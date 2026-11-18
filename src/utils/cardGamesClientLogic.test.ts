import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGadhaChorDeck,
  buildUnoDeck,
  CARD_ROOM_TTL_MS,
  createEmptySatyoLanes,
  decideCardRoomCreateConflict,
  decideCardRoomJoinAction,
  DEFAULT_CARD_SETTINGS,
  getGadhaTargetUidFromCounts,
  isMongoosePlayLegal,
  isSatyoCardPlayable,
  isUnoCardPlayable,
  isValidCardRoomCodeFormat,
  sanitizeCardRoomCode,
  stripGadhaPairs,
} from './cardGamesClientLogic.ts';

describe('cardGamesClientLogic parity', () => {
  it('builds a full 108-card UNO deck', () => {
    assert.equal(buildUnoDeck().length, 108);
  });

  it('builds a 49-card Q♠ or 53-card Joker Gadha Chor deck', () => {
    const qDeck = buildGadhaChorDeck('queen_spades');
    const jDeck = buildGadhaChorDeck('joker');
    assert.equal(qDeck.length, 49);
    assert.equal(jDeck.length, 53);
  });

  it('strips pairs leaving only unpairable odd card', () => {
    const deck = buildGadhaChorDeck('queen_spades');
    const { remaining, pairsRemoved } = stripGadhaPairs(deck, 'any_same_rank');
    assert.equal(pairsRemoved, 24);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].kind, 'standard');
    if (remaining[0].kind === 'standard') {
      assert.equal(remaining[0].rank, 12);
      assert.equal(remaining[0].suit, 'spades');
    }
  });

  it('validates UNO draw stacking, Satyo 7-opener, and Mongoose rank match', () => {
    assert.equal(
      isUnoCardPlayable(
        { id: 'u1', kind: 'uno', color: 'red', value: '5' },
        { id: 'u0', kind: 'uno', color: 'blue', value: 'draw2' },
        'blue',
        2,
        true
      ),
      false
    );
    assert.equal(
      isUnoCardPlayable(
        { id: 'u2', kind: 'uno', color: 'red', value: 'draw2' },
        { id: 'u0', kind: 'uno', color: 'blue', value: 'draw2' },
        'blue',
        2,
        true
      ),
      true
    );

    const lanes = createEmptySatyoLanes();
    assert.equal(
      isSatyoCardPlayable(
        { id: 's1', kind: 'standard', suit: 'hearts', rank: 7 },
        lanes,
        0,
        DEFAULT_CARD_SETTINGS.satyo
      ),
      true
    );
    assert.equal(
      isSatyoCardPlayable(
        { id: 's2', kind: 'standard', suit: 'spades', rank: 7 },
        lanes,
        0,
        DEFAULT_CARD_SETTINGS.satyo
      ),
      false
    );

    assert.equal(
      isMongoosePlayLegal(
        [{ id: 'm1', kind: 'standard', suit: 'spades', rank: 9 }],
        { id: 'm0', kind: 'standard', suit: 'hearts', rank: 9 },
        DEFAULT_CARD_SETTINGS.mongoose
      ),
      true
    );
  });

  it('computes Gadha Chor target UID skipping safe players', () => {
    const players = {
      p1: {
        id: 'p1',
        name: 'A',
        avatar: { type: 'emoji' as const, emoji: '🦊', color: '#000' },
        isHost: true,
        ready: false,
        connected: true,
        isMuted: false,
        joinedAt: 1,
        cardCount: 3,
        score: 0,
        safe: false,
        saidUno: false,
      },
      p2: {
        id: 'p2',
        name: 'B',
        avatar: { type: 'emoji' as const, emoji: '🐻', color: '#000' },
        isHost: false,
        ready: false,
        connected: true,
        isMuted: false,
        joinedAt: 2,
        cardCount: 0,
        score: 0,
        safe: true,
        saidUno: false,
      },
      p3: {
        id: 'p3',
        name: 'C',
        avatar: { type: 'emoji' as const, emoji: '🐼', color: '#000' },
        isHost: false,
        ready: false,
        connected: true,
        isMuted: false,
        joinedAt: 3,
        cardCount: 4,
        score: 0,
        safe: false,
        saidUno: false,
      },
    };
    const target = getGadhaTargetUidFromCounts(['p1', 'p2', 'p3'], players, 'p1', 'clockwise');
    assert.equal(target, 'p3');
  });

  it('sanitizes room codes and validates 5-character format', () => {
    assert.equal(sanitizeCardRoomCode(' ab-9z! '), 'AB9Z');
    assert.equal(sanitizeCardRoomCode('hk3m9extra'), 'HK3M9');
    assert.equal(isValidCardRoomCodeFormat('HK3M9'), true);
    assert.equal(isValidCardRoomCodeFormat('HK3M'), false);
    assert.equal(isValidCardRoomCodeFormat('hk3m9'), false);
  });

  it('handles create conflict idempotently for own room and signals collision for another host without deletion', () => {
    assert.equal(
      decideCardRoomCreateConflict({ hostId: 'u1', playerIds: ['u1'] }, 'u1'),
      'reuse_existing'
    );
    assert.equal(
      decideCardRoomCreateConflict({ hostId: 'u2', playerIds: ['u2', 'u1'] }, 'u1'),
      'reuse_existing'
    );
    assert.equal(
      decideCardRoomCreateConflict({ hostId: 'u2', playerIds: ['u2'] }, 'u1'),
      'collision'
    );
  });

  it('allows joining open lobbies for all 4 games, blocks full/active rooms for outsiders, and supports browser-refresh rejoin', () => {
    const now = 1_700_000_000_000;
    for (const game of ['uno', 'satyo', 'mongoose', 'gadha_chor'] as const) {
      assert.deepEqual(
        decideCardRoomJoinAction(
          {
            selectedGame: game,
            phase: 'lobby',
            playerIds: ['u1'],
            createdAt: now - 5000,
            updatedAt: now - 1000,
          },
          'u2',
          now
        ),
        { action: 'join' }
      );
    }

    // Rejoin works even when game is actively playing
    assert.deepEqual(
      decideCardRoomJoinAction(
        {
          selectedGame: 'uno',
          phase: 'playing',
          playerIds: ['u1', 'u2'],
          createdAt: now - 5000,
          updatedAt: now - 1000,
        },
        'u2',
        now
      ),
      { action: 'rejoin' }
    );

    // Outsider rejected from active game
    assert.deepEqual(
      decideCardRoomJoinAction(
        {
          selectedGame: 'uno',
          phase: 'playing',
          playerIds: ['u1', 'u2'],
          createdAt: now - 5000,
          updatedAt: now - 1000,
        },
        'u3',
        now
      ),
      { action: 'reject', error: 'GAME_IN_PROGRESS' }
    );

    // Satyo 6-player capacity cap vs UNO 8-player capacity
    assert.deepEqual(
      decideCardRoomJoinAction(
        {
          selectedGame: 'satyo',
          phase: 'lobby',
          playerIds: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'],
          createdAt: now - 5000,
          updatedAt: now - 1000,
        },
        'u7',
        now
      ),
      { action: 'reject', error: 'ROOM_FULL' }
    );

    // Expired room rejected for non-members
    assert.deepEqual(
      decideCardRoomJoinAction(
        {
          selectedGame: 'mongoose',
          phase: 'lobby',
          playerIds: ['u1'],
          createdAt: now - CARD_ROOM_TTL_MS - 1000,
          updatedAt: now - CARD_ROOM_TTL_MS - 1000,
        },
        'u2',
        now
      ),
      { action: 'reject', error: 'ROOM_NOT_FOUND' }
    );
  });
});

