import { PlayerAvatar } from './game';

export type AnimalColor =
  | 'Red'
  | 'Orange'
  | 'Yellowish'
  | 'Gray'
  | 'Brown'
  | 'Green'
  | 'Black and White';

export type AnimalHome = 'Water' | 'Land' | 'Air' | 'Land and Water';

export type AnimalLegs = 'No legs' | '2' | '4' | '6+';

export type AnimalBodyCovering = 'Fur' | 'Hard shell' | 'Feathers' | 'Smooth/Scales';

export type AnimalFeature =
  | 'Horns/Antlers'
  | 'Visible ears'
  | 'Tusks'
  | 'Fins/Flippers'
  | 'Visible tail';

export type AnimalPattern = 'Stripes' | 'Spots/Patches' | 'Plain';

export type QuestionCategoryId =
  | 'color'
  | 'home'
  | 'legs'
  | 'bodyCovering'
  | 'features'
  | 'pattern';

export type AnimalTraitOption =
  | AnimalColor
  | AnimalHome
  | AnimalLegs
  | AnimalBodyCovering
  | AnimalFeature
  | AnimalPattern;

export interface AnimalDef {
  id: string;
  name: {
    en: string;
    hi: string;
  };
  emoji: string;
  cardBg: string;
  cardBorder: string;
  accentColor: string;
  traits: {
    color: AnimalColor;
    home: AnimalHome;
    legs: AnimalLegs;
    bodyCovering: AnimalBodyCovering;
    features: AnimalFeature[];
    pattern: AnimalPattern;
  };
}

export type AnimalPhase = 'lobby' | 'picking' | 'playing' | 'finished';

export interface AnimalPlayer {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  connected: boolean;
  joinedAt: number;
  isMuted: boolean;
  pickedSecret: boolean;
}

export interface PendingQuestion {
  id: string;
  byUid: string;
  category: QuestionCategoryId;
  option: AnimalTraitOption;
}

export interface PendingGuess {
  id: string;
  byUid: string;
  animalId: string;
}

export interface AnimalHistoryEntry {
  id: string;
  byUid: string;
  kind: 'question' | 'guess';
  category?: QuestionCategoryId;
  option?: AnimalTraitOption;
  animalId?: string;
  answer: boolean;
  createdAt: number;
}

export interface AnimalRoomState {
  code: string;
  hostId: string;
  playerIds: string[];
  players: Record<string, AnimalPlayer>;
  phase: AnimalPhase;
  turnUid: string | null;
  askedCategoriesThisTurn: QuestionCategoryId[];
  pendingQuestion: PendingQuestion | null;
  pendingGuess: PendingGuess | null;
  history: AnimalHistoryEntry[];
  winnerUid: string | null;
  revealedAnimals: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface AnimalSecret {
  ownerId: string;
  animalId: string;
}
