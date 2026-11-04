# Scion QA OCI release candidate — never a production Worker

**State:** draft workflow only; no GHCR package, no signature, no deployment, no Scion jobs, no runtime identity granted.

## Identity boundaries (keep these distinct)

1. **Human GitHub OAuth login**: Scion supports GitHub OAuth for operator UI/CLI login. An actual GitHub OAuth App must be registered by the administrator and its Client ID and Client Secret stored only in a protected server secret store. Do not add these to GitHub source or commit them. The current Scion Hub uses local dev-auth and remains loopback-only. Never flip its auth mode as part of this QA PR.
2. **Build signer (GitHub Actions OIDC)**: the workflow receives a short-lived OIDC identity from `https://token.actions.githubusercontent.com`, signs the *immutable registry digest* with Sigstore/Cosign, and verifies the exact workflow identity and issuer. This needs no long-lived signing key.
3. **Remote Runtime Broker / Worker identity**: neither GitHub OAuth nor the CI OIDC identity is a Worker credential. A separate, least-privilege scoped runtime/broker identity and verified protected transport are still required. No Worker token is minted or installed by this PR.

## Scope of the proposed workflow

- Builds a **synthetic-only** no-shell Go canary from `infra/scion-worker-qa/`, not an agent capable of real tasks.
- Runs on **manual dispatch only**, with an exact confirmation phrase and **main branch** restriction.
- Uses an environment `scion-qa-ghcr-approval`. **The repo administrator must create and configure that environment with required reviewers, branch restriction, and prevent self-review before merging this PR.** A missing environment can be created automatically by GitHub Actions without any protection, which is **not** approval.
- Pins all third-party GitHub Actions to full verified commit SHAs.
- Grants short-lived `contents: read`, `packages: write`, and `id-token: write` permissions to the publishing job only.
- Builds a static `linux/amd64` binary; publishes `ghcr.io/shtefanvko-ctrl/kareta-scion-synthetic-qa:qa-<full commit SHA>`, signs `@sha256:<digest>` and independently verifies the same digest with a pinned workflow certificate identity.
- Never uses `:latest`, a mutable tag in a runtime manifest, a root filesystem mount, privileged mode, a Kubernetes API, or the CARAT/Scion task queue.
- **No automatic trigger**, worker enrollment, Job creation, prod deployment, canary admission, or claim/ACK activation.

## Required evidence before any manual QA publication

- Confirm an approved and protected GitHub environment exists.
- Review the exact Dockerfile, Go source and dependency tree. Confirm the synthetic contract still rejects arbitrary task execution.
- Check the workflow identity, Cosign issuer, and full action pins against their official upstream references.
- Run Go tests and YAML/workflow static policy checks on the exact commit SHA.
- After manual publication, capture the full registry reference `ghcr.io/...@sha256:<64 hex>`, the workflow run ID, the signed certificate identity, verification exit code and immutable digest.
- Check the GHCR package's pull visibility and permissions before proposing an isolated Kubernetes canary.

## Gates that remain DENY

- External real OIDC IdP/issuer/client registration and verified live login.
- Short-lived authenticated Worker/Broker identity with server-side scope.
- Independently verified HTTPS or mutually authenticated transport.
- **Real Scion Worker**, not this synthetic canary, built, scanned and signed by registry digest.
- Namespaced root-verified RBAC evidence has 12/12 checks from an operator terminal; the runtime still lacks a securely enrolled scoped identity.
- Server-side signed-image admission, independent verifier and fail-closed atomic claim/ACK against the exact isolated candidate.
- Explicit individual Kubernetes Job approval and rollback plan.

## Rollback

No production state is changed by opening a draft PR. Close the PR or delete the branch to abandon. If this workflow is later approved, run and publishes a QA image, remove the GHCR QA tag/package following approval; do not alter running Scion Workers because none should have consumed the image.

**Never merge or run this workflow as evidence of production readiness.**
