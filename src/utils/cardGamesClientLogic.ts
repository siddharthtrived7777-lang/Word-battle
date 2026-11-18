import type {
  CardGameId,
  CardGameSettingsMap,
  CardItem,
  CardPlayerPublic,
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
  UnoValue,
} from '../types/cardGames';

export const SUITS: StandardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: StandardRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const UNO_COLORS: UnoChosenColor[] = ['red', 'blue', 'green', 'yellow'];

export const DEFAULT_CARD_SETTINGS: CardGameSettingsMap = {
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

export function cloneDefaultCardSettings(): CardGameSettingsMap {
  return JSON.parse(JSON.stringify(DEFAULT_CARD_SETTINGS)) as CardGameSettingsMap;
}

export function shuffleCardArray<T>(items: T[]): T[] {
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
  return shuffleCardArray(deck);
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
  return shuffleCardArray(deck);
}

export function buildGadhaChorDeck(
  oddCard: 'queen_spades' | 'joker'
): Array<StandardCard | JokerCard> {
  if (oddCard === 'joker') {
    return buildStandardDeck(true);
  }
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

export function getCardGamePlayerLimits(gameId: CardGameId): { min: number; max: number } {
  switch (gameId) {
    case 'satyo':
      return { min: 2, max: 6 };
    default:
      return { min: 2, max: 8 };
  }
}

export function getCardGameTimerSeconds(
  gameId: CardGameId,
  settings: CardGameSettingsMap
): number {
  switch (gameId) {
    case 'uno':
      return settings.uno.turnTimerSeconds;
    case 'satyo':
      return settings.satyo.turnTimerSeconds;
    case 'mongoose':
      return settings.mongoose.turnTimerSeconds;
    case 'gadha_chor':
      return settings.gadha_chor.turnTimerSeconds;
  }
}

export function stepCardTurnIndex(
  length: number,
  current: number,
  direction: 1 | -1,
  steps = 1
): number {
  if (length <= 0) return 0;
  return (((current + direction * steps) % length) + length) % length;
}

export function sortCardHand(cards: CardItem[]): CardItem[] {
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

export function areGadhaCardsPair(
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

export function stripGadhaPairs(
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

export function isUnoCardPlayable(
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

export function isSatyoCardPlayable(
  card: CardItem,
  lanes: Record<StandardSuit, SatyoLanePublic>,
  boardCardCount: number,
  settings: SatyoSettings
): boolean {
  if (card.kind !== 'standard') return false;

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

  if (low > 2 && card.rank === low - 1) return true;
  if (low === 2 && card.rank === 1 && (settings.aceRule === 'low' || settings.aceRule === 'both')) {
    return true;
  }

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

  if (settings.specialCardsRule === 'tens_burn_aces_skip' && first.rank === 10) {
    return true;
  }

  if (settings.matchRule === 'rank_match') {
    return true;
  }

  if (settings.matchRule === 'rank_or_suit') {
    if (first.kind === 'joker' || uppermost.kind === 'joker') return true;
    return first.rank === uppermost.rank || first.suit === uppermost.suit;
  }

  const effRank = (r: number) => (r === 1 ? 14 : r);
  return effRank(first.rank) >= effRank(uppermost.rank);
}

export function getGadhaTargetUidFromCounts(
  playerOrder: string[],
  players: Record<string, CardPlayerPublic>,
  actorUid: string,
  pickDirection: GadhaChorSettings['pickDirection']
): string | null {
  const actorIdx = playerOrder.indexOf(actorUid);
  if (actorIdx === -1) return null;
  const dir: 1 | -1 = pickDirection === 'counterclockwise' ? -1 : 1;
  for (let offset = 1; offset < playerOrder.length; offset++) {
    const idx = stepCardTurnIndex(playerOrder.length, actorIdx, dir, offset);
    const candidate = playerOrder[idx];
    if (candidate !== actorUid && (players[candidate]?.cardCount ?? 0) > 0) {
      return candidate;
    }
  }
  return null;
}

export function findNextGadhaTurnIndex(
  playerOrder: string[],
  players: Record<string, CardPlayerPublic>,
  fromUid: string,
  fallbackIndex: number,
  pickDirection: GadhaChorSettings['pickDirection']
): number {
  const fromIdx = playerOrder.indexOf(fromUid);
  const startIdx = fromIdx === -1 ? fallbackIndex : fromIdx;
  const dir: 1 | -1 = pickDirection === 'counterclockwise' ? -1 : 1;
  for (let offset = 1; offset <= playerOrder.length; offset++) {
    const idx = stepCardTurnIndex(playerOrder.length, startIdx, dir, offset);
    const candidate = playerOrder[idx];
    if ((players[candidate]?.cardCount ?? 0) > 0) {
      return idx;
    }
  }
  return fallbackIndex;
}

export const CARD_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function sanitizeCardRoomCode(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
}

export function isValidCardRoomCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{5}$/.test(code);
}

export function isCardRoomExpired(
  room: { createdAt: number; updatedAt: number },
  now = Date.now()
): boolean {
  const lastTouch = Math.max(room.updatedAt || 0, room.createdAt || 0);
  if (lastTouch <= 0) return false;
  return now - lastTouch > CARD_ROOM_TTL_MS;
}

export function decideCardRoomCreateConflict(
  existing: { hostId: string; playerIds: string[] },
  uid: string
): 'reuse_existing' | 'collision' {
  if (existing.hostId === uid || existing.playerIds.includes(uid)) {
    return 'reuse_existing';
  }
  return 'collision';
}

export function decideCardRoomJoinAction(
  existing: {
    selectedGame: CardGameId;
    phase: 'lobby' | 'playing' | 'finished';
    playerIds: string[];
    createdAt: number;
    updatedAt: number;
  },
  uid: string,
  now = Date.now()
):
  | { action: 'rejoin' | 'join' }
  | { action: 'reject'; error: 'ROOM_NOT_FOUND' | 'GAME_IN_PROGRESS' | 'ROOM_FULL' } {
  if (existing.playerIds.includes(uid)) {
    return { action: 'rejoin' };
  }
  if (isCardRoomExpired(existing, now)) {
    return { action: 'reject', error: 'ROOM_NOT_FOUND' };
  }
  if (existing.phase !== 'lobby') {
    return { action: 'reject', error: 'GAME_IN_PROGRESS' };
  }
  const limits = getCardGamePlayerLimits(existing.selectedGame);
  if (existing.playerIds.length >= limits.max) {
    return { action: 'reject', error: 'ROOM_FULL' };
  }
  return { action: 'join' };
}

