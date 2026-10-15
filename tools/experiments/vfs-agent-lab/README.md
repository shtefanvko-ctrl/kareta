# KARETA VFS agent lab (experimental, not deployed)

This is a bounded **fixture-only proof of concept** for per-agent virtual JSON workspaces using Node.js `node:vfs`. The default fixture demo does not call Ollama, launch autonomous agents, modify the SPA, reach MySQL, or handle live vehicle/customer records. A separate opt-in local-only Ollama CLI is proposed as a stacked experiment.

## Requirements and local commands

Node.js **26.9.0+** is required for `mount()/unmount()` and the `--experimental-vfs` flag. Node.js 22 (used by the main application-gates workflow) does **not** support this module. Run only in an isolated development/CI environment:

```sh
node --experimental-vfs --test tools/experiments/vfs-agent-lab/workspace.test.cjs
node --experimental-vfs tools/experiments/vfs-agent-lab/demo.cjs
```

The demo prints `mode: fixture_only`; it never implies Ollama or production integration. Node is an optional **developer-side tool**; KARETA's production PHP/JS/MySQL stack remains authoritative.

## Design constraints

- One independent `MemoryProvider`-backed virtual filesystem per workspace.
- Only `/inbox/task.json` and `/outbox/result.json` are exposed via narrow methods; no arbitrary paths.
- JSON objects only; maximum 64 KiB per document (including UTF-8 bytes).
- Short allowlisted ASCII agent IDs; no credentials, VINs, PII, or production data in fixtures.
- No implicit mount and no disk persistence; `close()` invalidates the wrapper.
- **Security:** VFS is not a sandbox, a permission boundary, or a replacement for OS/container isolation. The same process can access host resources. Untrusted code must never execute inside this process.
- No auto-pull or auto-start of Ollama models. The **separate** adapter on issue #138 supports only the exact `127.0.0.1:11434/api/generate` URL. Network calls require explicit opt-in; synthetic prompts only; outputs are unverified text, never actions.

## Optional loopback Ollama adapter (stacked review increment #138)

No external dependency, API key, or remote URL is accepted. The Node.js connector is **disabled by default**; unit tests use mocked HTTP and do not contact Ollama.

```sh
node --test tools/experiments/vfs-agent-lab/ollama-client.test.cjs
# Only on a developer machine with Ollama and the named model ALREADY installed:
node tools/experiments/vfs-agent-lab/ollama-demo.cjs --allow-local-ollama --model qwen2.5-coder:1.5b
```

The second command is *not* run by CI and is never invoked on `s.kareta.kz`. Only synthetic prompt fixtures may be used. Errors return explicit codes (e.g. `MODEL_NOT_FOUND`, `TIMEOUT`, `LOCAL_OLLAMA_UNAVAILABLE`) rather than a fabricated answer. The adapter caps request sizes, response sizes, timeout, token context, tokens generated, and in-flight concurrency to 1; it sets `keep_alive: 0`. These API constraints do not cap Ollama's actual RAM/VRAM use.

To install a model (if ever authorized), do so **outside** this lab after verifying available disk, RAM and runtime. The lab never installs, pulls or starts a model.

## Evidence, ownership, and rollout

Experiment lane starts from `main` and does not modify PR #133 or PR #134. Keep this PR draft until Node 26 CI and independent review PASS. CI evidence is only proof for this experiment—not staging/runtime release evidence. Do not deploy to `s.kareta.kz` or production as part of this PR.

Rollback: close the PR and delete the experiment branch. No production state or schema migration is involved.

References:
- https://nodejs.org/api/vfs.html
- `AGENTS.md`, `ai/CHANGE_LANES.md`, `ai/VERIFICATION_GATES.md`
