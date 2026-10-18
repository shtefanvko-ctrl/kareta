# KARETA Control Center (experimental)

Separate local-only Ubuntu control panel. **Not deployed**. No modifications to KARETA's existing PHP SPA.

## Stack
- Go standard-library HTTP API, bound to `127.0.0.1:4174`
- Vue 3 + TypeScript + Vite frontend, development UI at `127.0.0.1:5173`
- Read-only system monitoring for the first increment

## Local development

Prerequisites: Go 1.22+, Node.js 20.19+ or 22.12+, npm.

```bash
cd control-center/backend
go test ./...
go run .
```

In another terminal:

```bash
cd control-center/frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The Vite dev server proxies `/api` to the Go backend.

## Scope and security

The backend exposes only GET `/api/health` and GET `/api/system`. No shell commands, sudo, systemd control, model execution, remote binding, credentials or persistent data. The API reports Linux `/proc/meminfo`, `/proc/loadavg`, and disk usage for `/` using syscall.Statfs. Missing metrics return null, not fake values. CPU load average is **not** CPU utilization percentage. Future actions require explicit allowlists, local authentication and negative-path tests.

## Verification
Run `go test ./...` and `npm run build` on Ubuntu. Do not claim runtime PASS until executed on the exact commit.
