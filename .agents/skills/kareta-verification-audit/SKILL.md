---
name: kareta-verification-audit
description: Audit whether a KARETA change is truly verified on the exact candidate.
version: 1.0.0
---
# Evidence model
DESIRED != IMPLEMENTED != VERIFIED != DEPLOYED.

# Audit
- Bind evidence to exact SHA.
- Inspect workflow conclusions and failed-step logs.
- Confirm focused regressions actually cover changed contracts.
- Check changed-file list for release, migration, provenance, lazy-route, auth, and DB drift.
- Invalidate old PASS evidence after HEAD changes.
- Never infer staging or deployment from repository CI.
