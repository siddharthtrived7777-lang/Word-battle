import express from 'express';
import type { Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoomState, Player, SignalPayload } from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number(process.argv[idx + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return Number(process.env.PORT || 3000);
}

const PORT = resolvePort();
const isProduction = process.env.NODE_ENV === 'production';

// Authoritative in-memory room state when running built-in room server
const rooms = new Map<string, RoomState>();
// Map<roomCode, Map<playerId, WebSocket>>
const roomSockets = new Map<string, Map<string, WebSocket>>();
// Map<roomCode, Map<playerId, Response>> for SSE fallback / primary HTTP transport
const roomSseClients = new Map<string, Map<string, Response>>();
// Grace timers for SSE reconnects before treating a drop as permanent disconnect
const disconnectTimers = new Map<string, NodeJS.Timeout>();

interface ClientMeta {
  roomCode: string;
  playerId: string;
}

const socketMeta = new WeakMap<WebSocket, ClientMeta>();

function timerKey(roomCode: string, playerId: string): string {
  return `${roomCode}:${playerId}`;
}

function clearDisconnectTimer(roomCode: string, playerId: string) {
  const key = timerKey(roomCode, playerId);
  const existing = disconnectTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    disconnectTimers.delete(key);
  }
}

function normalizeRoom(room: RoomState): RoomState {
  return {
    ...room,
    players: room.players ?? {},
    usedPairIds: room.usedPairIds ?? [],
    clues: room.clues ?? [],
    votes: room.votes ?? {},
  };
}

function broadcastRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const normalized = normalizeRoom(room);
  const wsPayload = JSON.stringify({ type: 'room_state', room: normalized });

  const peers = roomSockets.get(roomCode);
  if (peers) {
    for (const ws of peers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(wsPayload);
      }
    }
  }

  const ssePeers = roomSseClients.get(roomCode);
  if (ssePeers) {
    const sseFrame = `event: room_state\ndata: ${JSON.stringify(normalized)}\n\n`;
    for (const res of ssePeers.values()) {
      if (!res.writableEnded) {
        res.write(sseFrame);
      }
    }
  }
}

function deliverSignal(roomCode: string, signal: SignalPayload) {
  const peers = roomSockets.get(roomCode);
  const targetWs = peers?.get(signal.to);
  if (targetWs && targetWs.readyState === WebSocket.OPEN) {
    targetWs.send(JSON.stringify({ type: 'signal', signal }));
    return;
  }

  const ssePeers = roomSseClients.get(roomCode);
  const targetRes = ssePeers?.get(signal.to);
  if (targetRes && !targetRes.writableEnded) {
    targetRes.write(`event: signal\ndata: ${JSON.stringify(signal)}\n\n`);
  }
}

function removePlayerFromRoom(roomCode: string, playerId: string) {
  clearDisconnectTimer(roomCode, playerId);

  const peers = roomSockets.get(roomCode);
  if (peers) {
    peers.delete(playerId);
    if (peers.size === 0) {
      roomSockets.delete(roomCode);
    }
  }

  const ssePeers = roomSseClients.get(roomCode);
  if (ssePeers) {
    ssePeers.delete(playerId);
    if (ssePeers.size === 0) {
      roomSseClients.delete(roomCode);
    }
  }

  const room = rooms.get(roomCode);
  if (!room) return;

  delete room.players[playerId];
  const remaining = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
  );

  if (remaining.length === 0) {
    rooms.delete(roomCode);
    return;
  }

  // Migrate host if host left
  if (room.hostId === playerId || !room.players[room.hostId]) {
    const nextHost = remaining[0];
    room.hostId = nextHost.id;
    for (const p of remaining) {
      p.isHost = p.id === nextHost.id;
    }
  }

  // Clean up votes & turn order if in active phase
  if (room.votes && room.votes[playerId]) {
    delete room.votes[playerId];
  }
  if (room.roundConfig) {
    room.roundConfig.turnOrder = room.roundConfig.turnOrder.filter((id) => id !== playerId);
    if (room.roundConfig.currentTurnIndex >= room.roundConfig.turnOrder.length) {
      room.roundConfig.currentTurnIndex = 0;
    }
  }

  broadcastRoom(roomCode);
}

function applyRoomUpdate(
  room: RoomState,
  playerId: string,
  patch?: Partial<RoomState>,
  playerPatch?: Partial<Player>
) {
  if (playerPatch && room.players[playerId]) {
    room.players[playerId] = {
      ...room.players[playerId],
      ...playerPatch,
    };
  }

  if (patch) {
    if (patch.phase !== undefined) room.phase = patch.phase;
    if (patch.settings !== undefined) room.settings = patch.settings;
    if (patch.roundConfig !== undefined) room.roundConfig = patch.roundConfig;
    if (patch.usedPairIds !== undefined) room.usedPairIds = patch.usedPairIds;
    if (patch.clues !== undefined) room.clues = patch.clues;
    if (patch.votes !== undefined) room.votes = patch.votes;
    if (patch.outcome !== undefined) room.outcome = patch.outcome;
    if (patch.players !== undefined) room.players = patch.players;
    if (patch.hostId !== undefined) room.hostId = patch.hostId;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/ice-servers', (_req, res) => {
    const iceServers: Array<{
      urls: string | string[];
      username?: string;
      credential?: string;
    }> = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];

    const rawTurnUrls = (process.env.TURN_URLS || '').trim();
    const turnUsername = (process.env.TURN_USERNAME || '').trim();
    const turnCredential = (process.env.TURN_CREDENTIAL || '').trim();
    const hasTurn = Boolean(rawTurnUrls && turnUsername && turnCredential);

    if (hasTurn) {
      const urls = rawTurnUrls
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      if (urls.length > 0) {
        iceServers.push({
          urls,
          username: turnUsername,
          credential: turnCredential,
        });
      }
    }

    res.json({ iceServers, turnConfigured: hasTurn });
  });

  // HTTP + SSE endpoints (guaranteed to work across all proxies including Cloud Run iframes)
  app.post('/api/rooms', (req, res) => {
    const { room, player } = req.body as { room?: RoomState; player?: Player };
    if (!room || !player || !room.code) {
      res.status(400).json({ code: 'INVALID_REQUEST' });
      return;
    }
    const code = room.code.toUpperCase().trim();
    if (rooms.has(code)) {
      res.status(409).json({ code: 'ROOM_EXISTS' });
      return;
    }
    const freshRoom = normalizeRoom({
      ...room,
      code,
      players: { [player.id]: player },
    });
    rooms.set(code, freshRoom);
    res.json({ room: freshRoom });
  });

  app.post('/api/rooms/:code/join', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const { player } = req.body as { player?: Player };
    if (!player || !player.id) {
      res.status(400).json({ code: 'INVALID_REQUEST' });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ code: 'ROOM_NOT_FOUND' });
      return;
    }
    const existingCount = Object.keys(room.players).length;
    if (existingCount >= 10 && !room.players[player.id]) {
      res.status(409).json({ code: 'ROOM_FULL' });
      return;
    }
    if (room.phase !== 'lobby' && !room.players[player.id]) {
      res.status(409).json({ code: 'GAME_IN_PROGRESS' });
      return;
    }

    clearDisconnectTimer(code, player.id);
    room.players[player.id] = {
      ...player,
      isHost: room.hostId === player.id,
    };
    broadcastRoom(code);
    res.json({ room: normalizeRoom(room) });
  });

  app.get('/api/rooms/:code/events', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const playerId = String(req.query.playerId || '').trim();
    const room = rooms.get(code);
    if (!room || !playerId) {
      res.status(404).json({ code: 'ROOM_NOT_FOUND' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    clearDisconnectTimer(code, playerId);

    let ssePeers = roomSseClients.get(code);
    if (!ssePeers) {
      ssePeers = new Map();
      roomSseClients.set(code, ssePeers);
    }
    ssePeers.set(playerId, res);

    // Send immediate room snapshot
    res.write(`event: room_state\ndata: ${JSON.stringify(normalizeRoom(room))}\n\n`);

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keepalive\n\n');
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      const currentPeers = roomSseClients.get(code);
      if (currentPeers && currentPeers.get(playerId) === res) {
        currentPeers.delete(playerId);
      }
      // Give EventSource 6s to reconnect before removing player
      const key = timerKey(code, playerId);
      clearDisconnectTimer(code, playerId);
      const timeout = setTimeout(() => {
        disconnectTimers.delete(key);
        const stillSse = roomSseClients.get(code)?.has(playerId);
        const stillWs = roomSockets.get(code)?.has(playerId);
        if (!stillSse && !stillWs) {
          removePlayerFromRoom(code, playerId);
        }
      }, 6000);
      disconnectTimers.set(key, timeout);
    });
  });

  app.post('/api/rooms/:code/update', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ code: 'ROOM_NOT_FOUND' });
      return;
    }
    const { playerId, patch, playerPatch } = req.body as {
      playerId: string;
      patch?: Partial<RoomState>;
      playerPatch?: Partial<Player>;
    };
    applyRoomUpdate(room, playerId, patch, playerPatch);
    broadcastRoom(code);
    res.json({ ok: true });
  });

  app.post('/api/rooms/:code/clue', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ code: 'ROOM_NOT_FOUND' });
      return;
    }
    const { clue } = req.body as { clue: RoomState['clues'][number] };
    if (!room.clues) room.clues = [];
    if (clue && !room.clues.some((c) => c.id === clue.id)) {
      room.clues.push(clue);
    }
    broadcastRoom(code);
    res.json({ ok: true });
  });

  app.post('/api/rooms/:code/vote', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      res.status(404).json({ code: 'ROOM_NOT_FOUND' });
      return;
    }
    const { playerId, targetId } = req.body as { playerId: string; targetId: string };
    if (!room.votes) room.votes = {};
    if (playerId && targetId) {
      room.votes[playerId] = targetId;
    }
    broadcastRoom(code);
    res.json({ ok: true });
  });

  app.post('/api/rooms/:code/signal', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const { signal } = req.body as { signal: SignalPayload };
    if (signal) {
      deliverSignal(code, signal);
    }
    res.json({ ok: true });
  });

  app.post('/api/rooms/:code/leave', (req, res) => {
    const code = String(req.params.code || '').toUpperCase().trim();
    const { playerId } = req.body as { playerId?: string };
    if (playerId) {
      removePlayerFromRoom(code, playerId);
    }
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === 'create_room') {
        const room = msg.room as RoomState;
        const player = msg.player as Player;
        const code = room.code.toUpperCase();

        if (rooms.has(code)) {
          ws.send(JSON.stringify({ type: 'error', code: 'ROOM_EXISTS' }));
          return;
        }

        const freshRoom: RoomState = normalizeRoom({
          ...room,
          code,
          players: { [player.id]: player },
        });
        rooms.set(code, freshRoom);
        const peers = new Map<string, WebSocket>();
        peers.set(player.id, ws);
        roomSockets.set(code, peers);
        socketMeta.set(ws, { roomCode: code, playerId: player.id });
        broadcastRoom(code);
        return;
      }

      if (type === 'join_room') {
        const code = String(msg.roomCode || '').toUpperCase().trim();
        const player = msg.player as Player;
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', code: 'ROOM_NOT_FOUND' }));
          return;
        }

        const existingCount = Object.keys(room.players).length;
        if (existingCount >= 10 && !room.players[player.id]) {
          ws.send(JSON.stringify({ type: 'error', code: 'ROOM_FULL' }));
          return;
        }

        if (room.phase !== 'lobby' && !room.players[player.id]) {
          ws.send(JSON.stringify({ type: 'error', code: 'GAME_IN_PROGRESS' }));
          return;
        }

        clearDisconnectTimer(code, player.id);
        room.players[player.id] = {
          ...player,
          isHost: room.hostId === player.id,
        };

        let peers = roomSockets.get(code);
        if (!peers) {
          peers = new Map();
          roomSockets.set(code, peers);
        }
        peers.set(player.id, ws);
        socketMeta.set(ws, { roomCode: code, playerId: player.id });
        broadcastRoom(code);
        return;
      }

      if (type === 'update_room') {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        const room = rooms.get(meta.roomCode);
        if (!room) return;

        applyRoomUpdate(
          room,
          meta.playerId,
          msg.patch as Partial<RoomState>,
          msg.playerPatch as Partial<Player> | undefined
        );
        broadcastRoom(meta.roomCode);
        return;
      }

      if (type === 'add_clue') {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        const room = rooms.get(meta.roomCode);
        if (!room) return;
        const clue = msg.clue as RoomState['clues'][number];
        if (!room.clues) room.clues = [];
        if (!room.clues.some((c) => c.id === clue.id)) {
          room.clues.push(clue);
        }
        broadcastRoom(meta.roomCode);
        return;
      }

      if (type === 'cast_vote') {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        const room = rooms.get(meta.roomCode);
        if (!room) return;
        const targetId = String(msg.targetId || '');
        if (!room.votes) room.votes = {};
        room.votes[meta.playerId] = targetId;
        broadcastRoom(meta.roomCode);
        return;
      }

      if (type === 'send_signal') {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        const signal = msg.signal as SignalPayload;
        deliverSignal(meta.roomCode, signal);
        return;
      }

      if (type === 'leave_room') {
        const meta = socketMeta.get(ws);
        if (!meta) return;
        removePlayerFromRoom(meta.roomCode, meta.playerId);
        socketMeta.delete(ws);
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (meta) {
        removePlayerFromRoom(meta.roomCode, meta.playerId);
        socketMeta.delete(ws);
      }
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Imposter Word server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
