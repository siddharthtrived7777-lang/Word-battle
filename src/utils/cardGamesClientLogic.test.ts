import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGadhaChorDeck,
  buildUnoDeck,
  createEmptySatyoLanes,
  DEFAULT_CARD_SETTINGS,
  getGadhaTargetUidFromCounts,
  isMongoosePlayLegal,
  isSatyoCardPlayable,
  isUnoCardPlayable,
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
});
