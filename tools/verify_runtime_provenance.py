#!/usr/bin/env python3
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--base-url", required=True)
parser.add_argument("--expected-sha", required=True)
parser.add_argument("--expected-asset-version", default="")
args = parser.parse_args()

expected_sha = args.expected_sha.strip().lower()
if not re.fullmatch(r"[a-f0-9]{40}", expected_sha):
    raise SystemExit("expected SHA must be 40 hex chars")

url = args.base_url.rstrip("/") + "/api/provenance.php"
try:
    with urllib.request.urlopen(url, timeout=15) as response:
        status = response.status
        payload = json.loads(response.read().decode("utf-8"))
except urllib.error.HTTPError as error:
    body = error.read().decode("utf-8", "replace")
    print(body)
    raise SystemExit(f"PROVENANCE_VERIFY: FAIL HTTP {error.code}")
except Exception as error:
    raise SystemExit(f"PROVENANCE_VERIFY: FAIL {error}")

actual_sha = str(payload.get("gitSha", "")).strip().lower()
actual_asset = str(payload.get("assetVersion", "")).strip()
ok = (
    status == 200
    and payload.get("ok") is True
    and payload.get("status") == "provenance_ready"
    and actual_sha == expected_sha
    and (not args.expected_asset_version or actual_asset == args.expected_asset_version)
)

report = {
    "status": "PASS" if ok else "FAIL",
    "url": url,
    "expectedSha": expected_sha,
    "actualSha": actual_sha,
    "expectedAssetVersion": args.expected_asset_version,
    "actualAssetVersion": actual_asset,
    "builtAt": payload.get("builtAt", ""),
    "workflowRunId": payload.get("workflowRunId", ""),
}
print(json.dumps(report, indent=2))
sys.exit(0 if ok else 1)
