# Анализ KARETA — текущая точка продолжения 05.10.2026

Папка `Анализ/` — research/evidence слой. Она не является вторым runtime source of truth.

## Рабочий порядок

Основной исполняемый процесс: [ПРОМПТ_ТРИ_ПРОХОДА_2026-10-05.md](ПРОМПТ_ТРИ_ПРОХОДА_2026-10-05.md)

Порядок обязателен:
1. дополнить исследование;
2. повторно сверить с current main, runtime и активными PR;
3. внедрить минимальный доказуемый инкремент в существующую change lane.

Актуальная сверка: [AUDIT_2026-10-05.md](AUDIT_2026-10-05.md).  
Предыдущий аудит 04.10 сохранён как историческая контрольная точка.

## Текущий статус

| Этап | Состояние | Runtime |
| --- | --- | --- |
| M0 — оборудование | IMPLEMENTED в main | профиль + picker, matching не выводится из наличия |
| M1 — профессии | IMPLEMENTED в main | self-reported, RU/KK/EN, service auto-enable=false, matching disabled |
| M2 — service advisories | IMPLEMENTED в PR #90, не merged | read-only 109 relations, expert review NOT_RUN, hard filtering/ranking/matching disabled |
| M3 — explainable matching | NOT IMPLEMENTED | отдельный будущий контракт |
| M4 — UI matching filters/reasons | NOT IMPLEMENTED как M3 consumer | не подменять существующую Биржу |
| M5 — demand analytics | NOT IMPLEMENTED | 52 query examples = hypotheses, observed demand отсутствует |
| M6 — controlled rollout | NOT IMPLEMENTED | нужен feature-off + comparison + exact release evidence |

Current main на момент аудита: `582b8f94baba60c914cb82e598ad32a806a58117`, asset `188.5.5.6.84.176`.

## Материалы

- [ПОДБОР_ЗАЯВОК_ПЛАН.md](ПОДБОР_ЗАЯВОК_ПЛАН.md) — M0–M6.
- [РЕЕСТР_ОШИБОК.md](РЕЕСТР_ОШИБОК.md) — исторический реестр + актуализация 05.10.
- [ДОПОЛНИТЕЛЬНОЕ_ЗАДАНИЕ_ПРОМПТ.md](ДОПОЛНИТЕЛЬНОЕ_ЗАДАНИЕ_ПРОМПТ.md) — исходное постановочное задание.
- [ПРОМПТ_ТРИ_ПРОХОДА_2026-10-05.md](ПРОМПТ_ТРИ_ПРОХОДА_2026-10-05.md) — текущий исполняемый промпт.
- [РЫНОК_И_ОБОРУДОВАНИЕ.md](РЫНОК_И_ОБОРУДОВАНИЕ.md) — рынок и источники.
- [data](data) — замороженные research snapshots.
- [evidence](evidence) — evidence snapshots; их SHA не считать автоматически текущим candidate.
- [M2_RUNTIME_ADVISORY_2026-10-05.md](M2_RUNTIME_ADVISORY_2026-10-05.md) — M2 lane evidence.

## Research invariants

- `Анализ/data/equipment.json`: 82 equipment / 18 groups.
- `Анализ/data/professions.json`: 21 professions.
- `Анализ/data/service_links.json`: 109 service relations.
- `Анализ/data/query_dictionary.json`: 52 query hypotheses / 6 clarifications.
- Все эти snapshots остаются `DRAFT_NOT_RUNTIME_IMPORT`.
- Structural PASS не равен expert validation.
- Профессия и оборудование не равны квалификации.
- Research relation не является hard requirement.
- `observed_count=null` нельзя превращать в статистику спроса.

## Verification status PR #90

Проверенный кодовый checkpoint: `25d81703649df2799794cd77602472db89e20e3e`.

PASS:
- Application gates run `37238482404`;
- Master setup M0–M2 contracts;
- Analysis research runtime alignment;
- Design canon contract;
- Current API / route / browser-support contracts;
- Asset URL hygiene;
- Provenance contract + exact-candidate artifact;
- PHP syntax run `37238482379`;
- Geo runtime reconcile run `37238482459`;
- Home scanner navigation run `37238482538`.

Это source/CI verification. Реальная MySQL/API с пользовательскими профилями, browser/device smoke и фактический deployment остаются отдельными evidence уровнями.

## Следующие три шага

1. Добавить executable gate `Анализ ↔ runtime`, чтобы research drift не проходил молча.
2. Повторно запустить exact-head Application gates PR #90 после каждой правки и не расширять scope до M3 при FAIL.
3. После convergence M2 отдельно проектировать M3 shadow/explain-only matching с feature-off.
