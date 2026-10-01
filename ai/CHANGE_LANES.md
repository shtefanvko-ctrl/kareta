# KARETA Change Lanes

Purpose: stop parallel agents and PRs from implementing the same shared contract in incompatible ways.

## One canonical implementation lane per shared contract
Before opening or implementing a PR, identify the primary surface in `ai/SURFACE_MAP.json` and inspect open PRs touching the same files/contracts.

If another active PR already owns the contract:
1. stack explicitly on its head when there is a real dependency; or
2. contribute the delta to that lane; or
3. stop and report the conflict.

Do not create a competing implementation from `main` and resolve it later by guesswork.

## Stacked PR requirements
A stacked PR states its actual base PR/branch, net files relative to that base, merge order and recovery if the base changes. Scope is defined by the actual GitHub diff, not prose in the PR body.

## Shared-contract serialization
Serialize changes to:
- route registry / route asset loader / asset manifest / service worker;
- auth / identity / capabilities;
- DB schema / migrations;
- product identity / seller order contracts;
- release/version/provenance endpoints;
- native bridge contract.

Independent page copy/style work may proceed in parallel when it does not touch shared runtime contracts.

## Merge readiness
Required checks for the exact candidate must be PASS and dependency PRs resolved. NOT RUN or BLOCKED is not PASS.
