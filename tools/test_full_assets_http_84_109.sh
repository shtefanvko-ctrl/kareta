#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
HOST=127.0.0.1
PORT=18086
BASE="http://$HOST:$PORT"
LIST="$(mktemp)"
HDR="$(mktemp)"
BODY="$(mktemp)"
LOG="$(mktemp)"
cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$LIST" "$HDR" "$BODY" "$LOG"
}
trap cleanup EXIT
php -r 'require "inc/asset_registry.php"; $r=kareta_asset_registry(); $all=[]; foreach(["styles","scripts","images","critical"] as $k){foreach(($r[$k]??[]) as $p){$all[$p]=1;}} echo implode(PHP_EOL,array_keys($all)),PHP_EOL;' > "$LIST"
printf '%s\n' 'assets/onboarding/backgrounds/welcome/manifest.json' 'assets/errors/403/manifest.json' >> "$LIST"
php -S "$HOST:$PORT" -t "$ROOT" >"$LOG" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 40); do
  curl -sS -o /dev/null --max-time 1 "$BASE/" 2>/dev/null && break
  sleep 0.1
done
FAIL=0
COUNT=0
while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  COUNT=$((COUNT+1))
  : > "$HDR"; : > "$BODY"
  code=$(curl -sS -D "$HDR" -o "$BODY" -w '%{http_code}' --max-time 5 "$BASE/$asset" || echo ERR)
  ctype=$(awk 'BEGIN{IGNORECASE=1} /^Content-Type:/{gsub("\r",""); print tolower($2); exit}' "$HDR")
  expected=""
  case "$asset" in
    *.png) expected="image/png" ;;
    *.css) expected="text/css" ;;
    *.js) expected="javascript" ;;
    *.json) expected="application/json" ;;
  esac
  ok=1
  [ "$code" = "200" ] || ok=0
  if [ "$expected" = "javascript" ]; then
    [[ "$ctype" == *javascript* ]] || ok=0
  elif [ -n "$expected" ]; then
    [[ "$ctype" == "$expected"* ]] || ok=0
  fi
  if [ "$ok" -eq 0 ]; then
    echo "FAIL $asset HTTP=$code MIME=$ctype"
    FAIL=$((FAIL+1))
  fi
done < "$LIST"
if [ "$FAIL" -ne 0 ]; then
  echo "FULL_ASSET_HTTP_84_109: FAIL"
  echo "checked_assets=$COUNT failures=$FAIL"
  exit 1
fi
echo "FULL_ASSET_HTTP_84_109: PASS"
echo "checked_assets=$COUNT"
echo "http_status=200"
echo "mime_errors=0"
echo "not_found=0"
