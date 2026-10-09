# GitHub CI/CD and a Linux Docker server

The workflow and deployment helper are prepared locally. No GitHub repository, SSH connection, registry publication or public deployment has been configured or executed. This setup targets one Linux x86-64 server and one API process. ARM servers need an ARM/multi-platform image build before enabling deployment.

## Selected installation

- GitHub repository: https://github.com/RehmanMuaz/Boardroom
- Git remote: `git@github.com:RehmanMuaz/Boardroom.git`
- Registry image: `ghcr.io/rehmanmuaz/boardroom`
- Intended public origin: `https://note.vertexfilms.ca`
- Host: Linux with Docker at `212.56.40.140`, SSH username `root`; CPU architecture is confirmed x86-64; SSH port is not yet confirmed.
- Reverse proxy: existing Traefik. Confirmed network: `reverse-proxy`; entrypoints: `web` and `websecure`; certificate resolver: `vertexfilms` (Cloudflare DNS challenge). The proxy address is confirmed static at `172.19.0.7`; use `TRUST_PROXY=172.19.0.7/32`. No server connection has been made.

The local project is initialized on main with the supplied GitHub HTTPS remote. The remote was reachable and advertised no refs during setup; repository visibility is not confirmed. The first commit/push and deployment credentials remain pending. Do not overwrite an existing remote history: inspect it before the initial push. `APP_ORIGIN` will be `https://note.vertexfilms.ca`. The selected installation will use existing Traefik for public HTTPS; `deploy/compose.traefik.yaml` uses that proxy without publishing host ports or starting Caddy. Keep `AUTO_DEPLOY` disabled until that route is configured. Use `DEPLOY_HOST=212.56.40.140` and `DEPLOY_USER=root` in the production environment secrets; the workflow accepts this username.

### Identify the existing Traefik setup

Run these read-only commands on the server. First identify the Traefik container name:

```sh
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
uname -m
```

Replace `TRAEFIK_CONTAINER` below with that container's name:

```sh
docker inspect TRAEFIK_CONTAINER --format '{{range $name, $network := .NetworkSettings.Networks}}{{println $name $network.IPAddress}}{{end}}'
docker inspect TRAEFIK_CONTAINER --format '{{range .Args}}{{println .}}{{end}}' | grep -Ei '^--(entrypoints\..*\.address|providers\.docker\.network|certificatesresolvers\..*\.acme\.(tlschallenge|httpchallenge|dnschallenge\.provider))'
```

These commands avoid container environment variables, where provider credentials may be stored. If the second command prints nothing, the settings may live in a mounted Traefik configuration file; share only the entrypoint names, certificate resolver name and network name, not the whole configuration or credentials. A currently observed container IP is not necessarily permanent: forwarded headers must be trusted using a stable proxy address or an appropriately isolated network before deployment.

## What runs automatically

`.github/workflows/ci-deploy.yml` runs on pull requests, pushes to `main`, and manual workflow runs. CI installs dependencies, runs real PostgreSQL backend/model/deployment tests, builds the client/API, runs Chromium acceptance and builds the Docker image. It uses disposable test credentials, never production SMTP or production data.

Publishing/deployment are disabled until the repository variable `AUTO_DEPLOY` is exactly `true`. When enabled, a successful `main` run publishes `ghcr.io/OWNER/REPO:COMMIT`, deploys its immutable digest over SSH and uses the GitHub `production` environment. Pull requests never receive deployment access. Workflow concurrency and server locks serialize updates; a commit superseded on `main` is skipped before deployment. Protect `main` and require the `test` job before merging. GitHub environment approval rules are optional; omit required reviewers for fully automatic deployments.

The deployment helper refuses mutable image tags and concurrent deployments. It pulls the new image before interrupting editing. For an existing running API it makes a full database/media backup using the old image, then starts the new image and waits up to 180 seconds for Docker readiness. It records the successful image in ignored `.release.env`. Named volumes and a stable Compose project preserve accounts, boards and media. Updates interrupt active sockets and backups briefly pause editing; reconnect handles this within the existing limits. This is not a zero-downtime or multi-instance deployment.

## 1. Create the private repository

Create an empty private GitHub repository, then run these commands from this project's root after reviewing the staged files:

```sh
git init -b main
git add .
git diff --cached --name-only
git commit -m "Prepare Boardroom and deployment pipeline"
git remote add origin git@github.com:RehmanMuaz/Boardroom.git
git push -u origin main
```

Confirm the list excludes `.env`, `.env.production`, uploaded files, backups, database volumes and `node_modules`. The supplied ignore files exclude them. Do not add secrets with `git add -f`. No real credentials belong in workflow YAML.

## 2. Prepare the server once

Install Git, Docker Engine with the Compose plugin, and `flock` (usually supplied by util-linux). Host Node.js/npm are not required. Use a dedicated deployment account. Its Docker access allows host-level administration; give that account and its SSH key only to trusted deployment automation. Do not run pull-request code on the production host.

`sh scripts/server-helper.sh` builds a cached Node/Docker CLI/Compose helper from `deploy/helper/Dockerfile`, then runs the existing deployment or backup scripts in a temporary container. Only that Dockerfile enters its build context. The helper mounts the local Docker socket, the project at its identical absolute host path (for Compose bind mounts), and the host Docker login directory read-only. It automatically loads `.release.env`. The helper has Docker administrator access and must run only trusted code. It is removed after completion; application volumes and backups remain on the host. Portainer can inspect the application containers; CI manages releases.

This launcher supports a standard Linux Docker Engine at `/var/run/docker.sock`, not remote Docker contexts or rootless sockets. Private GHCR login must work inside the helper; host-only external credential helpers are not bundled. Use the server registry login described below.

Create `/opt/boardroom` owned by that account and clone the private repository there. The workflow expects this exact path and project name `boardroom-production`. Configure a read-only GitHub deploy key on the server so `git fetch origin main` works without interactive prompts. Verify GitHub's SSH host key when setting up that connection.

Generate a separate SSH key for GitHub Actions to connect to this server. Add its public key to the deployment account's `authorized_keys` (disable forwarding/PTY where practical). The private key goes in the GitHub environment secret below. The server's repository key and the Actions-to-server key have different purposes.

For private GHCR images, log the deployment account into `ghcr.io` using a dedicated GitHub credential with `read:packages` and access to the package. Supply it with `docker login ghcr.io --username USER --password-stdin`; don't put it in a command argument or in `.env.production`. Docker stores registry credentials for that account. The Actions publishing job uses its built-in `GITHUB_TOKEN`, not this server credential.

## 3. Production configuration and domain

Inside `/opt/boardroom`, copy `deploy/.env.traefik.example` to `.env.production`, restrict it to the deployment account (`chmod 600 .env.production`), and set fresh database/session secrets plus the Brevo SMTP settings. Use the database hostname `postgres` in `CONTAINER_DATABASE_URL` and percent-encode its password. Keep `REQUIRE_EMAIL_VERIFICATION=true`.

For this installation, keep `DEPLOY_PROXY=traefik`, `TRAEFIK_NETWORK=reverse-proxy`, `TRAEFIK_ENTRYPOINT=websecure`, and `TRAEFIK_CERT_RESOLVER=vertexfilms`. Keep `TRUST_PROXY=172.19.0.7/32`, now confirmed static in the server Traefik configuration. Deployment and backup scripts select the Traefik Compose file from this setting. PostgreSQL stays on the private application network; only the API joins the existing proxy network. No existing Traefik configuration or Cloudflare credentials need to be copied into Boardroom.

For a separate server served directly by the supplied Caddy proxy instead, use `deploy/.env.example` and the default `deploy/compose.yaml`:

```dotenv
SITE_ADDRESS=boards.example.com
APP_ORIGIN=https://boards.example.com
BIND_ADDRESS=0.0.0.0
HTTP_PORT=80
HTTPS_PORT=443
```

Point the domain at the server and allow HTTP/HTTPS traffic to Caddy. The stack exposes neither PostgreSQL nor the API directly. `APP_ORIGIN` controls verification, invitation and reset links, so production emails will use your domain. An existing reverse proxy requires a tailored proxy/network arrangement; do not enable this stack on already occupied ports. See [OPERATIONS.md](OPERATIONS.md) for TLS, SMTP, networking and complete backup/restore details.

## 4. Configure GitHub Actions

Create a GitHub environment named **production**, restrict deployment branches to **main**, and add these environment secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | Server DNS name or IPv4 address, without protocol |
| `DEPLOY_USER` | Dedicated server deployment username |
| `DEPLOY_PORT` | SSH port, normally `22` (optional) |
| `DEPLOY_SSH_KEY` | Private Actions-to-server SSH key |
| `DEPLOY_KNOWN_HOSTS` | Verified OpenSSH known_hosts entry for that host/port |

Verify the host key fingerprint through the server console or another trusted channel; don't blindly trust `ssh-keyscan` output. For a custom SSH port, known_hosts uses `[host]:port` formatting. The workflow enforces host-key checking.

After the first CI run passes and server configuration is ready, add the **repository variable** `AUTO_DEPLOY=true`. Run the workflow manually on `main` for the first installation. Subsequent successful pushes to `main` automatically publish and deploy. Registry package access must permit the server credential to pull the new package; first publication may require granting that access and rerunning the workflow.

## 5. Check the first live installation

Verify the public HTTPS certificate and `/health/ready`, then sign up and test real Brevo verification/reset/invitation delivery. Test two-account live editing, viewer restrictions, image/video uploads and a fresh-target restore before inviting the wider team. CI does not establish public DNS, certificate or email deliverability acceptance.

Useful server commands after deployment:

```sh
cd /opt/boardroom
docker compose --env-file .env.production --env-file .release.env -f deploy/compose.traefik.yaml -p boardroom-production ps
docker compose --env-file .env.production --env-file .release.env -f deploy/compose.traefik.yaml -p boardroom-production logs --tail 100 api
sh scripts/server-helper.sh ops backup --env-file .env.production --project boardroom-production --name backup-YYYY-MM-DD
```

Both environment files are needed for manual Compose commands after CI deployment, so the selected release stays consistent. `npm run ops` also loads `.release.env`. Schedule backups and copy encrypted archives off-host; pre-deployment backups alone are not a daily backup policy. Add disk/uptime alerts and log retention separately.

## Failure and recovery

Failed tests prevent publication/deployment. A failed backup prevents replacing the API. Failed startup/readiness fails the deployment job and leaves `.release.env` pointing to the last successful release; the actual running containers may differ, so inspect them before acting. Deployment never deletes volumes or prunes images.

Database migrations run on startup. An old image may not work with a newer schema, so this workflow does **not** automatically roll back either images or data. Inspect the failure and choose a forward fix, a confirmed schema-compatible image rollback, or full recovery from the pre-deployment archive into a fresh target using [OPERATIONS.md](OPERATIONS.md). Never overwrite the live database with an automatic restore.

If a killed deployment leaves `.deployment.lock` or `.pipeline.lock`, determine whether a deployment is still running before removing stale lock files. The workflow uses `flock` for the Git checkout and the Node helper uses an exclusive file for container updates.

References: [GitHub image publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments), [Docker Compose readiness](https://docs.docker.com/reference/cli/docker/compose/up/).

Local validation: 24 tests and the production build passed; the additional Linux launcher test passed inside the helper container (it is skipped by the Windows test runner). The helper image built and its Node/Compose smoke checks passed; the changed workflow passed actionlint. Earlier production image/Compose and six Chromium acceptance checks passed, though the existing Windows browser-runner shutdown stall required stopping that runner. GitHub-hosted execution, SSH/registry wiring and actual public deployment remain untested.

Helper implementation references: [Docker container mounts and runtime options](https://docs.docker.com/reference/cli/docker/container/run/), [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/).



