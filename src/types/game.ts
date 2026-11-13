export type Language = 'en' | 'hi';

export type GamePhase =
  | 'lobby'
  | 'reveal'
  | 'discussion'
  | 'voting'
  | 'result';

export type CategoryId =
  | 'food_drinks'
  | 'everyday_objects'
  | 'places_nature'
  | 'animals'
  | 'technology'
  | 'clothing'
  | 'household'
  | 'vehicles'
  | 'sports_hobbies';

export type CategorySelection = 'random' | CategoryId;

export interface WordPair {
  id: string;
  category: CategoryId;
  en: [string, string];
  hi: [string, string];
}

export interface PlayerAvatar {
  type: 'emoji' | 'initials';
  emoji?: string;
  color: string;
}

export interface Player {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
  score: number;
  isMuted: boolean;
  readyForDiscussion: boolean;
}

export interface GameSettings {
  category: CategorySelection;
  rounds: 3 | 4 | 5;
  imposterCount: 1 | 2;
}

export interface ClueEntry {
  id: string;
  playerId: string;
  playerName: string;
  round: number;
  text: string;
  createdAt: number;
}

export interface RoundConfig {
  pairId: string;
  category: CategoryId;
  /** 0 or 1: which word in the WordPair goes to the majority */
  majorityWordIndex: 0 | 1;
  /** 0 or 1: which word goes to the imposter(s) */
  imposterWordIndex: 0 | 1;
  imposterIds: string[];
  turnOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  turnStartedAt: number;
}

export interface RoundOutcome {
  winner: 'crew' | 'imposter';
  caughtImposterIds: string[];
  topVotedIds: string[];
  voteCounts: Record<string, number>;
  pointsAwarded: Record<string, number>;
}

export interface RoomState {
  code: string;
  hostId: string;
  phase: GamePhase;
  createdAt: number;
  settings: GameSettings;
  players: Record<string, Player>;
  usedPairIds: string[];
  roundConfig: RoundConfig | null;
  clues: ClueEntry[];
  votes: Record<string, string>;
  outcome: RoundOutcome | null;
}

export interface SignalPayload {
  id: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice';
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}
