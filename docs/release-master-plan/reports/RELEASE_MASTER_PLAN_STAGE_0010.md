# KARETA.KZ — Release Master Plan — Stage 0010/2513

## Task

Собрать единый CHANGELOG для R188.5.5.6.84.77–R188.5.5.6.84.109 с migrations, known limitations и rollback notes.

## Result

Созданы:
- `docs/changelog/RELEASE_NOTES_R188_5_5_6_84_77_TO_84_109.md`
- `docs/changelog/release_notes_84_77_84_109.json`
- `tools/test_release_notes_84_77_84_109.js`

Единый release checklist теперь включает release-note contract.

## Source coverage

Диапазон содержит 33 application release numbers: 84.77–84.109.

Документальные источники:
- 30 standalone `PATCH_R188_5_5_6_84_*.md`;
- 84.96 — `docs/KARETA_TASK_QUEUE_AFTER_R188_5_5_6_84_94.md`;
- 84.97 — `docs/MASTER_RECOVERY_R188_5_5_6_84_97.md`;
- 84.90 — отдельный patch/recovery source в baseline не найден; зафиксирован explicit documentation gap без выдуманных изменений.

## Migrations

Current baseline:
- `api/migration_manifest.php` version 129;
- 129 sequential migration files with checksums;
- release numbers and DB migration numbers are documented as independent sequences.

Release note фиксирует:
- production runtime migration fail-closed;
- explicit `KARETA_DB_RUNTIME_MIGRATION_WINDOW=1` for maintenance;
- messaging auto-schema default = false;
- explicit messaging installer `php tools/messaging_schema_install.php`;
- `config.private.php` and provider secrets are not packaged.

## Known limitations

Release note explicitly records:
- commissioning production OTP 0000 is active by default until `KARETA_OTP_TEMP_STATIC_ENABLED=0`;
- external messaging requires server-side provider credentials/webhooks;
- Stage 8 feature matrix contains BETA/INTERNAL/DISABLED domains;
- staging root still returns HTTP 403;
- prior staging checks found missing FULL assets and stale service worker;
- 84.90 has no standalone patch/recovery note.

## Rollback

Release note now contains separate:
- application-only rollback;
- DB rollback;
- Messaging rollback;
- pre-release/post-release checklist.

There is no project-wide reverse/down migration contract in the current manifest. DB rollback is documented as restore of a pre-deploy MySQL snapshot/backup, with application+DB compatibility preserved as one rollback point.

## Verification

`node tools/test_release_notes_84_77_84_109.js`:
`RELEASE_NOTES_84_77_84_109: PASS releases=33 patch=30 queue=1 recovery=1 gap=1 migrations=129`

Unified release checklist:
- 21/21 PASS
- 0 FAIL
- `RELEASE_CHECKLIST: PASS`

## Staging CHECK

Checked 2026-09-25T01:20Z:
- `https://s.kareta.kz/` → HTTP 403;
- `https://s.kareta.kz/docs/changelog/RELEASE_NOTES_R188_5_5_6_84_77_TO_84_109.md` → HTTP 403;
- `https://s.kareta.kz/docs/changelog/release_notes_84_77_84_109.json` → HTTP 403.

Therefore the changelog is complete and locally verified, but the mandatory external staging CHECK remains blocked by the existing server/vhost 403.
