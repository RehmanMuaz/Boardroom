#!/bin/sh
set -eu
umask 077
mode="${1:-}"
name="${2:-}"
case "$name" in ''|*[!a-z0-9-]*) echo 'Use a backup name containing only lowercase letters, digits and hyphens.' >&2; exit 1;; esac
[ "${#name}" -le 80 ] || exit 1
archive="/backups/$name"
check() {
 [ "$(cat "$archive/VERSION")" = 'boardroom-backup-v1' ] || exit 1
 # Check only the expected manifest entries, never paths chosen by an archive.
 awk '{print $2}' "$archive/CHECKSUMS" > /tmp/checksum-files
 printf 'database.dump\nassets.tar.gz\nassets.list\nassets.sizes\n' > /tmp/expected-files
 cmp /tmp/checksum-files /tmp/expected-files
 (cd "$archive" && sha256sum -c CHECKSUMS)
 # Refuse nested paths, links, devices and unexpected archive members.
 tar -tzf "$archive/assets.tar.gz" | sort > /tmp/archive-list
 cmp /tmp/archive-list "$archive/assets.list"
 if grep -Ev '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' "$archive/assets.list"; then exit 1; fi
 tar -tvzf "$archive/assets.tar.gz" | awk 'substr($1,1,1)!="-" {bad=1} END {exit bad}'
}
case "$mode" in
 backup)
  mkdir "$archive"
  # The controller stops the API before this command, keeping the DB and media consistent.
  psql -v ON_ERROR_STOP=1 -Atc 'SELECT id FROM team_assets ORDER BY id' > "$archive/assets.list"
  psql -v ON_ERROR_STOP=1 -Atc "SELECT id::text || ' ' || size_bytes::text FROM team_assets ORDER BY id" > "$archive/assets.sizes"
  while IFS= read -r id; do [ -f "/assets/$id" ] && [ ! -L "/assets/$id" ] || { echo 'Missing or unsafe asset file' >&2; exit 1; }; done < "$archive/assets.list"
  while read -r id bytes; do [ "$(stat -c%s "/assets/$id")" = "$bytes" ] || { echo 'Asset size does not match database metadata.' >&2; exit 1; }; done < "$archive/assets.sizes"
  pg_dump --format=custom --no-owner --no-acl --exclude-table-data=public.session --exclude-table-data=public.account_tokens --exclude-table-data=public.auth_rate_limits --file="$archive/database.dump"
  tar -czf "$archive/assets.tar.gz" -C /assets -T "$archive/assets.list"
  (cd "$archive" && sha256sum database.dump assets.tar.gz assets.list assets.sizes > CHECKSUMS)
  printf 'boardroom-backup-v1\n' > "$archive/VERSION"
  check
  echo 'Database and media backup complete. Sessions and account recovery links are excluded.'
  ;;
 check) check;;
 restore)
  check
  tables="$(psql -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")"
  [ "$tables" = 0 ] || { echo 'Restore requires a fresh empty database. Existing data will not be replaced.' >&2; exit 1; }
  [ -z "$(find /assets -mindepth 1 -maxdepth 1 -print -quit)" ] || { echo 'Restore requires an empty asset volume.' >&2; exit 1; }
  # The operations helper may initialize this volume before the unprivileged API.
  chown 1000:1000 /assets
  chmod 700 /assets
  mkdir /tmp/restore-assets
  tar -xzf "$archive/assets.tar.gz" -C /tmp/restore-assets --no-same-owner
  while read -r id bytes; do
   case "$id" in *[!a-f0-9-]*|'') exit 1;; esac
   [ "$(stat -c%s "/tmp/restore-assets/$id")" = "$bytes" ] || { echo 'Restored asset size mismatch.' >&2; exit 1; }
  done < "$archive/assets.sizes"
  # PostgreSQL restores all schema/data atomically; only then install validated flat files.
  pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname="$PGDATABASE" "$archive/database.dump"
  while IFS= read -r id; do cp "/tmp/restore-assets/$id" "/assets/$id"; chown 1000:1000 "/assets/$id"; chmod 600 "/assets/$id"; done < "$archive/assets.list"
  echo 'Restore complete. Start the API, sign in again and verify your boards and media.'
  ;;
 *) echo 'Expected backup, check or restore.' >&2; exit 1;;
esac
