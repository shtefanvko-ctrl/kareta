#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TOTAL=0
PASSED=0
FAILED=0

section() {
  printf '\n== %s ==\n' "$1"
}

run_check() {
  local label="$1"
  shift
  TOTAL=$((TOTAL + 1))
  if "$@"; then
    PASSED=$((PASSED + 1))
    printf '[PASS] %s\n' "$label"
  else
    local rc=$?
    FAILED=$((FAILED + 1))
    printf '[FAIL] %s (rc=%s)\n' "$label" "$rc"
  fi
}

section "SYNTAX"
run_check "php:index" php -l index.php
run_check "php:config" php -l config.php
run_check "php:asset_registry" php -l inc/asset_registry.php
run_check "php:identity_session" php -l api/identity_session.php
run_check "php:db_api" php -l api/db.php
run_check "node:route_registry" node --check js/next/route_registry.js
run_check "node:app_next" node --check js/next/app_next.js
run_check "node:project_audit" node --check tools/test_project_audit_r188558410.js

section "MIGRATIONS"
run_check "migration manifest/checksums" php tools/test_release_migration_manifest.php

section "AUTH"
run_check "master workplace auth guard" node tools/test_r1885568427_master_workplace_auth_guard.js
run_check "legacy role capability budget" node tools/test_legacy_role_budget_84_109.js
run_check "frontend role authorization boundary" node tools/test_frontend_role_authorization_84_109.js

section "VISUAL"
run_check "master mobile shell visual contract" node tools/test_master_mobile_shell_visual.js

section "API"
run_check "identity API/garage recovery" node tools/test_r1885607_identity_api_client_garage_recovery.js
run_check "direct DB API client contract" node tools/test_direct_db_api_client_84_109.js
run_check "db monolith decomposition contract" node tools/test_db_monolith_decomposition_84_109.js
run_check "API contract smoke suite" node tools/test_api_contract_smoke_84_109.js

section "PWA"
run_check "PWA release/manifest contract" node tools/test_release_pwa_contract.js
run_check "manifest fallback regression" node tools/test_r1885568428_manifest_fallback.js

section "SMOKE"
run_check "project audit contracts" node tools/test_project_audit_r188558410.js
run_check "browser support matrix" node tools/test_browser_support_matrix_84_109.js
run_check "production feature matrix" node tools/test_production_feature_matrix_84_109.js
run_check "runtime release metadata" node tools/test_runtime_release_metadata_84_109.js
run_check "release notes 84.77-84.109" node tools/test_release_notes_84_77_84_109.js
run_check "route lazy loader" node tools/test_route_lazy_loader_84_66.js
run_check "master exchange structure" node tools/test_master_exchange_structure_84_109.js

printf '\nSUMMARY: %s/%s passed; %s failed\n' "$PASSED" "$TOTAL" "$FAILED"
if [ "$FAILED" -eq 0 ]; then
  echo "RELEASE_CHECKLIST: PASS"
  exit 0
fi
echo "RELEASE_CHECKLIST: FAIL"
exit 1
