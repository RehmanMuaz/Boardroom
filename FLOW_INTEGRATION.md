# Flow board creation in your Boardroom account

Implementation is tested locally and integrated with the standard Boardroom build,
versioned migrations and deployment workflow. It is not deployed yet.

Flow asks Export JSON or Create in my Boardroom account last. Direct delivery
stages the exact board for ten minutes and returns a review link. Open it signed
in as muazrehman@vertexfilms.ca, inspect the content, then click Create workspace
in my account. This creates a new workspace with your owner membership; no
existing workspace is replaced. The integration credential cannot approve creation.
Repeated request IDs and concurrent approval clicks cannot create duplicates.

## Components

- server/flow-integration.ts: scoped staging API, authenticated native review and
  transactional approval, session-version/verification/Origin/CSRF enforcement.
- db/migrations/008_flow_imports.sql: account-bound expiring previews, idempotency
  metadata and a pending-expiry index, installed by the normal migration runner.
- server/index.ts: optional integration wrapper; normal realtime, sessions, assets,
  readiness and shutdown are preserved.
- deploy/compose.yaml: optional integration email and token hash; normal immutable
  image publication and deployment use the existing main-only release workflow.
- flow-browser.config.ts and flow-browser.spec.ts: real-browser creation acceptance,
  also included in CI after the existing browser checks.

Private media IDs are rejected for portable imports. At most twenty pending
previews are retained; expired pending previews are cleaned on subsequent staging.
After approval, content is removed from the preview table and lives in the workspace;
deduplication metadata remains. Service errors and request logging omit credentials
and board content. The HTML review escapes authored text. Same-origin referrer policy
preserves Chromium form Origin headers without exposing the preview to other origins.

## Private configuration

Generate a random 32-byte hex credential privately. Store its raw value only in
Flow as BOARDROOM_FLOW_TOKEN, and its SHA256 hex digest in Boardroom as
FLOW_IMPORT_TOKEN_SHA256. Set BOARDROOM_URL=https://note.vertexfilms.ca in Flow.
Set FLOW_IMPORT_EMAIL=muazrehman@vertexfilms.ca in Boardroom (also the default).
The account must already exist and satisfy the installation's verification policy.
Do not share credentials in chat or commit private environment files.
Removing the token hash disables staging. Credential rotation requires updating
both installations. No Boardroom password is shared with Flow.

Flow ships its additive thirteen-tool entrypoint through
branding-and-scripts/scripts/Dockerfile.boardroom and compose.boardroom.yaml.
Its original ten-tool and legacy seven-tool entrypoints remain available for rollback.

## Acceptance evidence, 2026-10-10

- Real PostgreSQL in an isolated disposable database: 36 Boardroom tests passed,
  no failures; one Linux-only helper test skipped on Windows.
- Native Chromium review/create check passed. It caught an Origin:null issue caused
  by no-referrer; the same-origin policy fixes it without weakening CSRF checks.
- Standard npm run build passed in a clean checkout, including strict TypeScript,
  Vite client and production server bundle.
- Flow: eight integration checks, fourteen legacy/offline tests, signed JWT and
  planning consistency checks passed.
- Test databases were created separately from the user's existing Boardroom database.
  The browser server required explicit shutdown after the test on Windows.
- Docker image build, GitHub CI/PR promotion, VPS account/configuration verification,
  production backup, deployment and hosted connector smoke tests remain pending
  because this task process cannot access Docker's pipe, GitHub or VPS SSH.

## Local isolated checks

node --env-file-if-exists=.env check-flow-release.mjs
node --env-file-if-exists=.env check-flow-release.mjs --browser
npm test
npm run build

The acceptance runner creates a uniquely named local test database and removes it
on completion. It refuses non-loopback database hosts. For a separate Docker test
service, use compose.flow-test.yaml and project boardroom-flow-tests; it binds
only 127.0.0.1:55432. Do not run destructive testing against existing user data.

## Release order and rollback

1. Push the feature branch, pass CI, merge to develop through a feature PR, then
   promote through a reviewed release PR to main. Main publishes/deploys via the
   existing immutable GHCR workflow and pre-update database/media backup.
2. Verify the target account on the server and configure the matching private
   credential in both installations. Do not change the account or bypass verification.
3. Deploy Boardroom with the normal helper. Migration 008 is additive. Verify
   public readiness and unauthenticated staging/review rejection.
4. Deploy the additive Flow MCP image, recreating only MCP. Preserve OAuth,
   private environment and reverse proxy. Refresh ChatGPT tool discovery afterward.
5. Smoke-test guided intake and JSON preparation without creating production records.
   The first real account import remains a user-reviewed creation.

Rollback to the preceding immutable Boardroom image and previous MCP image/config.
The additive preview table may remain; do not drop it or restore the whole database
automatically. Restore data only through a separately reviewed schema-aware plan.
