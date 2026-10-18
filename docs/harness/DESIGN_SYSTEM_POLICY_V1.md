# KARETA Design Harness Policy v1

Status: canonical verification policy for design-system changes.

## Architecture
Settings -> Primitive Tokens -> Semantic Tokens -> Shared Components -> Role Delta -> Page Layout -> Generated Output.

## Ownership
- css/next/design_contract.css is the single source owner of global canonical design tokens.
- Shared components own reusable component geometry and states.
- Role CSS contains only semantic/functional deltas.
- Page CSS contains only page layout/composition.
- Generated bundles are derivative artifacts, never independent design owners.
- Do not collapse semantically different control/card/panel/dialog values into one universal token.

## Settings
Settings may change only validated semantic tokens/presets. They must not create arbitrary CSS override layers.

## Responsive contract
phone <=767px; tablet 768-1199px; desktop >=1200px.

## Required gates
1. DESIGN_TOKEN_OWNERSHIP: one source owner per canonical token.
2. DESIGN_GENERATED_PARITY: generated bundles reproduce their source inputs.
3. DESIGN_COMPONENT_CONTRACT: role/page layers do not duplicate shared component ownership.
4. DESIGN_RESPONSIVE_CONTRACT: canonical breakpoints remain intact.
5. DESIGN_LEGACY_GUARD: no new legacy override layer.
6. DESIGN_IMPORTANT_GUARD: no unexplained growth of !important.
7. DESIGN_Z_INDEX_GUARD: no arbitrary numeric z-index outside the contract.
8. DESIGN_SETTINGS_CONTRACT: settings resolve through semantic tokens.

## Change protocol
Classify touched legacy CSS as ACTIVE, DUPLICATE, SUPERSEDED, DEAD, GENERATED, or UNKNOWN.
Never delete UNKNOWN rules without evidence. Never hand-fix a generated bundle as the source solution.
Preserve API, DB/migrations, Geo, ELM327, Scanner/VIN/QR, authentication, orders/business lifecycle, Android bridge, Service Worker and route logic unless separately tasked.

## Definition of Done
A design change is DONE only on one exact HEAD SHA where design gates and the surrounding Application/PHP/Geo/Scanner gates required by the recovery line pass. Old PASS is not evidence for a new HEAD.
