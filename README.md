# Boardroom

A self-hosted visual workspace for a small creative team. Original branding and a Milanote-inspired canvas. The existing editor supports browser-local storage and durable team storage. Exact visual parity needs reference screenshots/workflows.

Development uses feature/fix branches from `develop`, with pull requests back into `develop`. CI runs on `develop` without deployment. A release pull request from `develop` into `main` promotes tested changes to production; successful `main` builds deploy automatically when `AUTO_DEPLOY=true`. See [deployment setup](docs/DEPLOYMENT.md) for branch protection recommendations.

## Run locally

Requires Node.js 22.12+ and a running Docker daemon. On PowerShell, use npm.cmd if execution policy blocks npm.ps1.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. Set a random POSTGRES_PASSWORD, use the same password in DATABASE_URL, and set a random SESSION_SECRET of at least 32 characters. This working directory already has a generated local `.env`. Keep it private.
3. Run `docker compose up -d postgres`.
4. Run `npm run dev:api`.
5. In another terminal, run `npm run dev`.
6. Open **http://localhost:5173**. Use that exact origin, or change APP_ORIGIN. API, frontend and database bind to loopback. Nothing has been deployed.

Create an account, then create a workspace. Registration grants no access to existing workspaces. Owners use **Manage team** to invite an email as editor/viewer, change roles or remove members. Share the returned one-use token privately. The recipient signs into the matching email account and pastes the token into **Invitation token**. Tokens expire after 48 hours. SMTP delivery is available when configured; the owner sees sent/failed/manual status. Owners cannot be demoted or removed through these controls.

Choose **Continue as guest** at the top of the entry screen for the original local workspace. Local data is separate from team data. To transfer local data, export it, open a team workspace as owner/editor and import the backup. Import replaces the team's canvas with permission and revision checks.

## Implemented

- Notes with optional structured formatting, links, checklists, nested boards, columns, connectors, multi-selection, resize, titles, search, colors and undo/redo.
- Private team image/video/file uploads, inline image and video playback, authenticated downloads and byte-range streaming.
- Clipboard copy/cut/paste, duplicate, keyboard movement/resize, space-drag panning and an expanding canvas.
- Validated JSON import/export and a local/team repository interface.
- Node/TypeScript API and real PostgreSQL storage with database-backed session cookies.
- Salted scrypt passwords, session rotation, CSRF/origin checks and PostgreSQL-backed authentication throttling.
- Configurable SMTP verification, password recovery and invitation delivery; password resets revoke all sessions and local live sockets.
- Production container/TLS proxy configuration, full database/media backup and fresh-target restore tools, readiness/liveness checks and structured logs.
- Owner/editor/viewer permissions, member controls and hashed, expiring, one-use invitations.
- Live WebSocket editing, real member presence and transactional, idempotent operation acknowledgements.
- Unrelated field edits merge; competing same-field edits conflict explicitly. Disconnected edits retry safely while the tab stays open.
- Browser-local saves remain debounced. Undo uses inverse operations and preserves unrelated remote edits.
- Workspace-scoped board/card CRUD and a transactionally tracked MVP migration.

## Validation

Start PostgreSQL and configure `.env`, then run:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Backend tests use real PostgreSQL, including HTTP and WebSocket permission boundaries, durable reload, origin/CSRF/session expiry checks, field conflicts, operation-ID replay, reconnect, invitation expiry/reuse/email matching and immediate role/member/session revocation. Client ordering tests also cover a late acknowledgement arriving behind a newer server snapshot. Set TEST_DATABASE_URL to use a separate database. Tests create unique accounts/workspaces and remove them afterward; they never truncate existing data. `npm run test:model` needs no database.

Browser tests start fresh local API/Vite instances on ports 3101/5174 and cover canvas interactions, live two-account edits/dragging, presence, viewer restrictions, disconnect retries, dropped acknowledgements, same-field conflicts and immediate revocation. The milestone 4 tests also cover rich formatting after reload, group movement, columns, connectors, resizing, clipboard, canvas expansion, private media playback/ranges and automated accessibility checks. Team test data is cleaned up; browser-local tests use isolated browser contexts.

## Current limits

Team editors now update live through authorized WebSockets. PostgreSQL remains the durable source of truth. The canvas is still a validated JSONB document with a workspace-wide revision for snapshot ordering, but live operations compare individual fields so unrelated changes can merge. Same-field conflicts pause editing and retain the optimistic document for export/reload. Whole-document HTTP PUT still uses its original workspace-wide expected revision.

Pending operations stay in the current tab and retry with their original IDs after reconnect, including lost acknowledgements. They do not survive a tab close or page reload; export if saving cannot finish. A browser warning protects unsaved navigation. A lost/dropped socket reloads a server snapshot before replaying its queue. Local storage remains entirely separate from team sync.

The live gateway supports **one API process**. Multiple API instances need cross-process notifications/presence coordination before use. Presence shows actual connected accounts and tracks active board IDs; shared cursor rendering is not implemented. Rich-text CRDT merging is deferred; concurrent edits to the same text or formatting field conflict rather than merge. Operation-ledger retention and bounded durable offline queues remain production work.

Public sharing and production deployment remain planned. SMTP email flows are implemented but no external provider has been configured or contacted during validation. Deleted board cards leave child boards in backups; nested board tiles cannot be duplicated with the clipboard. Undo records typing changes. Email verification is optional in local development and enabled by default in the production template; existing accounts must verify when it is enabled. The current limit is 20 auth requests per client IP per 15 minutes, shared through PostgreSQL and retained across restarts.

Migration 001 is a historical relational scaffold. Live data uses migrations 002 through 006: accounts, team_workspaces, memberships, team_invitations, session, workspace_operations, team_assets, account_tokens and auth_rate_limits. API startup applies outstanding migrations transactionally under a database lock even on existing Docker volumes. It leaves the old scaffold intact. Keep database volumes local and back them up before team use. Only local development and isolated local container/restore acceptance have been performed.

See the [operations guide](docs/OPERATIONS.md) for container, SMTP, health, backup/restore and local acceptance instructions. No deployment has occurred.

For GitHub Actions CI/CD to a Linux Docker server, see [deployment setup](docs/DEPLOYMENT.md). CI runs tests/build/browser checks; automatic GHCR publication and SSH deployment remain disabled until `AUTO_DEPLOY=true` and server/environment secrets are configured. No repository has been published or server connected by this setup work.

See [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), and [project instructions](AGENTS.md).

Add feature requests, ideas, bugs and improvements to [the backlog](docs/BACKLOG.md). Plain bullets or the optional request template both work; ask Codex to review it or implement specific items when ready.

## Content and canvas controls

IDEA-004 is implemented on the development feature branch, awaiting production promotion. Choose Light, Dark or System under Appearance on the sign-in/workspace screen or in the editor Account menu. Signed-in account choices persist on the backend; browser-local canvas choices stay separate on that device. System follows OS changes. Interface colors change while shared card colors, note formatting and uploaded media retain their appearance.

The header shows Boardroom and the selected workspace. Use its workspace dropdown to switch teams, open the browser-local canvas or return to all workspaces. Account contains sign-in/sign-out; owners retain Manage team. Board titles are editable in the canvas heading, with nested breadcrumbs above. Actions contains JSON import/export and keyboard shortcuts. Save/conflict status remains visible; switching is blocked while uploads or unsaved operations remain.

Workspace owners can choose Rename workspace in the workspace dropdown, enter a name and save. Names are shared, persist in PostgreSQL and update for connected teammates. Editors/viewers cannot rename; browser-local mode has no team workspace name. Renaming preserves boards, uploads, invitations and permissions. Competing renames produce a conflict; reopen the form to use the latest name. Available on the development feature branch, not deployed.

New image/video uploads start without a subtitle. Use the subtitle icon in the bottom-right hover overlay on editable media to show or hide its caption field. Visibility is shared and saved; hiding preserves the caption text. Existing media captions remain visible.

Images and videos use borderless canvas frames with icon downloads in a bottom-right gradient overlay that appears on hover or keyboard focus. Drag directly on image/video surfaces; native video controls remain interactive; selecting editable media reveals resize handles. Dragging a resize handle or using its arrow keys preserves source proportions within supported size limits. Captions and native video controls remain available.

Use Image, Video or File in the rail, drag files onto the canvas, or paste files from the clipboard. Uploads require a team workspace and owner/editor access. Supported signatures are PNG/JPEG/WebP/GIF, MP4/WebM, PDF/ZIP and UTF-8 .txt. Images are limited to 10 MB and 40 million decoded pixels; other uploads to 50 MB. Video playback depends on browser codec support; transcoding and resumable uploads are not implemented. YouTube/Vimeo links offer an explicit click-to-load embed; the API does not fetch arbitrary preview URLs.

Shift-click or drag a marquee to select cards. Select two cards to connect them; select cards and choose a column to group them. Columns move their members. Cards have pointer and keyboard resize controls. Enter/Space selects a focused card; arrows move the selection (Shift moves ten pixels). Ctrl/Cmd+A selects, D duplicates, C/X/V copies/cuts/pastes, Z undoes, Shift+Z/Y redoes, and Delete removes. Space-drag pans. The ? control lists shortcuts. Format note enables bold, italic, underline, headings and bullets. Formatting uses validated structured text, with explicit conflicts for concurrent edits to the same document.

Private uploads live under ASSET_DIR (default data/assets), with metadata in PostgreSQL. Back up both the database and this directory. JSON export contains asset references, **not file bytes**; it is not a complete media backup or a cross-workspace media transfer. Removing a card retains its upload for undo. The API can delete unreferenced uploads; automatic cleanup, quotas and an S3 adapter remain future work. Never commit uploads or database volumes. Reference screenshots and manual screen-reader/cross-browser acceptance remain outstanding; automated accessibility checks do not establish complete WCAG conformance.

Production Linux servers need Docker, Git and flock; deployment/backup helpers run through scripts/server-helper.sh in a temporary container, so host Node/npm are unnecessary. Local development still requires Node.
# Canvas annotations

Use the floating annotation toolbar at the bottom of the canvas to select, draw with Pen/Highlighter, or place standalone Text. Text starts with immediate keyboard focus and a transparent, borderless appearance. Double-click to edit existing text; select it and open Text style for fonts, size, weight, alignment, colors, background and border options. Drag annotations to move them; use the text corner handle to resize. Delete removes the selected annotation; Ctrl/⌘ Z and Shift-Z undo/redo. Space-drag still pans.

Team annotations save to PostgreSQL and sync through authorized live operations. Viewers can see/select them but cannot edit. Guest annotations save only in that browser. This implementation is on a feature branch and has not been deployed.

Choose Shape and select Arrow, Line, Rectangle or Circle, then drag on the canvas. Circles can be drawn/resized as ellipses. Arrows point toward the end of your drag. Switch to Select to move shapes, resize with the corner handle, change outline color/thickness/type, or enable fill for rectangles/circles. The resize handle also supports arrows for width and Shift-arrows for height. Shapes are standalone annotations; they do not attach to cards or replace card connectors.

Open Board appearance in the board heading to choose a shared background color and Plain, Dots or Grid canvas. Use theme background returns to each person's app theme; explicit colors are shared across themes. Text style offers Heading, Label and Body presets, preserving your text and decorative choices. Appearance is per board, saved and undoable, and viewers have read-only controls. Guest choices stay browser-local.

Stroke width and annotation font size each have a slider alongside a numeric input. Drag for quick adjustments or type an exact value; both controls stay in sync. Width ranges from 1–60 and font size from 12–120.

## Checklist, label and canvas improvements (local feature branch)

IDEA-018 through IDEA-024 are implemented on `feature/backlog-editor-improvements` for local review. No deployment was performed.

- Rename a checklist through its title field and edit each task directly next to its checkbox. Enter inserts a task; Add task and the row removal button manage items. Existing checklist text/completion states remain intact.
- Link cards and the Link creation button use a globe/URL icon. Choose Line in the creation rail, then the source and destination items, to create an arrow aimed between their centers with both ends just outside their outer edges. Escape cancels. Arrows follow movement/resizing and render behind cards, columns and annotations. Touching/overlapping endpoint items hide the arrow until they separate.
- Select objects and open Arrange to change their front/back order. Cards and annotations share saved layers; a column stays behind its own members. Connectors remain behind all objects.
- Drag a card into a highlighted column or drag a contained card up/down to reorder it. Drop outside to detach it. Items fit the column width; resize handles allow smaller sizes within that width. Media retains ordinary source proportions. Moving a column carries its members; resizing/deletion/caption changes reflow its layout. Existing maximum dimensions and minimum media frame sizes apply.
- Use + Label at the bottom of a note to add a compact colored badge. Click a label to edit its name/color or remove it. Label text participates in board search and survives duplication/export/import. Up to 20 labels per note, each with up to 80 characters.
- Column summaries show direct card/file/board counts below the title, including images/videos as cards and nested board tiles as one board.

Changes support local saves or authorized live team persistence, undo/redo and read-only viewers. The API script does not watch files: after updating the checkout, stop the running API with Ctrl+C and restart `npm.cmd run dev:api`, then refresh the browser. Vite's `npm.cmd run dev` server updates the frontend.
