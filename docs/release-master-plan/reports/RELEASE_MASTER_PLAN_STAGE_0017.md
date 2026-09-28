# RELEASE MASTER PLAN — STAGE 0017

Baseline: `R188.5.5.6.84.109`

Task: Identity E2E suite.

Implemented:
- `tools/test_identity_e2e_84_109.js`;
- contract-only safe mode for normal release-gate execution;
- cookie-aware HTTP sessions for target/admin;
- lifecycle registration → login → upgrade → approval → context switch → logout → block;
- staging JSON evidence;
- fail-closed OTP and explicit reserved-phone requirements.
Validation:
- Node syntax: PASS.
- Identity E2E contract: PASS.
- Context switcher regression: PASS.
- Frontend role-authorization regression: PASS.
- staging runtime preflight: PASS, release `188.5.5.6.84.109`.
- full staging lifecycle: BLOCKED before mutation because reserved E2E admin/target identities are not configured in the runner environment.

No test account was created by the recorded staging run.
DOD status:

The automated lifecycle harness exists and is release-gated, but the DOD is not yet satisfied because the full lifecycle has not completed on staging.

Required to close:
1. Set `KARETA_E2E_ADMIN_PHONE` to an active reserved admin/owner test identity.
2. Set `KARETA_E2E_TARGET_PHONE` to a reserved unused test identity.
3. Re-run the staging command from `docs/architecture/IDENTITY_E2E_84_109.md`.
4. Require final report `status=PASS` with all lifecycle steps PASS.
