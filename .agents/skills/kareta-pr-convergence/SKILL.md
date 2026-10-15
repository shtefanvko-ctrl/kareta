---
name: kareta-pr-convergence
description: Reconcile KARETA branches and PRs while preserving valid features and avoiding blind merges.
version: 1.0.0
---
# Procedure
- Verify base/head ancestry and merge-base.
- Compare semantic file changes, not only commit counts.
- Classify each source slice as PRESERVED, TRANSFERABLE, CONFLICTING, SUPERSEDED, or OBSOLETE.
- Prefer isolated transfers over whole-branch merge for divergent historical work.
- Never resurrect conflicting migration numbers or stale release metadata.
- Prove preservation with exact files/tests before retiring a source branch.
