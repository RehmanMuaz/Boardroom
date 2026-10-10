# Account-bound Flow board creation

Local implementation, not deployed or provisioned. The extension's default target
is `muazrehman@vertexfilms.ca`, which must already be a Boardroom account. No
password is shared with Flow and no new account is created.

Flow's final guided question is **Export JSON** or **Create in my Boardroom account**.
For direct delivery it sends the prepared document to `/api/flow/previews` using a
private integration credential. Boardroom persists the exact content for ten minutes
and returns `/flow-review/<id>`. Open that link while signed in to the target account,
review the content, and click **Create workspace in my account**. A new workspace
and owner membership are created atomically. Existing workspaces are preserved;
repeated requests/clicks cannot create duplicates for the same request ID.

The integration credential can only stage portable documents for the configured
account. It cannot approve them, choose another owner, edit existing workspaces,
invite users, access uploads, or use the browser API. Native approval checks the
current account, session version, verification policy, Origin and CSRF. Private
asset references are rejected. Pending previews expire and are cleaned up when
another preview is staged; at most twenty unapproved previews are retained per
account. After approval only deduplication metadata remains in the import table.

## Configuration and release

Generate a random 32-byte hex token privately; store the raw token only in Flow's
private environment as `BOARDROOM_FLOW_TOKEN`. Store its SHA256 hex hash in
Boardroom as `FLOW_IMPORT_TOKEN_SHA256`. Set Flow's `BOARDROOM_URL` to the exact
HTTPS origin `https://note.vertexfilms.ca`. Boardroom's `FLOW_IMPORT_EMAIL` defaults
to the supplied email; changing the email changes which account can approve.
Do not paste either credential into chat or commit private environment files.
Rotate by replacing both values. Unsetting the hash disables the extension.

`flow-server.ts` wraps the existing server without editing its protected source
folder. It retains existing sessions, realtime hooks, maintenance, assets and
readiness checks. `migrateFlow` creates only the separate `flow_imports` table.
The normal server/build/deployment remain unchanged. Use `Dockerfile.flow` for the
opt-in server image and `compose.flow.yaml` after the existing Compose file to pass
the two Boardroom settings. Build/publish and deploy a reviewed immutable image
through the existing release process; this document does not authorize deployment.
Add the Flow intake, compiler, delivery and MCP scripts to its separately reviewed
MCP image and launch `boardroom_mcp.py` instead of `flow_mcp.py`.

Local commands:

```powershell
npx.cmd tsc --noEmit -p tsconfig.flow.json
npm.cmd test
npm.cmd run build
node --env-file=.env --import tsx flow-server.ts
```

For a local bundle, `node build-flow-server.mjs` replaces `build/server/index.js`
with the extension entrypoint. Use `FLOW_BUILD_OUTPUT` for a separate validation
directory. The extension is kept at the root because this session cannot write
inside `server` or `scripts`. Move it into those directories in a later cleanup
once normal write access is available.

Acceptance: Flow's eight integration tests, fourteen existing tests, JWT and plan
checks pass. Boardroom's TypeScript check, extension bundle and frontend build
passed using Vite's runner config loader and a separate writable output directory.
Settings and pre-database credential rejection checks pass. Full Boardroom tests
currently require PostgreSQL, unavailable at
127.0.0.1:5432; Docker is not running. Standard Vite build also encounters a denied
node_modules/.vite-temp write. Account/CSRF/expiry/concurrent approval tests are
provided in tests/flow-integration.test.ts; real database and browser acceptance
must pass before release. No live credential, account verification, workspace
creation, image publication or deployment has been performed.
