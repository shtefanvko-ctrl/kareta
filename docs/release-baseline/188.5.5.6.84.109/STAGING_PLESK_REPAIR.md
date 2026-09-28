# s.kareta.kz — Plesk staging repair for 188.5.5.6.84.109

Observed external failure: `https://s.kareta.kz/` resolves to a reachable HTTPS site, but the returned application is UKHPC rather than KARETA.KZ. The application source itself is not the cause; the fault is above the SPA at host/vhost/document-root deployment level.

The known hosting endpoint for the KARETA zone is the PS.kz Plesk host `195.210.46.63` / `srv-plesk33.ps.kz`. The corrective script does **not** hard-code a deployment folder. It searches the Plesk subscription tree for a project whose `inc/asset_version.php` contains `188.5.5.6.84.109`, requires exactly one validated candidate, then updates/creates the `s` subdomain with that folder as `-www-root` and rebuilds Plesk web configuration.

Run on the actual Plesk server as root:

```bash
cd <extracted KARETA project root>
sudo bash tools/repair_staging_plesk_84_109.sh
```

If more than one copy of release 84.109 exists, select the intended tree explicitly:

```bash
sudo KARETA_STAGING_DOCROOT=/var/www/vhosts/kareta.kz/<exact-folder> \
  bash tools/repair_staging_plesk_84_109.sh
```

The script is fail-closed: it refuses a directory without `index.php` and the exact release marker, refuses a target outside the `kareta.kz` Plesk subscription, preserves a before-state log, and does not edit application code or database data.

Expected Plesk operations are equivalent to:

```bash
plesk bin subdomain --update s -domain kareta.kz -www-root /<detected-root> -php true -ssl true
plesk repair web kareta.kz -y
```

If the `s` subdomain is absent in Plesk, the script creates it instead. Plesk documents `subdomain --create/--update`, `-domain`, and `-www-root` for this purpose.

After repair, verify externally:

```bash
python3 tools/verify_staging_release_84_109.py
```

Only `KARETA_STAGING_84_109: OK` is sufficient to mark `externalStaging=PASS` in `staging_check.json`.
