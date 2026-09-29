# MB Monitor Contract

## Purpose

MB monitoring is not a passive alert feed. Its purpose is to keep the project on one coherent, current engineering line without losing useful work that appears ahead of, beside, or outside the currently executed plan.

## Material-change rule

A change is material when it can affect any of the following:
- project rules or engineering contracts;
- approved plan or current priority;
- changelog or release state;
- open/closed issue status or acceptance criteria;
- Definition of Done;
- next step;
- architecture, data ownership, security, migration, deployment, or verification contracts.

Cosmetic or context-only changes are ignored unless they alter one of the contracts above.

## Soft integration rule

When MB discovers an existing change that the active work has not reached yet, do not automatically discard it, overwrite it, or treat it as foreign.

1. Establish provenance: identify the branch/commit/file/issue/PR and the exact delta.
2. Evaluate importance: determine whether the change is still valid for the current product, architecture, plan, and DoD.
3. Check overlap and conflict: compare it with the current canonical line and identify duplicated, superseded, conflicting, or complementary behavior.
4. Preserve before transforming: keep the original source reachable until the integration is verified. Avoid destructive force-push or deletion as the first action.
5. Integrate valuable work into the current canonical line rather than maintaining parallel truths. Prefer the smallest ancestry-safe merge, rebase/cherry-pick, or file-level reconstruction that preserves current behavior.
6. Resolve semantic conflicts, not only Git conflicts. The newer commit is not automatically correct; the accepted project rule and current product invariant decide the result.
7. Verify after integration with the relevant regression/CI/contract checks. If the change affects release or deployment behavior, distinguish implemented, verified, and deployed state.
8. Update the plan/changelog/issues/DoD/next step so all project control documents describe the same resulting state.
9. Only after equivalence and regression safety are proven may obsolete parallel branches or duplicate artifacts be retired.

## Singularity principle

The target state is one coherent source of truth, not a collection of competing branches, documents, or partial implementations. Useful work discovered anywhere should converge into that source of truth when it remains valid. Invalid or superseded work should remain traceable long enough to explain why it was not integrated.

## Reporting format

For every material MB event, report only:
- what changed;
- why it matters;
- whether it is complementary, conflicting, duplicated, or superseded;
- what was preserved;
- what was integrated or intentionally rejected;
- what concrete action or next step this creates.

## Safety constraints

- No destructive rewrite before comparison.
- No silent loss of unique behavior or evidence.
- No merge solely because code is newer.
- No parallel long-lived source of truth when a safe convergence path exists.
- No claim of DONE until the required verification for the affected contract has passed.
