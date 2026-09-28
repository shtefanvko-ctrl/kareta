# Security policy

## Secrets

Never commit passwords, OTP values, API keys, database credentials, private keys, access tokens, production cookies, database dumps, or backup archives.

Use environment-specific secret storage outside the repository. Public client-side identifiers may be committed only when they are explicitly designed to be public.

## Reporting

Security findings affecting KARETA.KZ must be tracked privately before public disclosure. Do not place exploitable production details, credentials, or personal data in public issues.

## Verification before merge

Every change that affects authentication, authorization, identity, capabilities, payments, personal data, uploads, external integrations, or production configuration requires a security review before merge.

## Incident rule

A confirmed security defect must produce:
1. root-cause analysis;
2. a regression test or machine-enforced guardrail where technically possible;
3. verification that the same failure cannot recur through the same path.
