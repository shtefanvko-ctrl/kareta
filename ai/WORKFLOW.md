# AI Work Workflow

Use this lifecycle for implementation work. It is intentionally model-agnostic.

## 1. Orient
Define the requested outcome in observable terms. Identify affected files/surfaces, constraints, current state, and whether the task is high-risk.

## 2. Inspect before change
Read the existing implementation and its direct dependencies. Search for existing helpers/contracts before creating alternatives. Never infer a test/build/deploy command that is not present.

## 3. Claim one change lane
Check `ai/SURFACE_MAP.json` and `ai/CHANGE_LANES.md`. If an active PR already owns the same contract, either stack explicitly on that PR or stop and report the conflict. Do not open a parallel competing implementation.

## 4. Plan the delta
For a non-trivial change, record:
- intended behavior;
- files/contracts expected to change;
- invariants that must remain true;
- verification to run;
- rollback/restore point for risky work.

Prefer the smallest coherent delta over broad cleanup.

## 5. Implement incrementally
Keep each change attributable to the task. Preserve public/API/data contracts unless explicitly changing them. Do not combine unrelated refactors with bug fixes.

## 6. Verify in layers
Use the strongest checks that actually exist for the affected surface, ideally in this order:
1. syntax/static validity;
2. focused unit/module checks;
3. integration/API checks;
4. browser/runtime smoke;
5. staging/deployment verification when required by DoD.

A missing check is not a PASS. Report it as an evidence gap and create the next executable action.

## 7. Inspect the result
Review the final diff for accidental scope expansion, dead code, duplicated logic, debug output, secret leakage, broken fallback behavior, and contract drift.

## 8. Evidence record
For completion/release-sensitive work, state:
- candidate branch/ref/SHA when available;
- checks actually executed and outcomes;
- checks not executed and why;
- runtime/staging evidence if required;
- known residual risk.

Status vocabulary follows `MB_MONITORING.md`: desired, implemented, verified, deployed are separate states.

## 9. Done gate
Use `DONE` only when the requested Definition of Done is met with required evidence. Otherwise use the most accurate state (for example IMPLEMENTED / NOT VERIFIED) and provide the next executable step.

## Regression rule
For every defect, record its trigger, call/data chain, violated contract, observable consequence and reproducer before claiming a root cause. Separate executed reproductions from source-only findings and hypotheses. Fix the smallest responsible boundary, then rerun the reproducer and a neighboring unaffected scenario. A missing product state machine is an implementation gap, not proof of a runtime exception.

If verification discovers a regression, stop expanding scope. Fix or revert the smallest responsible delta, rerun the failed check, then rerun the relevant regression checks.

## Reporting format
Keep progress reports decision-relevant:
- changed;
- verified;
- blocker/risk, if any;
- next step.

Do not bury an unverified state under optimistic wording.
