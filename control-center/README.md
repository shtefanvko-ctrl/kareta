# KARETA Control Center (experimental)

Separate local-only Ubuntu control panel. **Not deployed**. No modifications to KARETA's existing PHP SPA.

## Stack
- Go standard-library HTTP API, bound to `127.0.0.1:4174`
- Vue 3 + TypeScript + Vite frontend, development UI at `127.0.0.1:5173`
- Read-only system monitoring for the first increment

## Local development

Verified-toolchain target: Ubuntu 24.04, Go 1.27.3, Node.js 24.22.1, npm 11.9.0.
The Go language floor is 1.22; use the patched toolchain pinned in CI for security verification.

```bash
cd control-center/backend
go test ./...
go run .
```

In another terminal:

```bash
cd control-center/frontend
npm ci --ignore-scripts
npm run dev
```

Open http://127.0.0.1:5173 (not `localhost`). The Vite dev server proxies `/api` to the Go backend and rewrites Host to the fixed backend authority. Port 5173 is strict: a busy port fails instead of silently changing the trusted origin.

## Scope and security

The backend exposes GET `/api/health` and GET `/api/system` (with standard HEAD support). Other methods return 405; unknown GET paths return 404. No shell commands, sudo, systemd control, model execution, remote binding, credentials or persistent data. The API reports Linux `/proc/meminfo`, `/proc/loadavg`, and disk usage for `/` using syscall.Statfs. Missing metrics return null, not fake values. CPU load average is **not** CPU utilization percentage.

Host must be exactly `127.0.0.1:4174`. If Origin is present, only `http://127.0.0.1:5173` and `http://127.0.0.1:4174` are accepted. Duplicate/foreign/null origins and cross-site Fetch Metadata are rejected before metrics are read. CORS is disabled. Responses use no-store/nosniff; HTTP headers, read/write and idle time are bounded.

This is **not local-user authentication**: any local process can read these host-level metrics. Use only an isolated development machine with trusted local users. Do not expose either listener via nginx, tunnels, containers with public port mappings, or any existing KARETA SPA. Do not change the bind address or enable Vite remote access. Future privileged actions or remote/multi-user access require a separate authenticated, authorized design and independent security review.

## Verification
From `control-center/backend`:

```bash
go test -race -count=1 ./...
go vet ./...
go build ./...
go install golang.org/x/vuln/cmd/govulncheck@v1.9.0
govulncheck ./...
```

From `control-center/frontend` (both local ports must be free):

```bash
npm ci --ignore-scripts
npm run build
npm audit --audit-level=low
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser tests start and stop their own loopback backend/Vite instances. They verify real API data through the proxy, mobile overflow, no external page requests, offline/recovery and explicitly synthetic missing-metric fixtures. They do not connect to KARETA, a DB, agents, Ollama, staging or production. Browser smoke exercises the development UI; the built dist is not a production server/deployment package.

`.github/workflows/control-center.yml` checks out the exact PR head with read-only repository permissions and no persisted Git credential. It runs the above gates plus redacted Gitleaks scanning of PR commits. No deploy job exists. Existing SPA CI remains separate; green SPA checks alone do not verify this prototype.

Record PASS/FAIL/NOT RUN/BLOCKED against the exact SHA and toolchain. Any code change requires affected checks to run again. **DO NOT MERGE / DO NOT DEPLOY** until exact-head CI and independent security review are complete; passing these checks does not authorize deployment. Rollback: revert the isolated hardening commit; there are no data/schema side effects.
