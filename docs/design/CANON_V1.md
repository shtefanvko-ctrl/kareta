# KARETA Design Canon v1

Status: active migration contract.

## Owners

- `css/next/design_contract.css` — shared tokens and the only canonical z-index scale.
- `css/next/master_surfaces.css` — master shell/page geometry and responsive layout.
- `css/next/master_client_r84_postlude.css` — route/component presentation only; it must not own shell geometry.
- `css/routes/master_runtime.css` — generated artifact; never edit directly.

## Canonical layer scale

`base 0 → sticky 20 → shell 40 → nav 50 → fab 60 → overlay 80 → modal 100 → toast 120 → debug 200`.

New raw numeric `z-index` values are not allowed in the master geometry owner. Components should consume the named layer tokens.

## Overlay law

The Window Engine may have at most two overlay levels: an overlay/window and one modal above it. Routes must not build a third independent stack.

## Responsive law

- phone: <= 767 px — one content column, compact filters, no horizontal page overflow;
- tablet: 768–1199 px — dedicated two-column density where useful;
- desktop: >= 1200 px — bounded desktop workspace, higher information density.

The master exchange follows the client search/list visual language. API calls, route ownership and business state remain unchanged by presentation-only increments.

## Legacy migration

Historical `restore`, `recovery`, `modernization phase*`, legacy responsive bundles and old canonical files are migration inputs, not owners.

Retirement sequence:
1. stop adding new overrides to legacy files;
2. move active geometry/tokens into the owners above;
3. prove parity with static contracts and browser acceptance;
4. remove dead rules only after exact selectors are proven unused.

## Definition of done

- changes live in source files, not only a generated bundle;
- generated master runtime matches its source list;
- geometry exists in one owner;
- no new raw numeric z-index in that owner;
- phone/tablet/desktop contracts stay explicit;
- no API/DB/business-logic changes in a presentation-only increment;
- Application gates pass.
