# Home mobile/tablet regression — 188.5.5.6.84.114

Source URL: `http://localhost/#/home`.

Verified after the desktop Home adaptation at 390×844, 430×932, 768×1024, 820×1180 and 1023×768.

Result: 5/5 PASS. No document horizontal overflow. Desktop sidebar remains hidden below 1024. Bottom navigation remains visible. Home remains a one-column mobile/tablet composition. Work/community feeds remain the intentional horizontal flex/slider implementation below the desktop breakpoint.

Visual evidence is saved for 390×844, 768×1024 and the 1023×768 boundary.

The capture harness suppresses the onboarding overlay only after normal SPA boot so the existing Home route can be measured. It does not replace Home markup or CSS.

Reproducible runner: `tools/responsive/home_mobile_regression_84_114.js`.
