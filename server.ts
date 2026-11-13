import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoomState, Player, SignalPayload } from './src/types/game.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Authoritative in-memory room state when running built-in WebSocket room server
const rooms = new Map<string, RoomState>();
// Map<roomCode, Map<playerId, WebSocket>>
const roomSockets = new Map<string, Map<string, WebSocket>>();

interface ClientMeta {
  roomCode: string;
  playerId: string;
}

const socketMeta = new WeakMap<WebSocket, ClientMeta>();

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
  const peers = roomSockets.get(roomCode);
  if (!room || !peers) return;

  const payload = JSON.stringify({ type: 'room_state', room: normalizeRoom(room) });
  for (const ws of peers.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function removePlayerFromRoom(roomCode: string, playerId: string) {
  const room = rooms.get(roomCode);
  const peers = roomSockets.get(roomCode);

  if (peers) {
    peers.delete(playerId);
    if (peers.size === 0) {
      roomSockets.delete(roomCode);
    }
  }

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

  // Also clean up votes & turn order if in active phase
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

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
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

        const patch = msg.patch as Partial<RoomState>;
        const playerPatch = msg.playerPatch as Partial<Player> | undefined;

        if (playerPatch && room.players[meta.playerId]) {
          room.players[meta.playerId] = {
            ...room.players[meta.playerId],
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
        const peers = roomSockets.get(meta.roomCode);
        const targetWs = peers?.get(signal.to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: 'signal', signal }));
        }
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
