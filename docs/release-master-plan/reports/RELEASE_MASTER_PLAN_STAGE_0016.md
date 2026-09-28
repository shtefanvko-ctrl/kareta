# RELEASE MASTER PLAN — STAGE 0016

AUTO_STAGE: 16/2513  
Baseline: R188.5.5.6.84.109  
Task: Показывать только доступные context buttons

## Выполнено

- Context switcher больше не строит кнопки из статического списка ролей.
- Источник кнопок — только реальные `KaretaIdentity.contexts`.
- `accountTypes` не создаёт синтетические STO/Магазин.
- STO допускается только для `organizationType=service_station`.
- Магазин допускается только для seller profile или `organizationType=parts_store`.
- Неизвестная организация fail-closed и не маскируется под STO.
- Legacy fallback использует тот же server-driven список contexts.
- Runtime identity bundle пересобран.
- Старые 84.103/84.105 regressions переведены на актуальный contract.
- Добавлен `test_context_buttons_real_contexts_84_109.js`.

## Дополнительное исправление

Во время проверки обнаружен незавершённый cumulative regression: в `api/db.php` уже использовался `kcap()`, но alias отсутствовал. Alias восстановлен через тот же capability pipeline; monolith budget снова PASS.

## Проверки

- PHP syntax: PASS
- JS syntax: PASS
- boot bundle sync: PASS
- context real-context contract: PASS
- role-context scenarios: PASS
- context auto activation: PASS
- db monolith decomposition/budget: PASS

## Staging CHECK

- `https://s.kareta.kz/` -> HTTP 403.
- `/js/next/context_manager.js` -> HTTP 200, но новый `availableContexts()` marker отсутствует.
- `/js/boot/runtime_identity_bundle.js` -> HTTP 200, но новый marker отсутствует.
- На staging присутствует старый `VISIBLE_CONTEXT_OPTIONS`.

Staging result: **FAIL_NOT_DEPLOYED**.

Локальный DOD выполнен. Внешнее подтверждение требует деплоя текущего пакета на staging и повторного CHECK.
