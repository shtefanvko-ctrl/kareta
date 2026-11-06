# KARETA.KZ — один утверждённый брендбук + дополнение

**Исходный Landing Canon v2 не заменён.** Для агентов в GitHub:
- [Точное содержание 12 исходных слайдов](LANDING_CANON_V2_SOURCE.md).
- [Дополнение — страницы 13–27, измерения и регрессионные правила](LANDING_CANON_V2_ADDENDUM.md).
- [Кандидатные семантические роли цветов](canon_v2_addendum_tokens.json).
- [Матрица WCAG](contrast_matrix_v2_addendum.csv), [практические пары](contrast_pairs_v2_addendum.csv), [HSL-угловая совместимость](hue_compatibility_v2_addendum.csv).

**Полный оригинал** `KARETA_KZ_brandbook_landing_canon_v2_ORIGINAL.pptx` и **дополненный исходный PPTX** `KARETA_KZ_brandbook_landing_canon_v2_EXTENDED.pptx` лежат в проектной библиотеке ChatGPT `/kareta.kz/docs/design/`. 24 ранее опубликованных slide XML и relationships проверены на byte-for-byte identity.

Процедура для всех агентов: `AGENTS.md` → `ai/CONTEXT_ROUTER.md` → `ai/rules/design-system.md` → исходный v2 + дополнение. 

Не путать документирование с runtime-миграцией: CSS/JS маршруты и production этим PR не меняются.

## Большой пакет иконок — продолжение, не новая библиотека

- **120 исходных значков** (Font Awesome Free solid / CC BY 4.0), старые ID и 258 элементов архива сохранены побайтово.
- К нему добавлены 240 SVG, 240 PNG для light/dark, реестр и 120 currentColor mono-символов; полный архив в проектной библиотеке: `/kareta.kz/docs/design/KARETA_CLIENT_120_HQ_SVG_PNG_CANON_V2_ADDON.zip`.
- См. [правила и лицензия](../../assets/icons/kareta-client-120/README.md), [манифест 120](../../assets/icons/kareta-client-120/manifest_canon.json) и [монохромный спрайт](../../assets/icons/kareta-client-120/kareta-client-120-mono-sprite.svg).
- Это большие **filled** иконки для карточек; они не заменяют 24×24 outline меню. Плотность/контраст/роль проверять до подключения.
- PPTX/PDF в библиотеке обновлены до **27 страниц** (24 старых идентичны исходной версии, проверено пиксельным сравнением PDF).
