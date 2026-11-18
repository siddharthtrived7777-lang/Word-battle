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
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db as firestoreDb,
  extractFirebaseError,
  handleFirestoreError,
  isFirestoreConfigured,
  OperationType,
} from '../firebase';
import type {
  CardActionPayload,
  CardDeckFirestoreDoc,
  CardGameId,
  CardGameOutcome,
  CardGameSettingsMap,
  CardHandFirestoreDoc,
  CardItem,
  CardLogEntry,
  CardPlayerPublic,
  CardRoomClientState,
  CardRoomFirestoreDoc,
  CardTablePublicState,
  CardTransferFirestoreDoc,
  JokerCard,
  StandardCard,
  UnoCard,
} from '../types/cardGames';
import type { PlayerAvatar, SignalPayload } from '../types/game';
import {
  areGadhaCardsPair,
  buildGadhaChorDeck,
  buildStandardDeck,
  buildUnoDeck,
  cloneDefaultCardSettings,
  createEmptySatyoLanes,
  decideCardRoomCreateConflict,
  decideCardRoomJoinAction,
  findNextGadhaTurnIndex,
  formatCardName,
  getCardGamePlayerLimits,
  getCardGameTimerSeconds,
  getGadhaTargetUidFromCounts,
  isCardRoomExpired,
  isMongoosePlayLegal,
  isSatyoCardPlayable,
  isUnoCardPlayable,
  isValidCardRoomCodeFormat,
  sanitizeCardRoomCode,
  shuffleCardArray,
  sortCardHand,
  stepCardTurnIndex,
  stripGadhaPairs,
  SUITS,
} from '../utils/cardGamesClientLogic';

export interface CardRoomCallbacks {
  onState: (state: CardRoomClientState) => void;
  onSignal: (signal: SignalPayload) => void;
  onError?: (code: string) => void;
}

const STORAGE_KEY_PREFIX = 'pa_cards_active_room_';

export function saveActiveCardRoomCode(uid: string, code: string | null) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${uid}`;
    if (!code) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, code);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadActiveCardRoomCode(uid: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
  } catch {
    return null;
  }
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

interface NormalizedCardRoom {
  code: string;
  hostId: string;
  selectedGame: CardGameId;
  phase: 'lobby' | 'playing' | 'finished';
  settings: CardGameSettingsMap;
  playerIds: string[];
  players: Record<string, CardPlayerPublic>;
  playerOrder: string[];
  table: CardTablePublicState | null;
  createdAt: number;
  updatedAt: number;
}

function normalizeCardRoom(raw: CardRoomFirestoreDoc): NormalizedCardRoom {
  const defaults = cloneDefaultCardSettings();
  const rawSettings = raw.settings ?? defaults;
  const playerIds = Array.isArray(raw.playerIds) ? raw.playerIds : Object.keys(raw.players || {});
  return {
    code: raw.code,
    hostId: raw.hostId,
    selectedGame: raw.selectedGame || 'uno',
    phase: raw.phase || 'lobby',
    settings: {
      uno: { ...defaults.uno, ...(rawSettings.uno || {}) },
      satyo: { ...defaults.satyo, ...(rawSettings.satyo || {}) },
      mongoose: { ...defaults.mongoose, ...(rawSettings.mongoose || {}) },
      gadha_chor: { ...defaults.gadha_chor, ...(rawSettings.gadha_chor || {}) },
    },
    playerIds,
    players: raw.players ?? {},
    playerOrder:
      Array.isArray(raw.playerOrder) && raw.playerOrder.length > 0 ? raw.playerOrder : playerIds,
    table: raw.table ?? null,
    createdAt: toMillis(raw.createdAt),
    updatedAt: toMillis(raw.updatedAt),
  };
}

function isCardRoomStale(room: NormalizedCardRoom): boolean {
  return isCardRoomExpired(room) || room.playerIds.length === 0;
}

function makeLogEntry(actorUid: string, actorName: string, text: string): CardLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    actorUid,
    actorName,
    text,
    timestamp: Date.now(),
  };
}

function pushActionLog(
  existing: CardLogEntry[] | undefined,
  actorUid: string,
  actorName: string,
  text: string
): CardLogEntry[] {
  const next = [makeLogEntry(actorUid, actorName, text), ...(existing || [])];
  return next.slice(0, 24);
}

function makeTurnTimes(gameId: CardGameId, settings: CardGameSettingsMap) {
  const now = Date.now();
  const sec = getCardGameTimerSeconds(gameId, settings);
  return {
    turnStartedAt: now,
    turnDeadlineAt: sec > 0 ? now + sec * 1000 : null,
  };
}

function drawUnoCardFromDeck(deckDoc: CardDeckFirestoreDoc): UnoCard | null {
  if (deckDoc.drawPile.length === 0 && deckDoc.unoDiscard.length > 1) {
    const top = deckDoc.unoDiscard[deckDoc.unoDiscard.length - 1];
    const recyclable = deckDoc.unoDiscard.slice(0, -1);
    deckDoc.unoDiscard = [top];
    deckDoc.drawPile = shuffleCardArray(recyclable);
  }
  const popped = deckDoc.drawPile.pop();
  return popped && popped.kind === 'uno' ? popped : null;
}

function dealCardGameRound(room: NormalizedCardRoom): {
  handsByUid: Record<string, CardItem[]>;
  deckDoc: Omit<CardDeckFirestoreDoc, 'updatedAt'>;
  nextPlayers: Record<string, CardPlayerPublic>;
  playerOrder: string[];
  table: CardTablePublicState;
} {
  const activeUids = Object.values(room.players)
    .filter((p) => p.connected !== false)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    .map((p) => p.id);

  const limits = getCardGamePlayerLimits(room.selectedGame);
  if (activeUids.length < limits.min) {
    throw new Error(`NEED_AT_LEAST_${limits.min}_PLAYERS`);
  }
  if (activeUids.length > limits.max) {
    throw new Error(`MAX_${limits.max}_PLAYERS`);
  }

  const nextPlayers: Record<string, CardPlayerPublic> = {};
  const handsByUid: Record<string, CardItem[]> = {};
  for (const uid of Object.keys(room.players)) {
    const p = room.players[uid];
    if (!p) continue;
    nextPlayers[uid] = stripUndefined({
      ...p,
      ready: false,
      safe: false,
      saidUno: false,
      cardCount: 0,
      lastActionText: undefined,
    });
  }
  for (const uid of activeUids) {
    handsByUid[uid] = [];
  }

  const roundNumber = (room.table?.roundNumber ?? 0) + 1;
  const hostName = room.players[room.hostId]?.name || 'Table';
  const deckDoc: Omit<CardDeckFirestoreDoc, 'updatedAt'> = {
    drawPile: [],
    unoDiscard: [],
    mongooseStack: [],
  };

  let turnIndex = 0;
  let direction: 1 | -1 = 1;
  let actionLog: CardLogEntry[] = [];
  const { turnStartedAt, turnDeadlineAt } = makeTurnTimes(room.selectedGame, room.settings);

  const table: CardTablePublicState = {
    gameId: room.selectedGame,
    playerOrder: activeUids,
    turnUid: activeUids[0] ?? null,
    turnIndex: 0,
    direction: 1,
    turnStartedAt,
    turnDeadlineAt,
    roundNumber,
    actionLog: [],
    outcome: null,
  };

  if (room.selectedGame === 'uno') {
    const deck = buildUnoDeck();
    const handSize = room.settings.uno.startingHandSize;
    for (let c = 0; c < handSize; c++) {
      for (const uid of activeUids) {
        const card = deck.pop();
        if (card) handsByUid[uid].push(card);
      }
    }
    for (const uid of activeUids) {
      handsByUid[uid] = sortCardHand(handsByUid[uid]);
      nextPlayers[uid].cardCount = handsByUid[uid].length;
    }

    let openIdx = deck.findIndex((c) => c.color !== 'wild');
    if (openIdx === -1) openIdx = deck.length - 1;
    const [openCard] = deck.splice(openIdx, 1);
    deckDoc.unoDiscard = [openCard];
    deckDoc.drawPile = deck;

    actionLog = [
      makeLogEntry(
        room.hostId,
        hostName,
        `Dealt ${handSize} UNO cards each. Opening card: ${formatCardName(openCard)}.`
      ),
    ];

    table.uno = {
      topCard: openCard,
      activeColor: openCard.color === 'wild' ? 'red' : openCard.color,
      drawPileCount: deck.length,
      discardCount: 1,
      pendingDrawCount: 0,
      unoVulnerableUid: null,
      hasDrawnThisTurn: false,
    };
  } else if (room.selectedGame === 'satyo') {
    const deck = buildStandardDeck(false);
    let idx = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      if (!card) break;
      const uid = activeUids[idx % activeUids.length];
      handsByUid[uid].push(card);
      idx++;
    }
    for (const uid of activeUids) {
      handsByUid[uid] = sortCardHand(handsByUid[uid]);
      nextPlayers[uid].cardCount = handsByUid[uid].length;
    }

    const pref = room.settings.satyo.startingSeven;
    let starterIdx = 0;
    if (pref === 'hearts' || pref === 'spades') {
      const holderIdx = activeUids.findIndex((uid) =>
        handsByUid[uid].some((c) => c.kind === 'standard' && c.rank === 7 && c.suit === pref)
      );
      if (holderIdx !== -1) starterIdx = holderIdx;
    } else {
      const holderIdx = activeUids.findIndex((uid) =>
        handsByUid[uid].some((c) => c.kind === 'standard' && c.rank === 7)
      );
      if (holderIdx !== -1) starterIdx = holderIdx;
    }
    turnIndex = starterIdx;
    const starterUid = activeUids[starterIdx] ?? activeUids[0];
    const starterName = room.players[starterUid]?.name || 'Player';
    const startText = pref === 'hearts' ? '7♥' : pref === 'spades' ? '7♠' : 'any 7';

    actionLog = [
      makeLogEntry(
        starterUid,
        starterName,
        `All 52 cards dealt. ${starterName} leads with ${startText}.`
      ),
    ];

    table.satyo = {
      lanes: createEmptySatyoLanes(),
      startingSevenRequired: pref,
      boardCardCount: 0,
    };
  } else if (room.selectedGame === 'mongoose') {
    const deck = buildStandardDeck(false);
    const dealEach = Math.min(7, Math.max(4, Math.floor((deck.length - 4) / activeUids.length)));
    for (let c = 0; c < dealEach; c++) {
      for (const uid of activeUids) {
        const card = deck.pop();
        if (card) handsByUid[uid].push(card);
      }
    }
    for (const uid of activeUids) {
      handsByUid[uid] = sortCardHand(handsByUid[uid]);
      nextPlayers[uid].cardCount = handsByUid[uid].length;
    }
    const openCard = deck.pop() ?? null;
    if (openCard) {
      deckDoc.mongooseStack = [openCard];
    }
    deckDoc.drawPile = deck;

    actionLog = [
      makeLogEntry(
        room.hostId,
        hostName,
        `Dealt ${dealEach} cards each.${openCard ? ` Opening stack card: ${formatCardName(openCard)}.` : ''}`
      ),
    ];

    table.mongoose = {
      uppermostCard: openCard,
      recentStackCards: openCard ? [openCard] : [],
      stackCount: openCard ? 1 : 0,
      drawPileCount: deck.length,
      lastPlayedByUid: null,
      burnedCount: 0,
      roundNumber,
    };
  } else {
    // Gadha Chor
    const settings = room.settings.gadha_chor;
    const deck = buildGadhaChorDeck(settings.oddCard);
    let idx = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      if (!card) break;
      const uid = activeUids[idx % activeUids.length];
      handsByUid[uid].push(card);
      idx++;
    }
    direction = settings.pickDirection === 'counterclockwise' ? -1 : 1;

    let pairsClearedTotal = 0;
    const safeOrder: string[] = [];

    for (const uid of activeUids) {
      if (settings.autoDiscardPairs) {
        const { remaining, pairsRemoved } = stripGadhaPairs(handsByUid[uid], settings.pairRule);
        handsByUid[uid] = shuffleCardArray(remaining);
        pairsClearedTotal += pairsRemoved;
        if (handsByUid[uid].length === 0) {
          nextPlayers[uid].safe = true;
          safeOrder.push(uid);
        }
      } else {
        handsByUid[uid] = sortCardHand(handsByUid[uid]);
      }
      nextPlayers[uid].cardCount = handsByUid[uid].length;
    }

    const firstActiveIdx = activeUids.findIndex((uid) => handsByUid[uid].length > 0);
    turnIndex = firstActiveIdx === -1 ? 0 : firstActiveIdx;
    const turnUid = activeUids[turnIndex] ?? null;
    const targetUid = turnUid
      ? getGadhaTargetUidFromCounts(activeUids, nextPlayers, turnUid, settings.pickDirection)
      : null;

    actionLog = [
      makeLogEntry(
        room.hostId,
        hostName,
        settings.autoDiscardPairs
          ? `Pairs cleared automatically (${pairsClearedTotal} pairs). Pick a hidden card!`
          : 'All cards dealt! Drop matching pairs and pick from your neighbor.'
      ),
    ];

    table.gadhaChor = {
      targetUid,
      targetCardCount: targetUid ? nextPlayers[targetUid]?.cardCount ?? 0 : 0,
      pairsClearedTotal,
      safeOrder,
      oddCardType: settings.oddCard,
      pendingPick: null,
    };
  }

  table.turnIndex = turnIndex;
  table.turnUid = activeUids[turnIndex] ?? null;
  table.direction = direction;
  table.actionLog = actionLog;

  return {
    handsByUid,
    deckDoc,
    nextPlayers,
    playerOrder: activeUids,
    table,
  };
}

function finalizeGadhaChorTable(
  room: NormalizedCardRoom,
  nextPlayers: Record<string, CardPlayerPublic>,
  nextTable: CardTablePublicState,
  actionLog: CardLogEntry[]
): {
  nextPlayers: Record<string, CardPlayerPublic>;
  nextTable: CardTablePublicState;
} {
  const loserUid =
    room.playerOrder.find((uid) => (nextPlayers[uid]?.cardCount ?? 0) > 0) ?? null;
  const winnerUids = room.playerOrder.filter((uid) => uid !== loserUid);
  const scores: Record<string, number> = {};

  for (const uid of room.playerOrder) {
    if (uid !== loserUid && nextPlayers[uid]) {
      nextPlayers[uid] = {
        ...nextPlayers[uid],
        safe: true,
        score: (nextPlayers[uid].score || 0) + 10,
      };
    }
    scores[uid] = nextPlayers[uid]?.score ?? 0;
  }

  const loserName = loserUid ? nextPlayers[loserUid]?.name || 'Player' : 'Nobody';
  const oddLabel =
    room.settings.gadha_chor.oddCard === 'joker' ? 'the lone Joker' : 'the Queen of Spades (Q♠)';

  const outcome: CardGameOutcome = {
    gameId: 'gadha_chor',
    winnerUids,
    loserUid,
    reason: `${loserName} was left holding ${oddLabel} — Gadha Chor!`,
    scores,
    revealedHands: {},
  };

  return {
    nextPlayers,
    nextTable: {
      ...nextTable,
      turnDeadlineAt: null,
      actionLog,
      gadhaChor: nextTable.gadhaChor
        ? {
            ...nextTable.gadhaChor,
            targetUid: null,
            targetCardCount: 0,
            pendingPick: null,
          }
        : undefined,
      outcome,
    },
  };
}

class CardRoomService {
  private unsubscribes: Array<() => void> = [];
  private activeCode: string | null = null;
  private callbacks: CardRoomCallbacks | null = null;
  private myUid: string | null = null;
  private latestRoom: NormalizedCardRoom | null = null;
  private latestHand: CardItem[] = [];
  private processedTransferIds = new Set<string>();
  private transferQueue: Promise<void> = Promise.resolve();
  private actionQueue: Promise<void> = Promise.resolve();
  private resolvingPickId: string | null = null;

  // Fallback HTTP/SSE state (only when Firebase is not configured)
  private eventSource: EventSource | null = null;

  private enqueueAction<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.actionQueue.then(fn, fn);
    this.actionQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private emitCurrentState() {
    if (!this.latestRoom || !this.callbacks) return;
    const room = this.latestRoom;
    const clientState: CardRoomClientState = {
      code: room.code,
      hostId: room.hostId,
      selectedGame: room.selectedGame,
      phase: room.phase,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      settings: room.settings,
      players: room.players,
      playerOrder: room.playerOrder,
      table: room.table,
      myHand: room.phase === 'lobby' ? [] : [...this.latestHand],
    };
    this.callbacks.onState(clientState);
  }

  private attachListeners(code: string, uid: string) {
    this.clearListeners();

    const roomPath = `card_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'card_rooms', code);
    const unsubRoom = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          saveActiveCardRoomCode(uid, null);
          this.latestRoom = null;
          this.callbacks?.onError?.('DISCONNECTED');
          return;
        }
        this.latestRoom = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
        this.emitCurrentState();
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, roomPath);
      }
    );

    const handPath = `card_rooms/${code}/hands/${uid}`;
    const handRef = doc(firestoreDb, 'card_rooms', code, 'hands', uid);
    const unsubHand = onSnapshot(
      handRef,
      (snap) => {
        if (!snap.exists()) {
          this.latestHand = [];
        } else {
          const data = snap.data() as CardHandFirestoreDoc;
          this.latestHand = Array.isArray(data.cards) ? data.cards : [];
        }
        this.emitCurrentState();
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, handPath);
      }
    );

    const transfersPath = `card_rooms/${code}/card_transfers`;
    const transfersQuery = query(
      collection(firestoreDb, 'card_rooms', code, 'card_transfers'),
      where('to', '==', uid)
    );
    const unsubTransfers = onSnapshot(
      transfersQuery,
      (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            const transfer = change.doc.data() as CardTransferFirestoreDoc;
            const transferId = change.doc.id;
            if (!this.processedTransferIds.has(transferId)) {
              this.processedTransferIds.add(transferId);
              this.transferQueue = this.transferQueue
                .then(() => this.processIncomingTransfer(code, uid, transferId, transfer))
                .catch(() => {
                  this.processedTransferIds.delete(transferId);
                });
            }
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, transfersPath);
      }
    );

    const signalsPath = `card_rooms/${code}/signals`;
    const signalsQuery = query(
      collection(firestoreDb, 'card_rooms', code, 'signals'),
      where('to', '==', uid)
    );
    const unsubSignals = onSnapshot(
      signalsQuery,
      (snap) => {
        for (const change of snap.docChanges()) {
          if (change.type === 'added') {
            const sig = change.doc.data() as SignalPayload;
            this.callbacks?.onSignal(sig);
            deleteDoc(change.doc.ref).catch(() => {});
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, signalsPath);
      }
    );

    this.unsubscribes.push(unsubRoom, unsubHand, unsubTransfers, unsubSignals);
  }

  private clearListeners() {
    for (const unsub of this.unsubscribes) {
      unsub();
    }
    this.unsubscribes = [];
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private async processIncomingTransfer(
    code: string,
    uid: string,
    transferId: string,
    transfer: CardTransferFirestoreDoc
  ): Promise<void> {
    const roomRef = doc(firestoreDb, 'card_rooms', code);
    const handRef = doc(firestoreDb, 'card_rooms', code, 'hands', uid);
    const transferRef = doc(firestoreDb, 'card_rooms', code, 'card_transfers', transferId);

    const [roomSnap, handSnap] = await Promise.all([getDoc(roomRef), getDoc(handRef)]);
    if (!roomSnap.exists()) {
      await deleteDoc(transferRef).catch(() => {});
      return;
    }

    const room = normalizeCardRoom(roomSnap.data() as CardRoomFirestoreDoc);
    const currentCards = handSnap.exists()
      ? ((handSnap.data() as CardHandFirestoreDoc).cards ?? [])
      : [];

    const existingIds = new Set(currentCards.map((c) => c.id));
    const incomingCards = (transfer.cards || []).filter((c) => !existingIds.has(c.id));
    const mergedCards = [...currentCards, ...incomingCards];

    const batch = writeBatch(firestoreDb);

    if (transfer.reason === 'gadha_pick' && room.selectedGame === 'gadha_chor' && room.phase === 'playing') {
      const nextPlayers: Record<string, CardPlayerPublic> = { ...room.players };
      const settings = room.settings.gadha_chor;
      const actor = nextPlayers[uid];
      const targetUid = transfer.from;
      const targetName = nextPlayers[targetUid]?.name || 'Neighbor';

      let nextHand = mergedCards;
      let pairsAdded = 0;
      if (settings.autoDiscardPairs) {
        const stripped = stripGadhaPairs(mergedCards, settings.pairRule);
        nextHand = shuffleCardArray(stripped.remaining);
        pairsAdded = stripped.pairsRemoved;
      }

      const safeOrder = [...(room.table?.gadhaChor?.safeOrder ?? [])];
      let nextLog = pushActionLog(
        room.table?.actionLog,
        uid,
        actor?.name || 'Player',
        pairsAdded > 0
          ? `Picked a card from ${targetName} & auto-paired!`
          : `Picked a hidden card from ${targetName}.`
      );

      if (actor) {
        nextPlayers[uid] = stripUndefined({
          ...actor,
          cardCount: nextHand.length,
          safe: nextHand.length === 0,
          lastActionText: `Picked from ${targetName}`,
        });
      }

      if (nextHand.length === 0) {
        if (!safeOrder.includes(uid)) safeOrder.push(uid);
        nextLog = pushActionLog(
          nextLog,
          uid,
          actor?.name || 'Player',
          `${actor?.name || 'Player'} emptied their hand — SAFE!`
        );
      }

      const activeRemaining = room.playerOrder.filter(
        (pid) => (nextPlayers[pid]?.cardCount ?? 0) > 0
      );

      let nextTable: CardTablePublicState = {
        ...(room.table || {
          gameId: 'gadha_chor',
          playerOrder: room.playerOrder,
          turnUid: uid,
          turnIndex: 0,
          direction: 1,
          turnStartedAt: Date.now(),
          turnDeadlineAt: null,
          roundNumber: 1,
          actionLog: [],
          outcome: null,
        }),
        actionLog: nextLog,
        gadhaChor: {
          targetUid: room.table?.gadhaChor?.targetUid ?? null,
          targetCardCount: room.table?.gadhaChor?.targetCardCount ?? 0,
          pairsClearedTotal: (room.table?.gadhaChor?.pairsClearedTotal ?? 0) + pairsAdded,
          safeOrder,
          oddCardType: settings.oddCard,
          pendingPick: null,
        },
      };

      let nextPhase: 'playing' | 'finished' = 'playing';

      if (activeRemaining.length <= 1) {
        nextPhase = 'finished';
        const fin = finalizeGadhaChorTable(room, nextPlayers, nextTable, nextLog);
        Object.assign(nextPlayers, fin.nextPlayers);
        nextTable = fin.nextTable;
      } else {
        const nextTurnIdx = findNextGadhaTurnIndex(
          room.playerOrder,
          nextPlayers,
          uid,
          room.table?.turnIndex ?? 0,
          settings.pickDirection
        );
        const nextTurnUid = room.playerOrder[nextTurnIdx] ?? null;
        const nextTargetUid = nextTurnUid
          ? getGadhaTargetUidFromCounts(
              room.playerOrder,
              nextPlayers,
              nextTurnUid,
              settings.pickDirection
            )
          : null;
        const clocks = makeTurnTimes('gadha_chor', room.settings);
        nextTable = {
          ...nextTable,
          turnIndex: nextTurnIdx,
          turnUid: nextTurnUid,
          turnStartedAt: clocks.turnStartedAt,
          turnDeadlineAt: clocks.turnDeadlineAt,
          gadhaChor: {
            ...nextTable.gadhaChor!,
            targetUid: nextTargetUid,
            targetCardCount: nextTargetUid ? nextPlayers[nextTargetUid]?.cardCount ?? 0 : 0,
            pendingPick: null,
          },
        };
      }

      batch.set(handRef, {
        ownerId: uid,
        cards: nextHand,
        updatedAt: serverTimestamp(),
      });
      batch.update(roomRef, {
        phase: nextPhase,
        players: stripUndefined(nextPlayers),
        table: stripUndefined(nextTable),
        updatedAt: serverTimestamp(),
      });
      batch.delete(transferRef);
      await batch.commit();
      return;
    }

    // Standard penalty / mongoose pile delivery
    const nextHand = sortCardHand(mergedCards);
    batch.set(handRef, {
      ownerId: uid,
      cards: nextHand,
      updatedAt: serverTimestamp(),
    });
    if (room.players[uid]) {
      batch.update(roomRef, {
        [`players.${uid}.cardCount`]: nextHand.length,
        updatedAt: serverTimestamp(),
      });
    }
    batch.delete(transferRef);
    await batch.commit();
  }

  public async resolvePendingGadhaPick(code: string, targetUid: string): Promise<void> {
    if (!isFirestoreConfigured() || !auth.currentUser) return;
    return this.enqueueAction(async () => {
      const roomRef = doc(firestoreDb, 'card_rooms', code);
      const handRef = doc(firestoreDb, 'card_rooms', code, 'hands', targetUid);
      const [roomSnap, handSnap] = await Promise.all([getDoc(roomRef), getDoc(handRef)]);
      if (!roomSnap.exists() || !handSnap.exists()) return;

      const room = normalizeCardRoom(roomSnap.data() as CardRoomFirestoreDoc);
      const gc = room.table?.gadhaChor;
      const pending = gc?.pendingPick;
      if (
        room.phase !== 'playing' ||
        room.selectedGame !== 'gadha_chor' ||
        !gc ||
        !pending ||
        pending.targetUid !== targetUid
      ) {
        return;
      }

      if (this.resolvingPickId === pending.id) return;
      this.resolvingPickId = pending.id;

      try {
        const targetCards = [...((handSnap.data() as CardHandFirestoreDoc).cards ?? [])];
        if (targetCards.length === 0) {
          await updateDoc(roomRef, {
            'table.gadhaChor.pendingPick': null,
            updatedAt: serverTimestamp(),
          });
          return;
        }

        const safeIdx = Math.max(0, Math.min(targetCards.length - 1, Math.floor(pending.index)));
        const [pickedCard] = targetCards.splice(safeIdx, 1);

        const nextPlayers: Record<string, CardPlayerPublic> = { ...room.players };
        const safeOrder = [...(gc.safeOrder || [])];
        let nextLog = room.table?.actionLog || [];

        const targetPlayer = nextPlayers[targetUid];
        if (targetPlayer) {
          nextPlayers[targetUid] = stripUndefined({
            ...targetPlayer,
            cardCount: targetCards.length,
            safe: targetCards.length === 0,
          });
        }

        if (targetCards.length === 0) {
          if (!safeOrder.includes(targetUid)) safeOrder.push(targetUid);
          nextLog = pushActionLog(
            nextLog,
            targetUid,
            targetPlayer?.name || 'Neighbor',
            `${targetPlayer?.name || 'Neighbor'} emptied their hand — SAFE!`
          );
        }

        const nextTable: CardTablePublicState = {
          ...room.table!,
          actionLog: nextLog,
          gadhaChor: {
            ...gc,
            targetCardCount: targetCards.length,
            safeOrder,
            pendingPick: null,
          },
        };

        const batch = writeBatch(firestoreDb);
        batch.set(handRef, {
          ownerId: targetUid,
          cards: targetCards,
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(firestoreDb, 'card_rooms', code, 'card_transfers', pending.id), {
          id: pending.id,
          from: targetUid,
          to: pending.pickerUid,
          reason: 'gadha_pick',
          cards: [pickedCard],
          createdAt: serverTimestamp(),
        });
        batch.update(roomRef, {
          players: stripUndefined(nextPlayers),
          table: stripUndefined(nextTable),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (err) {
        this.resolvingPickId = null;
        handleFirestoreError(err, OperationType.UPDATE, `card_rooms/${code}`);
      }
    });
  }

  public async revealHandOnFinish(code: string, uid: string): Promise<void> {
    if (!isFirestoreConfigured() || !auth.currentUser) return;
    const roomRef = doc(firestoreDb, 'card_rooms', code);
    const handRef = doc(firestoreDb, 'card_rooms', code, 'hands', uid);
    try {
      const [roomSnap, handSnap] = await Promise.all([getDoc(roomRef), getDoc(handRef)]);
      if (!roomSnap.exists() || !handSnap.exists()) return;
      const room = normalizeCardRoom(roomSnap.data() as CardRoomFirestoreDoc);
      if (room.phase !== 'finished' || !room.table?.outcome) return;
      if (room.table.outcome.revealedHands?.[uid]) return;
      const cards = (handSnap.data() as CardHandFirestoreDoc).cards ?? [];
      await updateDoc(roomRef, {
        [`table.outcome.revealedHands.${uid}`]: cards,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-critical end-of-hand visual reveal
    }
  }

  public async resolveTimedOutTurn(code: string, actorUid: string): Promise<void> {
    if (!isFirestoreConfigured() || !auth.currentUser) return;
    return this.enqueueAction(async () => {
      const roomRef = doc(firestoreDb, 'card_rooms', code);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) return;
      const room = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
      if (room.phase !== 'playing' || !room.table?.turnDeadlineAt) return;
      if (Date.now() < room.table.turnDeadlineAt) return;

      const turnUid = room.table.turnUid;
      if (!turnUid) return;

      // Active turn player handles own auto-move; host only steps in after +2.5s grace
      if (turnUid !== actorUid) {
        if (room.hostId !== actorUid || Date.now() < room.table.turnDeadlineAt + 2500) {
          return;
        }
        // Host safe fallback advance if turn player dropped
        const nextIdx = stepCardTurnIndex(
          room.playerOrder.length,
          room.table.turnIndex,
          room.table.direction,
          1
        );
        const nextUid = room.playerOrder[nextIdx] ?? turnUid;
        const clocks = makeTurnTimes(room.selectedGame, room.settings);
        const targetUid =
          room.selectedGame === 'gadha_chor'
            ? getGadhaTargetUidFromCounts(
                room.playerOrder,
                room.players,
                nextUid,
                room.settings.gadha_chor.pickDirection
              )
            : null;
        await updateDoc(roomRef, {
          'table.turnIndex': nextIdx,
          'table.turnUid': nextUid,
          'table.turnStartedAt': clocks.turnStartedAt,
          'table.turnDeadlineAt': clocks.turnDeadlineAt,
          'table.actionLog': pushActionLog(
            room.table.actionLog,
            turnUid,
            room.players[turnUid]?.name || 'Player',
            'Turn timed out — passed to next player.'
          ),
          ...(room.selectedGame === 'gadha_chor' && room.table.gadhaChor
            ? {
                'table.gadhaChor.targetUid': targetUid,
                'table.gadhaChor.targetCardCount': targetUid
                  ? room.players[targetUid]?.cardCount ?? 0
                  : 0,
                'table.gadhaChor.pendingPick': null,
              }
            : {}),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        return;
      }

      if (room.selectedGame === 'uno') {
        if (room.table.uno?.hasDrawnThisTurn) {
          await this.sendAction(code, actorUid, { type: 'uno_pass' });
        } else {
          await this.sendAction(code, actorUid, { type: 'uno_draw' });
          const afterSnap = await getDoc(roomRef);
          if (afterSnap.exists()) {
            const after = normalizeCardRoom(afterSnap.data() as CardRoomFirestoreDoc);
            if (
              after.phase === 'playing' &&
              after.table?.turnUid === actorUid &&
              after.table?.uno?.hasDrawnThisTurn
            ) {
              await this.sendAction(code, actorUid, { type: 'uno_pass' });
            }
          }
        }
      } else if (room.selectedGame === 'satyo') {
        const handSnap = await getDoc(doc(firestoreDb, 'card_rooms', code, 'hands', actorUid));
        const hand = handSnap.exists()
          ? ((handSnap.data() as CardHandFirestoreDoc).cards ?? [])
          : [];
        const lanes = room.table.satyo?.lanes ?? createEmptySatyoLanes();
        const boardCount = room.table.satyo?.boardCardCount ?? 0;
        const legal = hand.find((c) =>
          isSatyoCardPlayable(c, lanes, boardCount, room.settings.satyo)
        );
        if (legal) {
          await this.sendAction(code, actorUid, { type: 'satyo_play', cardId: legal.id });
        } else {
          await this.sendAction(code, actorUid, { type: 'satyo_pass' });
        }
      } else if (room.selectedGame === 'mongoose') {
        await this.sendAction(code, actorUid, { type: 'mongoose_pickup' });
      } else if (room.selectedGame === 'gadha_chor') {
        const count = room.table.gadhaChor?.targetCardCount ?? 0;
        if (count > 0 && !room.table.gadhaChor?.pendingPick) {
          await this.sendAction(code, actorUid, {
            type: 'gadha_pick',
            index: Math.floor(Math.random() * count),
          });
        }
      }
    }).catch(() => {});
  }

  public async findActiveRejoinRoom(uid: string): Promise<CardRoomClientState | null> {
    if (!isFirestoreConfigured()) {
      const saved = loadActiveCardRoomCode(uid);
      if (!saved) return null;
      try {
        const res = await fetch(`/api/card-rooms/${saved}?playerId=${encodeURIComponent(uid)}`);
        if (!res.ok) {
          saveActiveCardRoomCode(uid, null);
          return null;
        }
        const data = (await res.json()) as { state: CardRoomClientState };
        return data.state;
      } catch {
        return null;
      }
    }

    if (!auth.currentUser) return null;
    const myUid = auth.currentUser.uid;
    try {
      const q = query(
        collection(firestoreDb, 'card_rooms'),
        where('playerIds', 'array-contains', myUid)
      );
      const snap = await getDocs(q);
      const validRooms: NormalizedCardRoom[] = [];
      for (const d of snap.docs) {
        const room = normalizeCardRoom(d.data() as CardRoomFirestoreDoc);
        if (isCardRoomStale(room)) {
          continue;
        }
        if (room.playerIds.includes(myUid)) {
          validRooms.push(room);
        }
      }

      // Fallback check from locally remembered room code in case query cache misses a just-created room
      if (validRooms.length === 0) {
        const savedCode = sanitizeCardRoomCode(loadActiveCardRoomCode(myUid) || '');
        if (isValidCardRoomCodeFormat(savedCode)) {
          try {
            const savedSnap = await getDoc(doc(firestoreDb, 'card_rooms', savedCode));
            if (savedSnap.exists()) {
              const savedRoom = normalizeCardRoom(savedSnap.data() as CardRoomFirestoreDoc);
              if (!isCardRoomStale(savedRoom) && savedRoom.playerIds.includes(myUid)) {
                validRooms.push(savedRoom);
              }
            }
          } catch {
            // Ignore fallback read failure
          }
        }
      }

      validRooms.sort((a, b) => b.updatedAt - a.updatedAt);
      const active = validRooms.find((r) => r.phase !== 'finished') ?? validRooms[0] ?? null;
      if (!active) {
        saveActiveCardRoomCode(myUid, null);
        return null;
      }

      saveActiveCardRoomCode(myUid, active.code);
      let myHand: CardItem[] = [];
      if (active.phase !== 'lobby') {
        try {
          const handSnap = await getDoc(
            doc(firestoreDb, 'card_rooms', active.code, 'hands', myUid)
          );
          if (handSnap.exists()) {
            myHand = (handSnap.data() as CardHandFirestoreDoc).cards ?? [];
          }
        } catch {
          // Ignore hand read error on preview
        }
      }

      return {
        code: active.code,
        hostId: active.hostId,
        selectedGame: active.selectedGame,
        phase: active.phase,
        createdAt: active.createdAt,
        updatedAt: active.updatedAt,
        settings: active.settings,
        players: active.players,
        playerOrder: active.playerOrder,
        table: active.table,
        myHand,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'card_rooms');
    }
  }

  public async createRoom(
    rawCode: string,
    selectedGame: CardGameId,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    const code = sanitizeCardRoomCode(rawCode);
    if (!isValidCardRoomCodeFormat(code)) {
      throw new Error('INVALID_CODE');
    }

    this.cleanup();
    if (!isFirestoreConfigured()) {
      return this.httpCreateRoom(code, selectedGame, player, callbacks);
    }

    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
    if (!auth.currentUser.emailVerified) throw new Error('AUTH_UNVERIFIED');

    const uid = auth.currentUser.uid;
    const roomPath = `card_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'card_rooms', code);

    const now = Date.now();
    const safeName = player.name.trim().slice(0, 20) || 'Player';
    const safeAvatar = stripUndefined(player.avatar);
    const hostPlayer: CardPlayerPublic = stripUndefined({
      id: uid,
      name: safeName,
      avatar: safeAvatar,
      isHost: true,
      ready: false,
      connected: true,
      isMuted: false,
      joinedAt: now,
      cardCount: 0,
      score: 0,
      safe: false,
      saidUno: false,
    });

    const settings = cloneDefaultCardSettings();
    const payload = {
      code,
      hostId: uid,
      selectedGame,
      phase: 'lobby' as const,
      settings,
      playerIds: [uid],
      players: { [uid]: hostPlayer },
      playerOrder: [uid],
      table: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    let resolvedRoom: NormalizedCardRoom | null = null;
    let joinedExisting = false;

    try {
      await runTransaction(firestoreDb, async (tx) => {
        const snap = await tx.get(roomRef);

        if (snap.exists()) {
          const existing = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
          const conflictResolution = decideCardRoomCreateConflict(existing, uid);
          if (conflictResolution === 'reuse_existing') {
            // Idempotent re-entry if this user already owns or belongs to this room
            const updatedMember: CardPlayerPublic = stripUndefined({
              ...(existing.players[uid] || hostPlayer),
              id: uid,
              name: safeName,
              avatar: safeAvatar,
              isHost: existing.hostId === uid,
              connected: true,
            });
            tx.update(roomRef, {
              [`players.${uid}`]: updatedMember,
              updatedAt: serverTimestamp(),
            });
            resolvedRoom = {
              ...existing,
              players: {
                ...existing.players,
                [uid]: updatedMember,
              },
              updatedAt: now,
            };
            joinedExisting = true;
            return;
          }
          // Existing room belongs to another player: never delete active rooms; signal collision for code retry
          throw new Error('ROOM_EXISTS');
        }

        tx.set(roomRef, payload);
        resolvedRoom = {
          code,
          hostId: uid,
          selectedGame,
          phase: 'lobby',
          settings,
          playerIds: [uid],
          players: { [uid]: hostPlayer },
          playerOrder: [uid],
          table: null,
          createdAt: now,
          updatedAt: now,
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'ROOM_EXISTS') {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, roomPath);
    }

    const activeRoom = resolvedRoom!;
    let initialHand: CardItem[] = [];
    if (joinedExisting && activeRoom.phase !== 'lobby') {
      try {
        const handSnap = await getDoc(doc(firestoreDb, 'card_rooms', code, 'hands', uid));
        if (handSnap.exists()) {
          initialHand = (handSnap.data() as CardHandFirestoreDoc).cards ?? [];
        }
      } catch {
        // Hand listener will sync
      }
    }

    this.activeCode = code;
    this.myUid = uid;
    this.callbacks = callbacks;
    this.latestHand = initialHand;
    this.latestRoom = activeRoom;
    saveActiveCardRoomCode(uid, code);
    this.attachListeners(code, uid);

    const clientState: CardRoomClientState = {
      code: activeRoom.code,
      hostId: activeRoom.hostId,
      selectedGame: activeRoom.selectedGame,
      phase: activeRoom.phase,
      createdAt: activeRoom.createdAt,
      updatedAt: activeRoom.updatedAt,
      settings: activeRoom.settings,
      players: activeRoom.players,
      playerOrder: activeRoom.playerOrder,
      table: activeRoom.table,
      myHand: activeRoom.phase === 'lobby' ? [] : initialHand,
    };
    callbacks.onState(clientState);
    return clientState;
  }

  public async joinRoom(
    rawCode: string,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    const cleanCode = sanitizeCardRoomCode(rawCode);
    if (!isValidCardRoomCodeFormat(cleanCode)) {
      throw new Error('INVALID_CODE');
    }

    this.cleanup();
    if (!isFirestoreConfigured()) {
      return this.httpJoinRoom(cleanCode, player, callbacks);
    }

    if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
    if (!auth.currentUser.emailVerified) throw new Error('AUTH_UNVERIFIED');

    const uid = auth.currentUser.uid;
    const roomPath = `card_rooms/${cleanCode}`;
    const roomRef = doc(firestoreDb, 'card_rooms', cleanCode);
    const safeName = player.name.trim().slice(0, 20) || 'Player';
    const safeAvatar = stripUndefined(player.avatar);
    const now = Date.now();

    let resolvedRoom: NormalizedCardRoom | null = null;

    try {
      await runTransaction(firestoreDb, async (tx) => {
        let snap;
        try {
          snap = await tx.get(roomRef);
        } catch (readErr) {
          const { code: fbCode } = extractFirebaseError(readErr);
          if (fbCode === 'permission-denied') {
            throw new Error('ROOM_UNAVAILABLE');
          }
          throw readErr;
        }

        if (!snap.exists()) {
          throw new Error('ROOM_NOT_FOUND');
        }

        const existing = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
        const decision = decideCardRoomJoinAction(existing, uid, now);
        if (decision.action === 'reject') {
          throw new Error(decision.error);
        }

        if (decision.action === 'join') {
          const joinedPlayer: CardPlayerPublic = stripUndefined({
            id: uid,
            name: safeName,
            avatar: safeAvatar,
            isHost: existing.hostId === uid,
            ready: false,
            connected: true,
            isMuted: false,
            joinedAt: now,
            cardCount: 0,
            score: 0,
            safe: false,
            saidUno: false,
          });
          const nextPlayerIds = existing.playerIds.includes(uid)
            ? existing.playerIds
            : [...existing.playerIds, uid];
          const nextOrder = existing.playerOrder.includes(uid)
            ? existing.playerOrder
            : [...existing.playerOrder, uid];

          tx.update(roomRef, {
            playerIds: nextPlayerIds,
            playerOrder: nextOrder,
            [`players.${uid}`]: joinedPlayer,
            updatedAt: serverTimestamp(),
          });

          resolvedRoom = {
            ...existing,
            playerIds: nextPlayerIds,
            playerOrder: nextOrder,
            players: { ...existing.players, [uid]: joinedPlayer },
            updatedAt: now,
          };
        } else {
          // Idempotent rejoin for existing member (e.g. browser refresh or repeated join click)
          const updatedMember: CardPlayerPublic = stripUndefined({
            ...(existing.players[uid] || {
              id: uid,
              name: safeName,
              avatar: safeAvatar,
              isHost: existing.hostId === uid,
              ready: false,
              connected: true,
              isMuted: false,
              joinedAt: now,
              cardCount: 0,
              score: 0,
              safe: false,
              saidUno: false,
            }),
            name: safeName,
            avatar: safeAvatar,
            connected: true,
          });

          tx.update(roomRef, {
            [`players.${uid}.connected`]: true,
            [`players.${uid}.name`]: safeName,
            [`players.${uid}.avatar`]: safeAvatar,
            updatedAt: serverTimestamp(),
          });

          resolvedRoom = {
            ...existing,
            players: { ...existing.players, [uid]: updatedMember },
            updatedAt: now,
          };
        }
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'ROOM_NOT_FOUND' ||
          error.message === 'ROOM_FULL' ||
          error.message === 'GAME_IN_PROGRESS' ||
          error.message === 'ROOM_UNAVAILABLE')
      ) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }

    const activeRoom = resolvedRoom!;
    let initialHand: CardItem[] = [];
    if (activeRoom.phase !== 'lobby') {
      try {
        const handSnap = await getDoc(doc(firestoreDb, 'card_rooms', cleanCode, 'hands', uid));
        if (handSnap.exists()) {
          initialHand = (handSnap.data() as CardHandFirestoreDoc).cards ?? [];
        }
      } catch {
        // Hand listener will sync
      }
    }

    this.activeCode = cleanCode;
    this.myUid = uid;
    this.callbacks = callbacks;
    this.latestRoom = activeRoom;
    this.latestHand = initialHand;
    saveActiveCardRoomCode(uid, cleanCode);
    this.attachListeners(cleanCode, uid);

    const clientState: CardRoomClientState = {
      code: activeRoom.code,
      hostId: activeRoom.hostId,
      selectedGame: activeRoom.selectedGame,
      phase: activeRoom.phase,
      createdAt: activeRoom.createdAt,
      updatedAt: activeRoom.updatedAt,
      settings: activeRoom.settings,
      players: activeRoom.players,
      playerOrder: activeRoom.playerOrder,
      table: activeRoom.table,
      myHand: activeRoom.phase === 'lobby' ? [] : initialHand,
    };
    callbacks.onState(clientState);
    return clientState;
  }

  public async setReady(code: string, uid: string, ready: boolean): Promise<CardRoomClientState> {
    if (!isFirestoreConfigured()) {
      return this.httpSetReady(code, uid, ready);
    }
    const actorUid = auth.currentUser?.uid || uid;
    const roomPath = `card_rooms/${code}`;
    try {
      await updateDoc(doc(firestoreDb, 'card_rooms', code), {
        [`players.${actorUid}.ready`]: ready,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
    if (this.latestRoom) {
      this.latestRoom = {
        ...this.latestRoom,
        players: {
          ...this.latestRoom.players,
          [actorUid]: {
            ...this.latestRoom.players[actorUid],
            ready,
          },
        },
      };
      this.emitCurrentState();
    }
    return this.buildFallbackClientState();
  }

  public async updateConfig(
    code: string,
    uid: string,
    payload: {
      selectedGame?: CardGameId;
      settings?: Partial<CardGameSettingsMap>;
    }
  ): Promise<CardRoomClientState> {
    if (!isFirestoreConfigured()) {
      return this.httpUpdateConfig(code, uid, payload);
    }
    const actorUid = auth.currentUser?.uid || uid;
    const roomPath = `card_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'card_rooms', code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    const room = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
    if (room.hostId !== actorUid) throw new Error('HOST_ONLY');
    if (room.phase !== 'lobby') throw new Error('LOBBY_ONLY');

    const nextGame = payload.selectedGame ?? room.selectedGame;
    const nextSettings: CardGameSettingsMap = {
      uno: { ...room.settings.uno, ...(payload.settings?.uno || {}) },
      satyo: { ...room.settings.satyo, ...(payload.settings?.satyo || {}) },
      mongoose: { ...room.settings.mongoose, ...(payload.settings?.mongoose || {}) },
      gadha_chor: { ...room.settings.gadha_chor, ...(payload.settings?.gadha_chor || {}) },
    };

    try {
      await updateDoc(roomRef, {
        selectedGame: nextGame,
        settings: nextSettings,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }
    return this.buildFallbackClientState();
  }

  public async startGame(code: string, uid: string): Promise<CardRoomClientState> {
    if (!isFirestoreConfigured()) {
      return this.httpStartGame(code, uid);
    }
    const actorUid = auth.currentUser?.uid || uid;
    const roomPath = `card_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'card_rooms', code);

    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    const room = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
    if (room.hostId !== actorUid) throw new Error('HOST_ONLY');

    const deal = dealCardGameRound(room);
    const batch = writeBatch(firestoreDb);

    for (const [pid, cards] of Object.entries(deal.handsByUid)) {
      batch.set(doc(firestoreDb, 'card_rooms', code, 'hands', pid), {
        ownerId: pid,
        cards,
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(firestoreDb, 'card_rooms', code, 'deck', 'state'), {
      ...deal.deckDoc,
      updatedAt: serverTimestamp(),
    });

    // Edge case: Gadha Chor autoDiscardPairs immediately left <= 1 active player
    let nextPhase: 'playing' | 'finished' = 'playing';
    let nextPlayers = deal.nextPlayers;
    let nextTable = deal.table;

    if (room.selectedGame === 'gadha_chor') {
      const remaining = deal.playerOrder.filter((pid) => deal.handsByUid[pid].length > 0);
      if (remaining.length <= 1) {
        nextPhase = 'finished';
        const fin = finalizeGadhaChorTable(
          { ...room, playerOrder: deal.playerOrder },
          nextPlayers,
          nextTable,
          nextTable.actionLog
        );
        nextPlayers = fin.nextPlayers;
        nextTable = fin.nextTable;
      }
    }

    batch.update(roomRef, {
      phase: nextPhase,
      players: stripUndefined(nextPlayers),
      playerOrder: deal.playerOrder,
      table: stripUndefined(nextTable),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }

    this.latestHand = deal.handsByUid[actorUid] || [];
    return this.buildFallbackClientState();
  }

  public async sendAction(
    code: string,
    uid: string,
    action: CardActionPayload
  ): Promise<CardRoomClientState> {
    if (!isFirestoreConfigured()) {
      return this.httpSendAction(code, uid, action);
    }
    return this.enqueueAction(async () => {
      const actorUid = auth.currentUser?.uid || uid;
      const roomPath = `card_rooms/${code}`;
      const roomRef = doc(firestoreDb, 'card_rooms', code);
      const handRef = doc(firestoreDb, 'card_rooms', code, 'hands', actorUid);
      const deckRef = doc(firestoreDb, 'card_rooms', code, 'deck', 'state');

      const [roomSnap, handSnap, deckSnap] = await Promise.all([
        getDoc(roomRef),
        getDoc(handRef),
        action.type === 'uno_draw' ||
        action.type === 'uno_play' ||
        action.type === 'uno_catch' ||
        action.type === 'mongoose_pickup' ||
        action.type === 'mongoose_play'
          ? getDoc(deckRef)
          : Promise.resolve(null),
      ]);

      if (!roomSnap.exists()) throw new Error('ROOM_NOT_FOUND');
      const room = normalizeCardRoom(roomSnap.data() as CardRoomFirestoreDoc);
      if (room.phase !== 'playing' || !room.table) {
        throw new Error('GAME_NOT_ACTIVE');
      }
      const actor = room.players[actorUid];
      if (!actor) throw new Error('PLAYER_NOT_IN_ROOM');

      const myHand = handSnap.exists()
        ? [...((handSnap.data() as CardHandFirestoreDoc).cards ?? [])]
        : [];
      const deckDoc: CardDeckFirestoreDoc =
        deckSnap && deckSnap.exists()
          ? {
              drawPile: [...((deckSnap.data() as CardDeckFirestoreDoc).drawPile ?? [])],
              unoDiscard: [...((deckSnap.data() as CardDeckFirestoreDoc).unoDiscard ?? [])],
              mongooseStack: [...((deckSnap.data() as CardDeckFirestoreDoc).mongooseStack ?? [])],
              updatedAt: null,
            }
          : {
              drawPile: [],
              unoDiscard: [],
              mongooseStack: [],
              updatedAt: null,
            };

      const nextPlayers: Record<string, CardPlayerPublic> = { ...room.players };
      const table = structuredClone(room.table) as CardTablePublicState;
      const currentTurnUid = table.turnUid;
      const batch = writeBatch(firestoreDb);

      let nextPhase: 'playing' | 'finished' = 'playing';
      let touchedHand = false;
      let nextHand = myHand;
      let touchedDeck = false;

      // ================= UNO =================
      if (room.selectedGame === 'uno' && table.uno) {
        const uno = table.uno;

        if (action.type === 'uno_call') {
          if (myHand.length > 2 || myHand.length === 0) {
            throw new Error('UNO_CALL_ONLY_WITH_1_OR_2_CARDS');
          }
          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            saidUno: true,
            lastActionText: 'Called UNO!',
          });
          if (uno.unoVulnerableUid === actorUid) {
            uno.unoVulnerableUid = null;
          }
          table.actionLog = pushActionLog(table.actionLog, actorUid, actor.name, 'Called UNO!');
        } else if (action.type === 'uno_catch') {
          const targetUid = action.targetUid;
          const target = nextPlayers[targetUid];
          if (
            !target ||
            targetUid === actorUid ||
            uno.unoVulnerableUid !== targetUid ||
            target.cardCount !== 1 ||
            target.saidUno
          ) {
            throw new Error('NOBODY_TO_CATCH');
          }

          const penalty = room.settings.uno.unoPenaltyCards;
          const drawnCards: UnoCard[] = [];
          for (let i = 0; i < penalty; i++) {
            const d = drawUnoCardFromDeck(deckDoc);
            if (d) drawnCards.push(d);
          }

          if (drawnCards.length > 0) {
            const transferId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            batch.set(doc(firestoreDb, 'card_rooms', code, 'card_transfers', transferId), {
              id: transferId,
              from: actorUid,
              to: targetUid,
              reason: 'uno_penalty',
              cards: drawnCards,
              createdAt: serverTimestamp(),
            });
            touchedDeck = true;
          }

          nextPlayers[targetUid] = stripUndefined({
            ...target,
            cardCount: target.cardCount + drawnCards.length,
            saidUno: false,
          });
          uno.unoVulnerableUid = null;
          uno.drawPileCount = deckDoc.drawPile.length;
          uno.discardCount = deckDoc.unoDiscard.length;
          table.actionLog = pushActionLog(
            table.actionLog,
            actorUid,
            actor.name,
            `Caught ${target.name} without saying UNO! (+${drawnCards.length} cards)`
          );
        } else {
          if (actorUid !== currentTurnUid) {
            throw new Error('NOT_YOUR_TURN');
          }
          const topCard =
            deckDoc.unoDiscard[deckDoc.unoDiscard.length - 1] ?? uno.topCard ?? null;

          if (action.type === 'uno_draw') {
            touchedDeck = true;
            touchedHand = true;

            if (uno.pendingDrawCount > 0) {
              const count = uno.pendingDrawCount;
              for (let i = 0; i < count; i++) {
                const d = drawUnoCardFromDeck(deckDoc);
                if (d) nextHand.push(d);
              }
              nextHand = sortCardHand(nextHand);
              uno.pendingDrawCount = 0;
              uno.hasDrawnThisTurn = false;
              nextPlayers[actorUid] = stripUndefined({
                ...actor,
                cardCount: nextHand.length,
                saidUno: false,
                lastActionText: `Drew ${count}`,
              });
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Drew ${count} penalty cards.`
              );
              table.turnIndex = stepCardTurnIndex(
                room.playerOrder.length,
                table.turnIndex,
                table.direction,
                1
              );
              table.turnUid = room.playerOrder[table.turnIndex] ?? null;
              const clocks = makeTurnTimes('uno', room.settings);
              table.turnStartedAt = clocks.turnStartedAt;
              table.turnDeadlineAt = clocks.turnDeadlineAt;
            } else {
              if (uno.hasDrawnThisTurn) {
                throw new Error('ALREADY_DRAWN_THIS_TURN');
              }

              if (room.settings.uno.drawUntilPlayable) {
                let drawnCount = 0;
                let foundPlayable = false;
                while (drawnCount < 12) {
                  const drawn = drawUnoCardFromDeck(deckDoc);
                  if (!drawn) break;
                  nextHand.push(drawn);
                  drawnCount++;
                  if (
                    isUnoCardPlayable(
                      drawn,
                      topCard,
                      uno.activeColor,
                      0,
                      room.settings.uno.stackDrawCards
                    )
                  ) {
                    foundPlayable = true;
                    break;
                  }
                }
                nextHand = sortCardHand(nextHand);
                if (drawnCount === 0 || !foundPlayable) {
                  nextPlayers[actorUid] = stripUndefined({
                    ...actor,
                    cardCount: nextHand.length,
                    saidUno: false,
                    lastActionText: drawnCount > 0 ? `Drew ${drawnCount}, Passed` : 'Passed',
                  });
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    drawnCount > 0
                      ? `Drew ${drawnCount} card(s) and passed.`
                      : 'Passed (deck empty).'
                  );
                  table.turnIndex = stepCardTurnIndex(
                    room.playerOrder.length,
                    table.turnIndex,
                    table.direction,
                    1
                  );
                  table.turnUid = room.playerOrder[table.turnIndex] ?? null;
                  const clocks = makeTurnTimes('uno', room.settings);
                  table.turnStartedAt = clocks.turnStartedAt;
                  table.turnDeadlineAt = clocks.turnDeadlineAt;
                } else {
                  uno.hasDrawnThisTurn = true;
                  nextPlayers[actorUid] = stripUndefined({
                    ...actor,
                    cardCount: nextHand.length,
                    saidUno: false,
                    lastActionText: `Drew ${drawnCount}`,
                  });
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    `Drew ${drawnCount} card(s) — playable card ready!`
                  );
                }
              } else {
                const drawn = drawUnoCardFromDeck(deckDoc);
                if (!drawn) {
                  nextPlayers[actorUid] = stripUndefined({
                    ...actor,
                    lastActionText: 'Passed',
                  });
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    'Deck empty — passed turn.'
                  );
                  table.turnIndex = stepCardTurnIndex(
                    room.playerOrder.length,
                    table.turnIndex,
                    table.direction,
                    1
                  );
                  table.turnUid = room.playerOrder[table.turnIndex] ?? null;
                  const clocks = makeTurnTimes('uno', room.settings);
                  table.turnStartedAt = clocks.turnStartedAt;
                  table.turnDeadlineAt = clocks.turnDeadlineAt;
                } else {
                  nextHand.push(drawn);
                  nextHand = sortCardHand(nextHand);
                  const canPlayDrawn = isUnoCardPlayable(
                    drawn,
                    topCard,
                    uno.activeColor,
                    0,
                    room.settings.uno.stackDrawCards
                  );
                  nextPlayers[actorUid] = stripUndefined({
                    ...actor,
                    cardCount: nextHand.length,
                    saidUno: false,
                    lastActionText: 'Drew 1',
                  });
                  if (canPlayDrawn) {
                    uno.hasDrawnThisTurn = true;
                    table.actionLog = pushActionLog(
                      table.actionLog,
                      actorUid,
                      actor.name,
                      'Drew 1 card (play it or pass).'
                    );
                  } else {
                    uno.hasDrawnThisTurn = false;
                    table.actionLog = pushActionLog(
                      table.actionLog,
                      actorUid,
                      actor.name,
                      'Drew 1 card.'
                    );
                    table.turnIndex = stepCardTurnIndex(
                      room.playerOrder.length,
                      table.turnIndex,
                      table.direction,
                      1
                    );
                    table.turnUid = room.playerOrder[table.turnIndex] ?? null;
                    const clocks = makeTurnTimes('uno', room.settings);
                    table.turnStartedAt = clocks.turnStartedAt;
                    table.turnDeadlineAt = clocks.turnDeadlineAt;
                  }
                }
              }
            }
            uno.drawPileCount = deckDoc.drawPile.length;
            uno.discardCount = deckDoc.unoDiscard.length;
          } else if (action.type === 'uno_pass') {
            if (!uno.hasDrawnThisTurn) {
              throw new Error('DRAW_BEFORE_PASSING');
            }
            uno.hasDrawnThisTurn = false;
            nextPlayers[actorUid] = stripUndefined({
              ...actor,
              lastActionText: 'Passed',
            });
            table.actionLog = pushActionLog(table.actionLog, actorUid, actor.name, 'Passed turn.');
            table.turnIndex = stepCardTurnIndex(
              room.playerOrder.length,
              table.turnIndex,
              table.direction,
              1
            );
            table.turnUid = room.playerOrder[table.turnIndex] ?? null;
            const clocks = makeTurnTimes('uno', room.settings);
            table.turnStartedAt = clocks.turnStartedAt;
            table.turnDeadlineAt = clocks.turnDeadlineAt;
          } else if (action.type === 'uno_play') {
            const cardIdx = nextHand.findIndex((c) => c.id === action.cardId);
            if (cardIdx === -1) throw new Error('CARD_NOT_IN_HAND');
            const card = nextHand[cardIdx];
            if (card.kind !== 'uno') throw new Error('INVALID_CARD_TYPE');
            if (
              !isUnoCardPlayable(
                card,
                topCard,
                uno.activeColor,
                uno.pendingDrawCount,
                room.settings.uno.stackDrawCards
              )
            ) {
              throw new Error('ILLEGAL_UNO_PLAY');
            }
            if (card.color === 'wild' && !action.chosenColor) {
              throw new Error('CHOOSE_WILD_COLOR');
            }

            touchedHand = true;
            touchedDeck = true;
            nextHand.splice(cardIdx, 1);
            deckDoc.unoDiscard.push(card);

            uno.topCard = card;
            uno.activeColor = card.color === 'wild' ? action.chosenColor! : card.color;
            uno.hasDrawnThisTurn = false;

            const actorSaidUno = actor.saidUno;
            let nextSaidUno = actorSaidUno;
            if (nextHand.length === 1) {
              uno.unoVulnerableUid = actorSaidUno ? null : actorUid;
            } else {
              if (uno.unoVulnerableUid === actorUid) {
                uno.unoVulnerableUid = null;
              }
              if (nextHand.length > 2) {
                nextSaidUno = false;
              }
            }

            nextPlayers[actorUid] = stripUndefined({
              ...actor,
              cardCount: nextHand.length,
              saidUno: nextSaidUno,
              lastActionText: `Played ${formatCardName(card)}`,
            });

            if (nextHand.length === 0) {
              const opponentCards = room.playerOrder
                .filter((pid) => pid !== actorUid)
                .reduce((sum, pid) => sum + (nextPlayers[pid]?.cardCount ?? 0), 0);
              const awarded = Math.max(10, opponentCards * 12);
              nextPlayers[actorUid] = stripUndefined({
                ...nextPlayers[actorUid],
                score: (nextPlayers[actorUid]?.score ?? 0) + awarded,
              });
              const scores: Record<string, number> = {};
              for (const pid of room.playerOrder) {
                scores[pid] = nextPlayers[pid]?.score ?? 0;
              }
              nextPhase = 'finished';
              table.turnDeadlineAt = null;
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Played ${formatCardName(card)} and WON!`
              );
              table.outcome = {
                gameId: 'uno',
                winnerUids: [actorUid],
                loserUid: null,
                reason: `${actor.name} emptied their hand and won +${awarded} pts!`,
                scores,
                revealedHands: { [actorUid]: [] },
              };
            } else {
              const nPlayers = room.playerOrder.length;
              if (card.value === 'reverse') {
                if (nPlayers === 2 && room.settings.uno.twoPlayerReverseActsAsSkip) {
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    'Played Reverse (acts as Skip — goes again!).'
                  );
                } else {
                  table.direction = table.direction === 1 ? -1 : 1;
                  table.turnIndex = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 1);
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    'Played Reverse (direction flipped).'
                  );
                }
              } else if (card.value === 'skip') {
                const skippedIdx = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 1);
                const skippedName = nextPlayers[room.playerOrder[skippedIdx]]?.name || 'Player';
                table.turnIndex = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 2);
                table.actionLog = pushActionLog(
                  table.actionLog,
                  actorUid,
                  actor.name,
                  `Played ${formatCardName(card)} — skipped ${skippedName}.`
                );
              } else if (card.value === 'draw2' || card.value === 'wild4') {
                const drawAmt = card.value === 'wild4' ? 4 : 2;
                if (room.settings.uno.stackDrawCards) {
                  uno.pendingDrawCount += drawAmt;
                  table.turnIndex = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 1);
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    card.value === 'wild4'
                      ? `Played Wild +4 (${uno.activeColor.toUpperCase()}, +${uno.pendingDrawCount} pending!).`
                      : `Played ${formatCardName(card)} (+${uno.pendingDrawCount} stacked!).`
                  );
                } else {
                  const victimIdx = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 1);
                  const victimUid = room.playerOrder[victimIdx];
                  const penaltyCards: UnoCard[] = [];
                  for (let i = 0; i < drawAmt; i++) {
                    const d = drawUnoCardFromDeck(deckDoc);
                    if (d) penaltyCards.push(d);
                  }
                  if (penaltyCards.length > 0 && victimUid && victimUid !== actorUid) {
                    const transferId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    batch.set(doc(firestoreDb, 'card_rooms', code, 'card_transfers', transferId), {
                      id: transferId,
                      from: actorUid,
                      to: victimUid,
                      reason: 'uno_penalty',
                      cards: penaltyCards,
                      createdAt: serverTimestamp(),
                    });
                  }
                  if (victimUid && nextPlayers[victimUid]) {
                    nextPlayers[victimUid] = stripUndefined({
                      ...nextPlayers[victimUid],
                      cardCount: nextPlayers[victimUid].cardCount + penaltyCards.length,
                      saidUno: false,
                    });
                  }
                  table.turnIndex = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 2);
                  table.actionLog = pushActionLog(
                    table.actionLog,
                    actorUid,
                    actor.name,
                    `Played ${formatCardName(card)} — ${nextPlayers[victimUid]?.name || 'Next player'} draws ${drawAmt} & skips.`
                  );
                }
              } else {
                table.turnIndex = stepCardTurnIndex(nPlayers, table.turnIndex, table.direction, 1);
                table.actionLog = pushActionLog(
                  table.actionLog,
                  actorUid,
                  actor.name,
                  card.color === 'wild'
                    ? `Played Wild → color ${uno.activeColor.toUpperCase()}.`
                    : `Played ${formatCardName(card)}.`
                );
              }
              table.turnUid = room.playerOrder[table.turnIndex] ?? null;
              const clocks = makeTurnTimes('uno', room.settings);
              table.turnStartedAt = clocks.turnStartedAt;
              table.turnDeadlineAt = clocks.turnDeadlineAt;
            }
            uno.drawPileCount = deckDoc.drawPile.length;
            uno.discardCount = deckDoc.unoDiscard.length;
          } else {
            throw new Error('INVALID_UNO_ACTION');
          }
        }
      }

      // ================= SATYO =================
      else if (room.selectedGame === 'satyo' && table.satyo) {
        if (actorUid !== currentTurnUid) throw new Error('NOT_YOUR_TURN');
        const satyo = table.satyo;
        const boardCount = SUITS.reduce((sum, s) => sum + satyo.lanes[s].cardsCount, 0);

        if (action.type === 'satyo_pass') {
          const hasLegal = nextHand.some((c) =>
            isSatyoCardPlayable(c, satyo.lanes, boardCount, room.settings.satyo)
          );
          if (room.settings.satyo.mustPlayIfAble && hasLegal) {
            throw new Error('MUST_PLAY_LEGAL_CARD');
          }
          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            lastActionText: 'Passed',
          });
          table.actionLog = pushActionLog(table.actionLog, actorUid, actor.name, 'Passed.');
          table.turnIndex = stepCardTurnIndex(room.playerOrder.length, table.turnIndex, 1, 1);
          table.turnUid = room.playerOrder[table.turnIndex] ?? null;
          const clocks = makeTurnTimes('satyo', room.settings);
          table.turnStartedAt = clocks.turnStartedAt;
          table.turnDeadlineAt = clocks.turnDeadlineAt;
        } else if (action.type === 'satyo_play') {
          const idx = nextHand.findIndex((c) => c.id === action.cardId);
          if (idx === -1) throw new Error('CARD_NOT_IN_HAND');
          const card = nextHand[idx];
          if (!isSatyoCardPlayable(card, satyo.lanes, boardCount, room.settings.satyo)) {
            throw new Error('ILLEGAL_SATYO_PLAY');
          }
          if (card.kind !== 'standard') throw new Error('INVALID_CARD');

          touchedHand = true;
          nextHand.splice(idx, 1);
          const lane = satyo.lanes[card.suit];
          if (!lane.started) {
            lane.started = true;
            lane.low = 7;
            lane.high = 7;
            lane.cardsCount = 1;
          } else {
            if (card.rank === 1) {
              if (
                lane.low === 2 &&
                (room.settings.satyo.aceRule === 'low' || room.settings.satyo.aceRule === 'both')
              ) {
                lane.low = 1;
              } else {
                lane.high = 14;
              }
            } else if (lane.low !== null && card.rank < lane.low) {
              lane.low = card.rank;
            } else {
              lane.high = card.rank;
            }
            lane.cardsCount += 1;
          }
          satyo.boardCardCount = SUITS.reduce((sum, s) => sum + satyo.lanes[s].cardsCount, 0);

          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            cardCount: nextHand.length,
            lastActionText: `Placed ${formatCardName(card)}`,
          });
          table.actionLog = pushActionLog(
            table.actionLog,
            actorUid,
            actor.name,
            `Placed ${formatCardName(card)}.`
          );

          if (nextHand.length === 0) {
            const opponentCards = room.playerOrder
              .filter((pid) => pid !== actorUid)
              .reduce((sum, pid) => sum + (nextPlayers[pid]?.cardCount ?? 0), 0);
            const awarded =
              room.settings.satyo.scoringMode === 'pip_sum'
                ? Math.max(10, opponentCards * 7)
                : 10;
            nextPlayers[actorUid] = stripUndefined({
              ...nextPlayers[actorUid],
              score: (nextPlayers[actorUid]?.score ?? 0) + awarded,
            });
            const scores: Record<string, number> = {};
            for (const pid of room.playerOrder) {
              scores[pid] = nextPlayers[pid]?.score ?? 0;
            }
            nextPhase = 'finished';
            table.turnDeadlineAt = null;
            table.outcome = {
              gameId: 'satyo',
              winnerUids: [actorUid],
              loserUid: null,
              reason: `${actor.name} completed their hand first (+${awarded} pts)!`,
              scores,
              revealedHands: { [actorUid]: [] },
            };
          } else {
            table.turnIndex = stepCardTurnIndex(room.playerOrder.length, table.turnIndex, 1, 1);
            table.turnUid = room.playerOrder[table.turnIndex] ?? null;
            const clocks = makeTurnTimes('satyo', room.settings);
            table.turnStartedAt = clocks.turnStartedAt;
            table.turnDeadlineAt = clocks.turnDeadlineAt;
          }
        } else {
          throw new Error('INVALID_SATYO_ACTION');
        }
      }

      // ================= MONGOOSE =================
      else if (room.selectedGame === 'mongoose' && table.mongoose) {
        if (actorUid !== currentTurnUid) throw new Error('NOT_YOUR_TURN');
        const mongoose = table.mongoose;

        if (action.type === 'mongoose_pickup') {
          touchedHand = true;
          touchedDeck = true;

          if (deckDoc.mongooseStack.length > 0) {
            const pickedCount = deckDoc.mongooseStack.length;
            nextHand = sortCardHand([...nextHand, ...deckDoc.mongooseStack]);
            deckDoc.mongooseStack = [];
            mongoose.lastPlayedByUid = null;
            nextPlayers[actorUid] = stripUndefined({
              ...actor,
              cardCount: nextHand.length,
              lastActionText: `Picked up ${pickedCount}`,
            });
            table.actionLog = pushActionLog(
              table.actionLog,
              actorUid,
              actor.name,
              `Picked up the ${pickedCount}-card center stack.`
            );
          } else {
            const drawn = deckDoc.drawPile.pop();
            if (drawn && drawn.kind !== 'uno') {
              nextHand = sortCardHand([...nextHand, drawn]);
              nextPlayers[actorUid] = stripUndefined({
                ...actor,
                cardCount: nextHand.length,
                lastActionText: 'Drew 1',
              });
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                'Drew 1 card from the stockpile.'
              );
            } else {
              touchedHand = false;
              nextPlayers[actorUid] = stripUndefined({
                ...actor,
                lastActionText: 'Passed',
              });
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                'Passed turn.'
              );
            }
          }

          mongoose.uppermostCard =
            deckDoc.mongooseStack.length > 0
              ? deckDoc.mongooseStack[deckDoc.mongooseStack.length - 1]
              : null;
          mongoose.recentStackCards = deckDoc.mongooseStack.slice(-4);
          mongoose.stackCount = deckDoc.mongooseStack.length;
          mongoose.drawPileCount = deckDoc.drawPile.length;

          table.turnIndex = stepCardTurnIndex(room.playerOrder.length, table.turnIndex, 1, 1);
          table.turnUid = room.playerOrder[table.turnIndex] ?? null;
          const clocks = makeTurnTimes('mongoose', room.settings);
          table.turnStartedAt = clocks.turnStartedAt;
          table.turnDeadlineAt = clocks.turnDeadlineAt;
        } else if (action.type === 'mongoose_play') {
          if (!Array.isArray(action.cardIds) || action.cardIds.length === 0) {
            throw new Error('SELECT_CARD_TO_PLAY');
          }
          const uniqueIds = Array.from(new Set(action.cardIds));
          if (uniqueIds.length !== action.cardIds.length) {
            throw new Error('DUPLICATE_CARD_SELECTED');
          }
          const selected: Array<StandardCard | JokerCard> = [];
          for (const cid of uniqueIds) {
            const found = nextHand.find((c) => c.id === cid);
            if (!found || found.kind === 'uno') {
              throw new Error('CARD_NOT_IN_HAND');
            }
            selected.push(found);
          }

          const prevTop =
            deckDoc.mongooseStack.length > 0
              ? deckDoc.mongooseStack[deckDoc.mongooseStack.length - 1]
              : mongoose.uppermostCard ?? null;

          if (!isMongoosePlayLegal(selected, prevTop, room.settings.mongoose)) {
            throw new Error('ILLEGAL_MONGOOSE_PLAY');
          }

          touchedHand = true;
          touchedDeck = true;
          nextHand = nextHand.filter((c) => !uniqueIds.includes(c.id));
          deckDoc.mongooseStack.push(...selected);

          const playedText = selected.map((c) => formatCardName(c)).join(' + ');
          const topPlayed = selected[selected.length - 1];
          const rankMatched = prevTop !== null && prevTop.rank === topPlayed.rank;
          const isTenBurn =
            room.settings.mongoose.specialCardsRule === 'tens_burn_aces_skip' &&
            topPlayed.rank === 10;
          const isAceSkip =
            room.settings.mongoose.specialCardsRule === 'tens_burn_aces_skip' &&
            topPlayed.rank === 1 &&
            !rankMatched;

          let grantBonusTurn = false;
          let skipNext = false;
          let nextActorScore = actor.score;
          let actionText = `Played ${playedText}`;

          if (isTenBurn) {
            const burned = deckDoc.mongooseStack.length;
            mongoose.burnedCount += burned;
            deckDoc.mongooseStack = [];
            mongoose.lastPlayedByUid = null;
            grantBonusTurn = true;
            actionText = `10 Burn (${burned})`;
            table.actionLog = pushActionLog(
              table.actionLog,
              actorUid,
              actor.name,
              `Played ${playedText} — 10 BURNS ${burned} cards & bonus turn!`
            );
          } else if (rankMatched) {
            const eff = room.settings.mongoose.captureEffect;
            const pileSize = deckDoc.mongooseStack.length;
            if (eff === 'give_pile_to_previous') {
              const prevUid = mongoose.lastPlayedByUid;
              if (prevUid && prevUid !== actorUid && nextPlayers[prevUid]) {
                const pileCards = [...deckDoc.mongooseStack];
                const transferId = `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                batch.set(doc(firestoreDb, 'card_rooms', code, 'card_transfers', transferId), {
                  id: transferId,
                  from: actorUid,
                  to: prevUid,
                  reason: 'mongoose_pile',
                  cards: pileCards,
                  createdAt: serverTimestamp(),
                });
                nextPlayers[prevUid] = stripUndefined({
                  ...nextPlayers[prevUid],
                  cardCount: nextPlayers[prevUid].cardCount + pileSize,
                });
                deckDoc.mongooseStack = [];
                mongoose.lastPlayedByUid = null;
                actionText = `Matched! Sent ${pileSize}`;
                table.actionLog = pushActionLog(
                  table.actionLog,
                  actorUid,
                  actor.name,
                  `Matched rank with ${playedText} — ${nextPlayers[prevUid]?.name || 'Previous'} picks up ${pileSize} cards!`
                );
              } else {
                mongoose.burnedCount += pileSize;
                deckDoc.mongooseStack = [];
                mongoose.lastPlayedByUid = null;
                actionText = `Cleared ${pileSize}`;
                table.actionLog = pushActionLog(
                  table.actionLog,
                  actorUid,
                  actor.name,
                  `Played ${playedText} — cleared ${pileSize} cards.`
                );
              }
            } else if (eff === 'collect_pile_to_score') {
              nextActorScore += pileSize;
              deckDoc.mongooseStack = [];
              mongoose.lastPlayedByUid = null;
              actionText = `Collected +${pileSize}`;
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Matched rank with ${playedText} — collected ${pileSize} cards to bank!`
              );
            } else {
              mongoose.burnedCount += pileSize;
              deckDoc.mongooseStack = [];
              mongoose.lastPlayedByUid = null;
              grantBonusTurn = true;
              nextActorScore += Math.max(1, Math.floor(pileSize / 2));
              actionText = `Burned ${pileSize}!`;
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Matched rank with ${playedText} — burned ${pileSize} cards & gets a bonus turn!`
              );
            }
          } else {
            mongoose.lastPlayedByUid = actorUid;
            if (isAceSkip) {
              skipNext = true;
              actionText = `${playedText} (Skip)`;
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Played ${playedText} — Ace skips next player!`
              );
            } else {
              table.actionLog = pushActionLog(
                table.actionLog,
                actorUid,
                actor.name,
                `Played ${playedText} onto stack.`
              );
            }
          }

          while (deckDoc.drawPile.length > 0 && nextHand.length < 5) {
            const d = deckDoc.drawPile.pop();
            if (d && d.kind !== 'uno') {
              nextHand.push(d);
            }
          }
          nextHand = sortCardHand(nextHand);

          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            cardCount: nextHand.length,
            score: nextActorScore,
            lastActionText: actionText,
          });

          mongoose.uppermostCard =
            deckDoc.mongooseStack.length > 0
              ? deckDoc.mongooseStack[deckDoc.mongooseStack.length - 1]
              : null;
          mongoose.recentStackCards = deckDoc.mongooseStack.slice(-4);
          mongoose.stackCount = deckDoc.mongooseStack.length;
          mongoose.drawPileCount = deckDoc.drawPile.length;

          if (nextHand.length === 0 && deckDoc.drawPile.length === 0) {
            let winnerUids = [actorUid];
            let reason = `${actor.name} cleared their hand first and won Mongoose!`;

            if (room.settings.mongoose.captureEffect === 'collect_pile_to_score') {
              nextPlayers[actorUid].score += 5;
              const maxScore = Math.max(
                ...room.playerOrder.map((pid) => nextPlayers[pid]?.score ?? 0)
              );
              winnerUids = room.playerOrder.filter(
                (pid) => (nextPlayers[pid]?.score ?? 0) === maxScore
              );
              const names = winnerUids
                .map((pid) => nextPlayers[pid]?.name || 'Player')
                .join(' & ');
              reason = `${names} won Collector Mongoose with ${maxScore} points!`;
            } else {
              nextPlayers[actorUid].score += 15;
            }

            const scores: Record<string, number> = {};
            for (const pid of room.playerOrder) {
              scores[pid] = nextPlayers[pid]?.score ?? 0;
            }
            nextPhase = 'finished';
            table.turnDeadlineAt = null;
            table.outcome = {
              gameId: 'mongoose',
              winnerUids,
              loserUid: null,
              reason,
              scores,
              revealedHands: { [actorUid]: [] },
            };
          } else {
            if (!grantBonusTurn) {
              table.turnIndex = stepCardTurnIndex(
                room.playerOrder.length,
                table.turnIndex,
                1,
                skipNext ? 2 : 1
              );
              table.turnUid = room.playerOrder[table.turnIndex] ?? null;
            }
            const clocks = makeTurnTimes('mongoose', room.settings);
            table.turnStartedAt = clocks.turnStartedAt;
            table.turnDeadlineAt = clocks.turnDeadlineAt;
          }
        } else {
          throw new Error('INVALID_MONGOOSE_ACTION');
        }
      }

      // ================= GADHA CHOR =================
      else if (room.selectedGame === 'gadha_chor' && table.gadhaChor) {
        const gc = table.gadhaChor;

        if (action.type === 'gadha_shuffle_hand') {
          touchedHand = true;
          nextHand = shuffleCardArray(myHand);
          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            lastActionText: 'Shuffled hand',
          });
          table.actionLog = pushActionLog(
            table.actionLog,
            actorUid,
            actor.name,
            'Shuffled their cards.'
          );
        } else if (action.type === 'gadha_discard_pair') {
          const [idA, idB] = action.cardIds;
          const cardA = myHand.find((c) => c.id === idA);
          const cardB = myHand.find((c) => c.id === idB);
          if (!cardA || !cardB) throw new Error('CARD_NOT_IN_HAND');
          if (!areGadhaCardsPair(cardA, cardB, room.settings.gadha_chor.pairRule)) {
            throw new Error('NOT_A_VALID_PAIR');
          }

          touchedHand = true;
          nextHand = myHand.filter((c) => c.id !== idA && c.id !== idB);
          gc.pairsClearedTotal += 1;
          nextPlayers[actorUid] = stripUndefined({
            ...actor,
            cardCount: nextHand.length,
            safe: nextHand.length === 0,
            lastActionText: `Dropped pair ${formatCardName(cardA)} + ${formatCardName(cardB)}`,
          });

          table.actionLog = pushActionLog(
            table.actionLog,
            actorUid,
            actor.name,
            `Discarded pair (${formatCardName(cardA)} & ${formatCardName(cardB)}).`
          );

          if (nextHand.length === 0) {
            if (!gc.safeOrder.includes(actorUid)) gc.safeOrder.push(actorUid);
            table.actionLog = pushActionLog(
              table.actionLog,
              actorUid,
              actor.name,
              `${actor.name} has no cards left — SAFE!`
            );
          }

          const activeRemaining = room.playerOrder.filter(
            (pid) => (nextPlayers[pid]?.cardCount ?? 0) > 0
          );

          if (activeRemaining.length <= 1) {
            nextPhase = 'finished';
            const fin = finalizeGadhaChorTable(room, nextPlayers, table, table.actionLog);
            Object.assign(nextPlayers, fin.nextPlayers);
            Object.assign(table, fin.nextTable);
          } else {
            if (currentTurnUid && (nextPlayers[currentTurnUid]?.cardCount ?? 0) === 0) {
              const nextIdx = findNextGadhaTurnIndex(
                room.playerOrder,
                nextPlayers,
                currentTurnUid,
                table.turnIndex,
                room.settings.gadha_chor.pickDirection
              );
              table.turnIndex = nextIdx;
              table.turnUid = room.playerOrder[nextIdx] ?? null;
              const clocks = makeTurnTimes('gadha_chor', room.settings);
              table.turnStartedAt = clocks.turnStartedAt;
              table.turnDeadlineAt = clocks.turnDeadlineAt;
            }
            const tUid = table.turnUid
              ? getGadhaTargetUidFromCounts(
                  room.playerOrder,
                  nextPlayers,
                  table.turnUid,
                  room.settings.gadha_chor.pickDirection
                )
              : null;
            gc.targetUid = tUid;
            gc.targetCardCount = tUid ? nextPlayers[tUid]?.cardCount ?? 0 : 0;
          }
        } else if (action.type === 'gadha_pick') {
          if (actorUid !== currentTurnUid) throw new Error('NOT_YOUR_TURN');
          if (gc.pendingPick) throw new Error('PICK_IN_PROGRESS');
          const targetUid = getGadhaTargetUidFromCounts(
            room.playerOrder,
            nextPlayers,
            actorUid,
            room.settings.gadha_chor.pickDirection
          );
          if (!targetUid) {
            nextPhase = 'finished';
            const fin = finalizeGadhaChorTable(room, nextPlayers, table, table.actionLog);
            Object.assign(nextPlayers, fin.nextPlayers);
            Object.assign(table, fin.nextTable);
          } else {
            const targetCount = nextPlayers[targetUid]?.cardCount ?? 0;
            const index = Math.floor(action.index);
            if (!Number.isFinite(index) || index < 0 || index >= Math.max(1, targetCount)) {
              throw new Error('INVALID_CARD_INDEX');
            }
            gc.pendingPick = {
              id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              pickerUid: actorUid,
              targetUid,
              index,
            };
          }
        } else {
          throw new Error('INVALID_GADHA_CHOR_ACTION');
        }
      } else {
        throw new Error('GAME_NOT_ACTIVE');
      }

      if (touchedHand) {
        batch.set(handRef, {
          ownerId: actorUid,
          cards: nextHand,
          updatedAt: serverTimestamp(),
        });
      }

      if (touchedDeck) {
        batch.set(deckRef, {
          drawPile: deckDoc.drawPile,
          unoDiscard: deckDoc.unoDiscard,
          mongooseStack: deckDoc.mongooseStack,
          updatedAt: serverTimestamp(),
        });
      }

      batch.update(roomRef, {
        phase: nextPhase,
        players: stripUndefined(nextPlayers),
        table: stripUndefined(table),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }

      if (touchedHand) {
        this.latestHand = nextHand;
      }
      return this.buildFallbackClientState();
    });
  }

  public async playAgain(
    code: string,
    uid: string,
    mode: 'lobby' | 'redeal'
  ): Promise<CardRoomClientState> {
    if (!isFirestoreConfigured()) {
      return this.httpPlayAgain(code, uid, mode);
    }
    const actorUid = auth.currentUser?.uid || uid;
    if (mode === 'redeal') {
      return this.startGame(code, actorUid);
    }

    const roomPath = `card_rooms/${code}`;
    const roomRef = doc(firestoreDb, 'card_rooms', code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    const room = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
    if (room.hostId !== actorUid) throw new Error('HOST_ONLY');

    const resetPlayers: Record<string, CardPlayerPublic> = {};
    for (const [pid, p] of Object.entries(room.players)) {
      resetPlayers[pid] = stripUndefined({
        ...p,
        ready: false,
        safe: false,
        saidUno: false,
        cardCount: 0,
        lastActionText: undefined,
      });
    }

    try {
      await updateDoc(roomRef, {
        phase: 'lobby',
        players: resetPlayers,
        table: null,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, roomPath);
    }

    this.latestHand = [];
    return this.buildFallbackClientState();
  }

  public async updateMuteState(uid: string, isMuted: boolean): Promise<void> {
    if (!this.activeCode) return;
    if (!isFirestoreConfigured()) {
      await fetch(`/api/card-rooms/${this.activeCode}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted, playerId: uid }),
      }).catch(() => {});
      return;
    }
    const actorUid = auth.currentUser?.uid || uid;
    try {
      await updateDoc(doc(firestoreDb, 'card_rooms', this.activeCode), {
        [`players.${actorUid}.isMuted`]: isMuted,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignore transient mute sync error
    }
  }

  public async sendSignal(signal: Omit<SignalPayload, 'id' | 'timestamp'>): Promise<void> {
    if (!this.activeCode) return;
    if (!isFirestoreConfigured()) {
      if (!this.myUid) return;
      await fetch(`/api/card-rooms/${this.activeCode}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.myUid,
          signal: {
            ...signal,
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
          },
        }),
      }).catch(() => {});
      return;
    }

    if (!auth.currentUser) return;
    const sigId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sigPath = `card_rooms/${this.activeCode}/signals/${sigId}`;
    try {
      await setDoc(doc(firestoreDb, 'card_rooms', this.activeCode, 'signals', sigId), {
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
    const actorUid = isFirestoreConfigured() && auth.currentUser ? auth.currentUser.uid : uid;
    saveActiveCardRoomCode(actorUid, null);

    if (!isFirestoreConfigured()) {
      this.cleanup();
      await fetch(`/api/card-rooms/${code}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: actorUid }),
      }).catch(() => {});
      return;
    }

    const roomRef = doc(firestoreDb, 'card_rooms', code);
    try {
      await deleteDoc(doc(firestoreDb, 'card_rooms', code, 'hands', actorUid)).catch(() => {});
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const room = normalizeCardRoom(snap.data() as CardRoomFirestoreDoc);
        const remainingIds = room.playerIds.filter((id) => id !== actorUid);
        if (remainingIds.length === 0) {
          await deleteDoc(doc(firestoreDb, 'card_rooms', code, 'deck', 'state')).catch(() => {});
          await deleteDoc(roomRef);
        } else {
          const nextOrder = room.playerOrder.filter((id) => id !== actorUid);
          const nextHostId = room.hostId === actorUid ? (nextOrder[0] || remainingIds[0]) : room.hostId;
          const updates: Record<string, unknown> = {
            playerIds: remainingIds,
            playerOrder: nextOrder,
            [`players.${actorUid}`]: deleteField(),
            hostId: nextHostId,
            [`players.${nextHostId}.isHost`]: true,
            updatedAt: serverTimestamp(),
          };

          if (room.phase === 'playing') {
            if (nextOrder.length < 2) {
              updates.phase = 'lobby';
              updates.table = null;
            } else if (room.table && room.table.turnUid === actorUid) {
              const prevIdx = Math.max(0, room.playerOrder.indexOf(actorUid));
              const nextIdx = prevIdx % nextOrder.length;
              const nextTurnUid = nextOrder[nextIdx] ?? nextOrder[0];
              const clocks = makeTurnTimes(room.selectedGame, room.settings);
              updates['table.playerOrder'] = nextOrder;
              updates['table.turnIndex'] = nextIdx;
              updates['table.turnUid'] = nextTurnUid;
              updates['table.turnStartedAt'] = clocks.turnStartedAt;
              updates['table.turnDeadlineAt'] = clocks.turnDeadlineAt;
              if (room.selectedGame === 'gadha_chor' && room.table.gadhaChor) {
                const remainingPlayers = { ...room.players };
                delete remainingPlayers[actorUid];
                const tUid = getGadhaTargetUidFromCounts(
                  nextOrder,
                  remainingPlayers,
                  nextTurnUid,
                  room.settings.gadha_chor.pickDirection
                );
                updates['table.gadhaChor.targetUid'] = tUid;
                updates['table.gadhaChor.targetCardCount'] = tUid
                  ? remainingPlayers[tUid]?.cardCount ?? 0
                  : 0;
                updates['table.gadhaChor.pendingPick'] = null;
              }
            }
          }

          await updateDoc(roomRef, updates);
        }
      }
    } catch {
      // Ignore cleanup errors on exit
    } finally {
      this.cleanup();
    }
  }

  public cleanup(): void {
    this.clearListeners();
    this.activeCode = null;
    this.myUid = null;
    this.callbacks = null;
    this.latestRoom = null;
    this.latestHand = [];
    this.processedTransferIds.clear();
    this.resolvingPickId = null;
  }

  private buildFallbackClientState(): CardRoomClientState {
    if (this.latestRoom) {
      return {
        code: this.latestRoom.code,
        hostId: this.latestRoom.hostId,
        selectedGame: this.latestRoom.selectedGame,
        phase: this.latestRoom.phase,
        createdAt: this.latestRoom.createdAt,
        updatedAt: this.latestRoom.updatedAt,
        settings: this.latestRoom.settings,
        players: this.latestRoom.players,
        playerOrder: this.latestRoom.playerOrder,
        table: this.latestRoom.table,
        myHand: this.latestRoom.phase === 'lobby' ? [] : [...this.latestHand],
      };
    }
    return {
      code: this.activeCode || '',
      hostId: this.myUid || '',
      selectedGame: 'uno',
      phase: 'lobby',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: cloneDefaultCardSettings(),
      players: {},
      playerOrder: [],
      table: null,
      myHand: [],
    };
  }

  // ---------------- Local Non-Firebase HTTP/SSE Fallback ----------------
  private openHttpEventStream(code: string, uid: string) {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    const qs = new URLSearchParams({ playerId: uid });
    const es = new EventSource(`/api/card-rooms/${code}/events?${qs.toString()}`);
    this.eventSource = es;

    es.addEventListener('card_room_state', (evt: MessageEvent) => {
      try {
        const nextState = JSON.parse(evt.data) as CardRoomClientState;
        this.callbacks?.onState(nextState);
      } catch {
        // Ignore malformed SSE payload
      }
    });

    es.addEventListener('card_signal', (evt: MessageEvent) => {
      try {
        const sig = JSON.parse(evt.data) as SignalPayload;
        this.callbacks?.onSignal(sig);
      } catch {
        // Ignore malformed signal payload
      }
    });

    es.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.callbacks?.onError?.('DISCONNECTED');
      }
    };
  }

  private async httpPostJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { code?: string } & T;
    if (!res.ok) {
      throw new Error(data.code || `HTTP_${res.status}`);
    }
    return data;
  }

  private async httpCreateRoom(
    code: string,
    selectedGame: CardGameId,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    this.callbacks = callbacks;
    this.activeCode = code;
    this.myUid = player.id;
    const data = await this.httpPostJson<{ state: CardRoomClientState }>('/api/card-rooms', {
      code,
      selectedGame,
      player,
    });
    saveActiveCardRoomCode(player.id, code);
    callbacks.onState(data.state);
    this.openHttpEventStream(code, player.id);
    return data.state;
  }

  private async httpJoinRoom(
    cleanCode: string,
    player: { id: string; name: string; avatar: PlayerAvatar },
    callbacks: CardRoomCallbacks
  ): Promise<CardRoomClientState> {
    this.callbacks = callbacks;
    this.activeCode = cleanCode;
    this.myUid = player.id;
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${cleanCode}/join`,
      { player }
    );
    saveActiveCardRoomCode(player.id, cleanCode);
    callbacks.onState(data.state);
    this.openHttpEventStream(cleanCode, player.id);
    return data.state;
  }

  private async httpSetReady(code: string, uid: string, ready: boolean) {
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/ready`,
      { ready, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  private async httpUpdateConfig(
    code: string,
    uid: string,
    payload: { selectedGame?: CardGameId; settings?: Partial<CardGameSettingsMap> }
  ) {
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/config`,
      { ...payload, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  private async httpStartGame(code: string, uid: string) {
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/start`,
      { playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  private async httpSendAction(code: string, uid: string, action: CardActionPayload) {
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/action`,
      { action, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }

  private async httpPlayAgain(code: string, uid: string, mode: 'lobby' | 'redeal') {
    const data = await this.httpPostJson<{ state: CardRoomClientState }>(
      `/api/card-rooms/${code}/play-again`,
      { mode, playerId: uid }
    );
    this.callbacks?.onState(data.state);
    return data.state;
  }
}

export const cardRoomService = new CardRoomService();
