import type { PlayerAvatar } from './game.ts';

export type CardGameId = 'uno' | 'satyo' | 'mongoose' | 'gadha_chor';

export type CardRoomPhase = 'lobby' | 'playing' | 'finished';

export type StandardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type StandardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoChosenColor = 'red' | 'blue' | 'green' | 'yellow';
export type UnoValue =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface StandardCard {
  id: string;
  kind: 'standard';
  suit: StandardSuit;
  rank: StandardRank;
}

export interface JokerCard {
  id: string;
  kind: 'joker';
  suit: 'joker';
  rank: 0;
}

export interface UnoCard {
  id: string;
  kind: 'uno';
  color: UnoColor;
  value: UnoValue;
}

export type CardItem = StandardCard | JokerCard | UnoCard;

export type TurnTimerOption = 0 | 20 | 30 | 45;

export interface UnoSettings {
  startingHandSize: 5 | 7;
  stackDrawCards: boolean;
  drawUntilPlayable: boolean;
  twoPlayerReverseActsAsSkip: boolean;
  unoPenaltyCards: 2;
  turnTimerSeconds: TurnTimerOption;
}

export interface SatyoSettings {
  mustPlayIfAble: boolean;
  aceRule: 'low' | 'high' | 'both';
  startingSeven: 'hearts' | 'spades' | 'any';
  scoringMode: 'first_out' | 'pip_sum';
  turnTimerSeconds: TurnTimerOption;
}

export interface MongooseSettings {
  matchRule: 'rank_match' | 'rank_or_suit' | 'higher_or_equal';
  captureEffect: 'give_pile_to_previous' | 'collect_pile_to_score' | 'burn_and_bonus';
  allowMultiCardPlay: boolean;
  specialCardsRule: 'none' | 'tens_burn_aces_skip';
  turnTimerSeconds: TurnTimerOption;
}

export interface GadhaChorSettings {
  oddCard: 'queen_spades' | 'joker';
  pairRule: 'same_rank_same_color' | 'any_same_rank';
  autoDiscardPairs: boolean;
  pickDirection: 'clockwise' | 'counterclockwise';
  turnTimerSeconds: TurnTimerOption;
}

export interface CardGameSettingsMap {
  uno: UnoSettings;
  satyo: SatyoSettings;
  mongoose: MongooseSettings;
  gadha_chor: GadhaChorSettings;
}

export interface CardPlayerPublic {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  isMuted: boolean;
  joinedAt: number;
  cardCount: number;
  score: number;
  safe: boolean;
  saidUno: boolean;
  lastActionText?: string;
}

export interface CardLogEntry {
  id: string;
  actorUid: string;
  actorName: string;
  text: string;
  timestamp: number;
}

export interface SatyoLanePublic {
  started: boolean;
  low: number | null;
  high: number | null;
  cardsCount: number;
}

export interface CardGameOutcome {
  gameId: CardGameId;
  winnerUids: string[];
  loserUid: string | null;
  reason: string;
  scores: Record<string, number>;
  revealedHands?: Record<string, CardItem[]>;
}

export interface CardTablePublicState {
  gameId: CardGameId;
  playerOrder: string[];
  turnUid: string | null;
  turnIndex: number;
  direction: 1 | -1;
  turnStartedAt: number;
  turnDeadlineAt: number | null;
  roundNumber: number;
  actionLog: CardLogEntry[];
  // UNO public state
  uno?: {
    topCard: UnoCard | null;
    activeColor: UnoChosenColor;
    drawPileCount: number;
    discardCount: number;
    pendingDrawCount: number;
    unoVulnerableUid: string | null;
    hasDrawnThisTurn: boolean;
  };
  // Satyo public state
  satyo?: {
    lanes: Record<StandardSuit, SatyoLanePublic>;
    startingSevenRequired: StandardSuit | 'any';
    boardCardCount: number;
  };
  // Mongoose public state (uppermost publicly played card always clearly visible)
  mongoose?: {
    uppermostCard: StandardCard | JokerCard | null;
    recentStackCards: Array<StandardCard | JokerCard>;
    stackCount: number;
    drawPileCount: number;
    lastPlayedByUid: string | null;
    burnedCount: number;
    roundNumber: number;
  };
  // Gadha Chor public state
  gadhaChor?: {
    targetUid: string | null;
    targetCardCount: number;
    pairsClearedTotal: number;
    safeOrder: string[];
    oddCardType: 'queen_spades' | 'joker';
  };
  outcome: CardGameOutcome | null;
}

export interface CardRoomClientState {
  code: string;
  hostId: string;
  selectedGame: CardGameId;
  phase: CardRoomPhase;
  createdAt: number;
  updatedAt: number;
  settings: CardGameSettingsMap;
  players: Record<string, CardPlayerPublic>;
  playerOrder: string[];
  table: CardTablePublicState | null;
  /** Strictly only the authenticated caller's own cards */
  myHand: CardItem[];
}

export type CardActionPayload =
  | { type: 'uno_play'; cardId: string; chosenColor?: UnoChosenColor }
  | { type: 'uno_draw' }
  | { type: 'uno_pass' }
  | { type: 'uno_call' }
  | { type: 'uno_catch'; targetUid: string }
  | { type: 'satyo_play'; cardId: string }
  | { type: 'satyo_pass' }
  | { type: 'mongoose_play'; cardIds: string[] }
  | { type: 'mongoose_pickup' }
  | { type: 'gadha_pick'; index: number }
  | { type: 'gadha_discard_pair'; cardIds: [string, string] }
  | { type: 'gadha_shuffle_hand' };
