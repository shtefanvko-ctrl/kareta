# Protected catalog sources

This directory is not web-accessible (`storage/.htaccess`).

- `products_globaltuning.json` — external product source imported by migration 034.
- `services.json` — base KARETA.KZ service catalog imported by migration 035.

Catalog source files are immutable import inputs. Runtime reads use normalized MySQL tables. Manual service edits are stored with `manual_override=1` and are not overwritten by repeated source imports.
