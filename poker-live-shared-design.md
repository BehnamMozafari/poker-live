# Poker Live: shared free experience

## Intent and agreed requirements

Extend PrakritD/poker-live through a personal GitHub fork and a draft upstream pull request. Preserve the current website and TV experience while enabling a laptop or phone to record a game and other devices to watch it live. The user currently has read-only upstream access. No paid subscription functionality in this release.

The user chose:
- Multiple independent poker groups from day one.
- Google sign-in for hosts and players.
- The host/banker sets up seats, approves account-to-player links, and controls every game edit, including buy-ins and cash-outs.
- Guests scan a QR code and watch without signing in.
- Guest access is limited to the current game. Past games and group leaderboards require approved group membership.
- Each group's history and leaderboards are private. An authenticated player can see their own approved results across groups.
- A website first, with a backend usable by a future mobile app.
- Focus on the free experience; no billing or paid feature enforcement now.

The user's response to the connectivity question was interpreted and played back as: recording requires an internet connection; during disconnects show the last received state and a connection indicator. Do not queue offline writes.

## Proposed technical approach (builder choices)

Keep React, TypeScript, Vite, existing themes, accounting calculations, and TV board. Use Supabase PostgreSQL, Google OAuth via Supabase Auth, database access controls and realtime notifications; use Cloudflare Pages for the configured shared frontend. No dedicated always-on server and no direct database secrets in the browser. Cloud provisioning and Google OAuth setup require the relevant account access and are separate from making a tested PR ready.

Use explicit shared/local modes: without Supabase configuration retain the current local-only experience and existing history behavior, visibly labeled local. In shared mode never automatically seed the bundled history or upload a browser's local data. Legacy import is an explicit host action scoped to the selected group. The shared production build must not bundle real legacy game history. Local mode must not be presented as saving to the cloud.

## Identity and permissions

Creating a group makes the authenticated creator its owner and sole host/banker for this version. Other authenticated users can request membership and a link to a host-created player identity; the host approves or rejects. Account links and membership never grant game write access. Players may participate without accounts. Seats are session-specific and assigned by the host. Only the host can create/edit/end sessions, assign seats, record/undo transactions, change group settings, or import data. Host transfer and multiple simultaneous bankers are out of scope.

Membership supports host approval without displaying private history to pending applicants. Approved members can read their group's history and leaderboard. A separate narrowly scoped personal-results query exposes only the caller's approved linked results across groups, without exposing other groups' player records or event logs. For this release approved links expose the corresponding player's existing and future history in that group, and revocation removes account access. Player links are one account per group player, with uniqueness to prevent competing claims.

## Guest and TV experience

The host creates a high-entropy, revocable share link and QR code for a specific active session. Possession permits viewing that session only, not group membership, history, group leaderboards, account identities, or any mutation. Ending the session invalidates guest access to session data; guest viewers see that the game has ended. The host may revoke and regenerate the link. Do not broadcast private group tables to anonymous realtime subscribers: use an access-controlled public projection or a narrow token-validated endpoint and safe refresh/notification mechanism. Reconnect must reload authoritative data. Share tokens must not be leaked into third-party QR services or analytics. Retain useful current-session figures and seating on guest screens, and remove controls and rotation panels that expose history or group totals.

## Data and writes

Persist groups, memberships, group players, account-link requests, sessions, session seats, and ordered session events with stable IDs, ownership references, and timestamps. Keep money as integer cents and derive totals using the current accounting model. Preserve undo behavior without allowing stale callers to undo another device's just-added event unnoticed. Use database transactions and optimistic concurrency or explicit atomic commands for all changes. Repeated requests must not duplicate buy-ins; concurrent edits must either compose safely or fail with an actionable reload message. Enforce game rules and access checks in the database/API as well as the UI. Session creation with initial buy-ins and ending/settling a session must be atomic. At most one active session per group, matching the current app model scoped by group.

Retain safe JSON export. Import existing JSON only after validation and host confirmation; preserve relationships, integer amounts, chronology and ended sessions, deduplicate repeat imports, and never overwrite an active shared game silently. Import the intended canonical export rather than automatically merging divergent browser histories. Keep SQL migrations versioned, with a clean local bootstrap and documented backup/restore path. UI access goes through a storage/API layer so a future mobile client can use the same backend contract.

## Deliverable and validation

A fork branch and draft upstream PR containing the shared experience, SQL migrations and permissions, automated tests, configuration examples, Cloudflare build/deployment instructions, Google OAuth instructions, legacy import/export guidance, and free-tier limitations. Preserve the existing GitHub Pages/local workflow where practical; no production cutover, cloud account creation, real-data upload, or billing activation is implied before configuration is available. Do not claim a live deployment or end-to-end Google login verification unless actually performed.

Validate existing tests and production builds, account isolation between groups, host-only writes, pending/revoked membership, cross-group personal results, guest token boundaries and expiry/revocation, import idempotency, and concurrent/retried writes. Exercise host and guest responsive flows in a browser, including TV visibility and connection failures. Use local Supabase integration tests if the environment supports it; explicitly report anything requiring external credentials that could not be verified.

## Out of scope

Native mobile binaries, payment processing, offline write queues, real-money payment handling, billing entitlements, multiple bankers, host transfers, automatic merging of inconsistent browser histories, and modifying upstream settings. No Jira ticket was supplied: do not invent one. Branch/commit naming for this unrelated personal project should use a descriptive poker-live name unless the user supplies a ticket.
