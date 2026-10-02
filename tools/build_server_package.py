#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, os, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ROOT_EXCLUDE_PREFIXES = (
    ".github/",
    "harness/",
    "ai/",
    "docs/",
)
ROOT_EXCLUDE_FILES = {
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "MB_MONITORING.md",
}
KEEP_DOCS = {"docs/release/current.json"}

FORBIDDEN_PATTERNS = (
    re.compile(r"(^|/)config\.private\.php($|\.)", re.I),
    re.compile(r"(^|/)\.env($|\.)", re.I),
    re.compile(r"(^|/)node_modules/", re.I),
    re.compile(r"(^|/)storage/(logs|backups|runtime)/", re.I),
    re.compile(r"(^|/)storage/deployment_manifest\.json$", re.I),
    re.compile(r"\.sql$", re.I),
    re.compile(r"\.bak(?:[-_.].*)?$", re.I),
    re.compile(r"~$"),
    re.compile(r"\.(pem|p12|pfx|key)$", re.I),
)

DEV_ROOT_PATTERNS = (
    re.compile(r"^PATCH_.*\.md$", re.I),
    re.compile(r"^PATCH_MANIFEST_.*\.txt$", re.I),
    re.compile(r"^CHANGELOG_.*\.md$", re.I),
    re.compile(r"^RELEASE_MASTER_PLAN_.*\.md$", re.I),
)

TOOL_EXCLUDE_PATTERNS = (
    re.compile(r"^tools/test_", re.I),
    re.compile(r"^tools/fixtures/", re.I),
    re.compile(r"^tools/archive/", re.I),
    re.compile(r"^tools/apply_patch_", re.I),
    re.compile(r"^tools/verify_r\d", re.I),
    re.compile(r"^tools/repair_staging_", re.I),
)

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def tracked_files() -> list[str]:
    raw = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT)
    return [p.decode("utf-8") for p in raw.split(b"\0") if p]

def should_exclude(rel: str) -> bool:
    rel = rel.replace("\\", "/")
    if rel in KEEP_DOCS:
        return False
    if rel in ROOT_EXCLUDE_FILES:
        return True
    if any(rel.startswith(prefix) for prefix in ROOT_EXCLUDE_PREFIXES):
        return True
    if any(rx.search(rel) for rx in FORBIDDEN_PATTERNS):
        return True
    if any(rx.search(rel) for rx in TOOL_EXCLUDE_PATTERNS):
        return True
    if "/" not in rel and any(rx.search(rel) for rx in DEV_ROOT_PATTERNS):
        return True
    return False

def release_version() -> str:
    text = (ROOT / "inc/asset_version.php").read_text(encoding="utf-8")
    m = re.search(r"KARETA_ASSET_VERSION\s*=\s*'([^']+)'", text)
    if not m:
        raise RuntimeError("KARETA_ASSET_VERSION not found")
    return m.group(1)

def upload_readme(release: str, sha: str) -> str:
    return f"""# KARETA server-test package

Release: {release}
Exact Git SHA: {sha}

## Upload order

1. Extract this archive into a NEW test document root. Do not overwrite production in place.
2. Keep `config.private.php` OUTSIDE the public document root. Start from `config.server-test.example.php`.
3. Set test DB credentials and a writable absolute `storage_root`.
4. Keep `db_auto_create=false` and `db_auto_migrate=false`; apply schema only through the explicit migration process.
5. Run: `php tools/server_preflight.php`.
6. Verify: `GET /api/provenance.php` returns this exact SHA and release.
7. Run: `python3 tools/verify_staging_current.py --base-url https://s.kareta.kz --expected-release {release}`.
8. Only after staging PASS run Android/device evidence.

## Security

- No private config, .env, SQL dump, backup, runtime log or key file is included.
- `tools/` is blocked from HTTP by root .htaccess and is present only for CLI commissioning.
- Test OTP 0000 is available only through the staging template; production default is fail-closed.
- This package authorizes TEST deployment only. It is not production-release approval.
"""

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    ap.add_argument("--source-sha", required=True)
    ap.add_argument("--git-ref", required=True)
    ap.add_argument("--workflow-run-id", default="")
    args = ap.parse_args()

    sha = args.source_sha.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise SystemExit("source SHA must be exact 40-char SHA")

    release = release_version()
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    included: list[str] = []
    excluded: list[str] = []
    for rel in tracked_files():
        if should_exclude(rel):
            excluded.append(rel)
            continue
        path = ROOT / rel
        if path.is_file():
            included.append(rel)

    if "config.private.php" in included:
        raise SystemExit("private config must never be packaged")

    built_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    deployment = {
        "schema": 1,
        "gitSha": sha,
        "gitRef": args.git_ref,
        "assetVersion": release,
        "builtAt": built_at,
        "workflowRunId": str(args.workflow_run_id or ""),
    }
    deployment_bytes = (json.dumps(deployment, ensure_ascii=False, indent=2) + "\n").encode()
    readme_bytes = upload_readme(release, sha).encode()

    checksums: dict[str, str] = {}
    for rel in included:
        checksums[rel] = sha256_file(ROOT / rel)
    checksums["storage/deployment_manifest.json"] = sha256_bytes(deployment_bytes)
    checksums["_SERVER_UPLOAD_README.md"] = sha256_bytes(readme_bytes)

    package_manifest = {
        "schema": "kareta.server-package.v1",
        "release": release,
        "sourceSha": sha,
        "gitRef": args.git_ref,
        "builtAt": built_at,
        "workflowRunId": str(args.workflow_run_id or ""),
        "fileCount": len(checksums),
        "checksums": dict(sorted(checksums.items())),
        "excluded": sorted(excluded),
        "privateConfigIncluded": False,
        "purpose": "server-test",
    }
    package_manifest_bytes = (
        json.dumps(package_manifest, ensure_ascii=False, indent=2) + "\n"
    ).encode()

    epoch = (1980, 1, 1, 0, 0, 0)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel in sorted(included):
            data = (ROOT / rel).read_bytes()
            zi = zipfile.ZipInfo(rel, epoch)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, data)
        for rel, data in [
            ("storage/deployment_manifest.json", deployment_bytes),
            ("_SERVER_UPLOAD_README.md", readme_bytes),
            ("_SERVER_PACKAGE_MANIFEST.json", package_manifest_bytes),
        ]:
            zi = zipfile.ZipInfo(rel, epoch)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, data)

    print(json.dumps({
        "ok": True,
        "output": str(out),
        "release": release,
        "sourceSha": sha,
        "trackedIncluded": len(included),
        "manifestFileCount": len(checksums),
        "zipSha256": sha256_file(out),
        "zipBytes": out.stat().st_size,
    }, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
