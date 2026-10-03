# Geo map resilience — 2026-10-03

## Implemented
- Reject missing, empty and out-of-range map coordinates; preserve legitimate zero coordinates.
- Use latitude/longitude consistently for automatic map center.
- Ignore animation callbacks after the map closes.
- Report loading, partial tile failure and tile unavailability in RU/KK/EN without hiding markers or point actions.
- Ignore tile events from previous viewport renders.
- Reject unsuccessful nearby API responses in Masters/STO directory, Parts and Master Work Zone.
- Extend the existing Geo gate with executable helper and map lifecycle regressions.

## Evidence
- Local coordinate/center regression: PASS.
- Local simulated map DOM/tile lifecycle regression: PASS.
- Full repository CI and actual browser/WebView/network rendering: not yet verified.
- Deployment and migration execution: not performed.

## Remaining
1. Client Home still needs separate nearby API error handling and canonical boot bundle regeneration.
2. Allow city browsing without public nearby points or GPS; choose the city from canonical project data.
3. Verify Kazakhstan street/address detail on actual tiles; select provider and production availability conditions before enabling paid services.

The tests simulate DOM/tile events; they do not establish actual tile server availability or visual layout.
