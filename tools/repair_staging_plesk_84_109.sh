#!/usr/bin/env bash
set -euo pipefail

RELEASE="188.5.5.6.84.109"
DOMAIN="kareta.kz"
SUBDOMAIN="s"
HOST="${SUBDOMAIN}.${DOMAIN}"
VHOST_BASE="${KARETA_PLESK_VHOST_BASE:-/var/www/vhosts/${DOMAIN}}"
LOG="${KARETA_STAGING_REPAIR_LOG:-/tmp/kareta-staging-repair-${RELEASE}.log}"

exec > >(tee -a "$LOG") 2>&1

echo "KARETA_STAGING_REPAIR release=${RELEASE} host=${HOST}"
echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "ERROR: run as root on the Plesk host" >&2
  exit 20
fi
if ! command -v plesk >/dev/null 2>&1; then
  echo "ERROR: Plesk CLI not found" >&2
  exit 21
fi
if [[ ! -d "$VHOST_BASE" ]]; then
  echo "ERROR: subscription root not found: $VHOST_BASE" >&2
  exit 22
fi

validate_root() {
  local root="$1"
  [[ -f "$root/index.php" ]] || return 1
  [[ -f "$root/inc/asset_version.php" ]] || return 1
  grep -Fq "$RELEASE" "$root/inc/asset_version.php" || return 1
  return 0
}

TARGET_ROOT="${KARETA_STAGING_DOCROOT:-}"
if [[ -n "$TARGET_ROOT" ]]; then
  TARGET_ROOT="$(readlink -f "$TARGET_ROOT")"
  if ! validate_root "$TARGET_ROOT"; then
    echo "ERROR: KARETA_STAGING_DOCROOT does not contain KARETA release ${RELEASE}: $TARGET_ROOT" >&2
    exit 23
  fi
else
  mapfile -t CANDIDATES < <(
    find "$VHOST_BASE" -maxdepth 5 -type f -path '*/inc/asset_version.php' -print0 2>/dev/null \
      | while IFS= read -r -d '' version_file; do
          if grep -Fq "$RELEASE" "$version_file"; then
            root="$(dirname "$(dirname "$version_file")")"
            if validate_root "$root"; then printf '%s\n' "$root"; fi
          fi
        done \
      | sort -u
  )
  if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
    echo "ERROR: no deployed KARETA ${RELEASE} tree found under $VHOST_BASE" >&2
    exit 24
  fi
  if [[ ${#CANDIDATES[@]} -gt 1 ]]; then
    echo "ERROR: multiple KARETA ${RELEASE} trees found; rerun with KARETA_STAGING_DOCROOT=<exact path>" >&2
    printf 'candidate=%s\n' "${CANDIDATES[@]}"
    exit 25
  fi
  TARGET_ROOT="${CANDIDATES[0]}"
fi

case "$TARGET_ROOT" in
  "$VHOST_BASE"/*) ;;
  *)
    echo "ERROR: target root must be inside $VHOST_BASE: $TARGET_ROOT" >&2
    exit 26
    ;;
esac

REL_ROOT="/${TARGET_ROOT#${VHOST_BASE}/}"
echo "target_root=$TARGET_ROOT"
echo "plesk_www_root=$REL_ROOT"

echo "--- current subdomain state ---"
plesk bin subdomain --info "$HOST" || true

echo "--- DNS snapshot ---"
if command -v dig >/dev/null 2>&1; then
  echo "A=$(dig +short A "$HOST" | paste -sd, -)"
  echo "AAAA=$(dig +short AAAA "$HOST" | paste -sd, -)"
fi

if plesk bin subdomain --info "$HOST" >/dev/null 2>&1; then
  echo "action=update_subdomain"
  plesk bin subdomain --update "$SUBDOMAIN" -domain "$DOMAIN" -www-root "$REL_ROOT" -php true -ssl true
else
  echo "action=create_subdomain"
  plesk bin subdomain --create "$SUBDOMAIN" -domain "$DOMAIN" -www-root "$REL_ROOT" -php true -ssl true
fi

echo "--- rebuild Plesk web configuration ---"
plesk repair web "$DOMAIN" -y

echo "--- post-change subdomain state ---"
plesk bin subdomain --info "$HOST"

TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

CURL_ARGS=(--silent --show-error --fail --location --max-time 30)
if command -v dig >/dev/null 2>&1; then
  PUBLIC_IP="$(dig +short A "$HOST" | head -n1 || true)"
  if [[ -n "$PUBLIC_IP" ]]; then
    CURL_ARGS+=(--resolve "${HOST}:443:${PUBLIC_IP}")
  fi
fi

curl "${CURL_ARGS[@]}" "https://${HOST}/" -o "$TMP_BODY"

if ! grep -Eqi 'KARETA\.KZ|KARETA' "$TMP_BODY"; then
  echo "ERROR: ${HOST} still does not identify as KARETA.KZ" >&2
  grep -Eio '<title>[^<]*</title>|<h1[^>]*>[^<]*</h1>' "$TMP_BODY" | head -n 4 || true
  exit 30
fi
if ! grep -Fq "$RELEASE" "$TMP_BODY"; then
  echo "ERROR: ${HOST} serves KARETA but release token ${RELEASE} was not found in root HTML" >&2
  exit 31
fi

echo "external_host=${HOST}"
echo "external_application=KARETA.KZ"
echo "external_release=${RELEASE}"
echo "KARETA_STAGING_REPAIR: OK"
