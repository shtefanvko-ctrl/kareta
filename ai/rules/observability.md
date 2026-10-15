# KARETA observability governance v1.0

Load for incident response, tracing, application telemetry, operational health and error handling. Pair with `ai/rules/security.md` and `MB_MONITORING.md`.

- Use request/correlation identifiers where the API supports them; adding shared response fields/headers requires compatibility review. Distinguish real error categories: unauthorized, timeout, missing migration, stale release, wrong MIME, bridge unavailable, ECU no response.
- Show API errors and rejected actions accurately. Do not turn a failed request into a success-like placeholder, fake metric, fake loading completion or false OBD value.
- Protect credentials, OTP, sessions, VIN, plate, phone, location, MAC address, scan photos, payment data and full diagnostic payloads. Minimize/redact; log only what is needed, with access and retention controls.
- Separate security/audit events from diagnostic logs. Privileged operations require server-side authorization and auditable scope; frontend logs are not a security boundary.
- Report incident symptom, affected route and role, repro, exact Git SHA and asset version, evidence, smallest reversible patch and remaining gates.
- No new monitoring collection or log retention is authorized without a concrete use case and privacy review. No server health gate is altered by this document.
