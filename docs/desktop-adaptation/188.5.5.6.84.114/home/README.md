# KARETA.KZ Home desktop evidence — 188.5.5.6.84.114

Source URL: `http://localhost/#/home`.

Browser: Chrome 153.0.8010.53. Service Worker and HTTP cache were bypassed for deterministic layout verification.

Verified desktop viewports: 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1600×900, 1920×1080, 2560×1440.

Result: 8/8 geometry checks passed. No document horizontal overflow. Sidebar is 84 px at 1024 and 248 px from 1280. Home is bounded below 1440 px. Hero and quick actions share one desktop row. Nearby and popular-service sections share one row. Home feeds are desktop grids without horizontal scrolling: 3 columns below 1600 and 4 columns from 1600.

Key visual evidence is saved for 1024, 1366, 1440, 1920 and 2560 widths. The onboarding overlay was suppressed only by the capture harness so the already-rendered Home route could be measured; application layout/runtime itself was not replaced by a fixture.

Reproducible runner: `tools/responsive/home_desktop_geometry_84_114.js`.
