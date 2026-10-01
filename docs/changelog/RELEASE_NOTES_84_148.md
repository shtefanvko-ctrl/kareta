# KARETA.KZ 188.5.5.6.84.148

## Changed

- Services catalog now uses stale-while-revalidate instead of replacing usable content with a loading state on every revisit.
- Services snapshot is kept in release-scoped sessionStorage and silently revalidated.
- Masters paints cached results immediately, refreshes in the background, and skips DOM replacement when content is unchanged.
- Masters refreshes on resume, network recovery, and relevant realtime events.
- Community keeps its current feed visible while revalidating and only repaints when the feed signature changes.
- Community refreshes on resume and relevant realtime events.
- CI now syntax-checks the affected content-cache/state modules.

## Cache contract

Static assets use release-scoped cache-first storage. Dynamic content uses stale-while-revalidate.

Cached dynamic content is presentation state only; API/server data remains authoritative. Revalidation occurs after TTL, on connectivity/app resume, and on matching realtime events. A new web release changes the cache namespace, preventing old runtime/content snapshots from surviving a changed release.

## Verification status

Repository verification is wired into verification-gate. External staging remains NOT VERIFIED until the deployed 84.148 build passes tools/verify_staging_current.py.
