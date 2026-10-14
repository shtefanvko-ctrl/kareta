---
name: kareta-security-review
description: Change or audit KARETA authentication, Identity, contexts, capabilities, sessions, secrets or privileged actions.
version: 1.0.0
---
Authentication and authorization are separate.
Use server-side capability and resource-ownership checks; never trust client role/context claims.
Do not weaken sessions, CSRF/rate limits, capability checks or secret handling to make a test pass.
Include at least one relevant rejection/negative path when executable.
