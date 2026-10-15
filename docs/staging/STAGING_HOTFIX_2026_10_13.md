# KARETA.KZ staging guard hotfix (2026-10-13)

Source: ChatGPT /devil verified patches from October 13, 2026.

Scope: 5 changed files. Service Worker manifest cache validation; city-scoped
store directory; notifications API failure checks with RU/KK/EN locale;
master schedule stale free-slots; master exchange stale request guards.

Live staging: s.kareta.kz, deployed release 188.5.5.6.84.178.2.
Git candidate is based on main 5862c845 (release 188.5.5.6.84.178).
Do not overwrite live staging with a full checkout or merge to main.

Rollback: /home/karetakz/releases/devil-staging-hotfix-20261013/backup
HTTP/MIME/health verified in staging. Isolated Node guard tests passed.
Authenticated browser E2E, real MySQL bookings, Android/ELM are NOT RUN.

No database migration, private configuration, DNS, production, or auth policy changed.
