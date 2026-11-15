import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db as firestoreDb,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AnimalHistoryEntry,
  AnimalPlayer,
  AnimalRoomState,
  AnimalSecret,
  AnimalTraitOption,
  PendingGuess,
  PendingQuestion,
  QuestionCategoryId,
} from '../types/animalGame';
import { SignalPayload } from '../types/game';
import { ANIMALS_BY_ID, evaluateTraitQuestion } from '../data/animals';

export interface AnimalRoomCallbacks {
  onRoomUpdate: (room: AnimalRoomState | null) => void;
  onSecretUpdate: (animalId: string | null) => void;
  onSignal: (signal: SignalPayload) => void;
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

function normalizeAnimalRoom(raw: AnimalRoomState): AnimalRoomState {
  return {
    ...raw,
    playerIds: Array.isArray(raw.playerIds) ? raw.playerIds : [],
    players: raw.players ?? {},
    askedCategoriesThisTurn: Array.isArray(raw.askedCategoriesThisTurn)
      ? raw.askedCategoriesThisTurn
      : [],
    pendingQuestion: raw.pendingQuestion ?? null,
    pendingGuess: raw.pendingGuess ?? null,
    history: Array.isArray(raw.history) ? raw.history : [],
    winnerUid: raw.winnerUid ?? null,
    revealedAnimals: raw.revealedAnimals ?? {},
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  };
}

const ACTIVE_ROOM_STORAGE_KEY = 'gta_active_room';

export function saveActiveAnimalRoomCode(uid: string, code: string | null) {
  try {
    if (code) {
      localStorage.setItem(`${ACTIVE_ROOM_STORAGE_KEY}_${uid}`, code);
    } else {
      localStorage.removeItem(`${ACTIVE_ROOM_STORAGE_KEY}_${uid}`);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedAnimalRoomCode(uid: string): string | null {
  try {
    return localStorage.getItem(`${ACTIVE_ROOM_STORAGE_KEY}_${uid}`);
  } catch {
    return null;
  }
}

export function loadFlippedIds(code: string, uid: string): string[] {
  try {
    const raw = localStorage.getItem(`gta_flipped_${code}_${uid}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFlippedIds(code: string, uid: string, ids: string[]) {
  try {
    localStorage.setItem(`gta_flipped_${code}_${uid}`, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

class AnimalRoomService {
  private unsubscribes: Array<() => void> = [];
  private currentRoomCode: string | null = null;
  private currentUid: string | null = null;
  private callbacks: AnimalRoomCallbacks | null = null;

  public async findActiveRejoinRoom(uid: string): Promise<AnimalRoomState | null> {
    if (!auth.currentUser) return null;
    const colPath = 'animal_rooms';
    try {
      const q = query(
        collection(firestoreDb, 'animal_rooms'),
        where('playerIds', 'array-contains', uid)
      );
      const snap = await getDocs(q);
      const rooms = snap.docs
        .map((d) => normalizeAnimalRoom(d.data() as AnimalRoomState))
        .filter((r) => r.playerIds.includes(uid))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const active = rooms.find((r) => r.phase !== 'finished') ?? rooms[0] ?? null;
      if (active) {
        saveActiveAnimalRoomCode(uid, active.code);
      } else {
        saveActiveAnimalRoomCode(uid, null);
      }
      return active;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  }

  public async createRoom(
    code: string,
    player: AnimalPlayer,
    callbacks: AnimalRoomCallbacks
  ): Promise<void> {
    this.cleanup();
    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');

    const uid = auth.currentUser.uid;
    const roomPath = `animal_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'animal_rooms', code);

    let snap;
    try {
      snap = await getDoc(roomRef);
    } catch (error) {
      // Permission denied on an existing 2-player room means that random code collides
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        throw new Error('ROOM_EXISTS');
      }
      handleFirestoreError(error, OperationType.GET, roomPath);
    }

    if (snap.exists()) {
      throw new Error('ROOM_EXISTS');
    }

    const hostPlayer: AnimalPlayer = stripUndefined({
      ...player,
      id: uid,
      isHost: true,
      connected: true,
      pickedSecret: false,
    });

    const payload = {
      code,
      hostId: uid,
      playerIds: [uid],
      players: { [uid]: hostPlayer },
      phase: 'lobby' as const,
      turnUid: null,
      askedCategoriesThisTurn: [],
      pendingQuestion: null,
      pendingGuess: null,
      history: [],
      winnerUid: null,
      revealedAnimals: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(roomRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, roomPath);
    }

    const secretPath = `animal_rooms/${code}/secrets/${uid}`;
    try {
      await setDoc(doc(firestoreDb, 'animal_rooms', code, 'secrets', uid), {
        ownerId: uid,
        animalId: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, secretPath);
    }

    this.currentRoomCode = code;
    this.currentUid = uid;
    this.callbacks = callbacks;
    saveActiveAnimalRoomCode(uid, code);
    this.attachListeners(code, uid);
  }

  public async joinRoom(
    rawCode: string,
    player: AnimalPlayer,
    callbacks: AnimalRoomCallbacks
  ): Promise<void> {
    this.cleanup();
    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');

    const code = rawCode.toUpperCase().trim();
    const uid = auth.currentUser.uid;
    const roomPath = `animal_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'animal_rooms', code);

    let snap;
    try {
      snap = await getDoc(roomRef);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        throw new Error('GTA_ROOM_FULL');
      }
      handleFirestoreError(error, OperationType.GET, roomPath);
    }

    if (!snap.exists()) {
      throw new Error('GTA_ROOM_NOT_FOUND');
    }

    const existing = normalizeAnimalRoom(snap.data() as AnimalRoomState);
    const isExistingMember = existing.playerIds.includes(uid);

    if (!isExistingMember) {
      if (existing.playerIds.length >= 2) {
        throw new Error('GTA_ROOM_FULL');
      }
      if (existing.phase !== 'lobby') {
        throw new Error('GTA_GAME_STARTED');
      }

      const joinedPlayer: AnimalPlayer = stripUndefined({
        ...player,
        id: uid,
        isHost: existing.hostId === uid,
        connected: true,
        pickedSecret: false,
      });

      try {
        await updateDoc(roomRef, {
          playerIds: arrayUnion(uid),
          [`players.${uid}`]: joinedPlayer,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }

      const secretPath = `animal_rooms/${code}/secrets/${uid}`;
      try {
        await setDoc(doc(firestoreDb, 'animal_rooms', code, 'secrets', uid), {
          ownerId: uid,
          animalId: 'pending',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, secretPath);
      }
    } else {
      // Rejoin existing 2-player room seamlessly
      try {
        await updateDoc(roomRef, {
          [`players.${uid}.connected`]: true,
          [`players.${uid}.name`]: player.name,
          [`players.${uid}.avatar`]: stripUndefined(player.avatar),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    }

    this.currentRoomCode = code;
    this.currentUid = uid;
    this.callbacks = callbacks;
    saveActiveAnimalRoomCode(uid, code);
    this.attachListeners(code, uid);
  }

  private attachListeners(code: string, uid: string) {
    const roomPath = `animal_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'animal_rooms', code);

    const unsubRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          saveActiveAnimalRoomCode(uid, null);
          this.callbacks?.onRoomUpdate(null);
          return;
        }
        const room = normalizeAnimalRoom(snapshot.data() as AnimalRoomState);
        this.callbacks?.onRoomUpdate(room);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    const secretPath = `animal_rooms/${code}/secrets/${uid}`;
    const secretRef = doc(firestoreDb, 'animal_rooms', code, 'secrets', uid);
    const unsubSecret = onSnapshot(
      secretRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          this.callbacks?.onSecretUpdate(null);
          return;
        }
        const data = snapshot.data() as AnimalSecret;
        this.callbacks?.onSecretUpdate(
          data.animalId && data.animalId !== 'pending' ? data.animalId : null
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, secretPath);
      }
    );

    const signalsPath = `animal_rooms/${code}/signals`;
    const signalsQuery = query(
      collection(firestoreDb, 'animal_rooms', code, 'signals'),
      where('to', '==', uid)
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

    this.unsubscribes.push(() => {
      unsubRoom();
      unsubSecret();
      unsubSignals();
    });
  }

  public async startMatch(code: string, room: AnimalRoomState): Promise<void> {
    if (room.playerIds.length !== 2) return;
    const roomPath = `animal_rooms/${code}`;
    const resetPlayers: Record<string, AnimalPlayer> = {};
    for (const pid of room.playerIds) {
      if (room.players[pid]) {
        resetPlayers[pid] = stripUndefined({
          ...room.players[pid],
          pickedSecret: false,
        });
      }
    }
    const firstTurn = room.playerIds[Math.floor(Math.random() * room.playerIds.length)];
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        phase: 'picking',
        players: resetPlayers,
        turnUid: firstTurn,
        askedCategoriesThisTurn: [],
        pendingQuestion: null,
        pendingGuess: null,
        history: [],
        winnerUid: null,
        revealedAnimals: {},
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async submitSecretAnimal(code: string, uid: string, animalId: string): Promise<void> {
    const secretPath = `animal_rooms/${code}/secrets/${uid}`;
    try {
      await setDoc(doc(firestoreDb, 'animal_rooms', code, 'secrets', uid), {
        ownerId: uid,
        animalId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, secretPath);
    }

    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        [`players.${uid}.pickedSecret`]: true,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async beginPlayingPhase(code: string): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        phase: 'playing',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async askQuestion(
    code: string,
    uid: string,
    category: QuestionCategoryId,
    option: AnimalTraitOption,
    askedCategoriesThisTurn: QuestionCategoryId[]
  ): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    const nextAsked = askedCategoriesThisTurn.includes(category)
      ? askedCategoriesThisTurn
      : [...askedCategoriesThisTurn, category];
    const pendingQuestion: PendingQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      byUid: uid,
      category,
      option,
    };
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        pendingQuestion,
        askedCategoriesThisTurn: nextAsked,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async resolvePendingQuestion(
    code: string,
    mySecretAnimalId: string,
    pendingQuestion: PendingQuestion,
    existingHistory: AnimalHistoryEntry[]
  ): Promise<void> {
    const animal = ANIMALS_BY_ID[mySecretAnimalId];
    if (!animal) return;

    const answer = evaluateTraitQuestion(
      animal,
      pendingQuestion.category,
      pendingQuestion.option
    );
    const entry: AnimalHistoryEntry = {
      id: pendingQuestion.id,
      byUid: pendingQuestion.byUid,
      kind: 'question',
      category: pendingQuestion.category,
      option: pendingQuestion.option,
      answer,
      createdAt: Date.now(),
    };
    const nextHistory = [...existingHistory, entry].slice(-80);
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        pendingQuestion: null,
        history: nextHistory,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async endTurn(code: string, currentTurnUid: string, playerIds: string[]): Promise<void> {
    const nextTurnUid = playerIds.find((id) => id !== currentTurnUid) ?? currentTurnUid;
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        turnUid: nextTurnUid,
        askedCategoriesThisTurn: [],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async submitGuess(code: string, uid: string, animalId: string): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    const pendingGuess: PendingGuess = {
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      byUid: uid,
      animalId,
    };
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        pendingGuess,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async resolvePendingGuess(
    code: string,
    myUid: string,
    mySecretAnimalId: string,
    pendingGuess: PendingGuess,
    existingHistory: AnimalHistoryEntry[]
  ): Promise<void> {
    const isCorrect = pendingGuess.animalId === mySecretAnimalId;
    const winnerUid = isCorrect ? pendingGuess.byUid : myUid;
    const entry: AnimalHistoryEntry = {
      id: pendingGuess.id,
      byUid: pendingGuess.byUid,
      kind: 'guess',
      animalId: pendingGuess.animalId,
      answer: isCorrect,
      createdAt: Date.now(),
    };
    const nextHistory = [...existingHistory, entry].slice(-80);
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        phase: 'finished',
        pendingGuess: null,
        winnerUid,
        history: nextHistory,
        [`revealedAnimals.${myUid}`]: mySecretAnimalId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async revealMySecretOnFinish(
    code: string,
    myUid: string,
    mySecretAnimalId: string
  ): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        [`revealedAnimals.${myUid}`]: mySecretAnimalId,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async playAgain(code: string, myUid: string, room: AnimalRoomState): Promise<void> {
    const secretPath = `animal_rooms/${code}/secrets/${myUid}`;
    try {
      await setDoc(doc(firestoreDb, 'animal_rooms', code, 'secrets', myUid), {
        ownerId: myUid,
        animalId: 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, secretPath);
    }

    const resetPlayers: Record<string, AnimalPlayer> = {};
    for (const pid of room.playerIds) {
      if (room.players[pid]) {
        resetPlayers[pid] = stripUndefined({
          ...room.players[pid],
          pickedSecret: false,
        });
      }
    }

    const firstTurn =
      room.playerIds[Math.floor(Math.random() * Math.max(1, room.playerIds.length))] ?? myUid;
    const nextPhase = room.playerIds.length === 2 ? 'picking' : 'lobby';
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        phase: nextPhase,
        players: resetPlayers,
        turnUid: firstTurn,
        askedCategoriesThisTurn: [],
        pendingQuestion: null,
        pendingGuess: null,
        history: [],
        winnerUid: null,
        revealedAnimals: {},
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async updateMuteState(code: string, uid: string, isMuted: boolean): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'animal_rooms', code), {
        [`players.${uid}.isMuted`]: isMuted,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore transient mute update errors
    }
  }

  public async sendSignal(
    code: string,
    signal: Omit<SignalPayload, 'id' | 'timestamp'>
  ): Promise<void> {
    if (!auth.currentUser) return;
    const sigId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sigPath = `animal_rooms/${code}/signals/${sigId}`;
    try {
      await setDoc(doc(firestoreDb, 'animal_rooms', code, 'signals', sigId), {
        id: sigId,
        from: auth.currentUser.uid,
        to: signal.to,
        type: signal.type,
        data: stripUndefined(signal.data),
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, sigPath);
    }
  }

  public async leaveRoom(code: string, uid: string): Promise<void> {
    const roomPath = `animal_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'animal_rooms', code);
    try {
      await deleteDoc(doc(firestoreDb, 'animal_rooms', code, 'secrets', uid)).catch(() => {});
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const room = normalizeAnimalRoom(snap.data() as AnimalRoomState);
        const remainingIds = room.playerIds.filter((id) => id !== uid);
        if (remainingIds.length === 0) {
          await deleteDoc(roomRef);
        } else {
          const nextHostId = room.hostId === uid ? remainingIds[0] : room.hostId;
          await updateDoc(roomRef, {
            playerIds: remainingIds,
            [`players.${uid}`]: deleteField(),
            hostId: nextHostId,
            [`players.${nextHostId}.isHost`]: true,
            phase: 'lobby',
            turnUid: null,
            askedCategoriesThisTurn: [],
            pendingQuestion: null,
            pendingGuess: null,
            revealedAnimals: {},
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch {
      // Ignore cleanup errors on exit
    } finally {
      saveActiveAnimalRoomCode(uid, null);
      this.cleanup();
    }
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.currentRoomCode = null;
    this.currentUid = null;
    this.callbacks = null;
  }
}

export const animalRoomService = new AnimalRoomService();
