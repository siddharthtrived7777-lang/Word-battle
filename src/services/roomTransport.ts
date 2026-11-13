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

export type TransportMode = 'firebase' | 'websocket' | 'sse';

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
  private preferSse = false;
  private fbApp: FirebaseApp | null = null;
  private fbDb: Database | null = null;
  private ws: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private currentRoomCode: string | null = null;
  private currentPlayerId: string | null = null;
  private callbacks: TransportCallbacks | null = null;
  private unsubscribes: Array<() => void> = [];
  private isLeaving = false;

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
    this.isLeaving = false;
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

    if (!this.preferSse) {
      try {
        await this.connectWebSocket({
          type: 'create_room',
          room,
          player,
        });
        this.mode = 'websocket';
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'ROOM_EXISTS') throw err;
        // WebSocket blocked or unavailable behind proxy — switch seamlessly to HTTP + SSE
        this.preferSse = true;
      }
    }

    await this.createRoomViaSse(room, player);
  }

  public async joinRoom(
    roomCode: string,
    player: Player,
    callbacks: TransportCallbacks
  ): Promise<void> {
    this.cleanup();
    this.isLeaving = false;
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

    if (!this.preferSse) {
      try {
        await this.connectWebSocket({
          type: 'join_room',
          roomCode: code,
          player,
        });
        this.mode = 'websocket';
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (
          msg === 'ROOM_NOT_FOUND' ||
          msg === 'ROOM_FULL' ||
          msg === 'GAME_IN_PROGRESS'
        ) {
          throw err;
        }
        this.preferSse = true;
      }
    }

    await this.joinRoomViaSse(code, player);
  }

  private async createRoomViaSse(room: RoomState, player: Player): Promise<void> {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, player }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.code || 'CONNECTION_FAILED');
    }

    const data = (await res.json()) as { room: RoomState };
    this.mode = 'sse';
    this.callbacks?.onRoomUpdate(normalizeRoomState(data.room));
    this.attachSseListeners(room.code, player.id);
  }

  private async joinRoomViaSse(code: string, player: Player): Promise<void> {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.code || 'CONNECTION_FAILED');
    }

    const data = (await res.json()) as { room: RoomState };
    this.mode = 'sse';
    this.callbacks?.onRoomUpdate(normalizeRoomState(data.room));
    this.attachSseListeners(code, player.id);
  }

  private attachSseListeners(code: string, playerId: string) {
    const url = `/api/rooms/${encodeURIComponent(code)}/events?playerId=${encodeURIComponent(playerId)}`;
    const es = new EventSource(url);
    this.eventSource = es;

    es.addEventListener('room_state', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as RoomState;
        this.callbacks?.onRoomUpdate(normalizeRoomState(parsed));
      } catch {
        // Ignore malformed frame
      }
    });

    es.addEventListener('signal', (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as SignalPayload;
        this.callbacks?.onSignal(parsed);
      } catch {
        // Ignore malformed frame
      }
    });

    const handlePageHide = () => {
      if (this.currentRoomCode && this.currentPlayerId && navigator.sendBeacon) {
        const blob = new Blob(
          [JSON.stringify({ playerId: this.currentPlayerId })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `/api/rooms/${encodeURIComponent(this.currentRoomCode)}/leave`,
          blob
        );
      }
    };

    window.addEventListener('pagehide', handlePageHide);
    this.unsubscribes.push(() => {
      window.removeEventListener('pagehide', handlePageHide);
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
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        reject(new Error('CONNECTION_FAILED'));
        return;
      }

      this.ws = ws;
      let settled = false;

      const connectTimer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ws.close();
          } catch {
            // Ignore
          }
          if (this.ws === ws) this.ws = null;
          reject(new Error('CONNECTION_FAILED'));
        }
      }, 1600);

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
          window.clearTimeout(connectTimer);
          const code = String(msg.code || 'UNKNOWN');
          if (!settled) {
            settled = true;
            this.ws = null;
            try {
              ws.close();
            } catch {
              // Ignore
            }
            reject(new Error(code));
          } else {
            this.callbacks?.onError(code);
          }
          return;
        }

        if (msg.type === 'room_state') {
          window.clearTimeout(connectTimer);
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
        window.clearTimeout(connectTimer);
        if (!settled) {
          settled = true;
          if (this.ws === ws) this.ws = null;
          reject(new Error('CONNECTION_FAILED'));
        }
      };

      ws.onclose = () => {
        window.clearTimeout(connectTimer);
        if (!settled) {
          settled = true;
          if (this.ws === ws) this.ws = null;
          reject(new Error('CONNECTION_FAILED'));
          return;
        }
        // If WS drops mid-session (e.g. proxy idle timeout), seamlessly switch to SSE!
        if (!this.isLeaving && this.currentRoomCode && this.currentPlayerId) {
          this.preferSse = true;
          this.mode = 'sse';
          this.attachSseListeners(this.currentRoomCode, this.currentPlayerId);
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

    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'update_room',
          patch,
          playerPatch,
        })
      );
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: this.currentPlayerId,
        patch,
        playerPatch,
      }),
    });
  }

  public async updatePlayer(playerId: string, patch: Partial<Player>): Promise<void> {
    if (!this.currentRoomCode) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await update(ref(db, `rooms/${this.currentRoomCode}/players/${playerId}`), patch);
      return;
    }

    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'update_room',
          patch: {},
          playerPatch: playerId === this.currentPlayerId ? patch : undefined,
        })
      );
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: this.currentPlayerId,
        patch: {},
        playerPatch: playerId === this.currentPlayerId ? patch : undefined,
      }),
    });
  }

  public async addClue(clue: ClueEntry): Promise<void> {
    if (!this.currentRoomCode) return;

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await set(ref(db, `rooms/${this.currentRoomCode}/clues/${clue.id}`), clue);
      return;
    }

    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'add_clue', clue }));
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/clue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clue }),
    });
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

    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cast_vote', targetId }));
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: this.currentPlayerId,
        targetId,
      }),
    });
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

    if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'send_signal', signal: fullSignal }));
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: fullSignal }),
    }).catch(() => {});
  }

  public async leaveRoom(): Promise<void> {
    this.isLeaving = true;
    const code = this.currentRoomCode;
    const playerId = this.currentPlayerId;

    if (this.mode === 'firebase' && code && playerId) {
      try {
        const db = this.getFirebaseDb();
        await remove(ref(db, `rooms/${code}/players/${playerId}`));
      } catch {
        // Ignore cleanup errors
      }
    } else if (this.mode === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'leave_room' }));
    } else if (code && playerId) {
      await fetch(`/api/rooms/${encodeURIComponent(code)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      }).catch(() => {});
    }

    this.cleanup();
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

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
