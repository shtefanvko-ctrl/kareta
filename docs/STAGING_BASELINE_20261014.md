# Staging source baseline — 2026-10-14

Branch: deploy/staging-20261014.
Source: existing s.kareta.kz runtime, release 188.5.5.6.84.178.3.
Base commit: e15ac20c60c985f63b3667fc9a1dce361df77910.

Captured 1361 source files from a local tar snapshot and verified their SHA-256 hashes against the live source before copying. Preserved 60 modified tracked files and 10 additional source/assets files. Repository-only tooling and documentation retained; this is not a full filesystem mirror.

Excluded from the import: config.php, config.private.php, storage, media, downloads, garage-director, landing/lending, print-banners, preview screenshots, hidden files, backup files and secrets. Existing repository config.php is retained and is NOT verified as identical to the runtime config.

Backup: /home/karetakz/kareta-staging-backups/20261014-git-baseline/site-without-private-config.tar.gz
SHA-256: 7fc184dd75343802caf36b1606449534fca75d790890287faf3d945952ab8525
The archive contains runtime data: keep private, never publish or commit it.

Verification: 51 PHP/JavaScript/JSON syntax checks passed; basic private-key/token pattern scan passed. This is not a full secret or security audit. No application code was changed on the live site by this capture. No database migration was run.

Limitations: private config cannot be read by current OS user; database login denied for current OS user; fresh DB backup NOT CREATED. The earlier site.tar.gz is an incomplete failed backup and MUST NOT be used as a full restore point. Archive integrity verified by listing; restore drill NOT RUN. Browser and Android acceptance NOT RUN. No deployment command is enabled. Do not deploy the complete repository over the site: runtime config and excluded app directories need separate preservation.
