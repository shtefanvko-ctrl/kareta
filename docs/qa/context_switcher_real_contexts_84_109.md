# AUTO_STAGE 16/2513 — context buttons from real contexts

Baseline: R188.5.5.6.84.109

Изменение:
- context switcher строится только из `KaretaIdentity.contexts`;
- `accountTypes` больше не создаёт синтетические кнопки;
- СТО отображается только для `organizationType=service_station`;
- Магазин — только для seller profile или `organizationType=parts_store`;
- неизвестная организация не маскируется под СТО;
- legacy fallback использует тот же список реальных server contexts.

Локальные проверки:
- CONTEXT_BUTTONS_REAL_CONTEXTS_84_109: PASS
- R188.5 role-context scenarios: PASS
- context auto activation: PASS
- boot JS bundles fresh: PASS
- db monolith budget: PASS

Staging CHECK:
- `https://s.kareta.kz/` -> HTTP 403
- `/js/next/context_manager.js` -> HTTP 200, но новый marker отсутствует
- `/js/boot/runtime_identity_bundle.js` -> HTTP 200, но новый marker отсутствует
- старый `VISIBLE_CONTEXT_OPTIONS` на staging присутствует

Результат staging: FAIL_NOT_DEPLOYED.
