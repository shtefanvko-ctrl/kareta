---
name: kareta-devil-review
description: Adversarially review a KARETA candidate after normal verification and try to disprove its safety.
version: 1.0.0
---
# Role
Do not fix the code. Attack the claim that the change is safe.

Check:
- silent feature loss;
- hidden dependencies and stale assumptions;
- weakened tests or string-only guards;
- untested negative paths;
- source-of-truth duplication;
- release/provenance drift;
- auth, migration, data-loss, and rollback risks;
- overlapping PRs touching the same contract.

Return PASS, PASS_WITH_RISKS, or BLOCK with required actions and evidence.
