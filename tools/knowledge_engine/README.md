# KARETA Knowledge Engine — v1 (safe foundation)

This **does not claim autonomous learning or complete E2E**. It is a small auditable building block for Hermes → AI Core → Harness/Scion. It does **not** start sleeping agents or change live routing.

## Responsibilities
- `scan`: read-only, bounded inventory of allowlisted repository files; stores paths, SHA-256 digests, sizes only. Skips symlinks, secrets, configuration, uploads and large files. Detects missing project governance / identity test files.
- `plan --topic "ремонт стартера"`: creates eight idempotent research questions, not claims of internet search.
- `record`: stores sourced claims as **candidates**, never automatically verified.
- `review`: reviewer explicitly verifies/rejects claims with a review note.
- `lookup`: returns **verified only** by default; candidates require an explicit flag and are labelled.
- `contract-gate`: runs the existing identity source-contract test in a constrained subprocess. This is **not** a browser or business E2E run.

Uses SQLite under `~/.local/share/kareta/project_knowledge.sqlite3`, separate from the operational MySQL, Hermes history, and existing automotive corpus. SQLite file is mode 0600. No dependency installation, external HTTP fetches, model calls, Docker operations, or writes to production.

## Local verification
```bash
python3 tools/knowledge_engine/test_engine.py
python3 tools/knowledge_engine/engine.py scan
python3 tools/knowledge_engine/engine.py plan --topic "ремонт стартера"
python3 tools/knowledge_engine/engine.py contract-gate
python3 tools/knowledge_engine/engine.py status
```
For sandbox verification, use `--db /tmp/..../knowledge.sqlite3` (outside project root).

## Next integration gates
1. Restore Scion agent health and validate harness configurations through the proper Hub interface; keep failing agents inactive.
2. Connect AI Core's authenticated request router to bounded research queue; search sources only using domain policies, rate limits, provenance and clear trust ratings.
3. Bridge approved source facts to the **existing** `tools/repair_knowledge` automotive index; do not duplicate or mix facts with KARETA transactional records.
4. Build isolated staging accounts and seed/cleanup fixtures, then run real browser journeys: client registration → order → exchange → master acceptance → status change → notifications. Capture screenshots and API traces. Never aim mutations at production.
5. Require sandbox diff, explicit scoped approval and regression tests before any autonomous edit; production deployment remains separately authorized.

### Status semantics
`PASS`: a named gate ran and passed; `FAIL`: ran and failed;
`BLOCKED`: a required condition is absent; `NOT RUN`: no execution.
Historical E2E pass records are **not** evidence for this candidate. The current
main-branch identity contract runner references `api/domains/identity_admin.php`,
which is absent at that ref; the wrapper reports `BLOCKED` with that exact
missing dependency instead of silently treating the run as `PASS`.
