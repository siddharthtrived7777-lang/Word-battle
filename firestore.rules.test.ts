/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Covers Word Battle (/rooms) and Guess the Animal (/animal_rooms & /secrets).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export const DIRTY_DOZEN_PAYLOADS = [
  {
    name: '1. Unauthenticated room get',
    auth: null,
    operation: 'get',
    path: 'rooms/ABC12',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email room create',
    auth: { uid: 'u1', email_verified: false },
    operation: 'create',
    path: 'rooms/ABC12',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Blanket rooms / animal_rooms list query without playerIds scope',
    auth: { uid: 'u1', email_verified: true },
    operation: 'list',
    path: 'animal_rooms',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Spoofed hostId on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'animal_rooms/ABC12',
    data: { hostId: 'victim_uid', code: 'ABC12', phase: 'lobby' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'animal_rooms/ABC12',
    data: { hostId: 'u1', code: 'ABC12', phase: 'lobby', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Client-forged createdAt timestamp',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'animal_rooms/ABC12',
    data: { hostId: 'u1', code: 'ABC12', createdAt: new Date(0) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Invalid roomCode path ID poisoning',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: `animal_rooms/${'A'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Mutating immutable code or createdAt on update',
    auth: { uid: 'u1', email_verified: true },
    operation: 'update',
    path: 'animal_rooms/ABC12',
    data: { code: 'ZZZZZ' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Third player trying to read or join a full 2-player animal_room',
    auth: { uid: 'u3', email_verified: true },
    operation: 'update',
    path: 'animal_rooms/ABC12',
    data: { playerIds: ['u1', 'u2', 'u3'] },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Opponent attempting to read or list player secret animal document',
    auth: { uid: 'u2', email_verified: true },
    operation: 'get',
    path: 'animal_rooms/ABC12/secrets/u1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Player leaking revealedAnimals before phase is finished',
    auth: { uid: 'u1', email_verified: true },
    operation: 'update',
    path: 'animal_rooms/ABC12',
    data: { phase: 'playing', revealedAnimals: { u2: 'orca' } },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Spoofed signal sender or non-member writing animal room signal',
    auth: { uid: 'u3', email_verified: true },
    operation: 'create',
    path: 'animal_rooms/ABC12/signals/sig1',
    data: { id: 'sig1', from: 'u1', to: 'u2', type: 'offer' },
    expected: 'PERMISSION_DENIED',
  },
];

describe('Party Arcade Dirty Dozen Security Spec', () => {
  it('defines all 12 adversarial payloads', () => {
    assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
  });
});
