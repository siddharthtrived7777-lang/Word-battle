import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db as firestoreDb,
  extractFirebaseError,
  handleFirestoreError,
  isFirestoreConfigured,
  OperationType,
} from '../firebase';
import type { PlayerAvatar, SignalPayload } from '../types/game';
import type {
  DrawMessageDoc,
  DrawPlayer,
  DrawRoomState,
  DrawSecretDoc,
  DrawSettings,
  DrawStrokeDoc,
  DrawTurnState,
} from '../types/drawGuess';
import {
  buildCloseVariants,
  buildHintMask,
  computeWordLengths,
  DRAW_WORD_PACK_META,
  hashDrawGuess,
  normalizeGuessText,
  pickDrawWordChoices,
} from '../data/drawWords';

const STORAGE_KEY_PREFIX = 'pa_draw_active_room_';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const DEFAULT_DRAW_SETTINGS: DrawSettings = {
  rounds: 3,
  drawTimeSec: 80,
  wordPack: 'all',
  hintsEnabled: true,
};

export function saveActiveDrawRoomCode(uid: string, code: string | null) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${uid}`;
    if (!code) localStorage.removeItem(key);
    else localStorage.setItem(key, code);
  } catch {
    // Ignore storage errors
  }
}

export function loadActiveDrawRoomCode(uid: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
  } catch {
    return null;
  }
}

function generateDrawCode(): string {
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function toMillis(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val && typeof (val as Timestamp).toMillis === 'function') {
    return (val as Timestamp).toMillis();
  }
  return Date.now();
}

function normalizeRoom(raw: Record<string, unknown>): DrawRoomState {
  const settingsRaw = (raw.settings || {}) as Partial<DrawSettings>;
  const players = (raw.players || {}) as Record<string, DrawPlayer>;
  const playerIds = Array.isArray(raw.playerIds)
    ? (raw.playerIds as string[])
    : Object.keys(players);

  return {
    code: String(raw.code || ''),
    hostId: String(raw.hostId || ''),
    phase: (raw.phase as DrawRoomState['phase']) || 'lobby',
    settings: {
      rounds: ([2, 3, 4, 5].includes(Number(settingsRaw.rounds))
        ? settingsRaw.rounds
        : DEFAULT_DRAW_SETTINGS.rounds) as DrawSettings['rounds'],
      drawTimeSec: ([60, 80, 100].includes(Number(settingsRaw.drawTimeSec))
        ? settingsRaw.drawTimeSec
        : DEFAULT_DRAW_SETTINGS.drawTimeSec) as DrawSettings['drawTimeSec'],
      wordPack: (settingsRaw.wordPack || DEFAULT_DRAW_SETTINGS.wordPack) as DrawSettings['wordPack'],
      hintsEnabled:
        typeof settingsRaw.hintsEnabled === 'boolean'
          ? settingsRaw.hintsEnabled
          : DEFAULT_DRAW_SETTINGS.hintsEnabled,
    },
    playerIds,
    players,
    usedWords: Array.isArray(raw.usedWords) ? (raw.usedWords as string[]) : [],
    turn: (raw.turn as DrawTurnState | null) ?? null,
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  };
}

export interface DrawRoomCallbacks {
  onRoom: (room: DrawRoomState | null) => void;
  onStrokes: (strokes: DrawStrokeDoc[]) => void;
  onMessages: (messages: DrawMessageDoc[]) => void;
  onSecret: (secret: DrawSecretDoc | null) => void;
  onSignal: (signal: SignalPayload) => void;
  onError?: (message: string) => void;
}

class DrawRoomService {
  private unsubs: Array<() => void> = [];
  private activeRoomCode: string | null = null;

  cleanup() {
    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.unsubs = [];
    this.activeRoomCode = null;
  }

  private ensureDb() {
    if (!isFirestoreConfigured()) {
      throw new Error('FIRESTORE_NOT_CONFIGURED');
    }
    return firestoreDb;
  }

  subscribe(roomCode: string, myUid: string, callbacks: DrawRoomCallbacks) {
    this.cleanup();
    const db = this.ensureDb();
    const code = roomCode.toUpperCase().trim();
    this.activeRoomCode = code;

    const roomPath = `draw_rooms/${code}`;
    const roomUnsub = onSnapshot(
      doc(db, 'draw_rooms', code),
      (snap) => {
        if (!snap.exists()) {
          callbacks.onRoom(null);
          return;
        }
        callbacks.onRoom(normalizeRoom(snap.data() as Record<string, unknown>));
      },
      (err) => {
        const info = extractFirebaseError(err);
        callbacks.onError?.(info.message);
        try {
          handleFirestoreError(err, OperationType.GET, roomPath);
        } catch {
          // Handled via callback
        }
      }
    );

    const strokesPath = `draw_rooms/${code}/strokes`;
    const strokesQuery = query(
      collection(db, 'draw_rooms', code, 'strokes'),
      where('recipientIds', 'array-contains', myUid)
    );
    const strokesUnsub = onSnapshot(
      strokesQuery,
      (snap) => {
        const items: DrawStrokeDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          items.push({
            id: String(d.id || docSnap.id),
            turnKey: String(d.turnKey || ''),
            canvasVersion: Number(d.canvasVersion || 0),
            drawerUid: String(d.drawerUid || ''),
            seq: Number(d.seq || 0),
            tool: (d.tool as DrawStrokeDoc['tool']) || 'pen',
            color: String(d.color || '#111827'),
            size: Number(d.size || 6),
            points: Array.isArray(d.points) ? (d.points as number[]) : [],
            recipientIds: Array.isArray(d.recipientIds) ? (d.recipientIds as string[]) : [],
            createdAt: toMillis(d.createdAt),
          });
        });
        items.sort((a, b) => a.seq - b.seq || a.createdAt - b.createdAt);
        callbacks.onStrokes(items);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, strokesPath);
        } catch {
          // Non-fatal listener error logged
        }
      }
    );

    const messagesPath = `draw_rooms/${code}/messages`;
    const messagesQuery = query(
      collection(db, 'draw_rooms', code, 'messages'),
      where('recipientIds', 'array-contains', myUid)
    );
    const messagesUnsub = onSnapshot(
      messagesQuery,
      (snap) => {
        const list: DrawMessageDoc[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: String(d.id || docSnap.id),
            turnKey: String(d.turnKey || ''),
            senderId: String(d.senderId || ''),
            senderName: String(d.senderName || 'Player'),
            kind: (d.kind as DrawMessageDoc['kind']) || 'guess',
            text: String(d.text || ''),
            points: typeof d.points === 'number' ? d.points : undefined,
            recipientIds: Array.isArray(d.recipientIds) ? (d.recipientIds as string[]) : [],
            timestamp: Number(d.timestamp || 0),
            createdAt: toMillis(d.createdAt),
          });
        });
        list.sort((a, b) => a.timestamp - b.timestamp || a.createdAt - b.createdAt);
        callbacks.onMessages(list.slice(-80));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, messagesPath);
        } catch {
          // Logged
        }
      }
    );

    const secretPath = `draw_rooms/${code}/secrets/${myUid}`;
    const secretUnsub = onSnapshot(
      doc(db, 'draw_rooms', code, 'secrets', myUid),
      (snap) => {
        if (!snap.exists()) {
          callbacks.onSecret(null);
          return;
        }
        const d = snap.data();
        callbacks.onSecret({
          ownerId: String(d.ownerId || myUid),
          turnKey: String(d.turnKey || ''),
          word: String(d.word || ''),
          choices: Array.isArray(d.choices) ? (d.choices as string[]) : [],
          updatedAt: toMillis(d.updatedAt),
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, secretPath);
        } catch {
          // Logged
        }
      }
    );

    const signalsPath = `draw_rooms/${code}/signals`;
    const signalsQuery = query(
      collection(db, 'draw_rooms', code, 'signals'),
      where('to', '==', myUid)
    );
    const signalsUnsub = onSnapshot(
      signalsQuery,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const d = change.doc.data();
          callbacks.onSignal({
            id: String(d.id || change.doc.id),
            from: String(d.from || ''),
            to: String(d.to || ''),
            type: d.type as SignalPayload['type'],
            data: d.data,
            timestamp: Number(d.timestamp || Date.now()),
          });
          deleteDoc(change.doc.ref).catch(() => {});
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, signalsPath);
        } catch {
          // Logged
        }
      }
    );

    this.unsubs = [roomUnsub, strokesUnsub, messagesUnsub, secretUnsub, signalsUnsub];
  }

  async createRoom(
    uid: string,
    playerName: string,
    avatar: PlayerAvatar
  ): Promise<DrawRoomState> {
    const db = this.ensureDb();
    const cleanName = playerName.trim().slice(0, 20) || 'Player';

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateDrawCode();
      const ref = doc(db, 'draw_rooms', code);
      try {
        const existing = await getDoc(ref);
        if (existing.exists()) continue;

        const now = Date.now();
        const hostPlayer: DrawPlayer = {
          id: uid,
          name: cleanName,
          avatar: { type: 'initials', color: avatar.color },
          isHost: true,
          connected: true,
          isMuted: false,
          score: 0,
          joinedAt: now,
        };

        await setDoc(ref, {
          code,
          hostId: uid,
          phase: 'lobby',
          settings: { ...DEFAULT_DRAW_SETTINGS },
          playerIds: [uid],
          players: { [uid]: hostPlayer },
          usedWords: [],
          turn: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        saveActiveDrawRoomCode(uid, code);
        return {
          code,
          hostId: uid,
          phase: 'lobby',
          settings: { ...DEFAULT_DRAW_SETTINGS },
          playerIds: [uid],
          players: { [uid]: hostPlayer },
          usedWords: [],
          turn: null,
          createdAt: now,
          updatedAt: now,
        };
      } catch (err) {
        const info = extractFirebaseError(err);
        if (info.code === 'permission-denied' && attempt < 7) {
          // Room code likely collided with an active non-member room; retry fresh code
          continue;
        }
        handleFirestoreError(err, OperationType.CREATE, `draw_rooms/${code}`);
      }
    }

    throw new Error('COULD_NOT_ALLOCATE_ROOM_CODE');
  }

  async joinRoom(
    rawCode: string,
    uid: string,
    playerName: string,
    avatar: PlayerAvatar
  ): Promise<DrawRoomState> {
    const db = this.ensureDb();
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (code.length !== 5) {
      throw new Error('INVALID_CODE');
    }

    const ref = doc(db, 'draw_rooms', code);
    const cleanName = playerName.trim().slice(0, 20) || 'Player';

    try {
      const joined = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          throw new Error('ROOM_NOT_FOUND');
        }
        const room = normalizeRoom(snap.data() as Record<string, unknown>);
        const alreadyIn = room.playerIds.includes(uid) || Boolean(room.players[uid]);

        if (!alreadyIn) {
          if (room.phase !== 'lobby') {
            throw new Error('GAME_IN_PROGRESS');
          }
          if (room.playerIds.length >= 10) {
            throw new Error('ROOM_FULL');
          }
          const newPlayer: DrawPlayer = {
            id: uid,
            name: cleanName,
            avatar: { type: 'initials', color: avatar.color },
            isHost: false,
            connected: true,
            isMuted: false,
            score: 0,
            joinedAt: Date.now(),
          };
          const nextIds = [...room.playerIds, uid];
          const nextPlayers = { ...room.players, [uid]: newPlayer };
          tx.update(ref, {
            playerIds: nextIds,
            players: nextPlayers,
            updatedAt: serverTimestamp(),
          });
          return { ...room, playerIds: nextIds, players: nextPlayers };
        }

        // Idempotent rejoin
        const existingPlayer = room.players[uid];
        const updatedPlayer: DrawPlayer = {
          ...existingPlayer,
          name: cleanName,
          avatar: { type: 'initials', color: avatar.color },
          connected: true,
        };
        const nextPlayers = { ...room.players, [uid]: updatedPlayer };
        tx.update(ref, {
          players: nextPlayers,
          updatedAt: serverTimestamp(),
        });
        return { ...room, players: nextPlayers };
      });

      saveActiveDrawRoomCode(uid, code);
      return joined;
    } catch (err) {
      if (
        err instanceof Error &&
        ['ROOM_NOT_FOUND', 'GAME_IN_PROGRESS', 'ROOM_FULL', 'INVALID_CODE'].includes(err.message)
      ) {
        throw err;
      }
      handleFirestoreError(err, OperationType.UPDATE, `draw_rooms/${code}`);
    }
  }

  async findRejoinableRoom(uid: string): Promise<DrawRoomState | null> {
    if (!isFirestoreConfigured()) return null;
    const db = this.ensureDb();
    const saved = loadActiveDrawRoomCode(uid);
    if (saved && saved.length === 5) {
      try {
        const snap = await getDoc(doc(db, 'draw_rooms', saved));
        if (snap.exists()) {
          const room = normalizeRoom(snap.data() as Record<string, unknown>);
          if (room.playerIds.includes(uid) && Date.now() - room.updatedAt < 4 * 60 * 60 * 1000) {
            return room;
          }
        }
      } catch {
        // Ignore stale saved room
      }
      saveActiveDrawRoomCode(uid, null);
    }

    try {
      const q = query(collection(db, 'draw_rooms'), where('playerIds', 'array-contains', uid));
      const snap = await getDocs(q);
      let newest: DrawRoomState | null = null;
      snap.forEach((docSnap) => {
        const r = normalizeRoom(docSnap.data() as Record<string, unknown>);
        if (Date.now() - r.updatedAt < 4 * 60 * 60 * 1000) {
          if (!newest || r.updatedAt > newest.updatedAt) newest = r;
        }
      });
      return newest;
    } catch {
      return null;
    }
  }

  async updateSettings(code: string, settings: DrawSettings): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        settings,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async startGame(code: string, room: DrawRoomState): Promise<void> {
    const db = this.ensureDb();
    const orderedIds = Object.values(room.players)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
      .map((p) => p.id);

    if (orderedIds.length < 2) {
      throw new Error('NEED_2_PLAYERS');
    }

    const resetPlayers: Record<string, DrawPlayer> = {};
    for (const [uid, p] of Object.entries(room.players)) {
      resetPlayers[uid] = { ...p, score: 0 };
    }

    const now = Date.now();
    const firstDrawer = orderedIds[0];
    const turnKey = `r1_t0_${now}`;
    const packMeta = DRAW_WORD_PACK_META[room.settings.wordPack];

    const turn: DrawTurnState = {
      roundNumber: 1,
      turnIndex: 0,
      turnOrder: orderedIds,
      drawerUid: firstDrawer,
      turnKey,
      packLabel: packMeta.labelEn,
      hintMask: '',
      wordLengths: [],
      wordHash: '',
      closeHashes: [],
      startedAt: now,
      deadlineAt: now + 18000,
      guessedBy: {},
      drawerPoints: 0,
      canvasVersion: 0,
      revealedWord: null,
    };

    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        phase: 'choosing_word',
        players: resetPlayers,
        usedWords: [],
        turn,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async ensureDrawerChoices(
    code: string,
    room: DrawRoomState,
    drawerUid: string
  ): Promise<string[]> {
    const db = this.ensureDb();
    const turnKey = room.turn?.turnKey;
    if (!turnKey) return [];

    const secretRef = doc(db, 'draw_rooms', code, 'secrets', drawerUid);
    const path = `draw_rooms/${code}/secrets/${drawerUid}`;
    try {
      const existing = await getDoc(secretRef);
      if (existing.exists()) {
        const d = existing.data();
        if (d.turnKey === turnKey && Array.isArray(d.choices) && d.choices.length > 0) {
          return d.choices as string[];
        }
      }
      const picked = pickDrawWordChoices(room.settings.wordPack, room.usedWords, 3);
      const choices = picked.map((entry) => entry.word);
      await setDoc(secretRef, {
        ownerId: drawerUid,
        turnKey,
        word: '',
        choices,
        updatedAt: serverTimestamp(),
      });
      return choices;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  async selectWord(
    code: string,
    room: DrawRoomState,
    drawerUid: string,
    chosenWord: string
  ): Promise<void> {
    const db = this.ensureDb();
    if (!room.turn || room.turn.drawerUid !== drawerUid) return;

    const cleanWord = chosenWord.trim().slice(0, 60);
    const turnKey = room.turn.turnKey;
    const norm = normalizeGuessText(cleanWord);
    const wordHash = await hashDrawGuess(code, turnKey, norm);
    const closeVariants = buildCloseVariants(cleanWord);
    const closeHashes = await Promise.all(
      closeVariants.map((variant) => hashDrawGuess(code, turnKey, variant))
    );

    const hintMask = buildHintMask(cleanWord, []);
    const wordLengths = computeWordLengths(cleanWord);
    const now = Date.now();
    const drawMs = room.settings.drawTimeSec * 1000;

    const secretPath = `draw_rooms/${code}/secrets/${drawerUid}`;
    try {
      await setDoc(doc(db, 'draw_rooms', code, 'secrets', drawerUid), {
        ownerId: drawerUid,
        turnKey,
        word: cleanWord,
        choices: [cleanWord],
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, secretPath);
    }

    const nextTurn: DrawTurnState = {
      ...room.turn,
      hintMask,
      wordLengths,
      wordHash,
      closeHashes,
      startedAt: now,
      deadlineAt: now + drawMs,
      guessedBy: {},
      drawerPoints: 0,
      canvasVersion: 0,
      revealedWord: null,
    };

    const nextUsed = Array.from(new Set([...room.usedWords, cleanWord])).slice(-150);
    const roomPath = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        phase: 'drawing',
        turn: nextTurn,
        usedWords: nextUsed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, roomPath);
    }
  }

  async publishHintMask(code: string, turn: DrawTurnState, hintMask: string): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        turn: { ...turn, hintMask },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async createStroke(
    code: string,
    stroke: Omit<DrawStrokeDoc, 'createdAt'>
  ): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}/strokes/${stroke.id}`;
    try {
      await setDoc(doc(db, 'draw_rooms', code, 'strokes', stroke.id), {
        ...stroke,
        points: stroke.points.slice(0, 1600),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  async updateStrokePoints(code: string, strokeId: string, points: number[]): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}/strokes/${strokeId}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code, 'strokes', strokeId), {
        points: points.slice(0, 1600),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async deleteStroke(code: string, strokeId: string): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}/strokes/${strokeId}`;
    try {
      await deleteDoc(doc(db, 'draw_rooms', code, 'strokes', strokeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  async clearCanvas(code: string, turn: DrawTurnState): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        turn: { ...turn, canvasVersion: turn.canvasVersion + 1 },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async submitGuess(
    code: string,
    room: DrawRoomState,
    senderUid: string,
    senderName: string,
    rawText: string
  ): Promise<{ status: 'correct' | 'close' | 'guess' | 'ignored'; points?: number }> {
    const trimmed = rawText.trim().slice(0, 120);
    if (!trimmed || !room.turn) return { status: 'ignored' };

    const turn = room.turn;
    const isDrawer = turn.drawerUid === senderUid;
    const alreadyGuessed = Boolean(turn.guessedBy[senderUid]);

    // Prevent active drawer or players who already solved it from leaking hints in chat during drawing
    if (room.phase === 'drawing' && (isDrawer || alreadyGuessed)) {
      return { status: 'ignored' };
    }

    const db = this.ensureDb();
    const norm = normalizeGuessText(trimmed);

    if (room.phase === 'drawing' && turn.wordHash && norm) {
      const guessHash = await hashDrawGuess(code, turn.turnKey, norm);

      if (guessHash === turn.wordHash) {
        const roomRef = doc(db, 'draw_rooms', code);
        let awardedPoints = 0;

        try {
          awardedPoints = await runTransaction(db, async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists()) return 0;
            const liveRoom = normalizeRoom(snap.data() as Record<string, unknown>);
            if (liveRoom.phase !== 'drawing' || !liveRoom.turn) return 0;
            if (liveRoom.turn.turnKey !== turn.turnKey) return 0;
            if (liveRoom.turn.guessedBy[senderUid]) return 0;

            const now = Date.now();
            const totalMs = Math.max(1000, liveRoom.settings.drawTimeSec * 1000);
            const remainingMs = Math.max(0, liveRoom.turn.deadlineAt - now);
            const ratio = Math.min(1, remainingMs / totalMs);
            const order = Object.keys(liveRoom.turn.guessedBy).length + 1;
            const firstBonus = order === 1 ? 40 : 0;
            const pts = 110 + Math.round(170 * ratio) + firstBonus;
            const drawerBonus = 45;

            const nextGuessedBy = {
              ...liveRoom.turn.guessedBy,
              [senderUid]: { guessedAt: now, points: pts, order },
            };

            const nextPlayers = { ...liveRoom.players };
            if (nextPlayers[senderUid]) {
              nextPlayers[senderUid] = {
                ...nextPlayers[senderUid],
                score: (nextPlayers[senderUid].score || 0) + pts,
              };
            }
            const drawerId = liveRoom.turn.drawerUid;
            if (nextPlayers[drawerId]) {
              nextPlayers[drawerId] = {
                ...nextPlayers[drawerId],
                score: (nextPlayers[drawerId].score || 0) + drawerBonus,
              };
            }

            tx.update(roomRef, {
              players: nextPlayers,
              turn: {
                ...liveRoom.turn,
                guessedBy: nextGuessedBy,
                drawerPoints: (liveRoom.turn.drawerPoints || 0) + drawerBonus,
              },
              updatedAt: serverTimestamp(),
            });
            return pts;
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `draw_rooms/${code}`);
        }

        if (awardedPoints > 0) {
          const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const msgPath = `draw_rooms/${code}/messages/${msgId}`;
          try {
            await setDoc(doc(db, 'draw_rooms', code, 'messages', msgId), {
              id: msgId,
              turnKey: turn.turnKey,
              senderId: senderUid,
              senderName: senderName.trim().slice(0, 40) || 'Player',
              kind: 'correct',
              text: 'guessed the word!',
              points: awardedPoints,
              recipientIds: room.playerIds,
              timestamp: Date.now(),
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, msgPath);
          }
          return { status: 'correct', points: awardedPoints };
        }
        return { status: 'ignored' };
      }

      if (turn.closeHashes.includes(guessHash)) {
        return { status: 'close' };
      }
    }

    // Normal guess chat message
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const msgPath = `draw_rooms/${code}/messages/${msgId}`;
    try {
      await setDoc(doc(db, 'draw_rooms', code, 'messages', msgId), {
        id: msgId,
        turnKey: turn.turnKey,
        senderId: senderUid,
        senderName: senderName.trim().slice(0, 40) || 'Player',
        kind: 'guess',
        text: trimmed,
        recipientIds: room.playerIds,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, msgPath);
    }
    return { status: 'guess' };
  }

  async revealTurn(
    code: string,
    room: DrawRoomState,
    revealedWord: string
  ): Promise<void> {
    if (!room.turn || room.phase !== 'drawing') return;
    const db = this.ensureDb();
    const now = Date.now();
    const safeWord = revealedWord.trim().slice(0, 60) || 'Hidden Word';
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        phase: 'turn_reveal',
        turn: {
          ...room.turn,
          revealedWord: safeWord,
          deadlineAt: now + 5500,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async advanceNextTurn(code: string, room: DrawRoomState): Promise<void> {
    if (!room.turn) return;
    const db = this.ensureDb();
    const path = `draw_rooms/${code}`;

    const activeOrder = room.turn.turnOrder.filter((id) => Boolean(room.players[id]));
    const fallbackOrder = Object.values(room.players)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
      .map((p) => p.id);
    const turnOrder = activeOrder.length > 0 ? activeOrder : fallbackOrder;

    if (turnOrder.length < 2) {
      try {
        await updateDoc(doc(db, 'draw_rooms', code), {
          phase: 'finished',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    const currentIdx = turnOrder.indexOf(room.turn.drawerUid);
    const nextIdx = currentIdx >= 0 ? currentIdx + 1 : room.turn.turnIndex + 1;

    let nextRound = room.turn.roundNumber;
    let resolvedIdx = nextIdx;

    if (resolvedIdx >= turnOrder.length) {
      nextRound += 1;
      resolvedIdx = 0;
    }

    if (nextRound > room.settings.rounds) {
      try {
        await updateDoc(doc(db, 'draw_rooms', code), {
          phase: 'finished',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
      return;
    }

    const now = Date.now();
    const nextDrawer = turnOrder[resolvedIdx];
    const packMeta = DRAW_WORD_PACK_META[room.settings.wordPack];

    const nextTurn: DrawTurnState = {
      roundNumber: nextRound,
      turnIndex: resolvedIdx,
      turnOrder,
      drawerUid: nextDrawer,
      turnKey: `r${nextRound}_t${resolvedIdx}_${now}`,
      packLabel: packMeta.labelEn,
      hintMask: '',
      wordLengths: [],
      wordHash: '',
      closeHashes: [],
      startedAt: now,
      deadlineAt: now + 18000,
      guessedBy: {},
      drawerPoints: 0,
      canvasVersion: 0,
      revealedWord: null,
    };

    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        phase: 'choosing_word',
        turn: nextTurn,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async backToLobby(code: string, room: DrawRoomState): Promise<void> {
    const db = this.ensureDb();
    const resetPlayers: Record<string, DrawPlayer> = {};
    for (const [uid, p] of Object.entries(room.players)) {
      resetPlayers[uid] = { ...p, score: 0 };
    }
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        phase: 'lobby',
        players: resetPlayers,
        turn: null,
        usedWords: [],
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  async setMute(code: string, uid: string, isMuted: boolean): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}`;
    try {
      await updateDoc(doc(db, 'draw_rooms', code), {
        [`players.${uid}.isMuted`]: isMuted,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal mute sync
    }
  }

  async sendSignal(code: string, signal: SignalPayload): Promise<void> {
    const db = this.ensureDb();
    const path = `draw_rooms/${code}/signals/${signal.id}`;
    try {
      await setDoc(doc(db, 'draw_rooms', code, 'signals', signal.id), {
        ...signal,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  async leaveRoom(code: string, uid: string): Promise<void> {
    saveActiveDrawRoomCode(uid, null);
    this.cleanup();
    if (!isFirestoreConfigured()) return;
    const db = this.ensureDb();
    const ref = doc(db, 'draw_rooms', code);

    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const room = normalizeRoom(snap.data() as Record<string, unknown>);
      const remainingIds = room.playerIds.filter((id) => id !== uid);

      if (remainingIds.length === 0) {
        await deleteDoc(ref);
        return;
      }

      const nextHostId = room.hostId === uid ? remainingIds[0] : room.hostId;
      const updates: Record<string, unknown> = {
        playerIds: remainingIds,
        [`players.${uid}`]: deleteField(),
        hostId: nextHostId,
        updatedAt: serverTimestamp(),
      };
      if (nextHostId !== room.hostId && room.players[nextHostId]) {
        updates[`players.${nextHostId}.isHost`] = true;
      }
      await updateDoc(ref, updates);
    } catch {
      // Ignore leave errors if room already removed
    }
  }

  getActiveRoomCode(): string | null {
    return this.activeRoomCode;
  }
}

export const drawRoomService = new DrawRoomService();
