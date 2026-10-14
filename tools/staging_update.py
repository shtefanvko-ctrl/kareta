#!/usr/bin/env python3
"""Staging-only incremental deployment. Usage: check|apply BASE_SHA TARGET_SHA."""
import fcntl, hashlib, json, os, pathlib, re, subprocess, sys, tempfile, time, urllib.request
REPO = pathlib.Path(__file__).resolve().parents[1]
SITE = pathlib.Path("/home/karetakz/sites/s.kareta.kz")
BACKUPS = pathlib.Path("/home/karetakz/kareta-staging-backups/git-deploy")
ROOTS = {"api", "inc", "js", "css", "assets", "schemas", "scripts"}
FILES = {"index.php", "sw.js", "asset_manifest.php", "manifest.json", "booking.php"}
BLOCKED = {"api/bootstrap.php", "api/migration_manifest.php", "api/migration_manifest.json"}
def git(*args):
    return subprocess.check_output(["git", "-C", str(REPO), *args])
def sha(ref):
    if not re.fullmatch(r"[0-9a-f]{7,40}", ref):
        raise RuntimeError("Use an explicit commit SHA")
    return git("rev-parse", "--verify", ref + "^{commit}").decode().strip()
def allowed(name):
    p = pathlib.PurePosixPath(name)
    return (not p.is_absolute() and ".." not in p.parts
        and not any(x.startswith(".") for x in p.parts)
        and (p.parts[0] in ROOTS or name in FILES)
        and not re.search(r"(?i)(private|credential|secret|\.bak$|\.log$|\.sql$)", name)
        and p.parts[:2] != ("assets", "preview"))
def path_for(name):
    p = SITE / name
    if p.is_symlink() or any(x.is_symlink() for x in p.parents if x != SITE.parent):
        raise RuntimeError("Symlink target refused: " + name)
    if not p.resolve().is_relative_to(SITE.resolve()):
        raise RuntimeError("Path outside staging")
    return p
def blob(ref, name):
    x = subprocess.run(["git", "-C", str(REPO), "show", ref + ":" + name], capture_output=True)
    if x.returncode:
        raise RuntimeError("Missing Git file: " + name)
    mode = git("ls-tree", ref, "--", name).split()[0]
    if mode not in (b"100644", b"100755"):
        raise RuntimeError("Nonregular Git file refused")
    return x.stdout
def atomic(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".kareta-deploy-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
def health_once(expected_sha=None):
    results = {}
    for route in ("/api/readiness.php", "/api/runtime_health.php"):
        req = urllib.request.Request("http://127.0.0.1:8081" + route, headers={"Host":"s.kareta.kz"})
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.load(response)
        if data.get("ok") is not True or data.get("status") != "ready":
            raise RuntimeError("Health check failed: " + route)
        results[route] = data.get("assetVersion", data.get("version"))
    if len(set(results.values())) != 1:
        raise RuntimeError("Runtime release mismatch")
    if expected_sha:
        request = urllib.request.Request("http://127.0.0.1:8081/api/provenance.php", headers={"Host":"s.kareta.kz"})
        with urllib.request.urlopen(request, timeout=15) as response:
            provenance = json.load(response)
        if (provenance.get("ok") is not True or provenance.get("status") != "provenance_ready"
            or provenance.get("gitSha") != expected_sha
            or provenance.get("assetVersion") != next(iter(results.values()))):
            raise RuntimeError("Runtime provenance mismatch")
        results["gitSha"] = expected_sha
    return results
def health(expected_sha=None):
    for attempt in range(10):
        try:
            return health_once(expected_sha)
        except (RuntimeError, OSError, ValueError):
            if attempt == 9:
                raise
            time.sleep(0.5)
def version_at(ref):
    source = blob(ref, "inc/asset_version.php").decode()
    match = re.search(r"const\s+KARETA_ASSET_VERSION\s*=\s*['\"]([^'\"]+)['\"]", source)
    if not match:
        raise RuntimeError("Asset version constant missing")
    return match.group(1)
def provenance_change(base, target):
    name = "storage/deployment_manifest.json"
    path = path_for(name)
    old = path.read_bytes()
    previous = json.loads(old)
    if previous.get("gitSha") != base or previous.get("assetVersion") != version_at(base):
        raise RuntimeError("Stored provenance does not match the base")
    ref = git("rev-parse", "--abbrev-ref", "HEAD").decode().strip()
    manifest = {"schema":1, "gitSha":target, "gitRef":ref,
        "assetVersion":version_at(target), "builtAt":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "workflowRunId":""}
    return (name, old, (json.dumps(manifest, indent=2)+"\n").encode(), path.stat().st_mode & 0o777)
def plan(base, target):
    changes = []
    for line in git("diff", "--no-renames", "--name-status", base, target).decode().splitlines():
        status, name = line.split("\t", 1)
        if not allowed(name):
            if name in ("config.php", "config.private.php") or name.startswith(("storage/", "media/")):
                raise RuntimeError("Protected runtime path: " + name)
            continue  # Repository documentation/tools are not public application files.
        if status not in ("A", "M"):
            raise RuntimeError("Deletion/type change needs manual review: " + name)
        if name in BLOCKED or name.startswith(("api/migrations/", "schemas/")):
            raise RuntimeError("Database contract needs a separate reviewed deployment: " + name)
        p = path_for(name)
        old = blob(base, name) if status == "M" else None
        current = p.read_bytes() if p.exists() else None
        if current != old:
            raise RuntimeError("Live changes would be overwritten: " + name)
        new = blob(target, name)
        changes.append((name, old, new, p.stat().st_mode & 0o777 if p.exists() else 0o644))
    if changes:
        version = "inc/asset_version.php"
        if not any(n == version for n, *_ in changes):
            raise RuntimeError("A changed application needs an explicit asset version bump")
        with tempfile.TemporaryDirectory(prefix="kareta-preflight-") as tmp:
            for name, _, data, _ in changes:
                p = pathlib.Path(tmp) / pathlib.Path(name).name
                p.write_bytes(data)
                cmd = ["php", "-l", str(p)] if p.suffix == ".php" else ["node", "--check", str(p)] if p.suffix == ".js" else None
                if cmd:
                    x = subprocess.run(cmd, capture_output=True)
                    if x.returncode: raise RuntimeError("Syntax check failed: " + name)
                elif p.suffix == ".json":
                    json.loads(data)
    return changes
def deploy(base, target, apply=False):
    changes = plan(base, target)
    before = health(base)
    if not changes:
        return {"status":"NO_RUNTIME_CHANGES", "base":base, "target":target, "health":before}
    changes.append(provenance_change(base, target))
    if not apply:
        return {"status":"PREFLIGHT_PASS", "files":[x[0] for x in changes], "health":before}
    folder = BACKUPS / (time.strftime("%Y%m%d-%H%M%S") + "-" + target[:12])
    folder.mkdir(mode=0o700, exist_ok=False)
    record = {"base":base, "target":target, "status":"PREPARED", "files":[]}
    for name, old, new, mode in changes:
        if old is not None:
            atomic(folder / "files" / name, old, 0o600)
        record["files"].append({"path":name, "existed":old is not None, "mode":mode,
            "old_sha256":hashlib.sha256(old).hexdigest() if old is not None else None,
            "new_sha256":hashlib.sha256(new).hexdigest()})
    atomic(folder / "report.json", json.dumps(record, indent=2).encode(), 0o600)
    written = []
    try:
        for name, old, new, mode in changes:
            p = path_for(name)
            if (p.read_bytes() if p.exists() else None) != old:
                raise RuntimeError("Concurrent change detected: " + name)
            atomic(p, new, mode); written.append((name, old, new, mode))
        record["health"] = health(target)
        for name, _, new, _ in changes:
            if path_for(name).read_bytes() != new: raise RuntimeError("Readback mismatch")
        record["status"] = "DEPLOYED_CODE_ONLY"
    except Exception:
        conflicts = []
        for name, old, new, mode in reversed(written):
            p = path_for(name)
            if not p.exists() or p.read_bytes() != new:
                conflicts.append(name); continue
            if old is None: p.unlink()
            else: atomic(p, old, mode)
        record["status"] = "ROLLBACK_CONFLICT" if conflicts else "ROLLED_BACK"
        record["conflicts"] = conflicts
        atomic(folder / "report.json", json.dumps(record, indent=2).encode(), 0o600)
        raise RuntimeError(record["status"] + ": " + str(folder))
    atomic(folder / "report.json", json.dumps(record, indent=2).encode(), 0o600)
    return {"status":record["status"], "backup":str(folder), "files":len(changes), "health":record["health"]}
def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ("check", "apply"):
        raise SystemExit("Usage: staging_update.py check|apply BASE_SHA TARGET_SHA")
    os.umask(0o077)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    with (BACKUPS / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        print(json.dumps(deploy(sha(sys.argv[2]), sha(sys.argv[3]), sys.argv[1]=="apply"), indent=2))
if __name__ == "__main__":
    try: main()
    except Exception as e:
        print("DEPLOY_STOPPED: " + str(e), file=sys.stderr); sys.exit(1)
