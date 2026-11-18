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
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../firebaseConfig';
import {
  auth,
  db as firestoreDb,
  handleFirestoreError,
  isFirestoreConfigured,
  OperationType,
} from '../firebase';
import { ClueEntry, Player, RoomState, SignalPayload } from '../types/game';
import { getSortedPlayers } from '../utils/gameLogic';

export type TransportMode = 'firestore' | 'firebase' | 'sse';

export interface TransportCallbacks {
  onRoomUpdate: (room: RoomState | null) => void;
  onSignal: (signal: SignalPayload) => void;
  onError: (code: string) => void;
}

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toMillis(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

function isWordBattleRoomStale(raw: RoomState & { updatedAt?: unknown }): boolean {
  const lastTouch = Math.max(toMillis(raw.updatedAt ?? raw.createdAt), toMillis(raw.createdAt));
  const isExpired = Date.now() - lastTouch > ROOM_TTL_MS;
  const activePlayers = Object.values(raw.players ?? {}).filter(
    (p) => p && p.connected !== false
  );
  return isExpired || activePlayers.length === 0;
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
    createdAt: toMillis(raw.createdAt),
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
  private mode: TransportMode = isFirestoreConfigured()
    ? 'firestore'
    : isFirebaseConfigured()
      ? 'firebase'
      : 'sse';
  private fbApp: FirebaseApp | null = null;
  private fbDb: Database | null = null;
  private eventSource: EventSource | null = null;
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

    if (this.mode === 'firestore') {
      if (!auth.currentUser) {
        throw new Error('AUTH_REQUIRED');
      }
      const uid = auth.currentUser.uid;
      this.currentPlayerId = uid;
      const roomPath = `rooms/${room.code}`;
      const roomRef = doc(firestoreDb, 'rooms', room.code);

      const hostPlayer: Player = stripUndefined({
        ...player,
        id: uid,
        isHost: true,
      });

      const docPayload = {
        code: room.code,
        hostId: uid,
        phase: 'lobby' as const,
        settings: stripUndefined(room.settings),
        players: { [uid]: hostPlayer },
        usedPairIds: [],
        roundConfig: null,
        clues: [],
        votes: {},
        outcome: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await runTransaction(firestoreDb, async (tx) => {
          const snap = await tx.get(roomRef);
          if (snap.exists()) {
            const rawExisting = snap.data() as RoomState & { updatedAt?: unknown };
            if (isWordBattleRoomStale(rawExisting)) {
              tx.delete(roomRef);
            }
            throw new Error('ROOM_EXISTS');
          }
          tx.set(roomRef, docPayload);
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'ROOM_EXISTS') {
          throw error;
        }
        handleFirestoreError(error, OperationType.CREATE, roomPath);
      }

      this.attachFirestoreListeners(room.code, uid);
      return;
    }

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

    await this.createRoomViaSse(room, player);
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

    if (this.mode === 'firestore') {
      if (!auth.currentUser) {
        throw new Error('AUTH_REQUIRED');
      }
      const uid = auth.currentUser.uid;
      this.currentPlayerId = uid;
      const roomPath = `rooms/${code}`;
      const roomRef = doc(firestoreDb, 'rooms', code);

      let snap;
      try {
        snap = await getDoc(roomRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }

      if (!snap.exists()) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const rawExisting = snap.data() as RoomState & { updatedAt?: unknown };
      if (isWordBattleRoomStale(rawExisting)) {
        deleteDoc(roomRef).catch(() => {});
        throw new Error('ROOM_NOT_FOUND');
      }

      const existing = normalizeRoomState(rawExisting);
      const playerCount = Object.keys(existing.players).length;
      if (playerCount >= 10 && !existing.players[uid]) {
        throw new Error('ROOM_FULL');
      }
      if (existing.phase !== 'lobby' && !existing.players[uid]) {
        throw new Error('GAME_IN_PROGRESS');
      }

      const joinedPlayer: Player = stripUndefined({
        ...player,
        id: uid,
        isHost: existing.hostId === uid,
      });

      try {
        await updateDoc(roomRef, {
          [`players.${uid}`]: joinedPlayer,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }

      this.attachFirestoreListeners(code, uid);
      return;
    }

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

    await this.joinRoomViaSse(code, player);
  }

  private attachFirestoreListeners(code: string, playerId: string) {
    if (!auth.currentUser) return;

    const roomPath = `rooms/${code}`;
    const roomRef = doc(firestoreDb, 'rooms', code);

    const unsubRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          this.callbacks?.onRoomUpdate(null);
          return;
        }
        const room = normalizeRoomState(snapshot.data() as RoomState);
        const activePlayers = getSortedPlayers(room.players);

        if (activePlayers.length === 0) {
          this.callbacks?.onRoomUpdate(null);
          return;
        }

        if (!room.players[room.hostId]) {
          const nextHost = activePlayers[0];
          if (nextHost.id === playerId) {
            updateDoc(roomRef, {
              hostId: nextHost.id,
              [`players.${nextHost.id}.isHost`]: true,
              updatedAt: serverTimestamp(),
            }).catch((error) => handleFirestoreError(error, OperationType.UPDATE, roomPath));
          }
        }

        this.callbacks?.onRoomUpdate(room);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    const signalsPath = `rooms/${code}/signals`;
    const signalsQuery = query(
      collection(firestoreDb, 'rooms', code, 'signals'),
      where('to', '==', playerId)
    );

    const unsubSignals = onSnapshot(
      signalsQuery,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added') {
            const val = change.doc.data() as SignalPayload;
            this.callbacks?.onSignal(val);
            deleteDoc(change.doc.ref).catch(() => {});
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, signalsPath);
      }
    );

    const handlePageHide = () => {
      this.leaveRoom().catch(() => {});
    };

    window.addEventListener('pagehide', handlePageHide);

    this.unsubscribes.push(() => {
      unsubRoom();
      unsubSignals();
      window.removeEventListener('pagehide', handlePageHide);
    });
  }

  private async createRoomViaSse(room: RoomState, player: Player): Promise<void> {
    let res: Response;
    try {
      res = await fetch('/api/rooms', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, player }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`CONNECTION_FAILED:fetch:${detail}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsedCode = '';
      try {
        const parsed = JSON.parse(text) as { code?: string };
        parsedCode = parsed.code || '';
      } catch {
        // Non-JSON response
      }
      if (parsedCode === 'ROOM_EXISTS') {
        throw new Error('ROOM_EXISTS');
      }
      throw new Error(parsedCode || `CONNECTION_FAILED:HTTP_${res.status}`);
    }

    const data = (await res.json()) as { room: RoomState };
    this.mode = 'sse';
    this.callbacks?.onRoomUpdate(normalizeRoomState(data.room));
    this.attachSseListeners(room.code, player.id);
  }

  private async joinRoomViaSse(code: string, player: Player): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`CONNECTION_FAILED:fetch:${detail}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsedCode = '';
      try {
        const parsed = JSON.parse(text) as { code?: string };
        parsedCode = parsed.code || '';
      } catch {
        // Non-JSON response
      }
      if (
        parsedCode === 'ROOM_NOT_FOUND' ||
        parsedCode === 'ROOM_FULL' ||
        parsedCode === 'GAME_IN_PROGRESS'
      ) {
        throw new Error(parsedCode);
      }
      throw new Error(parsedCode || `CONNECTION_FAILED:HTTP_${res.status}`);
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

  public async updateRoom(
    patch: Partial<RoomState>,
    playerPatch?: Partial<Player>
  ): Promise<void> {
    if (!this.currentRoomCode || !this.currentPlayerId) return;

    if (this.mode === 'firestore') {
      const roomPath = `rooms/${this.currentRoomCode}`;
      const roomRef = doc(firestoreDb, 'rooms', this.currentRoomCode);
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      for (const [key, val] of Object.entries(patch)) {
        if (key === 'code' || key === 'createdAt') continue;
        updates[key] = val === undefined ? null : stripUndefined(val);
      }

      if (playerPatch) {
        for (const [key, val] of Object.entries(playerPatch)) {
          updates[`players.${this.currentPlayerId}.${key}`] = stripUndefined(val);
        }
      }

      try {
        await updateDoc(roomRef, updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      return;
    }

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

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/update`, {
      method: 'POST',
      credentials: 'same-origin',
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

    if (this.mode === 'firestore') {
      const roomPath = `rooms/${this.currentRoomCode}`;
      const roomRef = doc(firestoreDb, 'rooms', this.currentRoomCode);
      const updates: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      for (const [key, val] of Object.entries(patch)) {
        updates[`players.${playerId}.${key}`] = stripUndefined(val);
      }
      try {
        await updateDoc(roomRef, updates);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      return;
    }

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await update(ref(db, `rooms/${this.currentRoomCode}/players/${playerId}`), patch);
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/update`, {
      method: 'POST',
      credentials: 'same-origin',
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

    if (this.mode === 'firestore') {
      const roomPath = `rooms/${this.currentRoomCode}`;
      const roomRef = doc(firestoreDb, 'rooms', this.currentRoomCode);
      try {
        await updateDoc(roomRef, {
          clues: arrayUnion(stripUndefined(clue)),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      return;
    }

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await set(ref(db, `rooms/${this.currentRoomCode}/clues/${clue.id}`), clue);
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/clue`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clue }),
    });
  }

  public async castVote(targetId: string): Promise<void> {
    if (!this.currentRoomCode || !this.currentPlayerId) return;

    if (this.mode === 'firestore') {
      const roomPath = `rooms/${this.currentRoomCode}`;
      const roomRef = doc(firestoreDb, 'rooms', this.currentRoomCode);
      try {
        await updateDoc(roomRef, {
          [`votes.${this.currentPlayerId}`]: targetId,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
      return;
    }

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      await set(
        ref(db, `rooms/${this.currentRoomCode}/votes/${this.currentPlayerId}`),
        targetId
      );
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/vote`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: this.currentPlayerId,
        targetId,
      }),
    });
  }

  public async sendSignal(signal: Omit<SignalPayload, 'id' | 'timestamp'>): Promise<void> {
    if (!this.currentRoomCode) return;
    const sigId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullSignal: SignalPayload = {
      ...signal,
      id: sigId,
      timestamp: Date.now(),
    };

    if (this.mode === 'firestore') {
      if (!auth.currentUser) return;
      const sigPath = `rooms/${this.currentRoomCode}/signals/${sigId}`;
      const sigRef = doc(firestoreDb, 'rooms', this.currentRoomCode, 'signals', sigId);
      try {
        await setDoc(sigRef, {
          id: sigId,
          from: auth.currentUser.uid,
          to: signal.to,
          type: signal.type,
          data: stripUndefined(signal.data),
          timestamp: fullSignal.timestamp,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, sigPath);
      }
      return;
    }

    if (this.mode === 'firebase') {
      const db = this.getFirebaseDb();
      const targetSignalsRef = ref(db, `rooms/${this.currentRoomCode}/signals/${signal.to}`);
      await push(targetSignalsRef, fullSignal);
      return;
    }

    await fetch(`/api/rooms/${encodeURIComponent(this.currentRoomCode)}/signal`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: fullSignal }),
    }).catch(() => {});
  }

  public async leaveRoom(): Promise<void> {
    const code = this.currentRoomCode;
    const playerId = this.currentPlayerId;

    if (this.mode === 'firestore' && code && playerId) {
      const roomPath = `rooms/${code}`;
      const roomRef = doc(firestoreDb, 'rooms', code);
      try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          const room = normalizeRoomState(snap.data() as RoomState);
          const remaining = getSortedPlayers(room.players).filter((p) => p.id !== playerId);
          if (remaining.length === 0) {
            await deleteDoc(roomRef);
          } else if (room.hostId === playerId) {
            const nextHost = remaining[0];
            await updateDoc(roomRef, {
              [`players.${playerId}`]: deleteField(),
              hostId: nextHost.id,
              [`players.${nextHost.id}.isHost`]: true,
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(roomRef, {
              [`players.${playerId}`]: deleteField(),
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch {
        // Ignore errors when cleaning up on exit
      }
    } else if (this.mode === 'firebase' && code && playerId) {
      try {
        const db = this.getFirebaseDb();
        await remove(ref(db, `rooms/${code}/players/${playerId}`));
      } catch {
        // Ignore cleanup errors
      }
    } else if (code && playerId) {
      await fetch(`/api/rooms/${encodeURIComponent(code)}/leave`, {
        method: 'POST',
        credentials: 'same-origin',
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

    this.currentRoomCode = null;
    this.currentPlayerId = null;
    this.callbacks = null;
  }
}

export const roomTransport = new RoomTransport();
