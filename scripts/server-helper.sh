#!/bin/sh
# Linux Docker host only. Keep host/container paths identical for Compose bind mounts.
set -eu
mode=${1:-}
case "$mode" in
 deploy|ops) shift ;;
 *) echo 'Usage: sh scripts/server-helper.sh deploy|ops [helper arguments]' >&2; exit 2 ;;
esac
root=$(pwd -P)
test -f "$root/deploy/helper/Dockerfile" || { echo 'Run from the Boardroom repository root' >&2; exit 2; }
case "$root" in
 *,*) echo 'Repository path must not contain commas' >&2; exit 2 ;;
esac
# Only the helper Dockerfile enters the build context, never application secrets.
docker build --tag boardroom-server-helper:local "$root/deploy/helper"
set -- --env-file-if-exists=.release.env "scripts/$mode.mjs" "$@"
# Carry the host login into the trusted helper so private GHCR pulls work.
config_dir=${DOCKER_CONFIG:-${HOME:?}/.docker}
if [ -d "$config_dir" ]; then
 set -- --mount "type=bind,src=$config_dir,dst=/docker-config,readonly" boardroom-server-helper:local "$@"
else
 set -- boardroom-server-helper:local "$@"
fi
exec docker run --rm --init --read-only --tmpfs /tmp --cap-drop ALL \
 --user "$(id -u):$(id -g)" --group-add "$(stat -c '%g' /var/run/docker.sock)" \
 --env HOME=/tmp --env DOCKER_CONFIG=/docker-config \
 --security-opt no-new-privileges:true \
 --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
 --mount "type=bind,src=$root,dst=$root" --workdir "$root" \
 "$@"
