# Master availability — schedule isolation (2026-10-27)

## Status and scope
- Draft isolated GitHub PR, based on the exact latest main at authoring time.
- No production or staging backend deployed by this PR.
- Fixes an existing **confirmed side effect** in `kareta_master_availability_save`: a quick status change currently creates or overwrites today's `master_schedules` row (start/end, note, day-off). A status toggle therefore can destroy custom day annotations and create misleading schedule exceptions.

## Behavioral contract
- `masters.availability` is the source of truth for a master's current `online / busy / lunch / day_off` status.
- Quick status changes update **only** availability and are constrained to the authenticated master ID; the existing capability and owner checks in `api/db.php` must remain enforced.
- For **today only**, live `day_off` makes `kareta_master_schedule_day_bounds` report no available work minutes, without changing the stored working hours, custom notes, or future dates.
- Scheduled exceptions take priority: a previously configured day off stays a day off even if the master sets `online` in the quick control.
- Other statuses (`busy`, `lunch`) do not silently change dated hours or overwrite explicit shifts. They express current availability; whether they should immediately reject new discovery bookings must be agreed separately.
- No bulk repair of historical schedule rows. Existing rows already overwritten by old code cannot be distinguished reliably from intentional schedule changes without provenance.

## Validation
- `php -l api/master_workplace.php`: PASS.
- `php tools/test_master_availability_schedule_isolation_20261027.php`: PASS (fake PDO, no DB writes): four valid states, today's day-off, tomorrow unaffected, custom hours/notes, existing explicit day-off, return to online, invalid-state rejection.
- Regression test run against the unpatched main source: **FAIL** (reproduced missing today's live day-off overlay when schedule writes are disallowed).
- `git diff --check`: PASS.

## Required release gates
- Authorized staging API test with a disposable QA master, including **backup and exact restore** of the original `masters.availability` and any dated `master_schedules` row (including existence, notes, start/end). Not attempted until an explicit safe fixture is prepared.
- Examine all booking paths and availability filters for same-day `day_off` before deploy. Generic catalog/search and third-party bookings may have independent eligibility logic.
- DB data audit for legacy `master_schedules` rows created by earlier status toggles; do not automatically delete.
- Check concurrent staging changes: staging `api/master_workplace.php` differs from main and is modified by other workers. Merge at function level, not by replacing entire file.
- SPA: verified read-only on existing staging QA master at 390 and 1440 px: persisted authentication, hash route master → exchange → master without document reload, identical API-backed status after reload, no JS errors, no POST writes. This does **not** prove actual status saving.

Rollback: revert the single PHP change. Keep as Draft until live E2E/regression passes; never merge/deploy automatically.
