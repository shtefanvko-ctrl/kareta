# KARETA.KZ — Release notes 84.152

Status: **RECONCILIATION CANDIDATE — NOT DEPLOYED / NOT STAGING-VERIFIED**

## Inputs

- current `main`: `d2873bbde16ec985ad14e8ff892df5ccbd7cf3b4`
- previous web/runtime candidate 84.151: `6685ad9e02531dfa653aacd1f1eaf1c7c5a4cecc`
- reconciliation merge: `a7df986cee0d1e05895bbb93290dbc03111b9dac`
- common merge base: `5d333d5e67857d91a44a653e725fb2924eef2004`

## What 84.152 preserves

- complete 84.146–84.151 web/runtime line;
- Android Native API 6;
- canonical DB chain 1..135;
- release-scoped WebView static cache;
- stale-while-revalidate for Services/Masters/Community;
- 84.150 mobile/WebView visual hardening;
- 84.151 server-confirmed logout and per-account isolation;
- unified KaretaFirstVehicleFlow for Garage create/edit;
- current-main city-calm preloader;
- unrelated current-main social, print and media assets.

The only file modified on both sides since the merge base was `index.php`; it was resolved semantically rather than by choosing one side wholesale.

## Release identity

- runtime token: `188.5.5.6.84.152`
- Service Worker token: `188.5.5.6.84.152`
- branch: `release/reconcile-84.152`

## Required gates

Before merge/deploy:
- GitHub `verification-gate` PASS on the exact 84.152 head.

After deploy:
- `python3 tools/verify_staging_current.py --base-url https://s.kareta.kz` PASS;
- exact Git SHA provenance must match runtime;
- two-account Android smoke PASS;
- two-pass warm-route smoke PASS;
- evidence attached to #14, #15 and #21.

CI success alone does not mean DEPLOYED or RELEASED.
