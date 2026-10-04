# KARETA Design Canon v1

Status: migration contract for the current UI cleanup.

## Source owners

- `css/next/design_contract.css` owns shared visual tokens and the z-index scale.
- `css/next/master_surfaces.css` owns master page geometry and responsive layout.
- `css/routes/master_runtime.css` is generated. Do not edit it directly.
- Route/component CSS may own component appearance, but must not redefine shell geometry or invent layer numbers.

## Layer contract

Only these levels are canonical:

- `--k-z-base: 0`
- `--k-z-sticky: 20`
- `--k-z-shell: 40`
- `--k-z-nav: 50`
- `--k-z-fab: 60`
- `--k-z-overlay: 80`
- `--k-z-modal: 100`
- `--k-z-toast: 120`
- `--k-z-debug: 200`

New raw numeric `z-index` values are not allowed in the master surface owner.

## Overlay contract

The Window Engine contract remains maximum two overlay levels:
1. overlay/window;
2. modal above that window.

A route must not create an independent third stack.

## Responsive contract

- phone: up to 767 px — one content column;
- tablet: 768–1199 px — two-column layouts where useful;
- desktop: 1200 px and above — desktop information density and bounded content width.

The master exchange uses the client search/list visual language, but keeps master route logic, API calls and data contracts unchanged.

## Legacy migration rule

`restore`, `recovery`, `modernization phase*`, legacy responsive bundles and historical canonical files are frozen migration inputs, not design owners. Do not add new geometry fixes to them.

Retirement order:
1. stop adding new overrides;
2. move active values into the token/surface owner;
3. prove route parity with contract tests and browser acceptance;
4. remove dead legacy rules only after exact selectors are proven unused.

## Definition of done for a design increment

- source file changed, not only generated bundle;
- generated route bundle is fresh;
- no new raw z-index value in the master surface owner;
- phone/tablet/desktop contracts remain explicit;
- no API, DB or route ownership change in a presentation-only increment;
- Application gates pass.
