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
  CharadesDifficulty,
  CharadesMode,
  CharadesPhase,
  CharadesPlayer,
  CharadesPrivateMovie,
  CharadesPublicMovieMeta,
  CharadesRoomState,
  CharadesTeamId,
} from '../types/charades';
import { SignalPayload } from '../types/game';
import { splitMovieWords } from '../data/charadesMovies';

export interface CharadesRoomCallbacks {
  onRoomUpdate: (room: CharadesRoomState | null) => void;
  onPrivateMovieUpdate: (movie: CharadesPrivateMovie | null) => void;
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

function normalizeCharadesRoom(raw: CharadesRoomState): CharadesRoomState {
  return {
    ...raw,
    playerIds: Array.isArray(raw.playerIds) ? raw.playerIds : [],
    players: raw.players ?? {},
    teamNames: raw.teamNames ?? { A: 'Team A', B: 'Team B' },
    pausedFromPhase: raw.pausedFromPhase ?? null,
    roundNumber: typeof raw.roundNumber === 'number' ? raw.roundNumber : 0,
    actingTeam: raw.actingTeam ?? null,
    guessingTeam: raw.guessingTeam ?? null,
    actorIds: Array.isArray(raw.actorIds) ? raw.actorIds : [],
    movieGiverId: raw.movieGiverId ?? null,
    guesserIds: Array.isArray(raw.guesserIds) ? raw.guesserIds : [],
    movieMeta: raw.movieMeta ?? null,
    guessFeedback: raw.guessFeedback ?? { status: 'none', count: 0, updatedAt: 0 },
    revealedMovie: raw.revealedMovie ?? null,
    scores: raw.scores ?? { teamA: 0, teamB: 0, players: {} },
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  };
}

const CHARADES_ACTIVE_STORAGE_KEY = 'dc_active_room';

export function saveActiveCharadesRoomCode(uid: string, code: string | null) {
  try {
    if (code) {
      localStorage.setItem(`${CHARADES_ACTIVE_STORAGE_KEY}_${uid}`, code);
    } else {
      localStorage.removeItem(`${CHARADES_ACTIVE_STORAGE_KEY}_${uid}`);
    }
  } catch {
    // Ignore storage quota errors
  }
}

class CharadesRoomService {
  private unsubscribes: Array<() => void> = [];
  private callbacks: CharadesRoomCallbacks | null = null;
  private activeCode: string | null = null;
  private activeUid: string | null = null;

  public async findActiveRejoinRoom(uid: string): Promise<CharadesRoomState | null> {
    if (!auth.currentUser) return null;
    try {
      const q = query(
        collection(firestoreDb, 'charades_rooms'),
        where('playerIds', 'array-contains', uid)
      );
      const snap = await getDocs(q);
      const rooms = snap.docs
        .map((d) => normalizeCharadesRoom(d.data() as CharadesRoomState))
        .filter((r) => r.playerIds.includes(uid))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const active = rooms[0] ?? null;
      saveActiveCharadesRoomCode(uid, active ? active.code : null);
      return active;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'charades_rooms');
    }
  }

  public async createRoom(
    code: string,
    hostPlayer: CharadesPlayer,
    callbacks: CharadesRoomCallbacks
  ): Promise<void> {
    this.cleanup();
    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');

    const uid = auth.currentUser.uid;
    const roomPath = `charades_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'charades_rooms', code);

    let snap;
    try {
      snap = await getDoc(roomRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }

    if (snap.exists()) {
      throw new Error('ROOM_EXISTS');
    }

    const host: CharadesPlayer = stripUndefined({
      ...hostPlayer,
      id: uid,
      isHost: true,
      team: 'A',
      connected: true,
    });

    const payload = {
      code,
      hostId: uid,
      playerIds: [uid],
      players: { [uid]: host },
      mode: 'team' as CharadesMode,
      teamNames: { A: 'Team A', B: 'Team B' },
      phase: 'lobby' as CharadesPhase,
      pausedFromPhase: null,
      roundNumber: 0,
      actingTeam: 'A' as CharadesTeamId,
      guessingTeam: 'B' as CharadesTeamId,
      actorIds: [uid],
      movieGiverId: uid,
      guesserIds: [],
      movieMeta: null,
      guessFeedback: { status: 'none', count: 0, updatedAt: Date.now() },
      revealedMovie: null,
      scores: { teamA: 0, teamB: 0, players: { [uid]: 0 } },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(roomRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, roomPath);
    }

    this.activeCode = code;
    this.activeUid = uid;
    this.callbacks = callbacks;
    saveActiveCharadesRoomCode(uid, code);
    this.attachListeners(code, uid);
  }

  public async joinRoom(
    rawCode: string,
    player: CharadesPlayer,
    callbacks: CharadesRoomCallbacks
  ): Promise<void> {
    this.cleanup();
    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');

    const code = rawCode.toUpperCase().trim();
    const uid = auth.currentUser.uid;
    const roomPath = `charades_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'charades_rooms', code);

    let snap;
    try {
      snap = await getDoc(roomRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }

    if (!snap.exists()) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const existing = normalizeCharadesRoom(snap.data() as CharadesRoomState);
    const isExistingMember = existing.playerIds.includes(uid);

    if (!isExistingMember) {
      if (existing.playerIds.length >= 10) {
        throw new Error('ROOM_FULL');
      }

      const joined: CharadesPlayer = stripUndefined({
        ...player,
        id: uid,
        isHost: existing.hostId === uid,
        team: null,
        connected: true,
      });

      try {
        await updateDoc(roomRef, {
          playerIds: arrayUnion(uid),
          [`players.${uid}`]: joined,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    } else {
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

    this.activeCode = code;
    this.activeUid = uid;
    this.callbacks = callbacks;
    saveActiveCharadesRoomCode(uid, code);
    this.attachListeners(code, uid);
  }

  private attachListeners(code: string, uid: string) {
    const roomPath = `charades_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'charades_rooms', code);

    const unsubRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          saveActiveCharadesRoomCode(uid, null);
          this.callbacks?.onRoomUpdate(null);
          return;
        }
        const room = normalizeCharadesRoom(snapshot.data() as CharadesRoomState);

        // Host fallback if current host departed completely
        if (!room.playerIds.includes(room.hostId) && room.playerIds.length > 0) {
          const nextHostId = room.playerIds[0];
          if (nextHostId === uid) {
            updateDoc(roomRef, {
              hostId: nextHostId,
              [`players.${nextHostId}.isHost`]: true,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }

        this.callbacks?.onRoomUpdate(room);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      }
    );

    const privatePath = `charades_rooms/${code}/private_movie/${uid}`;
    const privateRef = doc(firestoreDb, 'charades_rooms', code, 'private_movie', uid);
    const unsubPrivate = onSnapshot(
      privateRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          this.callbacks?.onPrivateMovieUpdate(null);
          return;
        }
        this.callbacks?.onPrivateMovieUpdate(snapshot.data() as CharadesPrivateMovie);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, privatePath);
      }
    );

    const signalsPath = `charades_rooms/${code}/signals`;
    const signalsQuery = query(
      collection(firestoreDb, 'charades_rooms', code, 'signals'),
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

    const handlePageHide = () => {
      if (this.activeCode && this.activeUid) {
        updateDoc(doc(firestoreDb, 'charades_rooms', this.activeCode), {
          [`players.${this.activeUid}.connected`]: false,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', handlePageHide);

    this.unsubscribes.push(() => {
      unsubRoom();
      unsubPrivate();
      unsubSignals();
      window.removeEventListener('pagehide', handlePageHide);
    });
  }

  public async updateHostRoomPatch(
    code: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        ...stripUndefined(patch),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async startRoundSetup(
    code: string,
    room: CharadesRoomState,
    config: {
      actingTeam: CharadesTeamId | null;
      guessingTeam: CharadesTeamId | null;
      actorIds: string[];
      movieGiverId: string;
      guesserIds: string[];
    }
  ): Promise<void> {
    // Remove stale private_movie docs from previous round
    await Promise.all(
      room.playerIds.map((pid) =>
        deleteDoc(doc(firestoreDb, 'charades_rooms', code, 'private_movie', pid)).catch(() => {})
      )
    );

    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        phase: 'selecting_movie',
        pausedFromPhase: null,
        roundNumber: room.roundNumber + 1,
        actingTeam: config.actingTeam,
        guessingTeam: config.guessingTeam,
        actorIds: config.actorIds,
        movieGiverId: config.movieGiverId,
        guesserIds: config.guesserIds,
        movieMeta: null,
        guessFeedback: { status: 'none', count: 0, updatedAt: Date.now() },
        revealedMovie: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async assignMovie(
    code: string,
    giverUid: string,
    actorIds: string[],
    rawTitle: string,
    category: string,
    language: string,
    difficulty: CharadesDifficulty,
    hintsEnabled: boolean
  ): Promise<void> {
    const { cleanTitle, words, wordLengths } = splitMovieWords(rawTitle);
    if (!cleanTitle || words.length === 0) return;

    const recipients = Array.from(new Set([...actorIds, giverUid]));
    for (const targetUid of recipients) {
      const privatePath = `charades_rooms/${code}/private_movie/${targetUid}`;
      try {
        await setDoc(doc(firestoreDb, 'charades_rooms', code, 'private_movie', targetUid), {
          ownerId: targetUid,
          title: cleanTitle,
          words,
          category,
          language,
          difficulty,
          assignedBy: giverUid,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, privatePath);
      }
    }

    const movieMeta: CharadesPublicMovieMeta = {
      wordCount: words.length,
      wordLengths,
      completedWords: words.map(() => false),
      category,
      language,
      difficulty,
      hintsEnabled,
    };

    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        phase: 'acting',
        movieMeta,
        guessFeedback: { status: 'none', count: 0, updatedAt: Date.now() },
        revealedMovie: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async updateMovieMeta(
    code: string,
    movieMeta: CharadesPublicMovieMeta
  ): Promise<void> {
    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        movieMeta: stripUndefined(movieMeta),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async markWrongGuess(
    code: string,
    currentCount: number
  ): Promise<void> {
    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        guessFeedback: {
          status: 'wrong',
          count: currentCount + 1,
          updatedAt: Date.now(),
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async revealRoundMovie(
    code: string,
    room: CharadesRoomState,
    privateMovie: CharadesPrivateMovie,
    options: {
      outcome: 'guessed' | 'revealed';
      winnerUid?: string | null;
      winnerTeam?: CharadesTeamId | null;
      winnerName?: string;
    }
  ): Promise<void> {
    const nextScores = stripUndefined(room.scores);
    if (options.outcome === 'guessed') {
      if (room.mode === 'team') {
        const winningTeam = options.winnerTeam ?? room.guessingTeam;
        if (winningTeam === 'A') nextScores.teamA += 1;
        if (winningTeam === 'B') nextScores.teamB += 1;
      } else if (options.winnerUid) {
        nextScores.players[options.winnerUid] = (nextScores.players[options.winnerUid] ?? 0) + 1;
      }
      for (const actorId of room.actorIds) {
        if (room.mode === 'individual') {
          nextScores.players[actorId] = (nextScores.players[actorId] ?? 0) + 1;
        }
      }
    }

    const revealedMovie = {
      title: privateMovie.title,
      category: privateMovie.category,
      language: privateMovie.language,
      difficulty: privateMovie.difficulty,
      winnerUid: options.winnerUid ?? null,
      winnerTeam: options.winnerTeam ?? null,
      winnerName: options.winnerName ?? '',
      outcome: options.outcome,
    };

    const completedAll =
      room.movieMeta
        ? {
            ...room.movieMeta,
            completedWords: room.movieMeta.completedWords.map(() => true),
          }
        : null;

    const roomPath = `charades_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        phase: 'revealed',
        movieMeta: completedAll,
        guessFeedback: {
          status: options.outcome === 'guessed' ? 'correct' : 'none',
          count: room.guessFeedback.count,
          updatedAt: Date.now(),
        },
        revealedMovie,
        scores: nextScores,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async updateMediaState(
    code: string,
    uid: string,
    patch: Partial<Pick<CharadesPlayer, 'cameraEnabled' | 'micEnabled' | 'isMuted' | 'connected'>>
  ): Promise<void> {
    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [k, v] of Object.entries(patch)) {
      updates[`players.${uid}.${k}`] = v;
    }
    try {
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), updates);
    } catch {
      // Ignore transient media status sync errors
    }
  }

  public async removeDisconnectedPlayer(
    code: string,
    room: CharadesRoomState,
    targetUid: string
  ): Promise<void> {
    const nextIds = room.playerIds.filter((id) => id !== targetUid);
    const roomPath = `charades_rooms/${code}`;
    try {
      await deleteDoc(doc(firestoreDb, 'charades_rooms', code, 'private_movie', targetUid)).catch(() => {});
      await updateDoc(doc(firestoreDb, 'charades_rooms', code), {
        playerIds: nextIds,
        [`players.${targetUid}`]: deleteField(),
        actorIds: room.actorIds.filter((id) => id !== targetUid),
        guesserIds: room.guesserIds.filter((id) => id !== targetUid),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
  }

  public async sendSignal(
    code: string,
    signal: Omit<SignalPayload, 'id' | 'timestamp'>
  ): Promise<void> {
    if (!auth.currentUser) return;
    const sigId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sigPath = `charades_rooms/${code}/signals/${sigId}`;
    try {
      await setDoc(doc(firestoreDb, 'charades_rooms', code, 'signals', sigId), {
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
    const roomRef = doc(firestoreDb, 'charades_rooms', code);
    try {
      await deleteDoc(doc(firestoreDb, 'charades_rooms', code, 'private_movie', uid)).catch(() => {});
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const room = normalizeCharadesRoom(snap.data() as CharadesRoomState);
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
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch {
      // Ignore exit cleanup errors
    } finally {
      saveActiveCharadesRoomCode(uid, null);
      this.cleanup();
    }
  }

  public cleanup(): void {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    this.activeCode = null;
    this.activeUid = null;
    this.callbacks = null;
  }
}

export const charadesRoomService = new CharadesRoomService();
