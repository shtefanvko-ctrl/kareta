## Outcome
What user/product outcome does this change produce?

## Primary surface
Choose one: web_spa / backend_api / admin / marketplace_catalog / identity / android_webview_bridge / release

## Change lane
- Canonical PR/branch:
- Stacked base and merge order, if any:
- Competing open PR checked:

## Contracts changed
List route/API/data/auth/catalog/release/native contracts.

## Payload and cache impact
- Startup/login payload:
- Lazy route/data impact:
- Cache invalidation/warm-route impact:

## Acceptance criteria
- [ ] Observable criterion 1
- [ ] Observable criterion 2

## Evidence
| Check | Candidate/target | Result |
| --- | --- | --- |
| Syntax/static | | NOT RUN |
| Focused contract | | NOT RUN |
| Regression | | NOT RUN |
| Runtime/staging if required | | NOT RUN |

Use PASS / FAIL / NOT RUN / BLOCKED only.

## State
- DESIRED:
- IMPLEMENTED:
- VERIFIED:
- DEPLOYED:

## Risk / rollback
Describe the smallest restore/recovery path.

## Feature preservation — mandatory before approval
Refer to `ai/FEATURE_PRESERVATION.md` and the protected route/file baseline.
- [ ] Compared exact HEAD SHA with base, `main`, and overlapping feature PRs; no lost or overwritten changes.
- [ ] Listed affected existing client/master/STO/seller flows and confirmed no unintended capability removal.
- [ ] Reviewed routes/back navigation, booking/garage/orders, catalog/community/notifications, GEO/QR/ELM where affected.
- [ ] Reviewed RU/KK/EN, three themes, mobile/tablet/desktop and native bridge compatibility where affected.
- [ ] Reviewed deletions/renames and shared contracts; documented deliberate behavior changes with explicit approval.
- [ ] Recorded autonomous feature-preservation CI result on the exact candidate SHA, not a prior commit.
- [ ] Marked unrun runtime/device/server checks NOT RUN (not PASS); DO NOT MERGE if affected functionality remains unverified.

**Server checks are out of scope for the current GitHub-only hourly task.**
