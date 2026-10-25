#!/usr/bin/env python3
"""Hermetic tests: no external sites, DB connections, agents, or production data."""
import tempfile
from pathlib import Path
import unittest

from engine import connect, scan, plan, record, review, lookup, questions, allowed_files


class EngineTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.root = self.home / "project"
        self.root.mkdir()
        (self.root / "ai").mkdir()
        (self.root / "tools").mkdir()
        (self.root / "AGENTS.md").write_text("governance", encoding="utf-8")
        (self.root / "ai" / "CONTEXT_ROUTER.md").write_text("router", encoding="utf-8")
        (self.root / "ai" / "SURFACE_MAP.json").write_text("{}", encoding="utf-8")
        (self.root / "ai" / "VERIFICATION_GATES.md").write_text("gates", encoding="utf-8")
        (self.root / "tools" / "test_identity_e2e_84_109.js").write_text("// test", encoding="utf-8")
        self.db = self.home / "data" / "kb.sqlite3"
        self.cx = connect(self.db, self.root)
        self.addCleanup(self.cx.close)

    def test_scan_never_copies_source_or_secrets(self):
        (self.root / ".env").write_text("SECRET=should-never-index", encoding="utf-8")
        (self.root / "config.php").write_text("secret", encoding="utf-8")
        (self.root / "ai" / "private.md").symlink_to(self.root / ".env")
        result = scan(self.cx, self.root)
        self.assertEqual(result["status"], "PASS")
        paths = [x[0] for x in self.cx.execute("SELECT path FROM project_files")]
        self.assertNotIn(".env", paths)
        self.assertNotIn("config.php", paths)
        self.assertNotIn("ai/private.md", paths)
        self.assertTrue(all("content" not in c[1] for c in self.cx.execute("PRAGMA table_info(project_files)")))

    def test_research_is_queue_only_and_idempotent(self):
        first = plan(self.cx, "ремонт стартера")
        second = plan(self.cx, "ремонт стартера")
        self.assertEqual(first["status"], "QUEUED_NOT_RESEARCHED")
        self.assertFalse(second["internet_search_executed"])
        self.assertEqual(len(questions("ремонт стартера")), 8)
        self.assertEqual(self.cx.execute("SELECT COUNT(*) FROM research_questions").fetchone()[0], 8)

    def test_facts_require_human_review_for_default_lookup(self):
        data = dict(topic="стартер", claim="Подтверждать измерением",
                    source="https://example.org/manual", evidence="manual section A")
        f = record(self.cx, **data)
        self.assertEqual(f["status"], "candidate")
        self.assertFalse(lookup(self.cx, "стартер", False)["results"])
        self.assertEqual(len(lookup(self.cx, "стартер", True)["results"]), 1)
        result = review(self.cx, f["id"], "verified", "qa-reviewer", "checked manual section A")
        self.assertEqual(result["status"], "verified")
        self.assertEqual(len(lookup(self.cx, "стартер", False)["results"]), 1)

    def test_source_restrictions(self):
        for url in ("file:///etc/passwd", "http://example.org", "https://u:p@example.org/manual"):
            with self.assertRaises(ValueError):
                record(self.cx, "x", "y", url, "evidence")

    def test_db_must_not_live_inside_project(self):
        with self.assertRaises(ValueError):
            connect(self.root / "knowledge.db", self.root)

    def test_contract_gate_fails_closed_without_test_file(self):
        from engine import contract_gate
        (self.root / "tools" / "test_identity_e2e_84_109.js").unlink()
        r = contract_gate(self.cx, self.root)
        self.assertEqual(r["status"], "BLOCKED")
        self.assertEqual(r["browser_e2e"], "NOT RUN")


if __name__ == "__main__":
    unittest.main()
