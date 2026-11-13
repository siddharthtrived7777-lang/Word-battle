import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  Database,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  off,
} from 'firebase/database';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../firebaseConfig';
import { ClueEntry, Player, RoomState, SignalPayload } from '../types/game';
import { getSortedPlayers } from '../utils/gameLogic';

export type TransportMode = 'firebase' | 'websocket';

export interface TransportCallbacks {
  onRoomUpdate: (room: RoomState | null) => void;
  onSignal: (signal: SignalPayload) => void;
  onError: (code: string) => void;
}

function normalizeRoomState(raw: RoomState): RoomState {
  const rawClues = raw.clues as unknown;
  let clues: ClueEntry[] = [];
  if (Array.isArray(rawClues)) {
    clues = rawClues;
  } else if (rawClues && typeof rawClues === 'object') {
    clues = Object.values(rawClues as Record<string, ClueEntry>).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  const rawUsed = raw.usedPairIds as unknown;
  const usedPairIds: string[] = Array.isArray(rawUsed)
    ? rawUsed
    : rawUsed && typeof rawUsed === 'object'
      ? Object.values(rawUsed as Record<string, string>)
      : [];

  return {
    ...raw,
    players: raw.players ?? {},
    usedPairIds,
    clues,
    votes: raw.votes ?? {},
    outcome: raw.outcome ?? null,
    roundConfig: raw.roundConfig
      ? {
          ...raw.roundConfig,
          imposterIds: raw.roundConfig.imposterIds ?? [],
          turnOrder: raw.roundConfig.turnOrder ?? [],
        }
      : null,
  };
}

class RoomTransport {
  private mode: TransportMode = isFirebaseConfigured() ? 'firebase' : 'websocket';
  private fbApp: FirebaseApp | null = null;
  private fbDb: Database | null = null;
  private ws: WebSocket | null = null;
  private currentRoomCode: string | null = null;
  private currentPlayerId: string | null = null;
  private callbacks: TransportCallbacks | null = null;
  private unsubscribes: Array<() => void> = [];

  public getMode(): TransportMode {
    return this.mode;
  }

  private getFirebaseDb(): Database {
    if (!this.fbDb) {
      this.fbApp = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      this.fbDb = getDatabase(this.fbApp);
    }
    return this.fbDb;
  }

  public async createRoom(
    room: RoomState,
    player: Player,
    callbacks: TransportCallbacks
  ): Promise<void> {
    this.cleanup();
    this.callbacks = callbacks;
    this.currentRoomCode = room.code;
    this.currentPlayerId = player.id;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      const roomRef = ref(db, `rooms/${room.code}`);
      const snap = await get(roomRef);
      if (snap.exists()) {
        throw new Error('ROOM_EXISTS');
      }
      await set(roomRef, room);
      this.attachFirebaseListeners(room.code, player.id);
      return;
    }

    await this.connectWebSocket({
      type: 'create_room',
      room,
      player,
    });
  }

  public async joinRoom(
    roomCode: string,
    player: Player,
    callbacks: TransportCallbacks
  ): Promise<void> {
    this.cleanup();
    const code = roomCode.toUpperCase().trim();
    this.callbacks = callbacks;
    this.currentRoomCode = code;
    this.currentPlayerId = player.id;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      const roomRef = ref(db, `rooms/${code}`);
      const snap = await get(roomRef);
      if (!snap.exists()) {
        throw new Error('ROOM_NOT_FOUND');
      }
      const existing = normalizeRoomState(snap.val() as RoomState);
      const playerCount = Object.keys(existing.players).length;
      if (playerCount >= 10 && !existing.players[player.id]) {
        throw new Error('ROOM_FULL');
      }
      if (existing.phase !== 'lobby' && !existing.players[player.id]) {
        throw new Error('GAME_IN_PROGRESS');
      }

      const playerRef = ref(db, `rooms/${code}/players/${player.id}`);
      await set(playerRef, {
        ...player,
        isHost: existing.hostId === player.id,
      });
      this.attachFirebaseListeners(code, player.id);
      return;
    }

    await this.connectWebSocket({
      type: 'join_room',
      roomCode: code,
      player,
    });
  }

  private attachFirebaseListeners(code: string, playerId: string) {
    const db = this.getFirebaseDb();
    const roomRef = ref(db, `rooms/${code}`);
    const myPlayerRef = ref(db, `rooms/${code}/players/${playerId}`);
    const signalsRef = ref(db, `rooms/${code}/signals/${playerId}`);

    onDisconnect(myPlayerRef).remove();

    const roomHandler = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.callbacks?.onRoomUpdate(null);
        return;
      }
      const room = normalizeRoomState(snapshot.val() as RoomState);

      // Automatic deterministic host migration on disconnect
      const activePlayers = getSortedPlayers(room.players);
      if (activePlayers.length === 0) {
        remove(roomRef).catch(() => {});
        this.callbacks?.onRoomUpdate(null);
        return;
      }

      if (!room.players[room.hostId]) {
        const nextHost = activePlayers[0];
        if (nextHost.id === playerId) {
          update(roomRef, {
            hostId: nextHost.id,
            [`players/${nextHost.id}/isHost`]: true,
          }).catch(() => {});
        }
      }

      this.callbacks?.onRoomUpdate(room);
    });

    const signalHandler = onChildAdded(signalsRef, (snapshot) => {
      const val = snapshot.val() as SignalPayload | null;
      if (val) {
        this.callbacks?.onSignal(val);
      }
      remove(snapshot.ref).catch(() => {});
    });

    this.unsubscribes.push(() => {
      off(roomRef, 'value', roomHandler);
      off(signalsRef, 'child_added', signalHandler);
    });
  }

  private connectWebSocket(initialMessage: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      let settled = false;

      ws.onopen = () => {
        ws.send(JSON.stringify(initialMessage));
      };

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'error') {
          const code = String(msg.code || 'UNKNOWN');
          if (!settled) {
            settled = true;
            this.cleanup();
            reject(new Error(code));
          } else {
            this.callbacks?.onError(code);
          }
          return;
        }

        if (msg.type === 'room_state') {
          if (!settled) {
            settled = true;
            resolve();
          }
          const room = normalizeRoomState(msg.room as RoomState);
          this.callbacks?.onRoomUpdate(room);
          return;
        }

        if (msg.type === 'signal') {
          this.callbacks?.onSignal(msg.signal as SignalPayload);
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error('CONNECTION_FAILED'));
        }
      };

      ws.onclose = () => {
        if (settled && this.currentRoomCode) {
          this.callbacks?.onError('DISCONNECTED');
        }
      };
    });
  }

  public async updateRoom(
    patch: Partial<RoomState>,
    playerPatch?: Partial<Player>
  ): Promise<void> {
    if (!this.currentRoomCode || !this.currentPlayerId) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      const updates: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(patch)) {
        updates[key] = val === undefined ? null : val;
      }
      if (playerPatch) {
        for (const [key, val] of Object.entries(playerPatch)) {
          updates[`players/${this.currentPlayerId}/${key}`] = val;
        }
      }
      await update(ref(db, `rooms/${this.currentRoomCode}`), updates);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'update_room',
          patch,
          playerPatch,
        })
      );
    }
  }

  public async updatePlayer(playerId: string, patch: Partial<Player>): Promise<void> {
    if (!this.currentRoomCode) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await update(ref(db, `rooms/${this.currentRoomCode}/players/${playerId}`), patch);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'update_room',
          patch: {},
          playerPatch: playerId === this.currentPlayerId ? patch : undefined,
        })
      );
    }
  }

  public async addClue(clue: ClueEntry): Promise<void> {
    if (!this.currentRoomCode) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await set(ref(db, `rooms/${this.currentRoomCode}/clues/${clue.id}`), clue);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'add_clue', clue }));
    }
  }

  public async castVote(targetId: string): Promise<void> {
    if (!this.currentRoomCode || !this.currentPlayerId) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await set(
        ref(db, `rooms/${this.currentRoomCode}/votes/${this.currentPlayerId}`),
        targetId
      );
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cast_vote', targetId }));
    }
  }

  public async sendSignal(signal: Omit<SignalPayload, 'id' | 'timestamp'>): Promise<void> {
    if (!this.currentRoomCode) return;
    const fullSignal: SignalPayload = {
      ...signal,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      const targetSignalsRef = ref(db, `rooms/${this.currentRoomCode}/signals/${signal.to}`);
      await push(targetSignalsRef, fullSignal);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_signal', signal: fullSignal }));
    }
  }

  public async leaveRoom(): Promise<void> {
    const code = this.currentRoomCode;
    const playerId = this.currentPlayerId;

    if (this.mode === 'firebase' && code && playerId) {
      try {
        const db = this.getFirebaseDb();
        await remove(ref(db, `rooms/${code}/players/${playerId}`));
      } catch {
        // Ignore cleanup errors
      }
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }));
    }

    this.cleanup();
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.currentRoomCode = null;
    this.currentPlayerId = null;
    this.callbacks = null;
  }
}

export const roomTransport = new RoomTransport();
