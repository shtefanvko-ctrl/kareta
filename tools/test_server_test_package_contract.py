#!/usr/bin/env python3
from pathlib import Path
import importlib.util
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


builder = load_module(ROOT / "tools" / "build_server_test_package.py", "builder")
verifier = load_module(ROOT / "tools" / "verify_server_test_package.py", "verifier")
policy = json.loads(
    (ROOT / "harness" / "server-package-policy.json").read_text(encoding="utf-8")
)

assert policy["schema"] == "kareta.harness.server-package-policy.v1"

for required in [
    ".htaccess",
    "index.php",
    "config.php",
    "asset_manifest.php",
    "manifest.json",
    "sw.js",
]:
    assert required in policy["runtimeFiles"], required

for prefix in ["api/", "inc/", "css/", "js/", "assets/", "media/", "storage/"]:
    assert prefix in policy["runtimePrefixes"], prefix

for path in [
    "api/bootstrap.php",
    "inc/asset_version.php",
    "js/next/app_next.js",
    "storage/.htaccess",
    "tools/identity_migrate.php",
]:
    assert builder.is_selected(path, policy), path

for path in [
    ".github/workflows/verify.yml",
    "harness/change-map.json",
    "docs/architecture.md",
    "config.private.php",
    ".env",
    "storage/logs/private.log",
    "storage/backups/backup.zip",
]:
    assert not builder.is_selected(path, policy) or builder.is_forbidden_path(path, policy), path

assert builder.is_forbidden_path("config.private.php", policy)
assert builder.is_forbidden_path(".env", policy)
assert builder.is_forbidden_path("storage/logs/x.log", policy)
assert builder.is_forbidden_path("dump.sql", policy)
assert not builder.is_forbidden_path("api/bootstrap.php", policy)

assert verifier.safe_name("api/bootstrap.php")
assert not verifier.safe_name("../config.private.php")
assert not verifier.safe_name("/absolute/path")

server_test = (ROOT / "config.server-test.example.php").read_text(encoding="utf-8")
assert "'environment' => 'staging'" in server_test
assert "'db_auto_create' => false" in server_test
assert "'db_auto_migrate' => false" in server_test
assert "'messaging_auto_schema' => false" in server_test
assert "'otp_transport' => 'test_static'" in server_test
assert "'otp_test_code' => '0000'" in server_test

production_example = (ROOT / "config.private.example.php").read_text(encoding="utf-8")
assert "'otp_temp_static_enabled' => false" in production_example

config = (ROOT / "config.php").read_text(encoding="utf-8")
assert "$kareta_private_candidates" in config
assert "dirname(KARETA_ROOT) . '/.kareta/config.private.php'" in config
assert "$kareta_otp_temp_static_enabled" in config

print("SERVER_TEST_PACKAGE_CONTRACT: PASS")
