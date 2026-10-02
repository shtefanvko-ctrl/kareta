#!/usr/bin/env python3
from __future__ import annotations
import argparse, datetime as dt, hashlib, json, re, subprocess, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "harness/server-package-policy.json"

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def load_policy() -> dict:
    data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    if data.get("schema") != "kareta.harness.server-package-policy.v1":
        raise RuntimeError("server package policy schema mismatch")
    return data

def tracked_files() -> list[str]:
    raw = subprocess.check_output(["git","ls-files","-z"], cwd=ROOT)
    return [p.decode("utf-8") for p in raw.split(b"\0") if p]

def is_forbidden(rel: str, policy: dict) -> bool:
    rel = rel.replace("\\","/")
    for rule in policy.get("forbiddenPackagePaths", []):
        if rule.endswith("/") and rel.startswith(rule):
            return True
        if rel == rule:
            return True
    return any(rel.lower().endswith(str(s).lower()) for s in policy.get("forbiddenSuffixes", []))

def is_selected(rel: str, policy: dict) -> bool:
    explicit = set(policy.get("runtimeFiles", [])) | set(policy.get("opsFiles", [])) | set(policy.get("artifactSidecars", []))
    if rel in explicit:
        return True
    return any(rel.startswith(prefix) for prefix in policy.get("runtimePrefixes", []))

def release_version() -> str:
    text=(ROOT/"inc/asset_version.php").read_text(encoding="utf-8")
    m=re.search(r"KARETA_ASSET_VERSION\s*=\s*'([^']+)'",text)
    if not m:
        raise RuntimeError("KARETA_ASSET_VERSION not found")
    return m.group(1)

def scan_content(rel: str, data: bytes, policy: dict) -> None:
    for marker in policy.get("forbiddenContentMarkers", []):
        if marker.encode("utf-8") in data:
            raise RuntimeError("forbidden private-key marker in " + rel)

def upload_readme(release: str, sha: str) -> str:
    return f"""# KARETA server-test package

Release: {release}
Exact Git SHA: {sha}

1. Extract into a NEW test document root. Do not overwrite production in place.
2. Do not place real `config.private.php` in this archive or Git. Start from `config.server-test.example.php` and keep the real private config outside public_html.
3. Configure test DB credentials and a writable absolute `storage_root`.
4. Keep `db_auto_create=false` and `db_auto_migrate=false`. Apply schema only through the explicit migration/commissioning procedure.
5. Run `php tools/server_preflight.php` on the server.
6. Confirm `GET /api/provenance.php` returns exact SHA {sha} and release {release}.
7. Run `python3 tools/verify_staging_current.py --base-url https://s.kareta.kz --expected-release {release}`.
8. Only after staging PASS run Android two-account/two-pass/visual evidence.

Security:
- No private config, .env, SQL dump, backup, runtime log or private-key file is packaged.
- `tools/` remains HTTP-blocked by root .htaccess and is included only for CLI commissioning.
- Test OTP 0000 exists only in the staging template. Production default is fail-closed.
- This archive authorizes TEST installation only; it is not production release approval.
"""

def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True)
    ap.add_argument("--source-sha",required=True)
    ap.add_argument("--git-ref",required=True)
    ap.add_argument("--workflow-run-id",default="")
    args=ap.parse_args()

    sha=args.source_sha.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{40}",sha):
        raise SystemExit("source SHA must be exact 40-char SHA")

    policy=load_policy()
    release=release_version()
    tracked=tracked_files()
    selected=[]
    excluded=[]
    required=set(policy.get("runtimeFiles",[])) | set(policy.get("opsFiles",[])) | set(policy.get("artifactSidecars",[]))

    for rel in tracked:
        if is_forbidden(rel,policy):
            excluded.append(rel)
            continue
        if is_selected(rel,policy):
            if not (ROOT/rel).is_file():
                raise SystemExit("selected path is not a regular file: "+rel)
            selected.append(rel)
        else:
            excluded.append(rel)

    missing=sorted(required-set(selected))
    if missing:
        raise SystemExit("required package sources missing: "+", ".join(missing))

    built_at=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    deployment={
        "schema":1,
        "gitSha":sha,
        "gitRef":args.git_ref,
        "assetVersion":release,
        "builtAt":built_at,
        "workflowRunId":str(args.workflow_run_id or ""),
    }
    deployment_bytes=(json.dumps(deployment,ensure_ascii=False,indent=2)+"\n").encode()
    readme_bytes=upload_readme(release,sha).encode()

    checksums={}
    payloads={}
    for rel in sorted(selected):
        data=(ROOT/rel).read_bytes()
        scan_content(rel,data,policy)
        payloads[rel]=data
        checksums[rel]=sha256_bytes(data)

    payloads["storage/deployment_manifest.json"]=deployment_bytes
    payloads["_SERVER_UPLOAD_README.md"]=readme_bytes
    checksums["storage/deployment_manifest.json"]=sha256_bytes(deployment_bytes)
    checksums["_SERVER_UPLOAD_README.md"]=sha256_bytes(readme_bytes)

    package_manifest={
        "schema":"kareta.server-package.v1",
        "release":release,
        "sourceSha":sha,
        "gitRef":args.git_ref,
        "builtAt":built_at,
        "workflowRunId":str(args.workflow_run_id or ""),
        "purpose":"server-test",
        "fileCount":len(checksums),
        "checksums":dict(sorted(checksums.items())),
        "excluded":sorted(excluded),
        "privateConfigIncluded":False,
    }
    package_manifest_bytes=(json.dumps(package_manifest,ensure_ascii=False,indent=2)+"\n").encode()
    payloads["_SERVER_PACKAGE_MANIFEST.json"]=package_manifest_bytes

    out=Path(args.output)
    out.parent.mkdir(parents=True,exist_ok=True)
    epoch=(1980,1,1,0,0,0)
    with zipfile.ZipFile(out,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zf:
        for rel in sorted(payloads):
            zi=zipfile.ZipInfo(rel,epoch)
            zi.compress_type=zipfile.ZIP_DEFLATED
            zi.external_attr=0o644<<16
            zf.writestr(zi,payloads[rel])

    print(json.dumps({
        "ok":True,
        "output":str(out),
        "release":release,
        "sourceSha":sha,
        "packageFiles":len(payloads),
        "zipSha256":sha256_file(out),
        "zipBytes":out.stat().st_size,
    },ensure_ascii=False))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
