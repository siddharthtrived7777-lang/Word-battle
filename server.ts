import express from 'express';
import type { Response } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type { RoomState, Player, SignalPayload, PlayerAvatar } from './src/types/game.ts';
import type {
  CardActionPayload,
  CardGameId,
  CardGameSettingsMap,
} from './src/types/cardGames.ts';
import {
  autoResolveTimedOutTurn,
  createEmptySatyoLanes,
  createInitialCardRoom,
  getPlayerLimits,
  serializeCardRoomForPlayer,
  startCardGame,
  validateAndApplyCardAction,
} from './server/cardGamesEngine.ts';
import type { CardRoomInternal } from './server/cardGamesEngine.ts';
import {
  FIREBASE_PROJECT_ID,
  verifyFirebaseBearerToken,
} from './server/firebaseAuthVerify.ts';

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

// Authoritative Playing Cards rooms (per-player private hand isolation)
const cardRooms = new Map<string, CardRoomInternal>();
const cardRoomSseClients = new Map<string, Map<string, Response>>();
const cardDisconnectTimers = new Map<string, NodeJS.Timeout>();

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

// ---------------- Playing Cards Helpers ----------------
function clearCardDisconnectTimer(roomCode: string, playerId: string) {
  const key = timerKey(roomCode, playerId);
  const existing = cardDisconnectTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    cardDisconnectTimers.delete(key);
  }
}

function broadcastCardRoom(roomCode: string) {
  const room = cardRooms.get(roomCode);
  if (!room) return;

  const ssePeers = cardRoomSseClients.get(roomCode);
  if (!ssePeers) return;

  for (const [viewerUid, res] of ssePeers.entries()) {
    if (!res.writableEnded) {
      const personalized = serializeCardRoomForPlayer(room, viewerUid);
      res.write(`event: card_room_state\ndata: ${JSON.stringify(personalized)}\n\n`);
    }
  }
}

function deliverCardSignal(roomCode: string, signal: SignalPayload) {
  const ssePeers = cardRoomSseClients.get(roomCode);
  const targetRes = ssePeers?.get(signal.to);
  if (targetRes && !targetRes.writableEnded) {
    targetRes.write(`event: card_signal\ndata: ${JSON.stringify(signal)}\n\n`);
  }
}

function handleCardPlayerLeave(roomCode: string, playerId: string, permanent: boolean) {
  clearCardDisconnectTimer(roomCode, playerId);

  if (permanent) {
    const ssePeers = cardRoomSseClients.get(roomCode);
    if (ssePeers) {
      ssePeers.delete(playerId);
      if (ssePeers.size === 0) {
        cardRoomSseClients.delete(roomCode);
      }
    }
  }

  const room = cardRooms.get(roomCode);
  if (!room) return;

  if (!permanent && room.phase === 'playing') {
    if (room.players[playerId]) {
      room.players[playerId].connected = false;
      room.updatedAt = Date.now();
    }
    broadcastCardRoom(roomCode);
    return;
  }

  delete room.players[playerId];
  delete room.hands[playerId];
  room.playerOrder = room.playerOrder.filter((id) => id !== playerId);

  const remaining = Object.values(room.players).sort(
    (a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)
  );

  if (remaining.length === 0) {
    cardRooms.delete(roomCode);
    cardRoomSseClients.delete(roomCode);
    return;
  }

  if (room.hostId === playerId || !room.players[room.hostId]) {
    const nextHost = remaining[0];
    room.hostId = nextHost.id;
    for (const p of remaining) {
      p.isHost = p.id === nextHost.id;
    }
  }

  if (room.phase === 'playing' && room.playerOrder.length < 2) {
    room.phase = 'lobby';
    room.turnDeadlineAt = null;
    room.outcome = null;
    room.deck = [];
    room.discardUno = [];
    room.stackMongoose = [];
    room.satyoLanes = createEmptySatyoLanes();
    for (const p of remaining) {
      p.ready = false;
      p.safe = false;
      p.saidUno = false;
      room.hands[p.id] = [];
    }
  } else if (room.turnIndex >= room.playerOrder.length) {
    room.turnIndex = 0;
  }

  room.updatedAt = Date.now();
  broadcastCardRoom(roomCode);
}

async function resolveCardCallerUid(
  req: express.Request,
  fallbackPlayerId?: string
): Promise<string> {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const token = bearerToken || queryToken;

  if (FIREBASE_PROJECT_ID) {
    const caller = await verifyFirebaseBearerToken(token);
    if (!caller?.uid) {
      throw new Error('AUTH_REQUIRED');
    }
    return caller.uid;
  }

  const candidate = String(fallbackPlayerId || '').trim();
  if (!candidate) {
    throw new Error('AUTH_REQUIRED');
  }
  return candidate;
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

  // ---------------- Playing Cards Authoritative Endpoints ----------------
  app.post('/api/card-rooms', async (req, res) => {
    try {
      const { code: rawCode, selectedGame, player } = req.body as {
        code?: string;
        selectedGame?: CardGameId;
        player?: { id?: string; name?: string; avatar?: PlayerAvatar };
      };
      const uid = await resolveCardCallerUid(req, player?.id);
      const code = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      if (code.length !== 5 || !player?.name || !player?.avatar) {
        res.status(400).json({ code: 'INVALID_REQUEST' });
        return;
      }
      const existingRoom = cardRooms.get(code);
      if (existingRoom) {
        if (existingRoom.players[uid]) {
          existingRoom.players[uid].connected = true;
          if (player.name.trim()) {
            existingRoom.players[uid].name = player.name.trim().slice(0, 20);
          }
          if (player.avatar) {
            existingRoom.players[uid].avatar = player.avatar;
          }
          existingRoom.updatedAt = Date.now();
          broadcastCardRoom(code);
          res.json({ state: serializeCardRoomForPlayer(existingRoom, uid) });
          return;
        }
        res.status(409).json({ code: 'ROOM_EXISTS' });
        return;
      }

      const validGames: CardGameId[] = ['uno', 'satyo', 'mongoose', 'gadha_chor'];
      const gameId: CardGameId =
        selectedGame && validGames.includes(selectedGame) ? selectedGame : 'uno';

      const room = createInitialCardRoom(
        code,
        { id: uid, name: player.name.trim().slice(0, 20) || 'Player', avatar: player.avatar },
        gameId
      );
      cardRooms.set(code, room);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(codeErr.includes('AUTH') ? 401 : 400).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/join', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { player } = req.body as {
        player?: { id?: string; name?: string; avatar?: PlayerAvatar };
      };
      const uid = await resolveCardCallerUid(req, player?.id);
      const room = cardRooms.get(code);
      if (!room) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }

      const existing = room.players[uid];
      const limits = getPlayerLimits(room.selectedGame);
      if (!existing) {
        if (room.phase !== 'lobby') {
          res.status(409).json({ code: 'GAME_IN_PROGRESS' });
          return;
        }
        if (Object.keys(room.players).length >= limits.max) {
          res.status(409).json({ code: 'ROOM_FULL' });
          return;
        }
        if (!player?.name || !player?.avatar) {
          res.status(400).json({ code: 'INVALID_REQUEST' });
          return;
        }
        room.players[uid] = {
          id: uid,
          name: player.name.trim().slice(0, 20) || 'Player',
          avatar: player.avatar,
          isHost: room.hostId === uid,
          ready: false,
          connected: true,
          isMuted: false,
          joinedAt: Date.now(),
          score: 0,
          safe: false,
          saidUno: false,
        };
        if (!room.playerOrder.includes(uid)) {
          room.playerOrder.push(uid);
        }
      } else {
        existing.connected = true;
        if (player?.name) existing.name = player.name.trim().slice(0, 20) || existing.name;
        if (player?.avatar) existing.avatar = player.avatar;
      }

      clearCardDisconnectTimer(code, uid);
      room.updatedAt = Date.now();
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(codeErr.includes('AUTH') ? 401 : 400).json({ code: codeErr });
    }
  });

  app.get('/api/card-rooms/:code', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const uid = await resolveCardCallerUid(
        req,
        typeof req.query.playerId === 'string' ? req.query.playerId : undefined
      );
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(401).json({ code: codeErr });
    }
  });

  app.get('/api/card-rooms/:code/events', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const uid = await resolveCardCallerUid(
        req,
        typeof req.query.playerId === 'string' ? req.query.playerId : undefined
      );
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      clearCardDisconnectTimer(code, uid);
      room.players[uid].connected = true;

      let ssePeers = cardRoomSseClients.get(code);
      if (!ssePeers) {
        ssePeers = new Map();
        cardRoomSseClients.set(code, ssePeers);
      }
      ssePeers.set(uid, res);

      // Push caller-only state immediately and inform peers of connected status
      res.write(
        `event: card_room_state\ndata: ${JSON.stringify(serializeCardRoomForPlayer(room, uid))}\n\n`
      );
      broadcastCardRoom(code);

      const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        const currentPeers = cardRoomSseClients.get(code);
        if (currentPeers && currentPeers.get(uid) === res) {
          currentPeers.delete(uid);
        }

        const key = timerKey(code, uid);
        clearCardDisconnectTimer(code, uid);
        const timeout = setTimeout(() => {
          cardDisconnectTimers.delete(key);
          const stillSse = cardRoomSseClients.get(code)?.has(uid);
          if (!stillSse) {
            const currentRoom = cardRooms.get(code);
            if (!currentRoom) return;
            handleCardPlayerLeave(code, uid, currentRoom.phase === 'lobby');
          }
        }, 8000);
        cardDisconnectTimers.set(key, timeout);
      });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(401).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/ready', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { ready, playerId } = req.body as { ready?: boolean; playerId?: string };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      room.players[uid].ready = Boolean(ready);
      room.updatedAt = Date.now();
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(401).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/config', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { selectedGame, settings, playerId } = req.body as {
        selectedGame?: CardGameId;
        settings?: Partial<CardGameSettingsMap>;
        playerId?: string;
      };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (room.hostId !== uid) {
        res.status(403).json({ code: 'HOST_ONLY' });
        return;
      }
      if (room.phase !== 'lobby') {
        res.status(409).json({ code: 'GAME_ALREADY_STARTED' });
        return;
      }

      if (selectedGame && ['uno', 'satyo', 'mongoose', 'gadha_chor'].includes(selectedGame)) {
        room.selectedGame = selectedGame;
      }
      if (settings) {
        if (settings.uno) room.settings.uno = { ...room.settings.uno, ...settings.uno };
        if (settings.satyo) room.settings.satyo = { ...room.settings.satyo, ...settings.satyo };
        if (settings.mongoose) {
          room.settings.mongoose = { ...room.settings.mongoose, ...settings.mongoose };
        }
        if (settings.gadha_chor) {
          room.settings.gadha_chor = { ...room.settings.gadha_chor, ...settings.gadha_chor };
        }
      }
      room.updatedAt = Date.now();
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'AUTH_REQUIRED';
      res.status(401).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/start', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { playerId } = req.body as { playerId?: string };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (room.hostId !== uid) {
        res.status(403).json({ code: 'HOST_ONLY' });
        return;
      }
      startCardGame(room);
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'START_FAILED';
      res.status(400).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/action', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { action, playerId } = req.body as {
        action?: CardActionPayload;
        playerId?: string;
      };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (!action || typeof action.type !== 'string') {
        res.status(400).json({ code: 'INVALID_ACTION' });
        return;
      }
      validateAndApplyCardAction(room, uid, action);
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'ACTION_REJECTED';
      res.status(400).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/play-again', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { mode, playerId } = req.body as {
        mode?: 'lobby' | 'redeal';
        playerId?: string;
      };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (!room || !room.players[uid]) {
        res.status(404).json({ code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (room.hostId !== uid) {
        res.status(403).json({ code: 'HOST_ONLY' });
        return;
      }

      if (mode === 'redeal') {
        startCardGame(room);
      } else {
        room.phase = 'lobby';
        room.turnDeadlineAt = null;
        room.outcome = null;
        room.deck = [];
        room.discardUno = [];
        room.stackMongoose = [];
        room.satyoLanes = createEmptySatyoLanes();
        for (const p of Object.values(room.players)) {
          p.ready = false;
          p.safe = false;
          p.saidUno = false;
          p.lastActionText = undefined;
          room.hands[p.id] = [];
        }
        room.updatedAt = Date.now();
      }
      broadcastCardRoom(code);
      res.json({ state: serializeCardRoomForPlayer(room, uid) });
    } catch (err) {
      const codeErr = err instanceof Error ? err.message : 'RESET_FAILED';
      res.status(400).json({ code: codeErr });
    }
  });

  app.post('/api/card-rooms/:code/mute', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { isMuted, playerId } = req.body as { isMuted?: boolean; playerId?: string };
      const uid = await resolveCardCallerUid(req, playerId);
      const room = cardRooms.get(code);
      if (room && room.players[uid]) {
        room.players[uid].isMuted = Boolean(isMuted);
        room.updatedAt = Date.now();
        broadcastCardRoom(code);
      }
      res.json({ ok: true });
    } catch {
      res.status(401).json({ code: 'AUTH_REQUIRED' });
    }
  });

  app.post('/api/card-rooms/:code/signal', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { signal, playerId } = req.body as {
        signal?: SignalPayload;
        playerId?: string;
      };
      const uid = await resolveCardCallerUid(req, playerId);
      if (signal) {
        deliverCardSignal(code, { ...signal, from: uid });
      }
      res.json({ ok: true });
    } catch {
      res.status(401).json({ code: 'AUTH_REQUIRED' });
    }
  });

  app.post('/api/card-rooms/:code/leave', async (req, res) => {
    try {
      const code = String(req.params.code || '').toUpperCase().trim();
      const { playerId } = req.body as { playerId?: string };
      const uid = await resolveCardCallerUid(req, playerId);
      handleCardPlayerLeave(code, uid, true);
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // Periodic turn-timer check + stale card room sweep
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of cardRooms.entries()) {
      if (now - room.updatedAt > 6 * 60 * 60 * 1000) {
        cardRooms.delete(code);
        cardRoomSseClients.delete(code);
        continue;
      }
      if (room.phase === 'playing' && autoResolveTimedOutTurn(room)) {
        broadcastCardRoom(code);
      }
    }
  }, 1000);

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
