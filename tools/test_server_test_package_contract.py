#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[1]

def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

builder = load_module(ROOT / "tools" / "build_server_package.py", "builder")
policy = json.loads(
    (ROOT / "harness" / "server-package-policy.json").read_text(encoding="utf-8")
)

assert policy["schema"] == "kareta.harness.server-package-policy.v1"

for required in [
    ".htaccess","index.php","config.php","asset_manifest.php","manifest.json","sw.js",
]:
    assert required in policy["runtimeFiles"], required

for sidecar in [
    "config.server-test.example.php",
    "config.private.example.php",
    "docs/release/current.json",
    "docs/deployment/SERVER_TEST_UPLOAD.md",
]:
    assert sidecar in policy["artifactSidecars"], sidecar

for ops in [
    "tools/server_preflight.php",
    "tools/verify_runtime.php",
    "tools/verify_runtime_provenance.py",
    "tools/verify_staging_current.py",
    "tools/generate_deployment_manifest.php",
]:
    assert ops in policy["opsFiles"], ops
    assert (ROOT / ops).is_file(), ops

for path in [
    "api/bootstrap.php",
    "inc/asset_version.php",
    "js/next/app_next.js",
    "storage/.htaccess",
    "tools/server_preflight.php",
    "config.server-test.example.php",
]:
    assert builder.is_selected(path, policy), path

for path in [
    ".github/workflows/verify.yml",
    "harness/change-map.json",
    "config.private.php",
    ".env",
    "storage/logs/private.log",
    "storage/backups/backup.zip",
]:
    assert (not builder.is_selected(path, policy)) or builder.is_forbidden(path, policy), path

for path in [
    "config.private.php",".env","storage/logs/x.log","dump.sql","secret.pem"
]:
    assert builder.is_forbidden(path, policy), path

assert not builder.is_forbidden("api/bootstrap.php", policy)

server_test=(ROOT/"config.server-test.example.php").read_text(encoding="utf-8")
for needle in [
    "'environment' => 'staging'",
    "'db_auto_create' => false",
    "'db_auto_migrate' => false",
    "'messaging_auto_schema' => false",
    "'otp_transport' => 'test_static'",
    "'otp_test_code' => '0000'",
    "'otp_temp_static_enabled' => false",
]:
    assert needle in server_test, needle

production_example=(ROOT/"config.private.example.php").read_text(encoding="utf-8")
assert "'otp_temp_static_enabled' => false" in production_example

runbook=(ROOT/"docs/deployment/SERVER_TEST_UPLOAD.md").read_text(encoding="utf-8")
for needle in [
    "PHP 8.1 or newer",
    "db_auto_migrate",
    "verify_staging_current.py",
    "verify_runtime_provenance.py",
    "HARNESS_EVIDENCE external:staging-exact-runtime",
]:
    assert needle in runbook, needle

htaccess=(ROOT/".htaccess").read_text(encoding="utf-8")
for needle in [
    r"RewriteRule ^config\.(?:private|server-test)\.example\.php$ - [F,L]",
    r"RewriteRule ^_SERVER_[A-Za-z0-9_.-]+$ - [F,L]",
]:
    assert needle in htaccess, needle

config=(ROOT/"config.php").read_text(encoding="utf-8")
assert "$kareta_private_candidates" in config
assert "dirname(KARETA_ROOT) . '/.kareta/config.private.php'" in config
assert "$kareta_otp_temp_static_enabled" in config
assert "'otp_temp_static_enabled',\n        false" in config

print("SERVER_TEST_PACKAGE_CONTRACT: PASS")
