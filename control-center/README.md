# KARETA Control Center (experimental)

Separate local-only Ubuntu control panel. **Not deployed**. No modifications to KARETA's existing PHP SPA.

## Stack
- Go standard-library HTTP API, bound to `127.0.0.1:4174`
- Vue 3 + TypeScript + Vite frontend, development UI at `127.0.0.1:5173`
- System monitoring plus optional authenticated fleet diagnostics

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

The backend preserves GET `/api/health` and GET `/api/system` (with standard HEAD support). GET `/api/fleet` and optional authenticated POST `/api/tasks` extend it as described below. Other methods return 405; unknown GET paths return 404. No shell commands, sudo, systemd control, model execution, public binding or persistent job data. Optional agent credentials remain in private files outside the repository. The API reports Linux `/proc/meminfo`, `/proc/loadavg`, and disk usage for `/` using syscall.Statfs. Missing metrics return null, not fake values. CPU load average is **not** CPU utilization percentage.

Host must be exactly `127.0.0.1:4174`. If Origin is present, only `http://127.0.0.1:5173` and `http://127.0.0.1:4174` are accepted. Duplicate/foreign/null origins and cross-site Fetch Metadata are rejected before metrics are read. CORS is disabled. Responses use no-store/nosniff; HTTP headers, read/write and idle time are bounded.

This is **not local-user authentication**: any local process can read these host-level metrics. Use only an isolated development machine with trusted local users. Do not expose either listener via nginx, tunnels, containers with public port mappings, or any existing KARETA SPA. Do not change the bind address or enable Vite remote access. Privileged actions or remote/multi-user UI access require a separate authenticated, authorized design and independent security review. The optional agent broker below has its own mTLS boundary and stays on loopback.

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

## CARAT fleet and diagnostic dispatch (2026-10-28)

This increment extends this **same** Control Center; it does not install Kubernetes,
modify the PHP SPA, deploy a service, or connect any actual second machine.

- GET `/api/fleet` shows this coordinator plus every configured worker, including
  workers never seen in this process. Workers authenticate by a dedicated client
  certificate, whose CN must equal a configured node ID. A valid CA certificate
  for another CN cannot act for a worker.
- Optional broker: **TLS 1.3 + mandatory client certificates** on
  `127.0.0.1:4175`. Browser requests are refused. No public listener, proxy,
  firewall or existing server configuration is changed.
- POST `/api/tasks` on the existing local API requires an operator bearer token
  (minimum 32 characters), in addition to the existing Host/Origin boundary.
  The UI clears the token after submission and does not persist it. System and
  health endpoints remain GET/HEAD-only and work without fleet configuration.
- The only executable kind is `system-probe`: read OS metrics and return them.
  It cannot execute shell commands, access a supplied path, start a model or
  launch Scion. Those need explicitly reviewed task adapters and enforced limits.
- A worker sends a heartbeat and polls every 10 seconds. Heartbeats older than
  35 seconds are excluded from admission. Server receipt time is authoritative.
- Each probe requests 1 CPU and 16 MiB. Admission CPU budget is
  `max(0, cores - reserveCPU - max(load1, activeProbes))`. Available memory is
  `max(0, min(total, OSAvailable) - reserveRAM - activeProbes*16MiB)`.
  Missing load/RAM blocks admission. These are conservative estimates, **not OS
  resource reservations or isolation**. GPU/VRAM are explicitly unavailable.
- At most one active probe per worker. Automatic placement is pull-based: the
  first eligible authenticated worker receives the oldest compatible queued task;
  this is not a global best-fit optimization. An explicit target is respected.
- A running probe older than 60 seconds becomes `unknown` and keeps its budget;
  it is never automatically reissued. A late result from its owner releases it.
  Completion is idempotent. Waiting jobs expire after 10 minutes. Queue/history
  is bounded to 100 jobs and is **in memory**: restarting the coordinator loses
  probe history and queued jobs. This is not a durable general-purpose job queue.
  Workers retain an unacknowledged result in memory and do not claim another task
  until it is acknowledged. If the coordinator returns 404 (restart/pruned
  history), the worker explicitly discards that orphan diagnostic result without
  replaying the task. Other failures retain the pending result. An agent crash
  after a claim still requires operator recovery of the unknown session; no
  automatic retry of lost work.
- Both coordinator and workers run natively on Linux; container/cgroup quotas,
  Windows agents, persistent workloads, progress/log streaming and task adapter
  permissions are not implemented by this increment.

### Private setup, without installation or remote exposure

Run from `control-center` on a trusted development coordinator:

```bash
python3 scripts/setup-fleet.py /absolute/private/carat-fleet worker-2
cd backend
go build -o /absolute/private/carat-control .
CARAT_FLEET_CONFIG=/absolute/private/carat-fleet/fleet.json \
CARAT_ADMIN_TOKEN_FILE=/absolute/private/carat-fleet/admin-token \
  /absolute/private/carat-control
```

The setup tool requires Python 3 and OpenSSL. It refuses an existing destination,
creates private directories/files (0700/0600), and prints no credentials. Its
configuration starts each worker with a reserve of 1 CPU and 1 GiB RAM; adjust
these policies for the actual machine before starting. **Do not register the
coordinator again as a worker**: totals represent unique physical machines.
The coordinator is counted once and does not claim tasks in this increment.

Keep the root `ca.key`, server key and admin-token on the coordinator. Transfer
**only** `worker-2/` plus the Linux binary to the worker using an authenticated
channel. Never copy the CA private key or operator token to a worker. No private
material belongs in Git. The local UI remains at `http://127.0.0.1:5173`; run
`npm ci --ignore-scripts && npm run dev` in `frontend` as before.

On the worker, first establish an SSH local forward to an already authorized
coordinator account (verify its SSH host key through your normal trusted path):

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
  -L 127.0.0.1:4175:127.0.0.1:4175 user@coordinator
```

Then run the worker in another terminal:

```bash
CARAT_AGENT_CERT=/absolute/private/worker-2/worker-2.crt \
CARAT_AGENT_KEY=/absolute/private/worker-2/worker-2.key \
CARAT_AGENT_CA=/absolute/private/worker-2/ca.crt \
  /absolute/private/carat-control --agent
```

The agent's destination is fixed to `https://localhost:4175`, with certificate
verification always enabled. A tunnel transports this private broker only;
never forward the unauthenticated read-only UI/API to a public interface. Allow
TCP forwarding only to this broker destination in the SSH account policy. The
worker needs no inbound application port. For a local sandbox test only, an
agent may run on the coordinator without SSH; that is a multi-process test and
must never be reported as two physical machines.

Certificates expire after 90 days (CA after 365). To revoke a worker, remove its
ID from the private configuration and restart the coordinator and relevant
agents. Replacement certificates/CA and token rotation require replacing private
files and restarting. No dynamic certificate enrollment or public access exists.

Rollback: stop the new test processes; return source to PR #142 head
`92f2f2406d8e38d3f69ca41cd075011f11a4ea64`; start the original local-only prototype.
No website/DB/service migration or automatic deployment is involved. Keep or
securely remove generated private credentials according to the local policy.

Focused process integration (requires free 4174/4175 ports and an idle enough host):

```bash
go build -C backend -o /tmp/carat-control .
python3 scripts/test-fleet-integration.py --binary /tmp/carat-control
```

This test generates temporary private credentials, starts its own coordinator and
two agents, checks targeted probes and restart recovery, and stops all processes.
It makes no changes to configured machines, SSH accounts or service managers.
