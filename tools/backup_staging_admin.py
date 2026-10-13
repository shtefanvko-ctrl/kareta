#!/usr/bin/env python3
"""Run manually with sudo in Ubuntu; back up staging config and database only."""
import os, pathlib, subprocess, json, tempfile, shutil, gzip, hashlib, datetime
if os.geteuid() != 0:
    raise SystemExit("Run this script manually with sudo in Ubuntu.")
os.umask(0o077)
site = pathlib.Path("/home/karetakz/sites/s.kareta.kz")
base = pathlib.Path("/home/karetakz/kareta-staging-backups")
dest = base / ("admin-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S"))
dest.mkdir(mode=0o700, exist_ok=False)
try:
    # Load configuration only, never bootstrap.php or a migration entrypoint.
    php = "require '/home/karetakz/sites/s.kareta.kz/config.php'; echo json_encode(KARETA_DB, JSON_THROW_ON_ERROR);"
    loaded = subprocess.run(["php", "-r", php], capture_output=True, check=True)
    db = json.loads(loaded.stdout)
    if not db.get("database") or not db.get("username"):
        raise RuntimeError("Missing database configuration")
    shutil.copyfile(site / "config.private.php", dest / "config.private.php")
    shutil.copyfile(site / "config.php", dest / "config.php")
    def quote(value):
        return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r") + '"'
    options = {"user": db["username"], "password": db.get("password", ""),
               "host": db.get("host", "127.0.0.1"), "port": db.get("port", 3306)}
    if db.get("socket"):
        options["socket"] = db["socket"]
    with tempfile.TemporaryDirectory(prefix="kareta-db-", dir=dest) as tmp:
        cnf = pathlib.Path(tmp) / "client.cnf"
        cnf.write_text("[client]\n" + "".join(k + "=" + quote(v) + "\n" for k,v in options.items()))
        dump = dest / "database.sql.partial"
        with dump.open("wb") as out:
            result = subprocess.run(["mysqldump", "--defaults-extra-file=" + str(cnf),
                "--single-transaction", "--quick", "--skip-lock-tables", "--no-tablespaces",
                "--triggers", "--hex-blob", "--databases", db["database"]],
                stdout=out, stderr=subprocess.PIPE)
        if result.returncode or dump.stat().st_size == 0:
            raise RuntimeError("Database dump failed; partial backup must not be used")
        with dump.open("rb") as inp, gzip.open(dest / "database.sql.gz", "wb") as out:
            shutil.copyfileobj(inp, out)
        dump.unlink()
    # Read the entire stream to verify gzip CRC and truncation.
    with gzip.open(dest / "database.sql.gz", "rb") as inp:
        while inp.read(1024 * 1024):
            pass
    hashes = {}
    for name in ("config.private.php", "config.php", "database.sql.gz"):
        with (dest / name).open("rb") as inp:
            hashes[name] = hashlib.file_digest(inp, "sha256").hexdigest()
    report = {"status": "BACKUP_CREATED", "path": str(dest), "sha256": hashes,
              "restore_test": "NOT_RUN",
              "scope": "staging config and database; routines/events not included"}
    (dest / "report.json").write_text(json.dumps(report, indent=2))
    print("BACKUP_CREATED: " + str(dest))
    print("Archive integrity checked. Restore test not run. Website unchanged.")
except Exception:
    print("BACKUP_FAILED: " + str(dest))
    print("Do not use this directory as a complete backup. Website unchanged.")
    raise SystemExit(1)
