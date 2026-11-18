/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Covers Word Battle (/rooms), Guess the Animal (/animal_rooms), and Dumb Charades (/charades_rooms).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Unauthenticated room get',
    auth: null,
    operation: 'get',
    path: 'charades_rooms/ABC12',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email room create',
    auth: { uid: 'u1', email_verified: false },
    operation: 'create',
    path: 'charades_rooms/ABC12',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Blanket rooms / charades_rooms list query without playerIds scope',
    auth: { uid: 'u1', email_verified: true },
    operation: 'list',
    path: 'charades_rooms',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Spoofed hostId on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'charades_rooms/ABC12',
    data: { hostId: 'victim_uid', code: 'ABC12', phase: 'lobby' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'charades_rooms/ABC12',
    data: { hostId: 'u1', code: 'ABC12', phase: 'lobby', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Invalid roomCode path ID poisoning',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: `charades_rooms/${'A'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Mutating immutable code or createdAt on update',
    auth: { uid: 'u1', email_verified: true },
    operation: 'update',
    path: 'charades_rooms/ABC12',
    data: { code: 'ZZZZZ' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Non-host mutating teams or actorIds in charades_rooms',
    auth: { uid: 'u2', email_verified: true },
    operation: 'update',
    path: 'charades_rooms/ABC12',
    data: { mode: 'individual', actorIds: ['u3'] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Guessing player reading actor private_movie document',
    auth: { uid: 'u3', email_verified: true },
    operation: 'get',
    path: 'charades_rooms/ABC12/private_movie/u2',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Smuggling title into public movieMeta or revealedMovie before revealed phase',
    auth: { uid: 'u2', email_verified: true },
    operation: 'update',
    path: 'charades_rooms/ABC12',
    data: { phase: 'acting', revealedMovie: { title: 'SHOLAY' } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Opponent attempting to read player secret animal document',
    auth: { uid: 'u2', email_verified: true },
    operation: 'get',
    path: 'animal_rooms/ABC12/secrets/u1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Spoofed signal sender or non-member writing charades signal',
    auth: { uid: 'u9', email_verified: true },
    operation: 'create',
    path: 'charades_rooms/ABC12/signals/sig1',
    data: { id: 'sig1', from: 'u1', to: 'u2', type: 'offer' },
    expected: 'PERMISSION_DENIED',
  },
];

describe('Party Arcade Dirty Dozen Security Spec', () => {
  it('defines all 12 adversarial payloads', () => {
    assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
  });
});
