# Existing workspace reads, edit previews and native approval

Local implementation on `feature/flow-workspace-editing`, based on development
commit `9a21ae3`. It excludes the unrelated, unmerged team-comments feature.
Migration 011 deliberately leaves 010 available for that separate feature.
This branch is not deployed.

The existing import connection keeps its existing behavior. Reading existing
workspaces requires a separate explicit `FLOW_WORKSPACE_IDS` comma-separated UUID
allowlist (maximum 100). Empty/unset denies all such reads. No wildcard is accepted.
No live configuration was changed. The integration remains bound to its configured
account; this is not a multi-user identity delegation system.

With a valid existing bearer credential:

- `GET /api/flow/workspaces`: list allowed workspaces with current membership.
- `GET /api/flow/workspaces/:id`: read current snapshot and revision.
- `POST /api/flow/workspaces/:id/preview`: validate an operation containing
  `{id, baseRevision, changes}`; each change uses existing domain fields with
  `boardId`, optional `cardId`/`annotationId`, `field`, `before`, and `after`.
- `POST /api/flow/workspaces/:id/reviews`: persist the exact operation for native
  account review. `id` is the idempotency UUID; reuse only for identical retries.
- `GET /flow-edit-review/:id`: sign in and inspect all before/after changes.
- `POST /flow-edit-review/:id`: native same-origin, CSRF-protected approval only.
  The form accepts only CSRF, never replacement edit content.

Every request checks the configured account's current membership and required email
verification. IDs outside the allowlist are hidden. Preview rejects viewers,
stale revisions, conflicting before-values, invalid snapshots and foreign media
references. Workspace style changes remain owner-only. A preview accepts at most
100 changes and 1500kb. Preview itself returns exact before/after changes without
mutating the database. Staging is a separate tool that persists a ten-minute intent
and returns an account review URL; it does not change the workspace.

The response explicitly reports `records_changed: 0`, `ready_to_apply: false`.
Edits are not applied by importing a replacement workspace. No media uploads,
comments, emails, financial writes or automatic approval are added.

Migration 011 adds `flow_edits`, containing actor/workspace/request IDs, canonical
payload hash, exact operation, expiry and applied revision/time. The hash is stable
through PostgreSQL JSONB object-key ordering, including nested style objects.
At native approval, one transaction rechecks session version, configured identity,
membership, scope, owner-only styles, expiry, exact revision and payload hash. It
applies the field operation, writes the existing operation ledger, and marks the
intent applied atomically. Concurrent approvals apply once; later retries do not
reapply. Any intervening workspace edit requires a fresh read/review. Notification
publication follows commit; a publication failure does not report a committed edit
as failed. A chat reply or integration token cannot authorize application.

Validation: production build and full `npm test` passed against a new disposable
local PostgreSQL database: 90 passed, one Linux-only skip. Tests cover approval,
concurrent replay, stale content, expiry, CSRF, wrong/revoked accounts, role changes,
tampering, nested styles, foreign assets, operation-ID collisions and publication
failure. Flow has 20 offline and 16 integration/consumer checks passing. No deployed
workspace was read or modified. Live configuration and services remain unchanged.

For local database checks, `scripts/run-isolated-tests.mjs` requires a loopback
DATABASE_URL, creates a uniquely named empty database, runs tests, and removes only
that generated database. Never point tests at a production database. Docker is not
needed when a local PostgreSQL connection is available.

Release requires review of both source patches, migration 011, explicit workspace
allowlist configuration, normal Boardroom/Flow release pipelines and refreshed MCP
discovery. The allowlist is forwarded by deployment Compose and defaults to empty.
Older application versions can ignore the additive migration; do not roll back
database content. Applied edit records retain their exact changes for audit; a
production retention policy remains operator work. An automated Chromium check
passed actual signed-in review, native same-origin form approval, before/after
visibility, duplicate reload, stale-review rejection and unsigned-user rejection.
It runs in CI after browser installation. Manual production acceptance remains.
