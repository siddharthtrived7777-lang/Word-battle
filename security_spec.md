# Security Specification — Party Arcade (Word Battle & Guess the Animal)

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Every read and write on `/rooms`, `/animal_rooms`, `/secrets`, and `/signals` requires `request.auth != null && request.auth.token.email_verified == true`.
2. **No Blanket Room Scraping**:
   - `/rooms`: `allow list: if false;`
   - `/animal_rooms`: `allow list` is strictly scoped to `request.auth.uid in resource.data.playerIds` so users can only list their own active matches for rejoin.
3. **Strict 2-Player Isolation (`/animal_rooms/{roomCode}`)**:
   - `playerIds` is strictly capped at 2 entries.
   - Once 2 players are in the room (or `phase != 'lobby'`), any 3rd user receives `PERMISSION_DENIED` on both `get` and `update`.
   - Active game updates and deletes are permitted exclusively when `request.auth.uid in existing().playerIds`.
4. **Secret Animal Privacy (`/animal_rooms/{roomCode}/secrets/{uid}`)**:
   - `allow list: if false;` prevents enumerating secrets.
   - `allow get, create, update, delete` strictly requires `request.auth.uid == uid` and room membership. An opponent can never read `/secrets/{opponentUid}` under any circumstance.
   - `revealedAnimals` on the parent room doc must remain empty (`size() == 0`) until `phase == 'finished'`, when each player may write only their own UID entry.
5. **Creator Ownership & Immutability**: `code` and `createdAt` are immutable; `createdAt` and `updatedAt` are validated against `request.time`.
6. **Signal Privacy & Sender Integrity**: Signals require `from == request.auth.uid`, an existing parent room, and `list` filtered to `resource.data.to == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `get` on `/rooms/ABC12`.
2. Unverified email (`email_verified: false`) `create` on `/rooms/ABC12`.
3. Blanket `list` query on `/rooms` or `/animal_rooms` without `playerIds` filter.
4. Room `create` with spoofed `hostId` (`hostId != request.auth.uid`).
5. Room `create` with shadow field (`isAdmin: true`).
6. Room `create` with forged client `createdAt` timestamp (`createdAt != request.time`).
7. Invalid room code ID (`animal_rooms/ab12` or 200-char junk ID).
8. Mutating immutable `code` or `createdAt` field on `update`.
9. 3rd player attempting `get` or `update` (join) on a 2-player `/animal_rooms/ABC12` room.
10. Opponent (`u2`) attempting `get` or `list` on `/animal_rooms/ABC12/secrets/u1`.
11. Player writing `revealedAnimals` while `phase != 'finished'` or writing opponent's secret key.
12. Spoofed signal sender (`from != request.auth.uid`) or unfiltered `signals` list query.
