# KARETA UI Canon v3 recovery — 2026-10-15

Source: real Android screenshots. Do not infer code causes from screenshots alone.

## Verified root causes and safe corrections
- The main logo asset is base64 ASCII stored under .png and served image/png. Original authored image restored to valid PNG bytes, 1614 × 334. No logo substitution.
- SPA Back owner already marks the shared shell with data-kareta-header-mode=inner but corresponding scoped CSS was absent; compact header now shows existing Back+title without home brand.
- Home quick-actions lacked direct Diagnostics ECU entry. Existing garage-to-diagnostics entry is retained.
- Parts category mapping used the group name: a broad security word caused audio part tiles to show a lock. Keys now own existing category glyphs.
- Document capture included unnecessary intro detour, repeated headings and an excessive preview. Existing local camera/gallery, optional OCR and first-vehicle wizard remain.
- Floating chat and orders shortcuts covered interior content, so they are displayed only on home while canonical navigation remains.

## Verification and status
Run JS syntax, binary asset check, PNG HTTP byte/MIME check, SPA boot bundle check, scanner tests, affected route tests, Git CI for exact SHA, staging provenance and real Android smoke. Record PASS/FAIL/BLOCKED/NOT RUN without extrapolation.
Older tools/test_mobile_back_header_84_74.js assumes Back is inside a FAB stack even though current index.php already has it inside header; this unrelated baseline assertion predates our patch. Do not weaken it to manufacture PASS.

## Deferred increments
1. Social filters, work cards, empty-photo behavior and floating forms.
2. Full marketplace category, shop slider and seller permission validation using real API.
3. Live Android 320–430px RU/KK/EN screenshots and role navigation, then production only by separate approval.
