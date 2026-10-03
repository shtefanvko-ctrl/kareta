# Geo map resilience — 2026-10-03

## Implemented
- Reject missing, empty and out-of-range map coordinates; preserve legitimate zero coordinates.
- Use latitude/longitude consistently for automatic map center.
- Ignore animation callbacks after the map closes.
- Report loading, partial tile failure and tile unavailability in RU/KK/EN without hiding markers or point actions.
- Ignore tile events from previous viewport renders.
- Reject unsuccessful nearby API responses in Masters/STO directory, Parts and Master Work Zone.
- Extend the existing Geo gate with executable helper and map lifecycle regressions.
- Browse all eight registration cities from the existing canonical city catalog without GPS or public points.
- Use approximate GeoNames city centers only for browsing: no user marker, user distance, or user-coordinate persistence.
- Keep empty-point and failed-API messages separate from tile loading status, with RU/KK/EN notices.
- Reject missing stored user coordinates on Home and Masters; retain provider profile/booking and shop product actions.
- Preserve raw provider/shop coordinates through map consumers so map validation cannot mistake null for 0.
- Reject invalid owner work-zone coordinates before nearby requests, and invalid GPS responses in Masters/Parts.
- Regenerate canonical onboarding and core boot bundles.

## Evidence
- Local coordinate/center regression: PASS.
- Local simulated map DOM/tile lifecycle regression: PASS.
- City-center catalog, empty-map and unsuccessful API simulated regressions: PASS.
- Canonical boot bundle freshness and changed JavaScript syntax: PASS.
- Initial resilience head 2d05e13: all four repository CI workflows passed. City increment CI must be verified on its new head.
- Actual browser/WebView/network rendering: not yet verified.
- Deployment and migration execution: not performed.

## Remaining
1. Verify Kazakhstan street/address detail on actual tiles; select provider and production availability conditions before enabling paid services.

The tests simulate DOM/tile events; they do not establish actual tile server availability or visual layout.

## City center attribution
Approximate WGS84 browsing centers from GeoNames (CC BY 4.0), inspected 2026-10-03. These are not addresses or exact user locations.
- https://www.geonames.org/kz/largest-cities-in-kazakhstan.html
- https://www.geonames.org/1521370/ridder.html
- https://www.geonames.org/about.html

## Next Geo analysis / implementation order
1. Finish coordinate validity at all entry points and point-type contracts: service, mobile_origin and shop pickup; published-only browsing and owner-only work metadata remain separate.
2. Extend city browsing to Masters/STO and Parts using the existing catalog/map rather than a second page or loader. Home is implemented; other city-only consumers are not yet implemented.
3. Add category/radius controls and useful list fallback from the same response; distinguish empty data, API failure and tile failure.
4. Specify production tile-provider availability and retry behavior; do not claim public tiles have an SLA or activate paid services implicitly.
5. Browser/WebView/address visual verification is deferred at the user’s request. This remains open evidence, not PASS.
