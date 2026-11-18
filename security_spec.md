# Security Specification — Party Arcade (Word Battle, Guess the Animal & Dumb Charades)

## 1. Data Invariants
1. **Authenticated & Verified Access Only**: Every read and write across `/rooms`, `/animal_rooms`, `/charades_rooms`, `/secrets`, `/private_movie`, and `/signals` requires `request.auth != null && request.auth.token.email_verified == true`.
2. **No Blanket Room Scraping**:
   - `/rooms`: `allow list: if false;`
   - `/animal_rooms` & `/charades_rooms`: `allow list` is strictly scoped to `request.auth.uid in resource.data.playerIds` for rejoin discovery.
3. **Strict 2-Player Isolation (`/animal_rooms/{roomCode}`)**:
   - `playerIds` capped at 2; `/secrets/{uid}` readable/writable strictly by `request.auth.uid == uid`.
4. **Private Movie Assignment (`/charades_rooms/{roomCode}/private_movie/{uid}`)**:
   - `allow list: if false;` prevents enumerating secret movie assignments.
   - `allow get` requires `request.auth.uid == uid` and room membership — guessing players and non-actor hosts cannot read an actor's movie title.
   - `movieMeta` on `/charades_rooms/{roomCode}` strictly allows only non-secret hint fields (`wordCount`, `wordLengths`, `completedWords`, `category`, `language`, `difficulty`, `hintsEnabled`).
   - `revealedMovie` on `/charades_rooms/{roomCode}` must remain `null` until `phase == 'revealed'`.
5. **Host Authority (`/charades_rooms/{roomCode}`)**:
   - Team assignments, game mode, acting/guessing teams, actor selection, movie giver selection, round start, pause/resume, and restart are restricted to `existing().hostId == request.auth.uid`.
6. **Signal Privacy & Sender Integrity**: WebRTC signals require `from == request.auth.uid`, valid room membership, and `list` filtered to `resource.data.to == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated `get` on `/rooms/ABC12` or `/charades_rooms/ABC12`.
2. Unverified email (`email_verified: false`) `create` on `/charades_rooms/ABC12`.
3. Blanket `list` query on `/rooms`, `/animal_rooms`, or `/charades_rooms` without `playerIds` scope.
4. Room `create` with spoofed `hostId` (`hostId != request.auth.uid`).
5. Room `create` with shadow field (`isAdmin: true`) or forged `createdAt`.
6. Invalid room code ID (`charades_rooms/ab12` or 200-char junk ID).
7. Mutating immutable `code` or `createdAt` field on `update`.
8. Non-host player trying to alter teams, mode, `actorIds`, or `movieGiverId` in `/charades_rooms/ABC12`.
9. Guessing player attempting `get` or `list` on `/charades_rooms/ABC12/private_movie/{actorUid}`.
10. Actor or giver attempting to set `revealedMovie` while `phase != 'revealed'` or smuggle `title` inside `movieMeta`.
11. Opponent attempting `get` on `/animal_rooms/ABC12/secrets/{uid}`.
12. Spoofed WebRTC signal sender (`from != request.auth.uid`) or non-member writing `/signals`.
13. Opponent attempting `get` or `list` on `/card_rooms/ABC12/hands/{otherUid}` or `list` on `/card_rooms/ABC12/deck`.
14. Non-host player trying to change `selectedGame`, `settings`, or initiate a new round deal in `/card_rooms/ABC12`.

