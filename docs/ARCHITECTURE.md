# Architecture

## Live milestone 5 (locally validated)

React + strict TypeScript + Vite preserve the existing canvas. An Express 5 Node/TypeScript API uses PostgreSQL for team data and sessions. Development services bind to loopback; the production API is private behind the configured TLS proxy. The API also hosts the live WebSocket gateway; private local filesystem assets are implemented; S3-compatible storage and hosting are planned.

- src/main.tsx: application bootstrap.
- src/theme.tsx and src/themes.css: personal Light/Dark/System appearance, semantic interface color tokens, separate device/account preferences and system-theme change handling. Session responses hydrate the account preference; account changes use the authenticated, CSRF-protected PATCH /api/account/preferences endpoint. Preferences rehydrate on login, reload and window focus; they are not workspace live operations.
- src/features/Editor.tsx: preserved editor and interactions.
- src/features/WorkspaceControls.tsx: authorized workspace discovery/switching and account actions; the editor guards navigation while edits/uploads are pending. Root remounts the editor when workspace identity changes so canvas state/history cannot leak between teams.
- src/features/canvas/domain.ts: group movement, columns, deletion, duplication and canvas extents.
- src/features/content/: safe structured notes, media rendering and allowlisted video embeds.
- server/assets.ts: validated private uploads, authorized streaming and asset-reference checks.
- src/model.ts: domain model, movement, document and backup validation.
- src/repository.ts: typed local/team repository boundary and HTTP client.
- src/liveRepository.ts: optimistic document, acknowledgement queue, reconnect and live state.
- src/operations.ts: field deltas, conflict checks, inverse operations and document ordering.
- src/usePersistence.ts: debounce, serialized saves, status and unsaved-navigation protection.
- src/team.tsx: authentication, workspace selection, invitation acceptance and owner controls.
- server/app.ts: API boundary validation, authorization, static production frontend and health routes.
- server/account.ts and security.ts: verification/recovery, session rotation, password/token hashing.
- server/mail.ts: configured SMTP transport with required encryption.
- server/rate-limit.ts: shared atomic PostgreSQL authentication counters.
- server/maintenance.ts: bounded expired-session/token/limit/invitation cleanup.
- server/config.ts and observability.ts: startup validation, trusted proxy settings and sanitized JSON logs.
- deploy/: local-default production Compose and TLS proxy configuration.
- .github/workflows/ci-deploy.yml and scripts/deploy.mjs: GitHub test/build gates, opt-in immutable GHCR releases and single-server SSH updates with backup/readiness gates. Production secrets remain in the private server environment; database rollback is manual and schema-aware.
- scripts/ops.mjs and scripts/ops/: complete database/media archival and fresh-target restoration.
- server/workspace-store.ts: legacy transactional document mutation and conflicts.
- server/operations.ts: validated, transactionally persisted, idempotent field operations.
- server/realtime.ts: session-authenticated sockets, authorized broadcasts, ephemeral presence and revocation.
- server/migrate.ts: migration tracking and advisory-lock application.
- db/migrations/002_team_mvp.sql through 007_account_theme.sql: implemented schema, operation ledger and constrained personal account theme; 001 is an unused historical scaffold. Migration 007 is feature-branch work awaiting release.
- tests/backend.test.ts: real PostgreSQL HTTP permission/persistence/concurrency checks.
- tests/browser/: Chromium canvas and two-account workflow checks.

## Persistence

The live MVP stores the existing canvas model as a **validated JSONB workspace document**, with a workspace-wide revision. Undo, nested boards and import remain atomic through one repository interface. Identity, memberships, invitations and sessions use relational tables. The earlier normalized board/card scaffold is not a second persistence writer.

Legacy HTTP document writes lock the workspace row, resolve current membership, compare the expected workspace revision, validate the resulting document and commit it with an incremented revision. Live field operations use the more granular checks below. Membership reads during writes take a shared row lock so revocation and writes have a consistent transaction order. Stale requests return 409. Validation rejects duplicate IDs, cycles, invalid parents/targets, unsafe colors, oversized content and nonfinite/negative coordinates. Zod validates requests; JSON bodies are capped at 2 MB.

The team editor is a single optimistic writer. Every local action produces before/after deltas for individual fields or structural additions/deletions. The client overlays pending operations on acknowledged server snapshots, retains the original operation IDs and submits one operation at a time. The server locks the workspace, rechecks current write membership with a shared row lock, compares field values, validates the resulting graph, and atomically writes the snapshot/revision and operation ledger. Unrelated field edits can merge despite a stale snapshot revision. Same-field conflicts return 409; structural deletions also reject changes to the removed entity. Import preserves board/card order. Undo uses inverse field changes and refuses to replace a newer remote edit.

The workspace revision orders snapshots; field before-values provide granular concurrency checks. PostgreSQL persists operation ID, actor, payload hash and resulting revision. Duplicate replay returns an acknowledgement without another write; changed payloads or another actor using the same ID fail. Replays still require current write permission. Snapshot HTTP mutations use the same PostgreSQL document and notify the socket gateway after commit, so there is one persistence writer for each field.

Acknowledgements and broadcasts happen only after commit. Reconnect obtains a current snapshot and resends unacknowledged operations with unchanged IDs. The client handles late/older acknowledgements without regressing newer snapshots. Same-field conflicts retain the optimistic document, pause editing and ask for export/reload. Pending edits are in-memory only and warn on unsaved navigation; they do not survive closing/reloading the tab. Local storage never acts as team sync.

## Live HTTP contract

All routes begin with /api. Board/card IDs are scoped by workspace URL because local backups do not have globally unique IDs. Mutations need Origin and the session CSRF token. Workspace routes require a session and membership.

- GET /session: session user ID and CSRF token, including before sign-in.
- POST /auth/register, POST /auth/login, POST /logout.
- GET/POST /workspaces: list memberships or create an owned workspace.
- GET/PUT /workspaces/:id: read or replace a document; PUT takes {expectedRevision,snapshot}.
- GET/POST /workspaces/:id/boards: list or create {expectedRevision,board:{id,title,parent?}}.
- GET/PATCH/DELETE /workspaces/:id/boards/:boardId: read, rename {expectedRevision,title}, delete {expectedRevision}. Delete refuses referenced/parent boards and removal of the final board.
- POST /workspaces/:id/boards/:boardId/cards: {expectedRevision,card}.
- PATCH/DELETE /workspaces/:id/boards/:boardId/cards/:cardId: {expectedRevision,patch} or {expectedRevision}. Patch cannot change the card ID.
- GET /workspaces/:id/members: owner-only listing.
- PATCH/DELETE /workspaces/:id/members/:userId: owner changes editor/viewer role or removes a non-owner member.
- POST /workspaces/:id/invitations: owner sends {email,role}; token returned for manual sharing.
- POST /invitations/accept: signed-in matching email sends {token}.

Board/card mutations use the workspace revision and return the new snapshot/revision. The live editor uses WebSocket operations; document PUT remains available for revision-checked HTTP clients. These scoped endpoints replace the originally proposed global board/card URLs for the MVP. Comments, public sharing and upload-intent routes do not exist.

- POST /workspaces/:id/assets?name=filename: binary application/octet-stream upload, returning metadata and card kind.
- GET /workspaces/:id/assets/:assetId: metadata.
- GET/HEAD /workspaces/:id/assets/:assetId/content: private content, including single byte ranges.
- DELETE /workspaces/:id/assets/:assetId: owner/editor deletion only when unreferenced.

## Identity and permissions

express-session and connect-pg-simple provide database-backed sessions, HttpOnly/SameSite cookies, seven-day expiration and session-ID rotation at login. Passwords use salted Node scrypt hashes. Every mutation requires the configured Origin and session CSRF token. All auth endpoints use atomic PostgreSQL IP counters (20 per 15 minutes) shared across API instances and retained across restarts. Forwarded IP/protocol headers are accepted only from configured trusted proxy addresses.

Unauthenticated requests return 401, nonmembers get 404, viewers cannot mutate, and only owners manage invitations/members. Registration grants no existing workspace access. Removed members fail subsequent requests even with valid cookies. Client roles never grant access. Owners cannot be demoted/removed by these routes.

Invites use random 256-bit tokens with only SHA-256 hashes persisted. Acceptance locks the invite, checks email, expiry and previous use, inserts membership and marks acceptance in one transaction. Existing memberships are never overwritten by accepting an invitation.

Configurable email verification/recovery, shared authentication limits, expired-session maintenance, health routes and structured logs are implemented. External monitoring/alerts and actual SMTP provider configuration remain operator work. COOKIE_SECURE=true is available for HTTPS; local HTTP uses false. No deployment has occurred.

## Live WebSocket protocol

GET upgrade /api/live requires the exact configured Origin and the same signed database session as HTTP. Initial {type:'subscribe',workspaceId,csrf} checks session, CSRF and membership before adding the peer to a workspace. Subsequent messages are strict validated unions: {type:'operation',operation:{id,baseRevision,changes}} or {type:'presence',boardId}. Changes have boardId, optional cardId, an allowed field and before/after JSON values. Messages are capped at 2 MB and 120 per second; slow readers are disconnected.

Responses are snapshot, ack (operationId, snapshot, revision, duplicate), presence, role, error or revoked. Every operation, presence change and snapshot recipient rechecks the database session and membership. Owner membership updates/removal and logout close affected sockets before the HTTP response. Heartbeats additionally detect dead connections and externally expired/revoked sessions. Presence is ephemeral, workspace-scoped, lists actual connected accounts and includes active board IDs. A deleted active board falls back to the root.

The gateway runs inside one API process. Cross-process notifications and shared presence are required before horizontally scaling. Multiple writers are transactionally safe in PostgreSQL, but live fan-out currently covers this single process only.

## Planned work

Rich-text CRDTs, rendered shared cursors, cross-process fan-out, operation-ledger maintenance and persistent offline queues remain planned. Plain-text same-field collisions are explicit conflicts; no character-level merge is claimed.

A private S3-compatible adapter is planned. Local assets already validate signatures, size, image decoding and filenames; reads require current workspace membership. Content URLs never grant access by themselves. TLS proxy/container configuration, isolated database/media volumes, sanitized logs and a complete backup/restore path have been validated locally. Public installation has not occurred.

Preserve original Boardroom branding and the neutral canvas, white cards, slim rail, breadcrumbs and spatial layout. Current UI is an approximation; reference workflows/screenshots should guide milestone 4.

## Content and asset persistence

Image/video cards optionally store `captionVisible`. New uploads set it to false and start with empty caption text; omitted values preserve existing visible captions. The boolean is validated at HTTP/document/live-operation boundaries and participates in field conflicts and undo. Visibility changes adjust the card height to retain the media area where size limits permit.

Version-1 snapshots remain compatible with existing boards. Optional card fields store dimensions, asset IDs, column membership and structured rich-text blocks/runs; board connectors reference existing cards. Domain validation rejects unsafe links, malformed formatting, invalid dimensions and dangling columns/connectors. Formatting is rendered through text nodes and known elements rather than untrusted HTML. Formatting/text and whole connector arrays retain field conflict semantics; no character-level CRDT is claimed.

Uploads use generated UUID filenames under ASSET_DIR, never client paths. The service checks write permission before reading the body and again within the metadata transaction. It removes newly written files if metadata insertion fails. Actual file signatures determine MIME; images additionally undergo bounded decoding. Downloads recheck session/membership, use nosniff and same-origin resource headers, and stream authorized byte ranges. HTTP snapshot writes and WebSocket operations validate that asset IDs belong to that workspace and match the media card kind. Removing cards retains files for undo; deletion refuses referenced assets. Crash recovery for orphan files, quotas and retention are production work.

JSON exports omit asset bytes. Complete backups require PostgreSQL plus the asset directory. Browser-local mode cannot upload private team media. External video embeds are limited to recognized HTTPS YouTube/Vimeo URLs and load only after a click; no server-side arbitrary URL fetching occurs.

## Account tokens and production operations

Migration 005 adds nullable email verification timestamps, purpose-bound hashed account tokens and shared auth limits. Verification is configurable; enforced team HTTP routes and live subscriptions recheck account verification in PostgreSQL. Sign-in remains available to unverified users so they can request a verification email. Token consumption serializes on the account and token rows, checks expiry/use/purpose, and consumes other links of that purpose. Recovery updates the password and deletes every session in the same transaction, then closes local live sockets. Migration 006 adds an account session version. Recovery increments it in the password transaction; HTTP and live operations compare it on every authenticated access. Sign-in stamps and rechecks that version, so a delayed old session save cannot restore access after a reset. SMTP failures expose no transport credentials and invalidated account links can be reissued. Invitation SMTP failure retains an owner-only manual token. Mail delivery is synchronous, with bounded timeouts; no durable outbox/retry is claimed.

Production builds bundle the API without development runtime dependencies and retain migration files. The same Express process serves the existing Vite frontend behind Caddy, using secure cookies and an exact HTTPS origin. A named asset volume remains private to the API/operations helper. Readiness checks PostgreSQL and filesystem access; maintenance never deletes active records or media. Request logs contain generated request IDs and route templates, not input payloads or bearer URLs.

Full backup stops the single API writer, captures a custom-format database dump and all metadata-listed files, verifies sizes, and resumes the API. Recovery requires an empty database and asset volume, checks version/checksums/archive paths, imports PostgreSQL transactionally and restores private files. Sessions, account verification/reset links and throttle data are omitted. A new target is required if installation of files fails after database commit; filesystem and database commits are not one distributed transaction. Refer to [operations](OPERATIONS.md) for the tested procedure and remaining operator acceptance.

Production proxy selection: scripts/compose-config.mjs reads DEPLOY_PROXY from the private server environment file. The Traefik variant reuses API/database/backup services and joins only the API to the existing external proxy network; the Caddy variant remains available for standalone installations.

Linux production automation uses scripts/server-helper.sh and deploy/helper/Dockerfile. Node and Compose run in a temporary helper with the local Docker socket, identical host/project mount paths, and read-only registry login. The server needs Docker, Git and flock, without host Node/npm. Existing backup/readiness gates and immutable release tracking remain.
# Annotation model

Boards may contain ordered `annotations`; older snapshots without this field remain valid. Pen/highlighter strokes store bounded local point arrays, position, dimensions, color and thickness. Standalone text stores plain text plus a validated typography/background/border style. Font choices map to bundled system font families; arbitrary CSS and remote fonts are rejected.

Annotation entity/order and field changes use the existing compare-and-set operation ledger, PostgreSQL snapshot transaction, and authorized WebSocket fan-out. Independent annotation fields merge; competing edits to the same field conflict, including the grouped text style field. Gesture previews stay in the client until pointer release. Undo uses inverse operations and refuses to overwrite competing work. Workspace validation bounds annotation counts, stroke points, coordinates and styles at the existing API boundary; no database migration or new public endpoint is needed.

Optional board `background` (six-digit hex) and `pattern` (plain/dots/grid) fields use separate board field operations. Legacy snapshots default to the personal theme canvas and dots. Explicit colors remain shared across themes; pattern contrast and automatic transparent annotation text color adapt to those colors. Arbitrary CSS, images and URLs are rejected. Text presets write the existing validated annotation style, rather than storing a preset ID or changing notes. These fields use existing JSONB persistence and authorization without a database migration.
