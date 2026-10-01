# KARETA.KZ 188.5.5.6.84.150

## Master / Android WebView visual hardening

This release addresses the code causes behind WV-07..WV-11 without changing business workflows.

### Master content frame
- Master foundation and surface contract no longer declare an independent 1420px outer frame.
- Both inherit the canonical route frame: `--k-route-frame-max` (1280px at normal desktop widths).
- Route modules remain free to define internal grids but not a competing outer page width.

### Mobile navigation / More
- Opening `Ещё` now has one visual navigation state.
- The current route remains semantically current, but its orange active treatment is neutralized while the Smart Action Hub is open.
- `Ещё` becomes the sole visual active item during the overlay state.

### Master quick FABs
- Chat/Orders quick actions are a compact horizontal 2×44px rail instead of a tall vertical stack.
- The page reserves bottom scroll clearance for the rail.
- FABs are hidden while `Ещё` or the shell drawer is open.
- The `hidden` attribute remains authoritative.

### Route-load failure UX
- Raw loader exception messages, CSS/JS paths and filenames are no longer printed to the user.
- The UI shows a compact KARETA fail-soft state with Retry and Back.
- Full technical error details remain in `KaretaRuntimeLog` for diagnostics.

### Masters filter rail
- Narrow WebView filter controls use a full-bleed horizontal rail with explicit left/right scroll padding.
- First and last filters can be reached without being clipped by page gutters.

## Verification contract
`tools/test_master_ui_contract_84_150.js` machine-enforces the geometry, More state, FAB behavior, route-error privacy and filter-rail rules.

Device screenshots are still required before WV-07..WV-11 can be marked closed in issue #14.
