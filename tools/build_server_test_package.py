#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "harness" / "server-package-policy.json"


class PackageError(RuntimeError):
    pass


def load_policy() -> dict:
    data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    if data.get("schema") != "kareta.harness.server-package-policy.v1":
        raise PackageError("server package policy schema mismatch")
    return data


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None) -> str:
    proc = subprocess.run(
        cmd,
        cwd=str(cwd or ROOT),
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if proc.returncode != 0:
        raise PackageError(
            "command failed rc=%s: %s\n%s"
            % (proc.returncode, " ".join(cmd), proc.stdout[-4000:])
        )
    return proc.stdout


def git_tracked_files() -> list[str]:
    raw = subprocess.check_output(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
    )
    return sorted(
        p.decode("utf-8")
        for p in raw.split(b"\0")
        if p
    )


def is_selected(path: str, policy: dict) -> bool:
    if path in set(policy.get("runtimeFiles", [])):
        return True
    if path in set(policy.get("opsFiles", [])):
        return True
    return any(
        path.startswith(prefix)
        for prefix in policy.get("runtimePrefixes", [])
    )


def is_forbidden_path(path: str, policy: dict) -> bool:
    normalized = path.replace("\\", "/")
    for rule in policy.get("forbiddenPackagePaths", []):
        if rule.endswith("/"):
            if normalized.startswith(rule):
                return True
        elif normalized == rule:
            return True
    return any(
        normalized.endswith(suffix)
        for suffix in policy.get("forbiddenSuffixes", [])
    )


def read_release() -> str:
    asset = (ROOT / "inc" / "asset_version.php").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")

    am = re.search(r"KARETA_ASSET_VERSION\s*=\s*['\"]([^'\"]+)['\"]", asset)
    sm = re.search(r"const\s+RELEASE\s*=\s*['\"]([^'\"]+)['\"]\s*;", sw)
    asset_release = am.group(1) if am else ""
    sw_release = sm.group(1) if sm else ""

    if not asset_release:
        raise PackageError("KARETA_ASSET_VERSION not found")
    if asset_release != sw_release:
        raise PackageError(
            "release parity mismatch: asset=%s sw=%s"
            % (asset_release, sw_release)
        )
    return asset_release


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def scan_for_secret_markers(root: Path, policy: dict) -> None:
    markers = [
        str(x).encode("utf-8")
        for x in policy.get("forbiddenContentMarkers", [])
    ]
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if rel in {"storage/deployment_manifest.json", "storage/server_package_manifest.json"}:
            continue
        try:
            payload = path.read_bytes()
        except OSError as exc:
            raise PackageError("cannot read package file %s: %s" % (rel, exc))
        for marker in markers:
            if marker and marker in payload:
                raise PackageError(
                    "secret/private-key marker found in package file: %s" % rel
                )


def lint_package(root: Path) -> dict:
    php_files = sorted(root.rglob("*.php"))
    js_files = sorted(root.rglob("*.js"))

    for path in php_files:
        run(["php", "-l", str(path)], cwd=ROOT)

    node = shutil.which("node")
    if not node:
        raise PackageError("node is required for package JavaScript syntax checks")
    for path in js_files:
        run([node, "--check", str(path)], cwd=ROOT)

    return {
        "phpFiles": len(php_files),
        "jsFiles": len(js_files),
    }


def generate_provenance(
    package_root: Path,
    git_sha: str,
    git_ref: str,
    workflow_run_id: str,
    built_at: str,
) -> dict:
    target = package_root / "storage" / "deployment_manifest.json"
    target.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env.update(
        {
            "KARETA_DEPLOY_GIT_SHA": git_sha,
            "KARETA_DEPLOY_GIT_REF": git_ref,
            "KARETA_DEPLOY_BUILT_AT": built_at,
            "KARETA_DEPLOY_WORKFLOW_RUN_ID": workflow_run_id,
        }
    )
    run(
        [
            "php",
            str(ROOT / "tools" / "generate_deployment_manifest.php"),
            "--output=" + str(target),
        ],
        cwd=ROOT,
        env=env,
    )

    manifest = json.loads(target.read_text(encoding="utf-8"))
    if str(manifest.get("gitSha", "")).lower() != git_sha.lower():
        raise PackageError("deployment provenance gitSha mismatch")
    return manifest


def add_package_manifest(
    package_root: Path,
    git_sha: str,
    git_ref: str,
    release: str,
    built_at: str,
) -> dict:
    records = []
    for path in sorted(package_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(package_root).as_posix()
        if rel == "storage/server_package_manifest.json":
            continue
        records.append(
            {
                "path": rel,
                "size": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )

    manifest = {
        "schema": "kareta.server-package.v1",
        "gitSha": git_sha.lower(),
        "gitRef": git_ref,
        "assetVersion": release,
        "builtAt": built_at,
        "fileCount": len(records),
        "files": records,
    }
    target = package_root / "storage" / "server_package_manifest.json"
    target.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return manifest


def make_zip(package_root: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(
        zip_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as zf:
        directories = sorted(
            [p for p in package_root.rglob("*") if p.is_dir()],
            key=lambda p: p.relative_to(package_root).as_posix(),
        )
        for directory in directories:
            rel = directory.relative_to(package_root).as_posix().rstrip("/") + "/"
            info = zipfile.ZipInfo(rel)
            info.external_attr = 0o755 << 16
            zf.writestr(info, b"")

        files = sorted(
            [p for p in package_root.rglob("*") if p.is_file()],
            key=lambda p: p.relative_to(package_root).as_posix(),
        )
        for path in files:
            zf.write(path, path.relative_to(package_root).as_posix())


def build(args: argparse.Namespace) -> dict:
    policy = load_policy()
    git_sha = args.git_sha.lower().strip()
    if not re.fullmatch(r"[0-9a-f]{40}", git_sha):
        raise PackageError("--git-sha must be an exact 40-character SHA")

    release = read_release()
    if args.expected_release and release != args.expected_release:
        raise PackageError(
            "release mismatch: actual=%s expected=%s"
            % (release, args.expected_release)
        )

    output_dir = Path(args.output_dir).resolve()
    stage_root = output_dir / "webroot"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    stage_root.mkdir(parents=True, exist_ok=True)

    tracked = git_tracked_files()
    selected = [p for p in tracked if is_selected(p, policy)]

    required = set(policy.get("runtimeFiles", [])) | set(policy.get("opsFiles", []))
    missing = sorted(required - set(selected))
    if missing:
        raise PackageError("required package files missing: " + ", ".join(missing))

    forbidden = sorted(p for p in selected if is_forbidden_path(p, policy))
    if forbidden:
        raise PackageError(
            "forbidden files selected for package: " + ", ".join(forbidden[:20])
        )

    for rel in selected:
        src = ROOT / rel
        if src.is_symlink():
            raise PackageError("symlink is not allowed in server package: " + rel)
        if not src.is_file():
            raise PackageError("tracked package source is not a regular file: " + rel)
        dst = stage_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    for rel in policy.get("emptyRuntimeDirs", []):
        (stage_root / rel).mkdir(parents=True, exist_ok=True)

    built_at = args.built_at or dt.datetime.now(dt.timezone.utc).replace(
        microsecond=0
    ).isoformat()
    provenance = generate_provenance(
        stage_root,
        git_sha,
        args.git_ref,
        args.workflow_run_id,
        built_at,
    )

    scan_for_secret_markers(stage_root, policy)
    lint = lint_package(stage_root)
    package_manifest = add_package_manifest(
        stage_root,
        git_sha,
        args.git_ref,
        release,
        built_at,
    )

    short_sha = git_sha[:12]
    zip_name = "kareta-server-test-%s-%s.zip" % (release, short_sha)
    zip_path = output_dir / zip_name
    make_zip(stage_root, zip_path)

    zip_sha = sha256_file(zip_path)
    sums_path = output_dir / "SHA256SUMS.txt"
    sums_path.write_text("%s  %s\n" % (zip_sha, zip_name), encoding="utf-8")

    report = {
        "schema": "kareta.server-package-report.v1",
        "status": "PASS",
        "gitSha": git_sha,
        "gitRef": args.git_ref,
        "assetVersion": release,
        "builtAt": built_at,
        "workflowRunId": args.workflow_run_id,
        "zip": zip_name,
        "zipSha256": zip_sha,
        "zipBytes": zip_path.stat().st_size,
        "trackedFiles": len(tracked),
        "packagedSourceFiles": len(selected),
        "packageManifestFiles": package_manifest["fileCount"],
        "phpFiles": lint["phpFiles"],
        "jsFiles": lint["jsFiles"],
        "provenance": provenance,
        "privateConfigIncluded": (stage_root / "config.private.php").exists(),
        "environmentFilesIncluded": any(
            p.name == ".env" or p.name.startswith(".env.")
            for p in stage_root.rglob("*")
            if p.is_file()
        ),
    }
    if report["privateConfigIncluded"] or report["environmentFilesIncluded"]:
        raise PackageError("secret-bearing config leaked into package")

    (output_dir / "package-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--git-sha", required=True)
    parser.add_argument("--git-ref", default="release/reconcile-84.152")
    parser.add_argument("--workflow-run-id", default="")
    parser.add_argument("--built-at", default="")
    parser.add_argument("--expected-release", default="")
    return parser.parse_args()


def main() -> int:
    try:
        report = build(parse_args())
    except Exception as exc:
        print("SERVER_TEST_PACKAGE: FAIL", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        return 1

    print(
        "SERVER_TEST_PACKAGE: PASS release=%s sha=%s zip=%s files=%s"
        % (
            report["assetVersion"],
            report["gitSha"],
            report["zip"],
            report["packageManifestFiles"],
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
