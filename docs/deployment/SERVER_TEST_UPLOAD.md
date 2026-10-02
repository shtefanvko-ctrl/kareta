# KARETA.KZ — server-test upload

This document is for the test/staging server only. It does not authorize production deployment.

## Package identity

The generated ZIP is bound to one exact Git SHA through:

- `storage/deployment_manifest.json`;
- `storage/server_package_manifest.json`;
- `package-report.json`;
- `SHA256SUMS.txt`.

Do not rename a different build to the same release and do not edit either manifest by hand.

## Server prerequisites

- HTTPS virtual host / subdomain;
- PHP 8.1 or newer;
- PDO + MySQL/MariaDB driver;
- MySQL/MariaDB reachable with a dedicated test database/user;
- Apache/Plesk configuration that honors the supplied `.htaccess` rules;
- `mod_rewrite` support for clean SPA routes;
- a writable private storage directory outside the public document root when the hosting policy allows it.

Node.js and Python are build/verification tools and are not required to serve the application.

## 1. Prepare private configuration

Do this before the first web request.

The ZIP never contains `config.private.php`.

Copy the artifact sidecar `config.server-test.example.php` to one of the private locations already supported by `config.php`, preferably:

```text
<parent-of-docroot>/.kareta/config.private.php
```

Alternatively set `KARETA_PRIVATE_CONFIG_FILE` to an absolute private path.

Replace all placeholder DB/token values. Keep:

```php
'environment' => 'staging',
'db_auto_create' => false,
'db_auto_migrate' => false,
'demo_seed' => false,
'messaging_auto_schema' => false,
```

Static OTP `0000` is allowed only in the dedicated server-test template. Do not copy that staging setting into production.

## 2. Prepare storage

Preferred:

```text
/var/lib/kareta-test
```

or another path writable by the PHP-FPM user and outside the web root.

Create writable subdirectories as required by the runtime. If Plesk `open_basedir` rejects the external path, KARETA falls back to the packaged `storage/` directory; that directory is HTTP-denied by `storage/.htaccess`.

## 3. Database boundary

The package contains the canonical migration chain and manifest through DB version 137.

Automatic production-style migration is intentionally disabled in the server-test template. Do not enable runtime migrations just to make a failing server boot.

Before accepting staging, the test database must satisfy the canonical migration/schema contract. If the database is behind, use the controlled database maintenance procedure and re-run the repository migration gates before continuing.

## 4. Upload

Use a new empty document root or a new immutable release directory. Do not unpack over the currently served tree.

Verify `SHA256SUMS.txt`, then unpack the generated ZIP so that these paths are directly inside the document root:

```text
.htaccess
index.php
config.php
api/
inc/
js/
css/
assets/
media/
storage/
tools/
```

The packaged `tools/` directory contains only the approved operational CLI subset and is denied over HTTP by the root `.htaccess`.

Recommended permissions:

```text
directories: 755
files:       644
private config: 600 or 640
writable storage: owned/writable by PHP-FPM service user
```

## 5. First server checks

Do not switch production traffic.

Verify from a network that can reach the staging host:

```bash
python3 tools/verify_staging_current.py \
  --base-url https://s.kareta.kz \
  --expected-release 188.5.5.6.84.152

python3 tools/verify_runtime_provenance.py \
  --base-url https://s.kareta.kz \
  --expected-sha <exact-package-sha> \
  --expected-asset-version 188.5.5.6.84.152
```

The following runtime surfaces must agree on the release before the server test is accepted:

- `/`;
- `/sw.js`;
- `/asset_manifest.php?route_loader=1`;
- `/api/db.php?action=ping&identity_probe=1`;
- `/api/provenance.php`;
- every lazy CSS/JS URL enumerated by the staging verifier.

## 6. Harness evidence

After the server checks pass, record exact-SHA evidence on release PR #22:

```text
HARNESS_EVIDENCE external:staging-exact-runtime <exact-sha> PASS <evidence reference>
HARNESS_EVIDENCE external:deployed-provenance <exact-sha> PASS <evidence reference>
```

Android/device receipts remain separate and must not be fabricated from server-only testing.

## Stop conditions

Do not continue to Android acceptance or production if any of the following occurs:

- ZIP checksum mismatch;
- release token mismatch;
- deployed Git SHA mismatch;
- migration/schema failure;
- lazy asset 404 or wrong MIME;
- `config.private.php` missing/unreadable;
- storage not writable;
- staging verifier cannot reach the host;
- provenance endpoint returns 503 or another SHA.
