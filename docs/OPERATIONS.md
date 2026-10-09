# Local production-readiness setup

Milestone 5 supplies a runnable container stack and a locally tested recovery path. Nothing has been installed on a VPS or publicly deployed. Use one API process: live broadcasts/presence still require a shared gateway before horizontal scaling. Cloud/object storage has not been added.

## Container configuration

For the opt-in GitHub Actions pipeline and server setup, see [DEPLOYMENT.md](DEPLOYMENT.md). After CI deployments, add `--env-file .release.env` after the production environment file in manual Compose commands to keep using the recorded immutable image. `npm run ops` loads this release file automatically. On a Linux VPS without Node, use `sh scripts/server-helper.sh ops` instead; it runs the same tools in a temporary container and loads the release file.

Run commands from the repository root. Copy `deploy/.env.example` to a private `.env.production` and replace the database password and session secret. Set `CONTAINER_DATABASE_URL` with host `postgres`, using the same database password (URL-encode special characters). This URL is separate from the loopback `DATABASE_URL` used during development.

The default proxy binds **127.0.0.1:8080/8443** with `SITE_ADDRESS=localhost` and `APP_ORIGIN=https://localhost:8443`. Caddy issues a local certificate; trust its local CA for manual use. The automated local drill accepts that certificate only in isolated test clients. Public domains use Caddy's automatic HTTPS when DNS and ports are configured; this has not been attempted here. See the official [Caddy HTTPS guide](https://caddyserver.com/docs/quick-starts/https) and [reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

For a future explicitly authorized public installation, the operator must configure a domain, HTTPS origin, port bindings/firewall, SMTP and persistent backups. Keep PostgreSQL and the API private behind the proxy. The supplied Docker network is `172.30.80.0/24`; the proxy reserves `.254`, and the API trusts only that address for forwarded protocol/client IP. If this subnet conflicts with your host, change the subnet, proxy address and `TRUST_PROXY` together. Never trust arbitrary forwarded headers or use a numeric proxy hop count.

```sh
docker compose --env-file .env.production -f deploy/compose.yaml -p boardroom-production up -d --build --wait
docker compose --env-file .env.production -f deploy/compose.yaml -p boardroom-production logs --tail 100 api
docker compose --env-file .env.production -f deploy/compose.yaml -p boardroom-production down
```

These commands are instructions, not actions already performed against a public server. `down` retains volumes; do not add `--volumes` to routine shutdowns. The API runs as an unprivileged user with a read-only image, a private writable media volume and temporary filesystem. Database, media and proxy certificates have separate persistent volumes. Migrations run under a PostgreSQL advisory lock before readiness. Production startup rejects HTTP origins or insecure cookies. Browser assets and the API share the HTTPS origin, including WebSocket upgrades.

## Email and identity

SMTP emails include plain-text and HTML alternatives with clickable links. Account and invitation links use `APP_ORIGIN`: keep the local frontend origin during development, then set the exact public HTTPS origin in production. Previously sent emails retain their original links; request a fresh email after changing the origin or updating the email format.

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and, when needed, `SMTP_USER`/`SMTP_PASSWORD`. Port 587 normally uses STARTTLS; set `SMTP_SECURE=true` for implicit TLS, typically port 465. Encryption and normal certificate verification are required. See [Nodemailer SMTP configuration](https://nodemailer.com/smtp). `SMTP_ALLOW_INSECURE=true` is a local test option and is rejected in production.

The production template defaults to `REQUIRE_EMAIL_VERIFICATION=true`, which requires SMTP configuration. New and existing unverified accounts can sign in and request verification, but cannot access team data or live workspace subscriptions until verified. Existing accounts are not silently marked verified during migration. Browser-local mode remains available. The automated container drill explicitly disables verification because it sends no external email; the verification/recovery browser and backend tests use captured mail, and the SMTP transport test talks only to a loopback SMTP fixture.

Registration sends a verification link, valid for 24 hours. Password recovery is available when SMTP is configured and returns the same response for known/unknown account emails. Reset links expire after one hour. Tokens are hashed in PostgreSQL, purpose-bound and single-use; successful consumption invalidates other outstanding links of that purpose. Reset changes the password and removes every database session for that account, closing local live sockets before the response. Every authenticated access also checks a database session version, so delayed pre-reset requests cannot revive access. The user signs in again. Verification requires an explicit confirmation click. Email URLs carry tokens in a fragment, which the entry UI removes from the address bar after reading.

Owners' invitations are sent through SMTP when configured. Owner UI reports sent/failed/manual delivery and retains a one-use token for private sharing. Invitations still expire after 48 hours and require the matching account email. “Sent” means the configured SMTP server accepted the message, not confirmed inbox delivery. Failed account mail invalidates that newly issued link; users can request another. Durable mail queues, automatic retries, bounce processing and actual provider deliverability checks remain future work. No external emails were sent during validation.

## Full backup and restore

Browser JSON export is not a full backup. The operations tool creates an archive directory under ignored `backups/` containing a PostgreSQL custom dump, private media tarball, asset IDs/sizes, a version marker and SHA-256 checksums. File sizes must match database metadata. All workspaces, roles, account password hashes, invitations and operation IDs are included. Active sessions, verification/reset links and rate-limit counters are excluded, so restored users must sign in and request new account links. The private environment file and Caddy certificate volumes are not included; preserve configuration separately and reissue/trust certificates as appropriate.

```sh
sh scripts/server-helper.sh ops backup --env-file .env.production --project boardroom-production --name backup-2026-10-09
sh scripts/server-helper.sh ops check --env-file .env.production --project boardroom-production --name backup-2026-10-09
```

Backup briefly stops the selected API to keep PostgreSQL and files consistent, then restarts it even if archival fails. All application writers must be stopped; do not run another API/writer against that database during backup. Live editing is temporarily unavailable. The controller requires an explicit project/environment/archive name and never overwrites an existing archive. A failure may leave an incomplete directory; use a new name after addressing the error. The [PostgreSQL dump documentation](https://www.postgresql.org/docs/17/app-pgdump.html) describes the archive format and consistency guarantees for the database itself.

Restore is deliberately **fresh-target only**. Prepare a distinct Compose project with empty database and media volumes, keep its API stopped, and place the trusted archive under `backups/`:

```sh
docker compose --env-file .env.production -f deploy/compose.yaml -p boardroom-recovery up -d --wait postgres
sh scripts/server-helper.sh ops restore --env-file .env.production --project boardroom-recovery --name backup-2026-10-09
docker compose --env-file .env.production -f deploy/compose.yaml -p boardroom-recovery up -d --wait api proxy
```

Do not run the recovery proxy concurrently with the original project using the same ports/subnet. Restore checks checksums, flat UUID-only regular archive members and asset sizes before database import. Database restore is transactional and refuses nonempty databases; media restore refuses nonempty asset volumes. If disk failure interrupts copying after the database commits, leave the API stopped and repeat recovery into another fresh target. A complete restore requires verifying both board documents and media bytes before switching users over. Treat dumps as trusted administrator input: checksums detect corruption, not a maliciously replaced archive. Backups contain private team data and password hashes; protect/encrypt off-host copies and configure a retention schedule. Automatic remote backup, retention and point-in-time recovery are not implemented.

## Maintenance and monitoring

Authentication limits use atomic PostgreSQL counters shared across API instances: 20 auth requests per actual client IP per 15-minute window, including signup, login and recovery. Limits persist through API restarts, return `Retry-After` and fail closed if the database is unavailable. This does not make live collaboration support multiple API processes. Additional per-account/upload quotas and DDoS protection remain operator/future work.

Maintenance runs at startup and every 15 minutes, deleting expired sessions, auth limits and account tokens. Expired invitations have a seven-day cleanup grace. It does not delete uploads or the operation ledger. Cleanup failures are logged and retried on the next interval.

`GET /health/live` reports process liveness. `GET /health/ready` returns 200 only when PostgreSQL responds and the configured asset directory is readable/writable; dependency failure returns 503. Health responses reveal no credentials, membership or database details. Docker checks readiness and waits for dependencies. Health status does not automatically restart a still-running unhealthy process; investigate the cause.

The API writes structured JSON request/error logs with generated request IDs, status, duration and route templates. It omits query strings, bodies, cookies, credentials, email addresses, bearer tokens and raw dependency errors. HTTP responses include `X-Request-ID`; runtime errors use sanitized codes for correlation. Production sends security headers and a CSP allowing the existing editor and explicit supported video embeds. The server bounds HTTP header/request timeouts and closes sockets/pool on shutdown.

The operator still needs uptime/dependency alerts, disk-capacity monitoring, log retention, SMTP delivery checks and a scheduled backup/restore drill. No external monitoring service is configured automatically.

## Local acceptance drill

```sh
npm test
npm run build
npm run test:browser
npm run test:ops
```

`test:ops` needs Docker and Playwright Chromium. It builds the production image, creates isolated projects and fresh volumes, binds only loopback, verifies HTTPS/secure cookies/live editing, uploads private media, makes a backup, rejects corruption, restores into a new project, compares media bytes and refuses overwriting existing data. It stops its test containers afterward and retains ignored fixtures/backups and named test volumes for inspection. It uses ports 8080/8443 and the configured subnet; they must be free. It never acts on the development `boardroom` project or sends external email. Fresh VPS installation, public certificate issuance and actual SMTP provider delivery remain unperformed acceptance steps.

