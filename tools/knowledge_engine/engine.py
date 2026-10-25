#!/usr/bin/env python3
"""KARETA Knowledge Engine v1: provenance-first memory and read-only project index.

This module never crawls the web, executes autonomous agents, reads credentials,
modifies KARETA business data, or deploys code. Independent staging E2E is gated.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit


REQUIRED = (
    "AGENTS.md",
    "ai/CONTEXT_ROUTER.md",
    "ai/SURFACE_MAP.json",
    "ai/VERIFICATION_GATES.md",
    "tools/test_identity_e2e_84_109.js",
)
MAX_FILES = 1500
MAX_BYTES = 256 * 1024


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def output(value: object) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def connect(db: Path, root: Path) -> sqlite3.Connection:
    db = db.expanduser().resolve()
    root = root.resolve()
    if db == root or root in db.parents:
        raise ValueError("database must be outside the project source tree")
    db.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not db.exists():
        fd = os.open(db, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    os.chmod(db, 0o600)
    cx = sqlite3.connect(db)
    cx.execute("PRAGMA busy_timeout=5000")
    cx.executescript("""
        CREATE TABLE IF NOT EXISTS project_files (
            path TEXT PRIMARY KEY,
            sha256 TEXT NOT NULL,
            bytes INTEGER NOT NULL,
            scanned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            claim TEXT NOT NULL,
            source_url TEXT NOT NULL,
            evidence TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'candidate'
                CHECK (status IN ('candidate','verified','rejected')),
            reviewer TEXT,
            review_note TEXT,
            created_at TEXT NOT NULL,
            reviewed_at TEXT,
            UNIQUE(topic,claim,source_url)
        );
        CREATE INDEX IF NOT EXISTS ix_facts_topic ON facts(topic,status);
        CREATE TABLE IF NOT EXISTS research_questions (
            topic TEXT NOT NULL,
            question TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            created_at TEXT NOT NULL,
            PRIMARY KEY(topic,question)
        );
        CREATE TABLE IF NOT EXISTS gate_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gate TEXT NOT NULL,
            status TEXT NOT NULL,
            details TEXT NOT NULL,
            run_at TEXT NOT NULL
        );
    """)
    cx.commit()
    return cx


def allowed_files(root: Path):
    # Explicit, bounded allowlist. Never read .env, config.php, git internals,
    # private assets, DB dumps, upload folders, or user content.
    candidates = [root / "AGENTS.md", root / "ai" / "SURFACE_MAP.json"]
    for directory, globs in (
        ("ai", ("*.md", "rules/*.md")),
        (".github/workflows", ("*.yml", "*.yaml")),
        ("tools/repair_knowledge", ("README*.md",)),
        ("tools", ("test_*.js",)),
    ):
        base = root / directory
        if base.is_symlink():
            continue
        for pattern in globs:
            candidates.extend(base.glob(pattern))
    selected = {}
    for file in candidates:
        if not file.is_file() or file.is_symlink():
            continue
        real = file.resolve()
        if root not in real.parents:
            continue
        rel = real.relative_to(root).as_posix()
        if real.stat().st_size > MAX_BYTES:
            continue
        selected[rel] = real
    if len(selected) > MAX_FILES:
        raise ValueError("project index file limit exceeded")
    return sorted(selected.items())


def scan(cx: sqlite3.Connection, root: Path) -> dict:
    if not root.is_dir():
        raise ValueError("project root is missing")
    files = allowed_files(root)
    stamp = now()
    rows = []
    for rel, path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        rows.append((rel, digest, path.stat().st_size, stamp))
    with cx:
        cx.execute("DELETE FROM project_files")
        cx.executemany(
            "INSERT INTO project_files(path,sha256,bytes,scanned_at) VALUES(?,?,?,?)",
            rows,
        )
    indexed = {row[0] for row in rows}
    return {
        "status": "PASS" if all(p in indexed for p in REQUIRED) else "FAIL",
        "indexed": len(rows),
        "missing_required": [p for p in REQUIRED if p not in indexed],
        "stored_content": False,
        "root": str(root),
    }


def questions(topic: str) -> list[str]:
    topic = topic.strip()
    if not topic or len(topic) > 160:
        raise ValueError("topic must be 1..160 characters")
    return [
        f"Что представляет собой {topic} и с какими узлами связан?",
        f"Каково устройство и основные детали: {topic}?",
        f"Какие неисправности и симптомы характерны для: {topic}?",
        f"Как безопасно диагностировать: {topic}?",
        f"Каковы проверяемые этапы ремонта: {topic}?",
        f"Какие инструменты и запчасти требуются для: {topic}?",
        f"Как подтвердить качество ремонта: {topic}?",
        f"Есть ли услуга, поиск и оформление заявки по теме «{topic}» в KARETA?",
    ]


def plan(cx: sqlite3.Connection, topic: str) -> dict:
    items = questions(topic)
    with cx:
        cx.executemany(
            "INSERT OR IGNORE INTO research_questions(topic,question,created_at) VALUES(?,?,?)",
            [(topic.strip(), q, now()) for q in items],
        )
    return {
        "topic": topic.strip(),
        "status": "QUEUED_NOT_RESEARCHED",
        "questions": items,
        "internet_search_executed": False,
    }


def record(cx: sqlite3.Connection, topic: str, claim: str, source: str, evidence: str) -> dict:
    parsed = urlsplit(source)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("source must be an HTTPS URL without embedded credentials")
    if not topic.strip() or not claim.strip() or not evidence.strip():
        raise ValueError("topic, claim, and source evidence are required")
    if any(len(value) > maxlen for value, maxlen in ((topic, 160), (claim, 1000), (evidence, 1000), (source, 2048))):
        raise ValueError("input exceeds allowed length")
    with cx:
        cx.execute(
            """INSERT OR IGNORE INTO facts
               (topic,claim,source_url,evidence,created_at)
               VALUES(?,?,?,?,?)""",
            (topic.strip(), claim.strip(), source, evidence.strip(), now()),
        )
    row = cx.execute(
        "SELECT id,status FROM facts WHERE topic=? AND claim=? AND source_url=?",
        (topic.strip(), claim.strip(), source),
    ).fetchone()
    return {"id": row[0], "status": row[1], "verified": False}


def review(cx: sqlite3.Connection, fact_id: int, decision: str, reviewer: str, note: str) -> dict:
    if decision not in ("verified", "rejected"):
        raise ValueError("decision must be verified or rejected")
    if not reviewer.strip() or not note.strip():
        raise ValueError("named reviewer and supporting review note are required")
    row = cx.execute("SELECT id FROM facts WHERE id=?", (fact_id,)).fetchone()
    if not row:
        raise ValueError("fact not found")
    with cx:
        cx.execute(
            """UPDATE facts SET status=?,reviewer=?,review_note=?,reviewed_at=?
               WHERE id=?""",
            (decision, reviewer.strip()[:100], note.strip()[:1000], now(), fact_id),
        )
    return {"id": fact_id, "status": decision, "reviewed": True}


def lookup(cx: sqlite3.Connection, term: str, include_candidates: bool) -> dict:
    if not term.strip():
        raise ValueError("search term required")
    sql = """SELECT id,topic,claim,source_url,evidence,status,reviewer
             FROM facts WHERE (topic LIKE ? OR claim LIKE ?)"""
    params = [f"%{term}%", f"%{term}%"]
    if not include_candidates:
        sql += " AND status='verified'"
    sql += " ORDER BY CASE WHEN status='verified' THEN 0 ELSE 1 END,id DESC LIMIT 30"
    keys = ["id","topic","claim","source","evidence","status","reviewer"]
    return {"results": [dict(zip(keys, row)) for row in cx.execute(sql, params)],
            "verified_only": not include_candidates}


def contract_gate(cx: sqlite3.Connection, root: Path) -> dict:
    test = root / "tools/test_identity_e2e_84_109.js"
    prerequisites = (
        "tools/test_identity_e2e_84_109.js",
        "api/auth_session.php",
        "api/context.php",
        "api/domains/identity_admin.php",
        "api/identity/challenge_service.php",
    )
    missing = [name for name in prerequisites if not (root / name).is_file()]
    if missing or test.is_symlink():
        reason = "missing prerequisites: " + ", ".join(missing) if missing else "test file is a symlink"
        result = {"gate": "identity_contract", "status": "BLOCKED", "details": reason}
    else:
        try:
            run = subprocess.run(
                ["node", str(test), "--contract-only"],
                cwd=str(root), capture_output=True, text=True, timeout=20, check=False,
                env={"PATH": os.environ.get("PATH", "/usr/bin:/bin")},
            )
            result = {"gate": "identity_contract",
                      "status": "PASS" if run.returncode == 0 and "IDENTITY_E2E_CONTRACT_84_109: PASS" in run.stdout else "FAIL",
                      "details": (run.stdout + run.stderr)[-600:]}
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            result = {"gate": "identity_contract", "status": "BLOCKED", "details": type(exc).__name__}
    with cx:
        cx.execute("INSERT INTO gate_runs(gate,status,details,run_at) VALUES(?,?,?,?)",
                   (result["gate"], result["status"], result["details"], now()))
    result["mode"] = "source-contract-only"
    result["browser_e2e"] = "NOT RUN"
    result["staging_order_creation"] = "NOT RUN"
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--db", type=Path,
                        default=Path.home() / ".local/share/kareta/project_knowledge.sqlite3")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("scan")
    p = sub.add_parser("plan")
    p.add_argument("--topic", required=True)
    p = sub.add_parser("record")
    p.add_argument("--topic", required=True)
    p.add_argument("--claim", required=True)
    p.add_argument("--source", required=True)
    p.add_argument("--evidence", required=True)
    p = sub.add_parser("review")
    p.add_argument("--id", type=int, required=True)
    p.add_argument("--decision", choices=("verified", "rejected"), required=True)
    p.add_argument("--reviewer", required=True)
    p.add_argument("--note", required=True)
    p = sub.add_parser("lookup")
    p.add_argument("--term", required=True)
    p.add_argument("--include-candidates", action="store_true")
    sub.add_parser("contract-gate")
    sub.add_parser("status")
    args = parser.parse_args(argv)
    root = args.root.expanduser().resolve()
    try:
        with connect(args.db, root) as cx:
            if args.command == "scan":
                result = scan(cx, root)
            elif args.command == "plan":
                result = plan(cx, args.topic)
            elif args.command == "record":
                result = record(cx, args.topic, args.claim, args.source, args.evidence)
            elif args.command == "review":
                result = review(cx, args.id, args.decision, args.reviewer, args.note)
            elif args.command == "lookup":
                result = lookup(cx, args.term, args.include_candidates)
            elif args.command == "contract-gate":
                result = contract_gate(cx, root)
            else:
                result = {
                    "indexed_files": cx.execute("SELECT count(*) FROM project_files").fetchone()[0],
                    "facts": dict(cx.execute("SELECT status,count(*) FROM facts GROUP BY status")),
                    "queued_questions": cx.execute("SELECT count(*) FROM research_questions").fetchone()[0],
                    "gates": [dict(zip(("gate","status","run_at"), row)) for row in cx.execute(
                        "SELECT gate,status,run_at FROM gate_runs ORDER BY id DESC LIMIT 5")],
                }
        output(result)
        return 1 if result.get("status") == "FAIL" else 0
    except (ValueError, OSError, sqlite3.Error) as exc:
        output({"status": "BLOCKED", "error": str(exc)})
        return 2


if __name__ == "__main__":
    sys.exit(main())
