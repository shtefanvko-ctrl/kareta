# KARETA visual canon recovery v3 (2026-10-15)

User-approved P0/P1 UX invariants based on real Android screenshots. Screenshots prove symptoms, not causes.

1. Brand logo is a valid binary PNG (correct MIME, nonzero dimensions); its full-image header appears only on home. No fake substitutes or text placeholders.
2. Interior routes use compact Back + page title, not the home brand/nav/actions; preserve one SPA/Android Back handler and safe areas.
3. Home has direct access to the existing diagnostics route without a required vehicle. Garage launches the same module scoped to the selected vehicle ID.
4. Document capture reuses local two-sided photographs, optional device OCR, user review and the existing garage wizard. Keep camera/gallery/retake/manual paths, private photos, no false OCR.
5. Product categories use existing catalog IDs and real stock. A generic group label containing security must not render lock icons for speakers/cables/amplifiers. Real restrictions remain enforced by server.
6. Services, works, posts, messages, orders and finances retain their existing owners and APIs; no dummy values.
7. Floating global shortcuts do not cover interior content, navigation, scanner or forms. Access to their actions remains via regular navigation.
8. Verify Android widths 320/360/375/390/412/430, roles client/master/STO/seller, i18n RU/KK/EN, themes and missing images.

Record issue, owner, verified cause, files, tests, bundle and exact Git/staging SHA. A file change, URL 200 or screenshot mockup alone is not a visual PASS. P0: logo/header/diagnostics. P1: scanner/parts/social/overlays. Do not merge or touch production without separate permission. Follow iterative verification with rollback.

9. Onboarding/full-logo HTML from JavaScript MUST append the current window.KARETA_NEXT_ASSET_VERSION query to the real PNG URL; bare CDN logo paths can remain cached as invalid historical base64. Verify actual PNG magic through the versioned URL on staging.
