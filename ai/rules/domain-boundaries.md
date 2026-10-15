# KARETA domain boundaries v1.0

Load for cross-role/cross-module work. Canonical source paths and owner hints are in `ai/SURFACE_MAP.json`; route keys are in `ai/FEATURE_PRESERVATION_BASELINE.json`. This is guidance, not a second route or schema registry.

## Existing domain ownership
| Domain | Where to inspect first | Non-negotiable boundary |
| --- | --- | --- |
| Identity | `api/identity/`, `api/identity_session.php` | Authenticated subject is separate from capabilities and record ownership. |
| Vehicles | `js/next/pages/vehicle.js`, garage page | Use one vehicle ID and owner; no duplicate garage wizard or car authority. |
| Orders and slots | Existing order/request APIs and scheduling owners | Inspect producer/consumer and transactional slot guards; do not implement parallel booking. |
| Geography | `api/geo.php`, canonical city catalog | One city ID; support manual city if GPS unavailable. |
| Marketplace | `api/catalog/`, `api/seller_shop.php` | Server-owned SKU/OEM/fitment, seller permissions, stock and order state. |
| Community and messaging | Existing community/chats/notifications pages and APIs | Reuse authenticated message delivery and moderation owners. |
| Diagnostics | `js/next/pages/diagnostics.js`, `api/obd.php`, `js/mobile_native_bridge.js` | One diagnostic engine; carless scans; selected vehicle binding only by explicit authorized action. |
| Administrator | `js/next/pages/admin_workspaces.js`, `api/admin_operations.php` | Admin controls reuse domain APIs and require server authorization. |

## Changing a boundary
Enumerate producer, consumer, action, data authority, privacy scope, retry/idempotency and legacy compatibility. Verify changed and unaffected paths and at least one rejected/unauthorized path where relevant. UI roles do not confer server authority; client, master, STO, seller and admin may see different actions on the same underlying business object.

Existing routes/pages or class names do not prove successful runtime behavior, native-device support, deployment or privileges. Consult actual code for current details.
