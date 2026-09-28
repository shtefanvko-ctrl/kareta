# Responsive QA tools

`capture_baseline_windows.js` captures Stage 1 responsive baseline evidence against `http://localhost/`.

Default output:
`docs/responsive-baseline/188.5.5.6.84.110/stage_0001/`

Optional output override:
`KARETA_RD_OUT=<path>`

The harness uses a pre-boot legacy-session UI fixture for role/layout coverage. Protected backend 401/403 responses are coverage boundaries, not responsive failures. Identity-authenticated scenarios must be tested separately.
