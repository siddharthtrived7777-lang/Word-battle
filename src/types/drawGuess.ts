import type { PlayerAvatar } from './game';

export type DrawWordPackId =
  | 'all'
  | 'desi'
  | 'animals'
  | 'food'
  | 'objects'
  | 'adventure';

export type DrawPhase =
  | 'lobby'
  | 'choosing_word'
  | 'drawing'
  | 'turn_reveal'
  | 'finished';

export type DrawTool = 'pen' | 'eraser' | 'fill';

export interface DrawSettings {
  rounds: 2 | 3 | 4 | 5;
  drawTimeSec: 60 | 80 | 100;
  wordPack: DrawWordPackId;
  hintsEnabled: boolean;
}

export interface DrawPlayer {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  connected: boolean;
  isMuted: boolean;
  score: number;
  joinedAt: number;
}

export interface DrawGuessRecord {
  guessedAt: number;
  points: number;
  order: number;
}

export interface DrawTurnState {
  roundNumber: number;
  turnIndex: number;
  turnOrder: string[];
  drawerUid: string;
  turnKey: string;
  packLabel: string;
  hintMask: string;
  wordLengths: number[];
  wordHash: string;
  closeHashes: string[];
  startedAt: number;
  deadlineAt: number;
  guessedBy: Record<string, DrawGuessRecord>;
  drawerPoints: number;
  canvasVersion: number;
  revealedWord: string | null;
}

export interface DrawRoomState {
  code: string;
  hostId: string;
  phase: DrawPhase;
  settings: DrawSettings;
  playerIds: string[];
  players: Record<string, DrawPlayer>;
  usedWords: string[];
  turn: DrawTurnState | null;
  createdAt: number;
  updatedAt: number;
}

export interface DrawSecretDoc {
  ownerId: string;
  turnKey: string;
  word: string;
  choices: string[];
  updatedAt: number;
}

export interface DrawStrokeDoc {
  id: string;
  turnKey: string;
  canvasVersion: number;
  drawerUid: string;
  seq: number;
  tool: DrawTool;
  color: string;
  size: number;
  /** Flat integer coordinate array [x0, y0, x1, y1, ...] in 1000x625 canvas space */
  points: number[];
  recipientIds: string[];
  createdAt: number;
}

export interface DrawMessageDoc {
  id: string;
  turnKey: string;
  senderId: string;
  senderName: string;
  kind: 'guess' | 'correct' | 'system';
  text: string;
  points?: number;
  recipientIds: string[];
  timestamp: number;
  createdAt: number;
}
