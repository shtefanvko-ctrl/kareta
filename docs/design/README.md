# KARETA.KZ — один утверждённый брендбук + дополнение

**Исходный Landing Canon v2 не заменён.** Для агентов в GitHub:
- [Точное содержание 12 исходных слайдов](LANDING_CANON_V2_SOURCE.md).
- [Дополнение — страницы 13–24, измерения и регрессионные правила](LANDING_CANON_V2_ADDENDUM.md).
- [Кандидатные семантические роли цветов](canon_v2_addendum_tokens.json).
- [Матрица WCAG](contrast_matrix_v2_addendum.csv), [практические пары](contrast_pairs_v2_addendum.csv), [HSL-угловая совместимость](hue_compatibility_v2_addendum.csv).

**Полный оригинал** `KARETA_KZ_brandbook_landing_canon_v2_ORIGINAL.pptx` и **дополненный исходный PPTX** `KARETA_KZ_brandbook_landing_canon_v2_EXTENDED.pptx` лежат в проектной библиотеке ChatGPT `/kareta.kz/docs/design/`. 12 исходных slide XML и relationships проверены на byte-for-byte identity.

Процедура для всех агентов: `AGENTS.md` → `ai/CONTEXT_ROUTER.md` → `ai/rules/design-system.md` → исходный v2 + дополнение. 

Не путать документирование с runtime-миграцией: CSS/JS маршруты и production этим PR не меняются.
