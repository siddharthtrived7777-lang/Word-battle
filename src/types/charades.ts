import { PlayerAvatar } from './game';

export type CharadesMode = 'team' | 'individual';
export type CharadesTeamId = 'A' | 'B';
export type CharadesPhase =
  | 'lobby'
  | 'selecting_movie'
  | 'acting'
  | 'revealed'
  | 'paused';

export type CharadesCategory =
  | 'Bollywood Classics'
  | 'Modern Bollywood'
  | 'Dhollywood'
  | 'Comedy'
  | 'Romantic'
  | 'Action'
  | 'Thriller'
  | 'Horror'
  | 'Family'
  | 'Popular Movies'
  | 'Difficult Movies'
  | 'Regional Cinema'
  | 'Hollywood'
  | 'Custom';

export type CharadesDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface CharadesMovieItem {
  id: string;
  title: string;
  category: CharadesCategory;
  language: string;
  difficulty: CharadesDifficulty;
  popular?: boolean;
}

export interface CharadesPlayer {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  team: CharadesTeamId | null;
  connected: boolean;
  joinedAt: number;
  cameraEnabled: boolean;
  micEnabled: boolean;
  isMuted: boolean;
}

/**
 * Public movie hint metadata synced on the room document.
 * NEVER contains the movie title or individual words before reveal.
 */
export interface CharadesPublicMovieMeta {
  wordCount: number;
  wordLengths: number[];
  completedWords: boolean[];
  category: string;
  language: string;
  difficulty: CharadesDifficulty;
  hintsEnabled: boolean;
}

/**
 * Private movie assignment stored in /charades_rooms/{code}/private_movie/{uid}
 * Readable ONLY by the authorized recipient (actor or movie giver).
 */
export interface CharadesPrivateMovie {
  ownerId: string;
  title: string;
  words: string[];
  category: string;
  language: string;
  difficulty: CharadesDifficulty;
  assignedBy: string;
}

export interface CharadesGuessFeedback {
  status: 'none' | 'wrong' | 'correct';
  count: number;
  updatedAt: number;
}

export interface CharadesRevealedMovie {
  title: string;
  category: string;
  language: string;
  difficulty: CharadesDifficulty;
  winnerUid: string | null;
  winnerTeam: CharadesTeamId | null;
  winnerName: string;
  outcome: 'guessed' | 'revealed';
}

export interface CharadesScores {
  teamA: number;
  teamB: number;
  players: Record<string, number>;
}

export interface CharadesRoomState {
  code: string;
  hostId: string;
  playerIds: string[];
  players: Record<string, CharadesPlayer>;
  mode: CharadesMode;
  teamNames: {
    A: string;
    B: string;
  };
  phase: CharadesPhase;
  pausedFromPhase: CharadesPhase | null;
  roundNumber: number;
  actingTeam: CharadesTeamId | null;
  guessingTeam: CharadesTeamId | null;
  actorIds: string[];
  movieGiverId: string | null;
  guesserIds: string[];
  movieMeta: CharadesPublicMovieMeta | null;
  guessFeedback: CharadesGuessFeedback;
  revealedMovie: CharadesRevealedMovie | null;
  scores: CharadesScores;
  createdAt: number;
  updatedAt: number;
}

export type CharadesReactionType = 'heart' | 'thumbs_up' | 'peace';

export interface CharadesReactionEvent {
  id: string;
  senderId: string;
  senderName: string;
  gesture: CharadesReactionType;
  timestamp: number;
}

