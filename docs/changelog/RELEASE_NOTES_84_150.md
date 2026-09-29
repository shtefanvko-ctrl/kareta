# KARETA.KZ 188.5.5.6.84.150

## Navigation integrity

- Shell navigation uses Identity/context navigation only while Identity is authoritative.
- Legacy and resume-degraded sessions use the existing role-access policy instead of anonymous navigation.
- NavigationCore preserves client/master/seller/STO interface context during transient Identity outages without changing API authorization.
- Removed phantom route key `masterWorkplaceSettings`; canonical settings route is `cabinetSettings`.
- `masterWorkplaceApi` lazy assets now bind to `masterDashboard` and `cabinetSettings`.
- Rebuilt `runtime_shell_bundle.js` from source.
- Added navigation/source/bundle regression coverage.

Database boundary remains migration 135 from release 84.149.
