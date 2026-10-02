#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import PurePosixPath
import re
import sys
import zipfile


REQUIRED = {
    ".htaccess",
    "index.php",
    "config.php",
    "asset_manifest.php",
    "manifest.json",
    "sw.js",
    "api/bootstrap.php",
    "api/provenance.php",
    "api/migration_manifest.php",
    "inc/asset_version.php",
    "storage/.htaccess",
    "storage/deployment_manifest.json",
    "storage/server_package_manifest.json",
}

FORBIDDEN_EXACT = {
    "config.private.php",
    ".env",
}

FORBIDDEN_PREFIXES = (
    ".git/",
    ".github/",
    "harness/",
    "docs/",
    "ai/",
    "print-banners/",
    "storage/logs/",
    "storage/backups/",
)

FORBIDDEN_SUFFIXES = (
    ".sql",
    ".bak",
    ".pem",
    ".key",
    "~",
)


class VerifyError(RuntimeError):
    pass


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def safe_name(name: str) -> bool:
    p = PurePosixPath(name)
    return (
        not p.is_absolute()
        and ".." not in p.parts
        and "\\" not in name
        and "\x00" not in name
    )


def verify(zip_path: str, expected_sha: str, expected_release: str) -> dict:
    if not re.fullmatch(r"[0-9a-fA-F]{40}", expected_sha):
        raise VerifyError("expected SHA must be exact 40-character hex")

    with zipfile.ZipFile(zip_path, "r") as zf:
        names = set(zf.namelist())
        files = {n for n in names if not n.endswith("/")}

        unsafe = sorted(n for n in names if not safe_name(n))
        if unsafe:
            raise VerifyError("unsafe archive path: " + unsafe[0])

        missing = sorted(REQUIRED - files)
        if missing:
            raise VerifyError("required package files missing: " + ", ".join(missing))

        forbidden = []
        for name in sorted(files):
            if name in FORBIDDEN_EXACT:
                forbidden.append(name)
            if name.startswith(FORBIDDEN_PREFIXES):
                forbidden.append(name)
            if name.endswith(FORBIDDEN_SUFFIXES):
                forbidden.append(name)
        if forbidden:
            raise VerifyError("forbidden package file: " + forbidden[0])

        provenance = json.loads(
            zf.read("storage/deployment_manifest.json").decode("utf-8")
        )
        if str(provenance.get("gitSha", "")).lower() != expected_sha.lower():
            raise VerifyError("deployment provenance SHA mismatch")
        if str(provenance.get("assetVersion", "")) != expected_release:
            raise VerifyError("deployment provenance release mismatch")

        manifest = json.loads(
            zf.read("storage/server_package_manifest.json").decode("utf-8")
        )
        if manifest.get("schema") != "kareta.server-package.v1":
            raise VerifyError("server package manifest schema mismatch")
        if str(manifest.get("gitSha", "")).lower() != expected_sha.lower():
            raise VerifyError("server package manifest SHA mismatch")
        if str(manifest.get("assetVersion", "")) != expected_release:
            raise VerifyError("server package manifest release mismatch")

        records = manifest.get("files")
        if not isinstance(records, list) or not records:
            raise VerifyError("server package manifest file list missing")

        seen = set()
        for record in records:
            path = str(record.get("path", ""))
            if not path or path in seen:
                raise VerifyError("duplicate/empty manifest path")
            seen.add(path)
            if path not in files:
                raise VerifyError("manifest references missing file: " + path)
            payload = zf.read(path)
            if int(record.get("size", -1)) != len(payload):
                raise VerifyError("manifest size mismatch: " + path)
            if str(record.get("sha256", "")).lower() != sha256_bytes(payload):
                raise VerifyError("manifest hash mismatch: " + path)

        expected_manifest_files = files - {"storage/server_package_manifest.json"}
        if seen != expected_manifest_files:
            extra = sorted(expected_manifest_files - seen)
            stale = sorted(seen - expected_manifest_files)
            raise VerifyError(
                "manifest coverage mismatch extra=%s stale=%s"
                % (extra[:3], stale[:3])
            )

        private_markers = (
            b"-----BEGIN PRIVATE KEY-----",
            b"-----BEGIN RSA PRIVATE KEY-----",
            b"-----BEGIN OPENSSH PRIVATE KEY-----",
        )
        for name in sorted(files):
            payload = zf.read(name)
            if any(marker in payload for marker in private_markers):
                raise VerifyError("private key marker found: " + name)

        return {
            "status": "PASS",
            "gitSha": expected_sha.lower(),
            "assetVersion": expected_release,
            "files": len(files),
            "manifestFiles": len(records),
            "zipSha256": sha256_bytes(open(zip_path, "rb").read()),
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", required=True)
    parser.add_argument("--expected-sha", required=True)
    parser.add_argument("--expected-release", required=True)
    args = parser.parse_args()

    try:
        result = verify(args.zip, args.expected_sha, args.expected_release)
    except Exception as exc:
        print("SERVER_TEST_PACKAGE_VERIFY: FAIL", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    print("SERVER_TEST_PACKAGE_VERIFY: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
