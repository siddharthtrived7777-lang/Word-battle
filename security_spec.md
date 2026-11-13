# Security Specification — Imposter Word

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Every read and write on `/rooms/{roomCode}` and `/rooms/{roomCode}/signals/{signalId}` requires `request.auth != null && request.auth.token.email_verified == true`.
2. **No Room Scraping (`allow list: if false`)**: Clients may only `get` a room when they know its exact 5-character `roomCode` (`^[A-Z0-9]{5}$`). Listing all rooms is strictly forbidden.
3. **Creator Ownership & Immutability**: On room creation, `hostId` MUST equal `request.auth.uid`, `phase` MUST be `'lobby'`, `players` MUST contain only `request.auth.uid`, and `createdAt == request.time && updatedAt == request.time`. After creation, `code` and `createdAt` are immutable.
4. **Zero PII Exposure**: Neither `rooms` nor `signals` store email addresses, phone numbers, or user account metadata.
5. **Bounded Structures**: `players` is capped at 10 entries, `votes` at 10 entries, `clues` at 60 items, `usedPairIds` at 140 items.
6. **Signal Privacy & Sender Integrity**: Signals at `/rooms/{roomCode}/signals/{signalId}` can only be created with `from == request.auth.uid` for an existing parent room, listed only where `resource.data.to == request.auth.uid`, and read/deleted only by `from` or `to`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `get` on `/rooms/ABC12`.
2. Unverified email (`email_verified: false`) `create` on `/rooms/ABC12`.
3. Collection `list` query on `/rooms`.
4. Room `create` with spoofed `hostId` (`hostId != request.auth.uid`).
5. Room `create` with shadow field (`isAdmin: true`).
6. Room `create` with forged client `createdAt` timestamp (`createdAt != request.time`).
7. Room `create` with invalid room code ID (`rooms/ab12` or 1.5KB junk ID).
8. Room `update` mutating immutable `code` or `createdAt` field.
9. Non-host player trying to change `phase` or `settings` in `lobby`.
10. Signal `create` with spoofed `from` UID (`from != request.auth.uid`).
11. Signal `list` query without `where('to', '==', uid)` filter.
12. Signal `create` referencing a non-existent parent room (`exists()` fails).
