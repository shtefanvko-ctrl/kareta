#!/usr/bin/env python3
"""Read-only exact-commit staging inventory; no file contents are printed."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

def run(repo, commit, webroot):
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("invalid exact SHA")
    if not webroot.is_dir() or webroot.is_symlink():
        raise ValueError("invalid staging root")
    kind = subprocess.check_output(["git", "-C", str(repo), "cat-file", "-t", commit], text=True).strip()
    if kind != "commit":
        raise ValueError("expected commit object")
    tree = subprocess.check_output(["git", "-C", str(repo), "ls-tree", "-rz", commit])
    counts = {"matched": 0, "different": 0, "missing": 0, "symlink": 0}
    for item in tree.split(b"\0"):
        if not item:
            continue
        meta, name = item.split(b"\t", 1)
        mode, kind, expected = meta.decode().split(" ")
        if kind != "blob":
            continue
        relative = name.decode("utf-8", "surrogateescape")
        path = webroot / relative
        if mode == "120000" or any(p.is_symlink() for p in [path, *path.parents] if p != webroot.parent):
            counts["symlink"] += 1
        elif not path.is_file():
            counts["missing"] += 1
        else:
            data = path.read_bytes()
            actual = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            counts["matched" if actual == expected else "different"] += 1
    status = "PASS" if counts["different"] + counts["missing"] + counts["symlink"] == 0 else "FAIL"
    print(json.dumps({"result": status, "commit": commit, "counts": counts}, sort_keys=True))
    return 0 if status == "PASS" else 1

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("repo", type=Path)
    p.add_argument("commit")
    p.add_argument("webroot", type=Path)
    a = p.parse_args()
    try:
        sys.exit(run(a.repo, a.commit, a.webroot))
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(json.dumps({"result": "ERROR", "reason": str(exc)}))
        sys.exit(2)
