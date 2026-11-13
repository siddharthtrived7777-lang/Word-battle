/**
 * Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Designed for @firebase/rules-unit-testing against Firestore Emulator.
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
    name: '3. Blanket rooms list query',
    auth: { uid: 'u1', email_verified: true },
    operation: 'list',
    path: 'rooms',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Spoofed hostId on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'rooms/ABC12',
    data: { hostId: 'victim_uid', code: 'ABC12', phase: 'lobby' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on create',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'rooms/ABC12',
    data: { hostId: 'u1', code: 'ABC12', phase: 'lobby', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Client-forged createdAt timestamp',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: 'rooms/ABC12',
    data: { hostId: 'u1', code: 'ABC12', createdAt: new Date(0) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Invalid roomCode path ID poisoning',
    auth: { uid: 'u1', email_verified: true },
    operation: 'create',
    path: `rooms/${'A'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Mutating immutable code or createdAt on update',
    auth: { uid: 'u1', email_verified: true },
    operation: 'update',
    path: 'rooms/ABC12',
    data: { code: 'ZZZZZ' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Non-host changing room phase or settings',
    auth: { uid: 'u2', email_verified: true },
    operation: 'update',
    path: 'rooms/ABC12',
    data: { phase: 'result' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Spoofed signal sender from != auth.uid',
    auth: { uid: 'u2', email_verified: true },
    operation: 'create',
    path: 'rooms/ABC12/signals/sig1',
    data: { id: 'sig1', from: 'u1', to: 'u3', type: 'offer' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Unfiltered signals list query',
    auth: { uid: 'u2', email_verified: true },
    operation: 'list',
    path: 'rooms/ABC12/signals',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Orphaned signal targeting non-existent room',
    auth: { uid: 'u2', email_verified: true },
    operation: 'create',
    path: 'rooms/NOPE9/signals/sig1',
    data: { id: 'sig1', from: 'u2', to: 'u1', type: 'ice' },
    expected: 'PERMISSION_DENIED',
  },
];

describe('Imposter Word Dirty Dozen Security Spec', () => {
  it('defines all 12 adversarial payloads', () => {
    assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12);
  });
});
