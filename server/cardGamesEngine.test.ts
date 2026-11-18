import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoResolveTimedOutTurn,
  buildGadhaChorDeck,
  createInitialCardRoom,
  serializeCardRoomForPlayer,
  startCardGame,
  validateAndApplyCardAction,
} from './cardGamesEngine.ts';
import type { CardRoomInternal } from './cardGamesEngine.ts';
import type { PlayerAvatar } from '../src/types/game.ts';

const AVATAR: PlayerAvatar = { type: 'emoji', emoji: '🦊', color: '#C5A059' };

function addPlayer(room: CardRoomInternal, id: string, name: string) {
  room.players[id] = {
    id,
    name,
    avatar: AVATAR,
    isHost: false,
    ready: true,
    connected: true,
    isMuted: false,
    joinedAt: Date.now() + Object.keys(room.players).length,
    score: 0,
    safe: false,
    saidUno: false,
  };
  room.playerOrder.push(id);
}

test('serializeCardRoomForPlayer strictly isolates each player hand', () => {
  const room = createInitialCardRoom('ABCDE', { id: 'p1', name: 'Alice', avatar: AVATAR }, 'uno');
  addPlayer(room, 'p2', 'Bob');
  startCardGame(room);

  const view1 = serializeCardRoomForPlayer(room, 'p1');
  const view2 = serializeCardRoomForPlayer(room, 'p2');

  assert.equal(view1.myHand.length, 7);
  assert.equal(view2.myHand.length, 7);
  const p1Ids = new Set(view1.myHand.map((c) => c.id));
  for (const c of view2.myHand) {
    assert.equal(p1Ids.has(c.id), false, 'Player 1 must not share cards with Player 2');
  }
  // Ensure raw deck or hands map is never exposed
  assert.equal('hands' in (view1 as unknown as Record<string, unknown>), false);
  assert.equal('deck' in (view1 as unknown as Record<string, unknown>), false);
});

test('UNO validates turns, color choices on wild, UNO catch penalty, and win state', () => {
  const room = createInitialCardRoom('UNO11', { id: 'p1', name: 'Alice', avatar: AVATAR }, 'uno');
  addPlayer(room, 'p2', 'Bob');
  startCardGame(room);

  // Set deterministic controlled hands & top card
  room.discardUno = [{ id: 'top', kind: 'uno', color: 'red', value: '5' }];
  room.activeUnoColor = 'red';
  room.turnIndex = 0; // p1
  room.hands.p1 = [
    { id: 'c1', kind: 'uno', color: 'red', value: '9' },
    { id: 'c2', kind: 'uno', color: 'wild', value: 'wild' },
  ];
  room.hands.p2 = [
    { id: 'c3', kind: 'uno', color: 'blue', value: '4' },
    { id: 'c4', kind: 'uno', color: 'green', value: '7' },
  ];

  // Out of turn must throw
  assert.throws(
    () => validateAndApplyCardAction(room, 'p2', { type: 'uno_draw' }),
    /NOT_YOUR_TURN/
  );

  // Play red 9 -> drops p1 to 1 card without saying UNO -> vulnerable!
  validateAndApplyCardAction(room, 'p1', { type: 'uno_play', cardId: 'c1' });
  assert.equal(room.unoVulnerableUid, 'p1');
  assert.equal(room.playerOrder[room.turnIndex], 'p2');

  // Bob catches Alice without saying UNO (+2 cards)
  validateAndApplyCardAction(room, 'p2', { type: 'uno_catch', targetUid: 'p1' });
  assert.equal(room.hands.p1.length, 3);
  assert.equal(room.unoVulnerableUid, null);

  // Wild card requires chosenColor
  room.turnIndex = 0;
  assert.throws(
    () => validateAndApplyCardAction(room, 'p1', { type: 'uno_play', cardId: 'c2' }),
    /CHOOSE_WILD_COLOR/
  );

  // Play wild with chosen color -> updates activeColor cleanly
  validateAndApplyCardAction(room, 'p1', {
    type: 'uno_play',
    cardId: 'c2',
    chosenColor: 'yellow',
  });
  assert.equal(room.activeUnoColor, 'yellow');
});

test('Satyo deals 52 cards, enforces 7 of hearts lead, builds lanes, and rejects illegal pass', () => {
  const room = createInitialCardRoom('SATYO', { id: 'p1', name: 'Asha', avatar: AVATAR }, 'satyo');
  addPlayer(room, 'p2', 'Dev');
  startCardGame(room);

  const totalDealt = room.hands.p1.length + room.hands.p2.length;
  assert.equal(totalDealt, 52);

  const starterUid = room.playerOrder[room.turnIndex];
  const has7H = room.hands[starterUid].some(
    (c) => c.kind === 'standard' && c.rank === 7 && c.suit === 'hearts'
  );
  assert.equal(has7H, true);

  // Cannot pass when holding 7♥ and mustPlayIfAble=true
  assert.throws(
    () => validateAndApplyCardAction(room, starterUid, { type: 'satyo_pass' }),
    /MUST_PLAY_LEGAL_CARD/
  );

  const sevenHearts = room.hands[starterUid].find(
    (c) => c.kind === 'standard' && c.rank === 7 && c.suit === 'hearts'
  )!;
  validateAndApplyCardAction(room, starterUid, { type: 'satyo_play', cardId: sevenHearts.id });

  const view = serializeCardRoomForPlayer(room, starterUid);
  assert.equal(view.table?.satyo?.lanes.hearts.started, true);
  assert.equal(view.table?.satyo?.lanes.hearts.low, 7);
  assert.equal(view.table?.satyo?.lanes.hearts.high, 7);
});

test('Mongoose keeps uppermost card visible and executes rank-match pile capture', () => {
  const room = createInitialCardRoom('MONGO', { id: 'p1', name: 'Karan', avatar: AVATAR }, 'mongoose');
  addPlayer(room, 'p2', 'Meera');
  startCardGame(room);

  room.turnIndex = 0; // p1
  room.mongooseLastPlayedByUid = 'p2';
  room.stackMongoose = [{ id: 's1', kind: 'standard', suit: 'hearts', rank: 9 }];
  room.hands.p1 = [
    { id: 'm1', kind: 'standard', suit: 'spades', rank: 9 },
    { id: 'm2', kind: 'standard', suit: 'clubs', rank: 3 },
  ];
  room.hands.p2 = [{ id: 'm3', kind: 'standard', suit: 'diamonds', rank: 4 }];
  room.deck = [];

  const beforeView = serializeCardRoomForPlayer(room, 'p1');
  assert.equal(beforeView.table?.mongoose?.uppermostCard?.id, 's1');

  // Playing matching rank 9 sends the 2-card stack to previous player (p2)
  validateAndApplyCardAction(room, 'p1', { type: 'mongoose_play', cardIds: ['m1'] });
  assert.equal(room.stackMongoose.length, 0);
  assert.equal(room.hands.p2.length, 3);
});

test('Gadha Chor builds 49-card / 53-card decks and detects final Gadha Chor loser', () => {
  const deck49 = buildGadhaChorDeck('queen_spades');
  assert.equal(deck49.length, 49);
  assert.equal(
    deck49.filter((c) => c.kind === 'standard' && c.rank === 12).length,
    1
  );

  const deck53 = buildGadhaChorDeck('joker');
  assert.equal(deck53.length, 53);
  assert.equal(deck53.filter((c) => c.kind === 'joker').length, 1);

  const room = createInitialCardRoom('GADHA', { id: 'p1', name: 'Neha', avatar: AVATAR }, 'gadha_chor');
  addPlayer(room, 'p2', 'Rohan');
  startCardGame(room);

  room.turnIndex = 0; // p1 picks from p2
  room.hands.p1 = [{ id: 'g1', kind: 'standard', suit: 'hearts', rank: 5 }];
  room.hands.p2 = [
    { id: 'g2', kind: 'standard', suit: 'spades', rank: 5 },
    { id: 'qs', kind: 'standard', suit: 'spades', rank: 12 },
  ];
  room.settings.gadha_chor.autoDiscardPairs = true;

  // p1 picks index 0 (5♠) -> auto-pairs with 5♥ -> p1 becomes SAFE, p2 left with Q♠ as Gadha Chor!
  validateAndApplyCardAction(room, 'p1', { type: 'gadha_pick', index: 0 });
  assert.equal(room.phase, 'finished');
  assert.equal(room.outcome?.loserUid, 'p2');
  assert.deepEqual(room.outcome?.winnerUids, ['p1']);
});

test('autoResolveTimedOutTurn safely advances expired turn timer', () => {
  const room = createInitialCardRoom('TIMER', { id: 'p1', name: 'One', avatar: AVATAR }, 'uno');
  addPlayer(room, 'p2', 'Two');
  startCardGame(room);
  room.turnDeadlineAt = Date.now() - 1000;
  const beforeTurn = room.turnIndex;

  const changed = autoResolveTimedOutTurn(room);
  assert.equal(changed, true);
  assert.notEqual(room.turnIndex, beforeTurn);
});
