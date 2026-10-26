# Master exchange compact UI follow-up — 27 October 2026
## Scope and ownership
- Scoped follow-up to PR #147 and its safety follow-up PR #149, based on exact-tree-equivalent local commit `9b1d732` (same tree as published PR #149 head `a5cb159`).
- Modified only `js/next/pages/work_feed.js` and `css/next/master_exchange_reference_20261025.css`; included one optional isolated Playwright QA script.
- No shared CSS, navigation shell, auth, API, DB, migrations, production, or staging content altered by this branch.

## Problems and changes
1. Historical mobile CSS `.k-exchange-tabs--production button{width:100%}` obscured 3 of 4 nav tabs. On mobile the four tabs now form a visible 2x2 grid with 44px targets.
2. Historical mobile CSS hid the word `Фильтры`; scoped restoration ensures icon+label at 320px and above.
3. Empty states distinguish new/saved/responded/accepted, restricted "Мои услуги", and active search/filters. At most one relevant recovery action. Reset conditions restores search/urgency/distance/price/sort; it preserves chosen "Мои услуги" scope.
4. Load badge shortens to `Загрузка NN%` / `Загрузка —`; full details remain in title and KPI. Degraded label remains recognizably `Биржа доступна` with original failsoft text preserved in title.

## Evidence
- Node JS syntax PASS; request sequence/identity guard regression PASS; master exchange fail-soft PASS; mobile card regression PASS; `git diff --check` PASS.
- Optional browser regression `node tools/test_master_exchange_compact_browser_20261027.cjs`: 10/10 PASS on mocked empty and nonempty feed, at widths 320/390/430/768/1440, with real app CSS and real page runtime; asserts 4 tabs, labels, >=44px controls, no horizontal overflow, context-sensitive empty actions, and absent JS errors.
- Screenshots stay only in isolated local `qa-master-exchange-20261027/` directory; test data is synthetic, never a production order.

## Release blockers
- Staging runtime version already moved to `188.5.5.6.84.178.109` during concurrent work; its exchange JS/CSS still match .103 file hashes as of local read-only check.
- Live authorized real-order response workflow, Android WebView and approved pixel parity are NOT RUN for this delta.
- Do not copy worktree wholesale or overwrite shared `inc/asset_version.php`, `sw.js`, `inc/asset_registry.php`, or any worker edits.
- Staging deployment requires deliberate, hash-checked three-way application of only these page changes, version/cache coordination, rollback copy and route regression in the exact live source.

Rollback: revert the scoped UI commit, without touching DB, auth or other routes.
