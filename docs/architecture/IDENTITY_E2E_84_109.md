# Identity E2E — R188.5.5.6.84.109

## Scope

`tools/test_identity_e2e_84_109.js` automates the Identity lifecycle required by release Stage 17:

`registration → login → upgrade → approval → context switch → logout → block`.

The suite uses public application APIs and a separate admin session. It does not add a staging-only HTTP backdoor.
## Safety contract

- Running the script without `--base-url` or `KARETA_E2E_BASE_URL` performs contract-only checks and does not mutate data.
- A real E2E run requires both `KARETA_E2E_ADMIN_PHONE` and `KARETA_E2E_TARGET_PHONE` (or matching CLI arguments).
- The two phones must be explicitly reserved test identities and must differ.
- OTP must report `testMode=true`; otherwise the suite stops before using a real SMS transport.
- OTP codes and the admin phone are never written to the JSON report.
- The final target-account state is blocked, matching the last lifecycle assertion.
## Staging command

PowerShell:

```powershell
$env:KARETA_E2E_BASE_URL='https://s.kareta.kz'
$env:KARETA_E2E_ADMIN_PHONE='<reserved-admin-test-phone>'
$env:KARETA_E2E_TARGET_PHONE='<reserved-new-target-phone>'
node tools/test_identity_e2e_84_109.js --base-url $env:KARETA_E2E_BASE_URL --json docs/release-master-plan/stage_0017_identity_e2e_staging.json
```

The admin test identity must already be active with role `admin` or `owner`.
## Assertions

1. Staging reports release `188.5.5.6.84.109`.
2. Admin test identity can authenticate through test OTP.
3. Target phone is a new account and completes client registration.
4. Target logs out and logs in again as an existing account.
5. Target requests Master account type.
6. Approval is completed by test-auto mode or `users.setRole` from the admin session.
7. A real Master context materializes and `context.php?action=select` switches to it.
8. Target logs out.
9. Admin blocks the target through `users.setActive`.
10. A subsequent target login fails with HTTP 403 / account blocked.

The staging JSON report is the release evidence.
