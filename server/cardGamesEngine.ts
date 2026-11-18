import type { PlayerAvatar } from '../src/types/game.ts';
import type {
  CardActionPayload,
  CardGameId,
  CardGameOutcome,
  CardGameSettingsMap,
  CardItem,
  CardLogEntry,
  CardPlayerPublic,
  CardRoomClientState,
  CardRoomPhase,
  CardTablePublicState,
  GadhaChorSettings,
  JokerCard,
  MongooseSettings,
  SatyoLanePublic,
  SatyoSettings,
  StandardCard,
  StandardRank,
  StandardSuit,
  UnoCard,
  UnoChosenColor,
  UnoSettings,
  UnoValue,
} from '../src/types/cardGames.ts';

const SUITS: StandardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: StandardRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const UNO_COLORS: UnoChosenColor[] = ['red', 'blue', 'green', 'yellow'];

export const DEFAULT_ENGINE_SETTINGS: CardGameSettingsMap = {
  uno: {
    startingHandSize: 7,
    stackDrawCards: true,
    drawUntilPlayable: false,
    twoPlayerReverseActsAsSkip: true,
    unoPenaltyCards: 2,
    turnTimerSeconds: 30,
  },
  satyo: {
    mustPlayIfAble: true,
    aceRule: 'low',
    startingSeven: 'hearts',
    scoringMode: 'first_out',
    turnTimerSeconds: 30,
  },
  mongoose: {
    matchRule: 'rank_or_suit',
    captureEffect: 'give_pile_to_previous',
    allowMultiCardPlay: true,
    specialCardsRule: 'tens_burn_aces_skip',
    turnTimerSeconds: 30,
  },
  gadha_chor: {
    oddCard: 'queen_spades',
    pairRule: 'any_same_rank',
    autoDiscardPairs: false,
    pickDirection: 'clockwise',
    turnTimerSeconds: 30,
  },
};

export interface CardPlayerInternal {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  isMuted: boolean;
  joinedAt: number;
  score: number;
  safe: boolean;
  saidUno: boolean;
  lastActionText?: string;
}

export interface CardRoomInternal {
  code: string;
  hostId: string;
  selectedGame: CardGameId;
  phase: CardRoomPhase;
  createdAt: number;
  updatedAt: number;
  settings: CardGameSettingsMap;
  players: Record<string, CardPlayerInternal>;
  playerOrder: string[];
  /** Hidden server-authoritative card state — NEVER serialized directly to all clients */
  hands: Record<string, CardItem[]>;
  deck: CardItem[];
  discardUno: UnoCard[];
  stackMongoose: Array<StandardCard | JokerCard>;
  capturedMongooseCounts: Record<string, number>;
  burnedMongooseCount: number;
  satyoLanes: Record<StandardSuit, SatyoLanePublic>;
  roundNumber: number;
  turnIndex: number;
  direction: 1 | -1;
  turnStartedAt: number;
  turnDeadlineAt: number | null;
  actionLog: CardLogEntry[];
  activeUnoColor: UnoChosenColor;
  pendingUnoDraw: number;
  unoVulnerableUid: string | null;
  unoHasDrawnThisTurn: boolean;
  mongooseLastPlayedByUid: string | null;
  gadhaPairsClearedTotal: number;
  gadhaSafeOrder: string[];
  outcome: CardGameOutcome | null;
  actionNonce: number;
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function rankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    case 0:
      return 'JOKER';
    default:
      return String(rank);
  }
}

export function suitSymbol(suit: StandardSuit | 'joker'): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
    case 'joker':
      return '★';
  }
}

export function formatCardName(card: CardItem): string {
  if (card.kind === 'uno') {
    const colorText = card.color === 'wild' ? '' : `${card.color.toUpperCase()} `;
    return `${colorText}${card.value.toUpperCase()}`;
  }
  if (card.kind === 'joker') {
    return 'Joker';
  }
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export function buildUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  let seq = 1;
  for (const color of UNO_COLORS) {
    deck.push({ id: `uno_${seq++}`, kind: 'uno', color, value: '0' });
    const doubled: UnoValue[] = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'skip',
      'reverse',
      'draw2',
    ];
    for (const val of doubled) {
      deck.push({ id: `uno_${seq++}`, kind: 'uno', color, value: val });
      deck.push({ id: `uno_${seq++}`, kind: 'uno', color, value: val });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `uno_${seq++}`, kind: 'uno', color: 'wild', value: 'wild' });
    deck.push({ id: `uno_${seq++}`, kind: 'uno', color: 'wild', value: 'wild4' });
  }
  return shuffleArray(deck);
}

export function buildStandardDeck(includeJoker = false): Array<StandardCard | JokerCard> {
  const deck: Array<StandardCard | JokerCard> = [];
  let seq = 1;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `std_${suit}_${rank}_${seq++}`,
        kind: 'standard',
        suit,
        rank,
      });
    }
  }
  if (includeJoker) {
    deck.push({
      id: `std_joker_${seq++}`,
      kind: 'joker',
      suit: 'joker',
      rank: 0,
    });
  }
  return shuffleArray(deck);
}

export function buildGadhaChorDeck(oddCard: 'queen_spades' | 'joker'): Array<StandardCard | JokerCard> {
  if (oddCard === 'joker') {
    return buildStandardDeck(true);
  }
  // 49 cards: standard 52 minus Q♥, Q♦, Q♣ so Q♠ is the sole unpairable card
  const full = buildStandardDeck(false);
  return full.filter(
    (card) => !(card.kind === 'standard' && card.rank === 12 && card.suit !== 'spades')
  );
}

export function createEmptySatyoLanes(): Record<StandardSuit, SatyoLanePublic> {
  return {
    spades: { started: false, low: null, high: null, cardsCount: 0 },
    hearts: { started: false, low: null, high: null, cardsCount: 0 },
    diamonds: { started: false, low: null, high: null, cardsCount: 0 },
    clubs: { started: false, low: null, high: null, cardsCount: 0 },
  };
}

export function getPlayerLimits(gameId: CardGameId): { min: number; max: number } {
  switch (gameId) {
    case 'satyo':
      return { min: 2, max: 6 };
    default:
      return { min: 2, max: 8 };
  }
}

export function createInitialCardRoom(
  code: string,
  hostPlayer: { id: string; name: string; avatar: PlayerAvatar },
  selectedGame: CardGameId = 'uno'
): CardRoomInternal {
  const now = Date.now();
  return {
    code,
    hostId: hostPlayer.id,
    selectedGame,
    phase: 'lobby',
    createdAt: now,
    updatedAt: now,
    settings: structuredClone(DEFAULT_ENGINE_SETTINGS),
    players: {
      [hostPlayer.id]: {
        id: hostPlayer.id,
        name: hostPlayer.name,
        avatar: hostPlayer.avatar,
        isHost: true,
        ready: false,
        connected: true,
        isMuted: false,
        joinedAt: now,
        score: 0,
        safe: false,
        saidUno: false,
      },
    },
    playerOrder: [hostPlayer.id],
    hands: {},
    deck: [],
    discardUno: [],
    stackMongoose: [],
    capturedMongooseCounts: {},
    burnedMongooseCount: 0,
    satyoLanes: createEmptySatyoLanes(),
    roundNumber: 0,
    turnIndex: 0,
    direction: 1,
    turnStartedAt: now,
    turnDeadlineAt: null,
    actionLog: [],
    activeUnoColor: 'red',
    pendingUnoDraw: 0,
    unoVulnerableUid: null,
    unoHasDrawnThisTurn: false,
    mongooseLastPlayedByUid: null,
    gadhaPairsClearedTotal: 0,
    gadhaSafeOrder: [],
    outcome: null,
    actionNonce: 0,
  };
}

function appendLog(room: CardRoomInternal, actorUid: string, actorName: string, text: string) {
  room.actionLog.unshift({
    id: `log_${Date.now()}_${++room.actionNonce}`,
    actorUid,
    actorName,
    text,
    timestamp: Date.now(),
  });
  if (room.actionLog.length > 24) {
    room.actionLog.length = 24;
  }
}

function getTimerSeconds(room: CardRoomInternal): number {
  switch (room.selectedGame) {
    case 'uno':
      return room.settings.uno.turnTimerSeconds;
    case 'satyo':
      return room.settings.satyo.turnTimerSeconds;
    case 'mongoose':
      return room.settings.mongoose.turnTimerSeconds;
    case 'gadha_chor':
      return room.settings.gadha_chor.turnTimerSeconds;
  }
}

function refreshTurnClock(room: CardRoomInternal) {
  const now = Date.now();
  const sec = getTimerSeconds(room);
  room.turnStartedAt = now;
  room.turnDeadlineAt = sec > 0 ? now + sec * 1000 : null;
  room.updatedAt = now;
}

function stepTurnIndex(length: number, current: number, direction: 1 | -1, steps = 1): number {
  if (length <= 0) return 0;
  return (((current + direction * steps) % length) + length) % length;
}

function sortStandardHand(cards: CardItem[]): CardItem[] {
  const suitOrder: Record<string, number> = {
    spades: 0,
    hearts: 1,
    diamonds: 2,
    clubs: 3,
    joker: 4,
  };
  return [...cards].sort((a, b) => {
    if (a.kind === 'uno' && b.kind === 'uno') {
      const colorOrder: Record<string, number> = {
        red: 0,
        blue: 1,
        green: 2,
        yellow: 3,
        wild: 4,
      };
      if (a.color !== b.color) return colorOrder[a.color] - colorOrder[b.color];
      return a.value.localeCompare(b.value);
    }
    if (a.kind !== 'uno' && b.kind !== 'uno') {
      if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
      return a.rank - b.rank;
    }
    return 0;
  });
}

function areGadhaCardsPair(
  a: CardItem,
  b: CardItem,
  pairRule: GadhaChorSettings['pairRule']
): boolean {
  if (a.id === b.id) return false;
  if (a.kind !== 'standard' || b.kind !== 'standard') return false;
  if (a.rank !== b.rank) return false;
  if (pairRule === 'any_same_rank') return true;
  const aRed = a.suit === 'hearts' || a.suit === 'diamonds';
  const bRed = b.suit === 'hearts' || b.suit === 'diamonds';
  return aRed === bRed;
}

function stripGadhaPairs(
  hand: CardItem[],
  pairRule: GadhaChorSettings['pairRule']
): { remaining: CardItem[]; pairsRemoved: number } {
  const pool = [...hand];
  let pairsRemoved = 0;

  let found = true;
  while (found) {
    found = false;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        if (areGadhaCardsPair(pool[i], pool[j], pairRule)) {
          pool.splice(j, 1);
          pool.splice(i, 1);
          pairsRemoved += 1;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  return { remaining: pool, pairsRemoved };
}

export function startCardGame(room: CardRoomInternal): void {
  const activeUids = Object.values(room.players)
    .filter((p) => p.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
    .map((p) => p.id);

  const limits = getPlayerLimits(room.selectedGame);
  if (activeUids.length < limits.min) {
    throw new Error(`NEED_AT_LEAST_${limits.min}_PLAYERS`);
  }
  if (activeUids.length > limits.max) {
    throw new Error(`MAX_${limits.max}_PLAYERS`);
  }

  room.playerOrder = activeUids;
  room.hands = {};
  room.deck = [];
  room.discardUno = [];
  room.stackMongoose = [];
  room.capturedMongooseCounts = {};
  room.burnedMongooseCount = 0;
  room.satyoLanes = createEmptySatyoLanes();
  room.roundNumber += 1;
  room.direction = 1;
  room.turnIndex = 0;
  room.actionLog = [];
  room.pendingUnoDraw = 0;
  room.unoVulnerableUid = null;
  room.unoHasDrawnThisTurn = false;
  room.mongooseLastPlayedByUid = null;
  room.gadhaPairsClearedTotal = 0;
  room.gadhaSafeOrder = [];
  room.outcome = null;

  for (const uid of activeUids) {
    const p = room.players[uid];
    if (p) {
      p.ready = false;
      p.safe = false;
      p.saidUno = false;
      p.lastActionText = undefined;
    }
    room.hands[uid] = [];
  }

  if (room.selectedGame === 'uno') {
    const deck = buildUnoDeck();
    const handSize = room.settings.uno.startingHandSize;
    for (let c = 0; c < handSize; c++) {
      for (const uid of activeUids) {
        const card = deck.pop();
        if (card) room.hands[uid].push(card);
      }
    }
    for (const uid of activeUids) {
      room.hands[uid] = sortStandardHand(room.hands[uid]);
    }

    // Pick a clean non-wild starting card if available
    let openIdx = deck.findIndex((c) => c.color !== 'wild');
    if (openIdx === -1) openIdx = deck.length - 1;
    const [openCard] = deck.splice(openIdx, 1);
    room.discardUno = [openCard];
    room.activeUnoColor = openCard.color === 'wild' ? 'red' : openCard.color;
    room.deck = deck;
    appendLog(
      room,
      room.hostId,
      room.players[room.hostId]?.name || 'Table',
      `Dealt ${handSize} UNO cards each. Opening card: ${formatCardName(openCard)}.`
    );
  } else if (room.selectedGame === 'satyo') {
    const deck = buildStandardDeck(false);
    let idx = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      if (!card) break;
      const uid = activeUids[idx % activeUids.length];
      room.hands[uid].push(card);
      idx++;
    }
    for (const uid of activeUids) {
      room.hands[uid] = sortStandardHand(room.hands[uid]);
    }

    // Determine starting player based on startingSeven setting
    const pref = room.settings.satyo.startingSeven;
    let starterIdx = 0;
    if (pref === 'hearts' || pref === 'spades') {
      const holderIdx = activeUids.findIndex((uid) =>
        room.hands[uid].some((c) => c.kind === 'standard' && c.rank === 7 && c.suit === pref)
      );
      if (holderIdx !== -1) starterIdx = holderIdx;
    } else {
      const holderIdx = activeUids.findIndex((uid) =>
        room.hands[uid].some((c) => c.kind === 'standard' && c.rank === 7)
      );
      if (holderIdx !== -1) starterIdx = holderIdx;
    }
    room.turnIndex = starterIdx;
    const starterUid = activeUids[starterIdx];
    const startText =
      pref === 'hearts' ? '7♥' : pref === 'spades' ? '7♠' : 'any 7';
    appendLog(
      room,
      starterUid,
      room.players[starterUid]?.name || 'Player',
      `All 52 cards dealt. ${room.players[starterUid]?.name || 'Player'} leads with ${startText}.`
    );
  } else if (room.selectedGame === 'mongoose') {
    const deck = buildStandardDeck(false);
    const dealEach = Math.min(7, Math.max(4, Math.floor((deck.length - 4) / activeUids.length)));
    for (let c = 0; c < dealEach; c++) {
      for (const uid of activeUids) {
        const card = deck.pop();
        if (card) room.hands[uid].push(card);
      }
    }
    for (const uid of activeUids) {
      room.hands[uid] = sortStandardHand(room.hands[uid]);
      room.capturedMongooseCounts[uid] = 0;
    }
    const openCard = deck.pop();
    if (openCard) {
      room.stackMongoose = [openCard];
    }
    room.deck = deck;
    appendLog(
      room,
      room.hostId,
      room.players[room.hostId]?.name || 'Table',
      `Dealt ${dealEach} cards each.${openCard ? ` Opening stack card: ${formatCardName(openCard)}.` : ''}`
    );
  } else {
    // Gadha Chor
    const settings = room.settings.gadha_chor;
    const deck = buildGadhaChorDeck(settings.oddCard);
    let idx = 0;
    while (deck.length > 0) {
      const card = deck.pop();
      if (!card) break;
      const uid = activeUids[idx % activeUids.length];
      room.hands[uid].push(card);
      idx++;
    }
    room.direction = settings.pickDirection === 'counterclockwise' ? -1 : 1;

    for (const uid of activeUids) {
      if (settings.autoDiscardPairs) {
        const { remaining, pairsRemoved } = stripGadhaPairs(room.hands[uid], settings.pairRule);
        room.hands[uid] = shuffleArray(remaining);
        room.gadhaPairsClearedTotal += pairsRemoved;
        if (room.hands[uid].length === 0) {
          room.players[uid].safe = true;
          room.gadhaSafeOrder.push(uid);
        }
      } else {
        room.hands[uid] = sortStandardHand(room.hands[uid]);
      }
    }

    // Ensure turn points to an active non-safe player
    const firstActive = activeUids.findIndex((uid) => (room.hands[uid]?.length ?? 0) > 0);
    room.turnIndex = firstActive === -1 ? 0 : firstActive;

    // Edge case: if auto-discard already left only 1 active player
    const remainingPlayers = activeUids.filter((uid) => (room.hands[uid]?.length ?? 0) > 0);
    if (remainingPlayers.length <= 1) {
      finalizeGadhaChorOutcome(room);
      return;
    }

    appendLog(
      room,
      room.hostId,
      room.players[room.hostId]?.name || 'Table',
      settings.autoDiscardPairs
        ? `Pairs cleared automatically (${room.gadhaPairsClearedTotal} pairs). Pick a hidden card!`
        : 'All cards dealt! Drop matching pairs and pick from your neighbor.'
    );
  }

  room.phase = 'playing';
  refreshTurnClock(room);
}

function drawUnoFromDeck(room: CardRoomInternal): UnoCard | null {
  if (room.deck.length === 0 && room.discardUno.length > 1) {
    const top = room.discardUno[room.discardUno.length - 1];
    const recyclable = room.discardUno.slice(0, -1);
    room.discardUno = [top];
    room.deck = shuffleArray(recyclable);
  }
  const next = room.deck.pop();
  return next && next.kind === 'uno' ? next : null;
}

function isUnoCardPlayable(
  card: UnoCard,
  topCard: UnoCard | null,
  activeColor: UnoChosenColor,
  pendingDraw: number,
  stackDrawCards: boolean
): boolean {
  if (pendingDraw > 0) {
    if (!stackDrawCards || !topCard) return false;
    if (topCard.value === 'draw2') {
      return card.value === 'draw2' || card.value === 'wild4';
    }
    if (topCard.value === 'wild4') {
      return card.value === 'wild4';
    }
    return false;
  }

  if (!topCard) return true;
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function unoCardPoints(card: CardItem): number {
  if (card.kind !== 'uno') return 0;
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20;
  return Number(card.value) || 0;
}

function standardCardPoints(card: CardItem): number {
  if (card.kind === 'joker') return 25;
  if (card.kind === 'uno') return unoCardPoints(card);
  return card.rank;
}

export function isSatyoCardPlayable(
  card: CardItem,
  lanes: Record<StandardSuit, SatyoLanePublic>,
  boardCardCount: number,
  settings: SatyoSettings
): boolean {
  if (card.kind !== 'standard') return false;

  // Very first play of the game
  if (boardCardCount === 0) {
    if (settings.startingSeven === 'hearts') {
      return card.rank === 7 && card.suit === 'hearts';
    }
    if (settings.startingSeven === 'spades') {
      return card.rank === 7 && card.suit === 'spades';
    }
    return card.rank === 7;
  }

  const lane = lanes[card.suit];
  if (!lane.started) {
    return card.rank === 7;
  }

  const low = lane.low ?? 7;
  const high = lane.high ?? 7;

  // Descending toward 2 (and A if low/both)
  if (low > 2 && card.rank === low - 1) return true;
  if (low === 2 && card.rank === 1 && (settings.aceRule === 'low' || settings.aceRule === 'both')) {
    return true;
  }

  // Ascending toward K (and A if high/both)
  if (high < 13 && card.rank === high + 1) return true;
  if (
    high === 13 &&
    card.rank === 1 &&
    (settings.aceRule === 'high' || settings.aceRule === 'both')
  ) {
    return true;
  }

  return false;
}

export function isMongoosePlayLegal(
  selectedCards: Array<StandardCard | JokerCard>,
  uppermost: StandardCard | JokerCard | null,
  settings: MongooseSettings
): boolean {
  if (selectedCards.length === 0) return false;
  if (selectedCards.length > 1 && !settings.allowMultiCardPlay) return false;

  const first = selectedCards[0];
  if (selectedCards.some((c) => c.rank !== first.rank)) {
    return false;
  }

  if (!uppermost) return true;

  // Special 10 burn can be played anytime when enabled
  if (settings.specialCardsRule === 'tens_burn_aces_skip' && first.rank === 10) {
    return true;
  }

  if (settings.matchRule === 'rank_match') {
    // Play any card(s) onto the stack; matching rank triggers capture rule
    return true;
  }

  if (settings.matchRule === 'rank_or_suit') {
    if (first.kind === 'joker' || uppermost.kind === 'joker') return true;
    return first.rank === uppermost.rank || first.suit === uppermost.suit;
  }

  // higher_or_equal (Ace counts as 14)
  const effRank = (r: number) => (r === 1 ? 14 : r);
  return effRank(first.rank) >= effRank(uppermost.rank);
}

function getGadhaTargetUid(room: CardRoomInternal, actorUid: string): string | null {
  const order = room.playerOrder;
  const actorIdx = order.indexOf(actorUid);
  if (actorIdx === -1) return null;

  const dir = room.settings.gadha_chor.pickDirection === 'counterclockwise' ? -1 : 1;
  for (let offset = 1; offset < order.length; offset++) {
    const idx = stepTurnIndex(order.length, actorIdx, dir, offset);
    const candidate = order[idx];
    if (candidate !== actorUid && (room.hands[candidate]?.length ?? 0) > 0) {
      return candidate;
    }
  }
  return null;
}

function advanceGadhaTurn(room: CardRoomInternal, fromUid: string) {
  const order = room.playerOrder;
  const fromIdx = order.indexOf(fromUid);
  const dir = room.settings.gadha_chor.pickDirection === 'counterclockwise' ? -1 : 1;
  for (let offset = 1; offset <= order.length; offset++) {
    const idx = stepTurnIndex(order.length, fromIdx === -1 ? room.turnIndex : fromIdx, dir, offset);
    const candidate = order[idx];
    if ((room.hands[candidate]?.length ?? 0) > 0) {
      room.turnIndex = idx;
      return;
    }
  }
}

function finalizeGadhaChorOutcome(room: CardRoomInternal) {
  const loserUid =
    room.playerOrder.find((uid) => (room.hands[uid]?.length ?? 0) > 0) ?? null;
  const winnerUids = room.playerOrder.filter((uid) => uid !== loserUid);

  const scores: Record<string, number> = {};
  const revealedHands: Record<string, CardItem[]> = {};
  for (const uid of room.playerOrder) {
    if (uid !== loserUid && room.players[uid]) {
      room.players[uid].safe = true;
      room.players[uid].score += 10;
    }
    scores[uid] = room.players[uid]?.score ?? 0;
    revealedHands[uid] = [...(room.hands[uid] || [])];
  }

  const loserName = loserUid ? room.players[loserUid]?.name || 'Player' : 'Nobody';
  const oddLabel =
    room.settings.gadha_chor.oddCard === 'joker' ? 'the lone Joker' : 'the Queen of Spades (Q♠)';

  room.phase = 'finished';
  room.turnDeadlineAt = null;
  room.outcome = {
    gameId: 'gadha_chor',
    winnerUids,
    loserUid,
    reason: `${loserName} was left holding ${oddLabel} — Gadha Chor!`,
    scores,
    revealedHands,
  };
  room.updatedAt = Date.now();
}

export function validateAndApplyCardAction(
  room: CardRoomInternal,
  actorUid: string,
  action: CardActionPayload
): void {
  if (room.phase !== 'playing') {
    throw new Error('GAME_NOT_ACTIVE');
  }
  const actor = room.players[actorUid];
  if (!actor) {
    throw new Error('PLAYER_NOT_IN_ROOM');
  }

  const currentTurnUid = room.playerOrder[room.turnIndex] ?? null;

  // ---------------- UNO ----------------
  if (room.selectedGame === 'uno') {
    if (action.type === 'uno_call') {
      const hand = room.hands[actorUid] || [];
      if (hand.length > 2 || hand.length === 0) {
        throw new Error('UNO_CALL_ONLY_WITH_1_OR_2_CARDS');
      }
      actor.saidUno = true;
      if (room.unoVulnerableUid === actorUid) {
        room.unoVulnerableUid = null;
      }
      actor.lastActionText = 'Called UNO!';
      appendLog(room, actorUid, actor.name, 'Called UNO!');
      room.updatedAt = Date.now();
      return;
    }

    if (action.type === 'uno_catch') {
      const targetUid = action.targetUid;
      const target = room.players[targetUid];
      const targetHand = room.hands[targetUid] || [];
      if (
        !target ||
        targetUid === actorUid ||
        room.unoVulnerableUid !== targetUid ||
        targetHand.length !== 1 ||
        target.saidUno
      ) {
        throw new Error('NOBODY_TO_CATCH');
      }
      const penalty = room.settings.uno.unoPenaltyCards;
      for (let i = 0; i < penalty; i++) {
        const drawn = drawUnoFromDeck(room);
        if (drawn) targetHand.push(drawn);
      }
      room.hands[targetUid] = sortStandardHand(targetHand);
      room.unoVulnerableUid = null;
      target.saidUno = false;
      appendLog(
        room,
        actorUid,
        actor.name,
        `Caught ${target.name} without saying UNO! (+${penalty} cards)`
      );
      room.updatedAt = Date.now();
      return;
    }

    if (actorUid !== currentTurnUid) {
      throw new Error('NOT_YOUR_TURN');
    }

    const hand = room.hands[actorUid] || [];
    const topCard = room.discardUno[room.discardUno.length - 1] ?? null;

    if (action.type === 'uno_draw') {
      if (room.pendingUnoDraw > 0) {
        const count = room.pendingUnoDraw;
        for (let i = 0; i < count; i++) {
          const drawn = drawUnoFromDeck(room);
          if (drawn) hand.push(drawn);
        }
        room.hands[actorUid] = sortStandardHand(hand);
        room.pendingUnoDraw = 0;
        room.unoHasDrawnThisTurn = false;
        actor.saidUno = false;
        actor.lastActionText = `Drew ${count}`;
        appendLog(room, actorUid, actor.name, `Drew ${count} penalty cards.`);
        room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
        refreshTurnClock(room);
        return;
      }

      if (room.unoHasDrawnThisTurn) {
        throw new Error('ALREADY_DRAWN_THIS_TURN');
      }

      if (room.settings.uno.drawUntilPlayable) {
        let drawnCount = 0;
        let foundPlayable = false;
        while (drawnCount < 12) {
          const drawn = drawUnoFromDeck(room);
          if (!drawn) break;
          hand.push(drawn);
          drawnCount++;
          if (
            isUnoCardPlayable(
              drawn,
              topCard,
              room.activeUnoColor,
              0,
              room.settings.uno.stackDrawCards
            )
          ) {
            foundPlayable = true;
            break;
          }
        }
        room.hands[actorUid] = sortStandardHand(hand);
        actor.saidUno = false;
        if (drawnCount === 0 || !foundPlayable) {
          actor.lastActionText = drawnCount > 0 ? `Drew ${drawnCount}, Passed` : 'Passed';
          appendLog(
            room,
            actorUid,
            actor.name,
            drawnCount > 0 ? `Drew ${drawnCount} card(s) and passed.` : 'Passed (deck empty).'
          );
          room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
          refreshTurnClock(room);
          return;
        }
        room.unoHasDrawnThisTurn = true;
        actor.lastActionText = `Drew ${drawnCount}`;
        appendLog(room, actorUid, actor.name, `Drew ${drawnCount} card(s) — playable card ready!`);
        room.updatedAt = Date.now();
        return;
      }

      // Draw 1 card
      const drawn = drawUnoFromDeck(room);
      if (!drawn) {
        actor.lastActionText = 'Passed';
        appendLog(room, actorUid, actor.name, 'Deck empty — passed turn.');
        room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
        refreshTurnClock(room);
        return;
      }
      hand.push(drawn);
      room.hands[actorUid] = sortStandardHand(hand);
      actor.saidUno = false;
      const canPlayDrawn = isUnoCardPlayable(
        drawn,
        topCard,
        room.activeUnoColor,
        0,
        room.settings.uno.stackDrawCards
      );
      if (canPlayDrawn) {
        room.unoHasDrawnThisTurn = true;
        actor.lastActionText = 'Drew 1';
        appendLog(room, actorUid, actor.name, 'Drew 1 card (play it or pass).');
        room.updatedAt = Date.now();
      } else {
        actor.lastActionText = 'Drew 1';
        appendLog(room, actorUid, actor.name, 'Drew 1 card.');
        room.unoHasDrawnThisTurn = false;
        room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
        refreshTurnClock(room);
      }
      return;
    }

    if (action.type === 'uno_pass') {
      if (!room.unoHasDrawnThisTurn) {
        throw new Error('DRAW_BEFORE_PASSING');
      }
      room.unoHasDrawnThisTurn = false;
      actor.lastActionText = 'Passed';
      appendLog(room, actorUid, actor.name, 'Passed turn.');
      room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
      refreshTurnClock(room);
      return;
    }

    if (action.type === 'uno_play') {
      const cardIdx = hand.findIndex((c) => c.id === action.cardId);
      if (cardIdx === -1) {
        throw new Error('CARD_NOT_IN_HAND');
      }
      const card = hand[cardIdx];
      if (card.kind !== 'uno') {
        throw new Error('INVALID_CARD_TYPE');
      }
      if (
        !isUnoCardPlayable(
          card,
          topCard,
          room.activeUnoColor,
          room.pendingUnoDraw,
          room.settings.uno.stackDrawCards
        )
      ) {
        throw new Error('ILLEGAL_UNO_PLAY');
      }
      if (card.color === 'wild' && !action.chosenColor) {
        throw new Error('CHOOSE_WILD_COLOR');
      }

      hand.splice(cardIdx, 1);
      room.discardUno.push(card);
      room.activeUnoColor = card.color === 'wild' ? action.chosenColor! : card.color;
      room.unoHasDrawnThisTurn = false;
      actor.lastActionText = `Played ${formatCardName(card)}`;

      // UNO vulnerability tracking
      if (hand.length === 1) {
        room.unoVulnerableUid = actor.saidUno ? null : actorUid;
      } else {
        if (room.unoVulnerableUid === actorUid) {
          room.unoVulnerableUid = null;
        }
        if (hand.length > 2) {
          actor.saidUno = false;
        }
      }

      // Check immediate win
      if (hand.length === 0) {
        let pointsWon = 0;
        const revealedHands: Record<string, CardItem[]> = {};
        const scores: Record<string, number> = {};
        for (const uid of room.playerOrder) {
          revealedHands[uid] = [...(room.hands[uid] || [])];
          if (uid !== actorUid) {
            for (const rem of room.hands[uid] || []) {
              pointsWon += unoCardPoints(rem);
            }
          }
        }
        actor.score += Math.max(10, pointsWon);
        for (const uid of room.playerOrder) {
          scores[uid] = room.players[uid]?.score ?? 0;
        }
        room.phase = 'finished';
        room.turnDeadlineAt = null;
        room.outcome = {
          gameId: 'uno',
          winnerUids: [actorUid],
          loserUid: null,
          reason: `${actor.name} emptied their hand and won +${Math.max(10, pointsWon)} pts!`,
          scores,
          revealedHands,
        };
        appendLog(room, actorUid, actor.name, `Played ${formatCardName(card)} and WON!`);
        room.updatedAt = Date.now();
        return;
      }

      const nPlayers = room.playerOrder.length;
      if (card.value === 'reverse') {
        if (nPlayers === 2 && room.settings.uno.twoPlayerReverseActsAsSkip) {
          appendLog(room, actorUid, actor.name, `Played Reverse (acts as Skip — goes again!).`);
          // Stay on same turnIndex
        } else {
          room.direction = room.direction === 1 ? -1 : 1;
          room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
          appendLog(room, actorUid, actor.name, `Played Reverse (direction flipped).`);
        }
      } else if (card.value === 'skip') {
        const skippedIdx = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
        const skippedName = room.players[room.playerOrder[skippedIdx]]?.name || 'Player';
        room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 2);
        appendLog(room, actorUid, actor.name, `Played ${formatCardName(card)} — skipped ${skippedName}.`);
      } else if (card.value === 'draw2') {
        if (room.settings.uno.stackDrawCards) {
          room.pendingUnoDraw += 2;
          room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
          appendLog(
            room,
            actorUid,
            actor.name,
            `Played ${formatCardName(card)} (+${room.pendingUnoDraw} stacked!).`
          );
        } else {
          const victimIdx = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
          const victimUid = room.playerOrder[victimIdx];
          for (let i = 0; i < 2; i++) {
            const d = drawUnoFromDeck(room);
            if (d) room.hands[victimUid].push(d);
          }
          room.hands[victimUid] = sortStandardHand(room.hands[victimUid]);
          if (room.players[victimUid]) room.players[victimUid].saidUno = false;
          room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 2);
          appendLog(
            room,
            actorUid,
            actor.name,
            `Played ${formatCardName(card)} — ${room.players[victimUid]?.name || 'Next player'} draws 2 & skips.`
          );
        }
      } else if (card.value === 'wild4') {
        if (room.settings.uno.stackDrawCards) {
          room.pendingUnoDraw += 4;
          room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
          appendLog(
            room,
            actorUid,
            actor.name,
            `Played Wild +4 (${room.activeUnoColor.toUpperCase()}, +${room.pendingUnoDraw} pending!).`
          );
        } else {
          const victimIdx = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
          const victimUid = room.playerOrder[victimIdx];
          for (let i = 0; i < 4; i++) {
            const d = drawUnoFromDeck(room);
            if (d) room.hands[victimUid].push(d);
          }
          room.hands[victimUid] = sortStandardHand(room.hands[victimUid]);
          if (room.players[victimUid]) room.players[victimUid].saidUno = false;
          room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 2);
          appendLog(
            room,
            actorUid,
            actor.name,
            `Played Wild +4 (${room.activeUnoColor.toUpperCase()}) — ${room.players[victimUid]?.name || 'Next'} draws 4!`
          );
        }
      } else {
        room.turnIndex = stepTurnIndex(nPlayers, room.turnIndex, room.direction, 1);
        appendLog(
          room,
          actorUid,
          actor.name,
          card.color === 'wild'
            ? `Played Wild → color ${room.activeUnoColor.toUpperCase()}.`
            : `Played ${formatCardName(card)}.`
        );
      }

      refreshTurnClock(room);
      return;
    }

    throw new Error('INVALID_UNO_ACTION');
  }

  // ---------------- SATYO ----------------
  if (room.selectedGame === 'satyo') {
    if (actorUid !== currentTurnUid) {
      throw new Error('NOT_YOUR_TURN');
    }
    const hand = room.hands[actorUid] || [];
    const boardCount = SUITS.reduce((sum, s) => sum + room.satyoLanes[s].cardsCount, 0);

    if (action.type === 'satyo_pass') {
      const hasLegal = hand.some((c) =>
        isSatyoCardPlayable(c, room.satyoLanes, boardCount, room.settings.satyo)
      );
      if (room.settings.satyo.mustPlayIfAble && hasLegal) {
        throw new Error('MUST_PLAY_LEGAL_CARD');
      }
      actor.lastActionText = 'Passed';
      appendLog(room, actorUid, actor.name, 'Passed.');
      room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, 1, 1);
      refreshTurnClock(room);
      return;
    }

    if (action.type === 'satyo_play') {
      const idx = hand.findIndex((c) => c.id === action.cardId);
      if (idx === -1) throw new Error('CARD_NOT_IN_HAND');
      const card = hand[idx];
      if (!isSatyoCardPlayable(card, room.satyoLanes, boardCount, room.settings.satyo)) {
        throw new Error('ILLEGAL_SATYO_PLAY');
      }
      if (card.kind !== 'standard') throw new Error('INVALID_CARD');

      hand.splice(idx, 1);
      const lane = room.satyoLanes[card.suit];
      if (!lane.started) {
        lane.started = true;
        lane.low = 7;
        lane.high = 7;
        lane.cardsCount = 1;
      } else {
        if (card.rank === 1) {
          if (lane.low === 2 && (room.settings.satyo.aceRule === 'low' || room.settings.satyo.aceRule === 'both')) {
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

      actor.lastActionText = `Placed ${formatCardName(card)}`;
      appendLog(room, actorUid, actor.name, `Placed ${formatCardName(card)}.`);

      if (hand.length === 0) {
        const revealedHands: Record<string, CardItem[]> = {};
        const scores: Record<string, number> = {};
        let pipBonus = 0;
        for (const uid of room.playerOrder) {
          revealedHands[uid] = [...(room.hands[uid] || [])];
          if (uid !== actorUid) {
            for (const rem of room.hands[uid] || []) {
              pipBonus += standardCardPoints(rem);
            }
          }
        }
        const awarded = room.settings.satyo.scoringMode === 'pip_sum' ? Math.max(10, pipBonus) : 10;
        actor.score += awarded;
        for (const uid of room.playerOrder) {
          scores[uid] = room.players[uid]?.score ?? 0;
        }
        room.phase = 'finished';
        room.turnDeadlineAt = null;
        room.outcome = {
          gameId: 'satyo',
          winnerUids: [actorUid],
          loserUid: null,
          reason: `${actor.name} completed their hand first (+${awarded} pts)!`,
          scores,
          revealedHands,
        };
        room.updatedAt = Date.now();
        return;
      }

      room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, 1, 1);
      refreshTurnClock(room);
      return;
    }

    throw new Error('INVALID_SATYO_ACTION');
  }

  // ---------------- MONGOOSE ----------------
  if (room.selectedGame === 'mongoose') {
    if (actorUid !== currentTurnUid) {
      throw new Error('NOT_YOUR_TURN');
    }
    const hand = room.hands[actorUid] || [];

    if (action.type === 'mongoose_pickup') {
      if (room.stackMongoose.length > 0) {
        const pickedCount = room.stackMongoose.length;
        hand.push(...room.stackMongoose);
        room.stackMongoose = [];
        room.mongooseLastPlayedByUid = null;
        room.hands[actorUid] = sortStandardHand(hand);
        actor.lastActionText = `Picked up ${pickedCount}`;
        appendLog(room, actorUid, actor.name, `Picked up the ${pickedCount}-card center stack.`);
        room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, 1, 1);
        refreshTurnClock(room);
        return;
      }

      // Stack is empty: draw 1 card from deck if available, else pass
      const drawn = room.deck.pop();
      if (drawn && drawn.kind !== 'uno') {
        hand.push(drawn);
        room.hands[actorUid] = sortStandardHand(hand);
        actor.lastActionText = 'Drew 1';
        appendLog(room, actorUid, actor.name, 'Drew 1 card from the stockpile.');
      } else {
        actor.lastActionText = 'Passed';
        appendLog(room, actorUid, actor.name, 'Passed turn.');
      }
      room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, 1, 1);
      refreshTurnClock(room);
      return;
    }

    if (action.type === 'mongoose_play') {
      if (!Array.isArray(action.cardIds) || action.cardIds.length === 0) {
        throw new Error('SELECT_CARD_TO_PLAY');
      }
      const uniqueIds = Array.from(new Set(action.cardIds));
      if (uniqueIds.length !== action.cardIds.length) {
        throw new Error('DUPLICATE_CARD_SELECTED');
      }
      const selected: Array<StandardCard | JokerCard> = [];
      for (const cid of uniqueIds) {
        const found = hand.find((c) => c.id === cid);
        if (!found || found.kind === 'uno') {
          throw new Error('CARD_NOT_IN_HAND');
        }
        selected.push(found);
      }

      const prevTop =
        room.stackMongoose.length > 0
          ? room.stackMongoose[room.stackMongoose.length - 1]
          : null;

      if (!isMongoosePlayLegal(selected, prevTop, room.settings.mongoose)) {
        throw new Error('ILLEGAL_MONGOOSE_PLAY');
      }

      // Remove played cards from hand & push onto central stack (last item is uppermost face-up)
      room.hands[actorUid] = hand.filter((c) => !uniqueIds.includes(c.id));
      room.stackMongoose.push(...selected);

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

      if (isTenBurn) {
        const burned = room.stackMongoose.length;
        room.burnedMongooseCount += burned;
        room.stackMongoose = [];
        room.mongooseLastPlayedByUid = null;
        grantBonusTurn = true;
        actor.lastActionText = `10 Burn (${burned})`;
        appendLog(room, actorUid, actor.name, `Played ${playedText} — 10 BURNS ${burned} cards & bonus turn!`);
      } else if (rankMatched) {
        const eff = room.settings.mongoose.captureEffect;
        const pileSize = room.stackMongoose.length;
        if (eff === 'give_pile_to_previous') {
          const prevUid = room.mongooseLastPlayedByUid;
          if (prevUid && prevUid !== actorUid && room.hands[prevUid]) {
            room.hands[prevUid] = sortStandardHand([
              ...room.hands[prevUid],
              ...room.stackMongoose,
            ]);
            room.stackMongoose = [];
            room.mongooseLastPlayedByUid = null;
            actor.lastActionText = `Matched! Sent ${pileSize}`;
            appendLog(
              room,
              actorUid,
              actor.name,
              `Matched rank with ${playedText} — ${room.players[prevUid]?.name || 'Previous'} picks up ${pileSize} cards!`
            );
          } else {
            room.burnedMongooseCount += pileSize;
            room.stackMongoose = [];
            room.mongooseLastPlayedByUid = null;
            actor.lastActionText = `Cleared ${pileSize}`;
            appendLog(room, actorUid, actor.name, `Played ${playedText} — cleared ${pileSize} cards.`);
          }
        } else if (eff === 'collect_pile_to_score') {
          room.capturedMongooseCounts[actorUid] =
            (room.capturedMongooseCounts[actorUid] || 0) + pileSize;
          actor.score += pileSize;
          room.stackMongoose = [];
          room.mongooseLastPlayedByUid = null;
          actor.lastActionText = `Collected +${pileSize}`;
          appendLog(
            room,
            actorUid,
            actor.name,
            `Matched rank with ${playedText} — collected ${pileSize} cards to bank!`
          );
        } else {
          // burn_and_bonus
          room.burnedMongooseCount += pileSize;
          room.stackMongoose = [];
          room.mongooseLastPlayedByUid = null;
          grantBonusTurn = true;
          actor.score += Math.max(1, Math.floor(pileSize / 2));
          actor.lastActionText = `Burned ${pileSize}!`;
          appendLog(
            room,
            actorUid,
            actor.name,
            `Matched rank with ${playedText} — burned ${pileSize} cards & gets a bonus turn!`
          );
        }
      } else {
        room.mongooseLastPlayedByUid = actorUid;
        if (isAceSkip) {
          skipNext = true;
          actor.lastActionText = `${playedText} (Skip)`;
          appendLog(room, actorUid, actor.name, `Played ${playedText} — Ace skips next player!`);
        } else {
          actor.lastActionText = `Played ${playedText}`;
          appendLog(room, actorUid, actor.name, `Played ${playedText} onto stack.`);
        }
      }

      // Draw back up to 5 cards if deck still has cards (keeps midgame flowing until stockpile ends)
      while (room.deck.length > 0 && room.hands[actorUid].length < 5) {
        const d = room.deck.pop();
        if (d && d.kind !== 'uno') {
          room.hands[actorUid].push(d);
        }
      }
      room.hands[actorUid] = sortStandardHand(room.hands[actorUid]);

      // Check finish: player emptied hand with empty stockpile (or in collector mode, check high score)
      if (room.hands[actorUid].length === 0 && room.deck.length === 0) {
        const revealedHands: Record<string, CardItem[]> = {};
        const scores: Record<string, number> = {};
        for (const uid of room.playerOrder) {
          revealedHands[uid] = [...(room.hands[uid] || [])];
        }

        let winnerUids = [actorUid];
        let reason = `${actor.name} cleared their hand first and won Mongoose!`;

        if (room.settings.mongoose.captureEffect === 'collect_pile_to_score') {
          actor.score += 5; // Finish bonus
          const maxScore = Math.max(
            ...room.playerOrder.map((uid) => room.players[uid]?.score ?? 0)
          );
          winnerUids = room.playerOrder.filter(
            (uid) => (room.players[uid]?.score ?? 0) === maxScore
          );
          const names = winnerUids.map((uid) => room.players[uid]?.name || 'Player').join(' & ');
          reason = `${names} won Collector Mongoose with ${maxScore} points!`;
        } else {
          actor.score += 15;
        }

        for (const uid of room.playerOrder) {
          scores[uid] = room.players[uid]?.score ?? 0;
        }

        room.phase = 'finished';
        room.turnDeadlineAt = null;
        room.outcome = {
          gameId: 'mongoose',
          winnerUids,
          loserUid: null,
          reason,
          scores,
          revealedHands,
        };
        room.updatedAt = Date.now();
        return;
      }

      if (!grantBonusTurn) {
        room.turnIndex = stepTurnIndex(
          room.playerOrder.length,
          room.turnIndex,
          1,
          skipNext ? 2 : 1
        );
      }
      refreshTurnClock(room);
      return;
    }

    throw new Error('INVALID_MONGOOSE_ACTION');
  }

  // ---------------- GADHA CHOR ----------------
  if (room.selectedGame === 'gadha_chor') {
    const hand = room.hands[actorUid] || [];

    if (action.type === 'gadha_shuffle_hand') {
      room.hands[actorUid] = shuffleArray(hand);
      actor.lastActionText = 'Shuffled hand';
      appendLog(room, actorUid, actor.name, 'Shuffled their cards.');
      room.updatedAt = Date.now();
      return;
    }

    if (action.type === 'gadha_discard_pair') {
      const [idA, idB] = action.cardIds;
      const cardA = hand.find((c) => c.id === idA);
      const cardB = hand.find((c) => c.id === idB);
      if (!cardA || !cardB) {
        throw new Error('CARD_NOT_IN_HAND');
      }
      if (!areGadhaCardsPair(cardA, cardB, room.settings.gadha_chor.pairRule)) {
        throw new Error('NOT_A_VALID_PAIR');
      }

      room.hands[actorUid] = hand.filter((c) => c.id !== idA && c.id !== idB);
      room.gadhaPairsClearedTotal += 1;
      actor.lastActionText = `Dropped pair ${formatCardName(cardA)} + ${formatCardName(cardB)}`;
      appendLog(
        room,
        actorUid,
        actor.name,
        `Discarded pair (${formatCardName(cardA)} & ${formatCardName(cardB)}).`
      );

      if (room.hands[actorUid].length === 0) {
        actor.safe = true;
        if (!room.gadhaSafeOrder.includes(actorUid)) {
          room.gadhaSafeOrder.push(actorUid);
        }
        appendLog(room, actorUid, actor.name, `${actor.name} has no cards left — SAFE!`);
      }

      const activeRemaining = room.playerOrder.filter((uid) => (room.hands[uid]?.length ?? 0) > 0);
      if (activeRemaining.length <= 1) {
        finalizeGadhaChorOutcome(room);
        return;
      }

      // If current turn player became safe, advance turn
      if ((room.hands[currentTurnUid || '']?.length ?? 0) === 0) {
        advanceGadhaTurn(room, currentTurnUid || actorUid);
        refreshTurnClock(room);
      } else {
        room.updatedAt = Date.now();
      }
      return;
    }

    if (action.type === 'gadha_pick') {
      if (actorUid !== currentTurnUid) {
        throw new Error('NOT_YOUR_TURN');
      }
      const targetUid = getGadhaTargetUid(room, actorUid);
      if (!targetUid) {
        finalizeGadhaChorOutcome(room);
        return;
      }
      const targetHand = room.hands[targetUid] || [];
      const index = Math.floor(action.index);
      if (!Number.isFinite(index) || index < 0 || index >= targetHand.length) {
        throw new Error('INVALID_CARD_INDEX');
      }

      const [pickedCard] = targetHand.splice(index, 1);
      hand.push(pickedCard);

      const targetName = room.players[targetUid]?.name || 'Neighbor';
      actor.lastActionText = `Picked from ${targetName}`;

      if (room.settings.gadha_chor.autoDiscardPairs) {
        const { remaining, pairsRemoved } = stripGadhaPairs(
          hand,
          room.settings.gadha_chor.pairRule
        );
        room.hands[actorUid] = shuffleArray(remaining);
        room.gadhaPairsClearedTotal += pairsRemoved;
        appendLog(
          room,
          actorUid,
          actor.name,
          pairsRemoved > 0
            ? `Picked a card from ${targetName} & auto-paired!`
            : `Picked a hidden card from ${targetName}.`
        );
      } else {
        appendLog(room, actorUid, actor.name, `Picked card #${index + 1} from ${targetName}.`);
      }

      if (targetHand.length === 0 && room.players[targetUid]) {
        room.players[targetUid].safe = true;
        if (!room.gadhaSafeOrder.includes(targetUid)) {
          room.gadhaSafeOrder.push(targetUid);
        }
        appendLog(room, targetUid, targetName, `${targetName} emptied their hand — SAFE!`);
      }

      if (room.hands[actorUid].length === 0) {
        actor.safe = true;
        if (!room.gadhaSafeOrder.includes(actorUid)) {
          room.gadhaSafeOrder.push(actorUid);
        }
        appendLog(room, actorUid, actor.name, `${actor.name} emptied their hand — SAFE!`);
      }

      const activeRemaining = room.playerOrder.filter((uid) => (room.hands[uid]?.length ?? 0) > 0);
      if (activeRemaining.length <= 1) {
        finalizeGadhaChorOutcome(room);
        return;
      }

      advanceGadhaTurn(room, actorUid);
      refreshTurnClock(room);
      return;
    }

    throw new Error('INVALID_GADHA_CHOR_ACTION');
  }
}

export function serializeCardRoomForPlayer(
  room: CardRoomInternal,
  viewerUid: string
): CardRoomClientState {
  const playersPublic: Record<string, CardPlayerPublic> = {};
  for (const [uid, p] of Object.entries(room.players)) {
    playersPublic[uid] = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      ready: p.ready,
      connected: p.connected,
      isMuted: p.isMuted,
      joinedAt: p.joinedAt,
      cardCount: room.hands[uid]?.length ?? 0,
      score: p.score,
      safe: p.safe,
      saidUno: p.saidUno,
      lastActionText: p.lastActionText,
    };
  }

  let table: CardTablePublicState | null = null;
  if (room.phase !== 'lobby') {
    const turnUid = room.playerOrder[room.turnIndex] ?? null;
    table = {
      gameId: room.selectedGame,
      playerOrder: [...room.playerOrder],
      turnUid,
      turnIndex: room.turnIndex,
      direction: room.direction,
      turnStartedAt: room.turnStartedAt,
      turnDeadlineAt: room.turnDeadlineAt,
      roundNumber: room.roundNumber,
      actionLog: [...room.actionLog],
      outcome: room.outcome,
    };

    if (room.selectedGame === 'uno') {
      table.uno = {
        topCard: room.discardUno[room.discardUno.length - 1] ?? null,
        activeColor: room.activeUnoColor,
        drawPileCount: room.deck.length,
        discardCount: room.discardUno.length,
        pendingDrawCount: room.pendingUnoDraw,
        unoVulnerableUid: room.unoVulnerableUid,
        hasDrawnThisTurn: room.unoHasDrawnThisTurn,
      };
    } else if (room.selectedGame === 'satyo') {
      const boardCardCount = SUITS.reduce((sum, s) => sum + room.satyoLanes[s].cardsCount, 0);
      table.satyo = {
        lanes: structuredClone(room.satyoLanes),
        startingSevenRequired: room.settings.satyo.startingSeven,
        boardCardCount,
      };
    } else if (room.selectedGame === 'mongoose') {
      const top =
        room.stackMongoose.length > 0
          ? room.stackMongoose[room.stackMongoose.length - 1]
          : null;
      table.mongoose = {
        uppermostCard: top,
        recentStackCards: room.stackMongoose.slice(-4),
        stackCount: room.stackMongoose.length,
        drawPileCount: room.deck.length,
        lastPlayedByUid: room.mongooseLastPlayedByUid,
        burnedCount: room.burnedMongooseCount,
        roundNumber: room.roundNumber,
      };
    } else if (room.selectedGame === 'gadha_chor') {
      const targetUid = turnUid ? getGadhaTargetUid(room, turnUid) : null;
      table.gadhaChor = {
        targetUid,
        targetCardCount: targetUid ? room.hands[targetUid]?.length ?? 0 : 0,
        pairsClearedTotal: room.gadhaPairsClearedTotal,
        safeOrder: [...room.gadhaSafeOrder],
        oddCardType: room.settings.gadha_chor.oddCard,
      };
    }
  }

  return {
    code: room.code,
    hostId: room.hostId,
    selectedGame: room.selectedGame,
    phase: room.phase,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    settings: structuredClone(room.settings),
    players: playersPublic,
    playerOrder: [...room.playerOrder],
    table,
    // STRICT PRIVACY: only return caller's own cards
    myHand: room.hands[viewerUid] ? [...room.hands[viewerUid]] : [],
  };
}

export function autoResolveTimedOutTurn(room: CardRoomInternal): boolean {
  if (room.phase !== 'playing' || !room.turnDeadlineAt) return false;
  if (Date.now() < room.turnDeadlineAt) return false;

  const turnUid = room.playerOrder[room.turnIndex];
  if (!turnUid || !room.players[turnUid]) return false;

  try {
    if (room.selectedGame === 'uno') {
      if (room.unoHasDrawnThisTurn) {
        validateAndApplyCardAction(room, turnUid, { type: 'uno_pass' });
      } else {
        validateAndApplyCardAction(room, turnUid, { type: 'uno_draw' });
        if (room.phase === 'playing' && room.playerOrder[room.turnIndex] === turnUid && room.unoHasDrawnThisTurn) {
          validateAndApplyCardAction(room, turnUid, { type: 'uno_pass' });
        }
      }
      return true;
    }

    if (room.selectedGame === 'satyo') {
      const hand = room.hands[turnUid] || [];
      const boardCount = SUITS.reduce((sum, s) => sum + room.satyoLanes[s].cardsCount, 0);
      const legal = hand.find((c) =>
        isSatyoCardPlayable(c, room.satyoLanes, boardCount, room.settings.satyo)
      );
      if (legal) {
        validateAndApplyCardAction(room, turnUid, { type: 'satyo_play', cardId: legal.id });
      } else {
        validateAndApplyCardAction(room, turnUid, { type: 'satyo_pass' });
      }
      return true;
    }

    if (room.selectedGame === 'mongoose') {
      validateAndApplyCardAction(room, turnUid, { type: 'mongoose_pickup' });
      return true;
    }

    if (room.selectedGame === 'gadha_chor') {
      const targetUid = getGadhaTargetUid(room, turnUid);
      const count = targetUid ? room.hands[targetUid]?.length ?? 0 : 0;
      if (count > 0) {
        const randIdx = Math.floor(Math.random() * count);
        validateAndApplyCardAction(room, turnUid, { type: 'gadha_pick', index: randIdx });
        return true;
      }
    }
  } catch {
    // Fallback advance
    room.turnIndex = stepTurnIndex(room.playerOrder.length, room.turnIndex, room.direction, 1);
    refreshTurnClock(room);
    return true;
  }

  return false;
}
