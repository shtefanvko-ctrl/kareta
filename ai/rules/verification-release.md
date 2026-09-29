# Verification and Release Rules

Load this file for PASS/DONE decisions, regression checks, release/staging/deployment work, monitoring, or status reporting.

`MB_MONITORING.md` is the authoritative project contract for material-change monitoring, baseline semantics, evidence priority, and KARETA release/verification binding. This file does not duplicate it.

For executable gate selection and PASS/FAIL interpretation, load `ai/VERIFICATION_GATES.md`.

## Evidence ladder
Prefer evidence tied to the exact candidate, strongest first:
1. required automated checks for the affected surface;
2. focused runtime/integration evidence;
3. staging evidence for the exact candidate/release;
4. deployment evidence where deployment is part of DoD.

A commit, PR description, screenshot, changelog entry, endpoint existence, or visually correct UI is supporting information, not a substitute for a required gate.

## PASS semantics
- PASS: the named gate actually ran and passed for the relevant candidate.
- NOT RUN: no result exists; never translate this to PASS.
- BLOCKED: the gate cannot run because a concrete dependency is missing.
- FAIL: the gate ran and failed; preserve the failure evidence until resolved.

## Candidate identity
For release-sensitive work, bind evidence to a branch/ref/SHA/release identifier when available. Do not reuse evidence from a different candidate without proving equivalence.

## Regression scope
Verification must cover the changed path and, when a shared contract is touched, at least one representative unaffected/compatibility path. Security-sensitive work should include a relevant negative path when executable.

## State reporting
Never collapse these states:
- desired — intended/approved state;
- implemented — code/config exists;
- verified — required evidence passed;
- deployed — verified candidate is present on target.

Use the highest state actually supported by evidence.

## Missing automation
If an important invariant is currently prose-only, do not invent a check. Record the evidence gap and prefer converting it into an executable CI/runtime gate as a subsequent change.
