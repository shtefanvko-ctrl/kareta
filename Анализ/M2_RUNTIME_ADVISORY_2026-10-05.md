# M2 — runtime advisory service relations

Дата: 05.10.2026

## Статус

M2 переносит структурно валидные связи из `Анализ/data/service_links.json` в runtime-слой **только как read-only advisory data**.

Это не экспертное подтверждение и не matching-фильтр.

## Проверено перед переносом

- 109 / 109 service ID существуют в текущем `storage/catalog/services.json`;
- все referenced equipment ID существуют в `storage/catalog/master_equipment.json` (82 позиции);
- все referenced profession ID существуют в `storage/catalog/master_professions.json` (21 профессия);
- source service blob совпадает с текущим service catalog blob: `e3688e785be691fc81ad4030ad6fda34ec822f58`;
- все 109 research rows имеют `equipment_rule = recommendation_not_hard_requirement`;
- все 109 research rows имеют `relation_status = DRAFT_FOR_EXPERT_REVIEW`.

## Runtime контракт

Новый источник:
- `storage/catalog/master_service_advisories.json`

Read-only API в master context:
- `GET api/master_onboarding.php?action=serviceAdvisories`
- `GET api/master_onboarding.php?action=serviceAdvisories&serviceId=<service_id>`

Политика runtime:
- `expert_review = NOT_RUN`;
- `hard_filtering = false`;
- `ranking_impact = disabled`;
- `matching_usage = disabled`;
- relation item `hardRequirement = false`;
- relation item `equipmentRule = advisory_only`.

## Что это разрешает

Следующий M3 может читать один канонический runtime-каталог и строить объяснение-кандидат, например:
- заявленная услуга совпадает;
- профессия мастера согласуется с research advisory;
- у мастера заявлено рекомендуемое оборудование.

До отдельного решения M3 такие признаки не меняют выдачу, ranking или eligibility.

## Что запрещено

- исключать мастера из Биржи из-за отсутствующего оборудования;
- считать профессию подтверждённой квалификацией;
- считать `Есть / В СТО / Арендую` доказательством технической пригодности;
- превращать research proposal в hard requirement без экспертной проверки;
- использовать эти связи для scoring/ranking до отдельного контракта и тестов.

## Gate

`tools/test_master_service_advisories.php` проверяет:
- 109 runtime relations;
- cross-reference всех service/equipment/profession IDs;
- `expert_review = NOT_RUN`;
- запрет hard requirements;
- запрет включения matching/ranking.

Application gates запускают M0 + M1 + M2 проверки вместе.
