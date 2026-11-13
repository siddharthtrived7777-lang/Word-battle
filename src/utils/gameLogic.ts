import { CATEGORIES, WORD_PAIRS } from '../data/wordPairs';
import {
  CategoryId,
  GameSettings,
  Player,
  RoomState,
  RoundConfig,
  RoundOutcome,
} from '../types/game';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getSortedPlayers(players: Record<string, Player> | undefined): Player[] {
  if (!players) return [];
  return Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}

export function createRoundSetup(
  players: Record<string, Player>,
  settings: GameSettings,
  usedPairIds: string[]
): { roundConfig: RoundConfig; nextUsedPairIds: string[] } {
  const activePlayers = getSortedPlayers(players).filter((p) => p.connected);
  const usedSet = new Set(usedPairIds);

  let targetCategory: CategoryId;
  if (settings.category === 'random') {
    const categoriesWithUnused = CATEGORIES.filter((cat) =>
      WORD_PAIRS.some((pair) => pair.category === cat.id && !usedSet.has(pair.id))
    );
    const poolCats = categoriesWithUnused.length > 0 ? categoriesWithUnused : CATEGORIES;
    targetCategory = poolCats[Math.floor(Math.random() * poolCats.length)].id;
  } else {
    targetCategory = settings.category;
  }

  let candidatePairs = WORD_PAIRS.filter(
    (pair) => pair.category === targetCategory && !usedSet.has(pair.id)
  );

  let resetUsed = false;
  if (candidatePairs.length === 0) {
    // Fallback to any unused pair across all categories before resetting
    candidatePairs = WORD_PAIRS.filter((pair) => !usedSet.has(pair.id));
  }
  if (candidatePairs.length === 0) {
    // All 135 pairs used in this session — reset session history
    resetUsed = true;
    candidatePairs = WORD_PAIRS.filter((pair) => pair.category === targetCategory);
    if (candidatePairs.length === 0) {
      candidatePairs = WORD_PAIRS;
    }
  }

  const chosenPair = candidatePairs[Math.floor(Math.random() * candidatePairs.length)];
  const majorityWordIndex: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  const imposterWordIndex: 0 | 1 = majorityWordIndex === 0 ? 1 : 0;

  const maxImposters = activePlayers.length >= 5 ? 2 : 1;
  const actualImposterCount = Math.min(settings.imposterCount, maxImposters);

  const shuffledIds = shuffleArray(activePlayers.map((p) => p.id));
  const imposterIds = shuffledIds.slice(0, actualImposterCount);
  const turnOrder = shuffleArray(activePlayers.map((p) => p.id));

  const nextUsedPairIds = resetUsed
    ? [chosenPair.id]
    : [...usedPairIds, chosenPair.id];

  return {
    roundConfig: {
      pairId: chosenPair.id,
      category: chosenPair.category,
      majorityWordIndex,
      imposterWordIndex,
      imposterIds,
      turnOrder,
      currentTurnIndex: 0,
      currentRound: 1,
      turnStartedAt: Date.now(),
    },
    nextUsedPairIds,
  };
}

export function computeRoundOutcome(room: RoomState): RoundOutcome {
  const activePlayers = getSortedPlayers(room.players).filter((p) => p.connected);
  const imposterSet = new Set(room.roundConfig?.imposterIds ?? []);
  const voteCounts: Record<string, number> = {};

  for (const p of activePlayers) {
    voteCounts[p.id] = 0;
  }

  for (const [voterId, targetId] of Object.entries(room.votes ?? {})) {
    if (room.players[voterId] && room.players[targetId]) {
      voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
    }
  }

  let maxVotes = 0;
  for (const count of Object.values(voteCounts)) {
    if (count > maxVotes) maxVotes = count;
  }

  const topVotedIds =
    maxVotes > 0
      ? Object.entries(voteCounts)
          .filter(([, count]) => count === maxVotes)
          .map(([id]) => id)
      : [];

  const caughtImposterIds = topVotedIds.filter((id) => imposterSet.has(id));
  // Group wins if at least one imposter is top-voted and no innocent tied with them at the top
  const winner: 'crew' | 'imposter' =
    caughtImposterIds.length > 0 && caughtImposterIds.length === topVotedIds.length
      ? 'crew'
      : 'imposter';

  const pointsAwarded: Record<string, number> = {};
  for (const p of activePlayers) {
    if (winner === 'crew') {
      pointsAwarded[p.id] = imposterSet.has(p.id) ? 0 : 1;
    } else {
      pointsAwarded[p.id] = imposterSet.has(p.id) ? 2 : 0;
    }
  }

  return {
    winner,
    caughtImposterIds,
    topVotedIds,
    voteCounts,
    pointsAwarded,
  };
}
