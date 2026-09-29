# KARETA.KZ — ENGINEERING GUIDE

Version: 2026-09-29
Status: MIXED — CONTEXT-LEVEL FACTUAL INVENTORY COMPLETE / PARTIALLY VERIFIED
Scope: architecture, domain boundaries, agent workflow, verification and release discipline.

> Важно: первый фактический проход выполнен по всем bounded contexts. Документ теперь совмещает подтверждённые факты и целевые ограничения. Каноническим считается только утверждение, которое имеет repository evidence; неполные границы, legacy-совместимость и планируемые изменения сохраняют явный статус и не выдаются за завершённую реализацию.

## 0. Основной принцип

KARETA.KZ развивается инкрементально. Рабочая архитектура не переписывается с нуля без доказанной необходимости.

Обязательная цепочка для изменения:

`TASK → FACTUAL INVENTORY → DOMAIN → CONTEXT → CONTRACT → IMPLEMENT → VERIFY → REGRESSION → RELEASE GATE`

Запрещено:

`TASK → SEARCH SIMILAR CODE → MODIFY EVERYTHING → DONE`

До реализации должны быть определены: целевая feature, фактический владелец данных, разрешённые commands/queries, API contract, invariants, regression scope и acceptance evidence.

## 1. Статусы архитектурных утверждений

Используются пять статусов:

- `VERIFIED` — конкретное утверждение полностью подтверждено требуемым evidence;
- `PARTIALLY_VERIFIED` — граница или feature подтверждена repository evidence, но не все legacy paths, callers, permissions и regression scenarios исчерпывающе проверены;
- `PARTIALLY_VERIFIED_WITH_P0_DEBT` — фактическая граница подтверждена, но внутри неё найдено критичное архитектурное расхождение, которое нельзя скрывать статусом READY;
- `TARGET_UNTIL_VERIFIED` — целевое утверждение ещё не подтверждено фактической реализацией;
- `PLANNED` — механизм описан, но ещё не включён как автоматический enforcement.

Нельзя называть ownership каноническим только потому, что он логично выглядит в DDD-модели.

## 2. Bounded contexts — фактический статус

Первый repository-backed inventory pass завершён для всех основных контекстов. На текущем этапе:

- `Identity` — `PARTIALLY_VERIFIED`: Account, Person, PersonProfile, AuthSession, Context, Capability;
- `Garage` — `PARTIALLY_VERIFIED`: GarageVehicle и vehicle-owned child state; физический runtime-store пока `client_vehicles`;
- `Master` — `PARTIALLY_VERIFIED`: MasterProfile, onboarding, availability/preferences и рабочие настройки;
- `Service` — `PARTIALLY_VERIFIED`: ServiceRequest, RepairOrder и repair lifecycle при сохранённом legacy shared store `orders`;
- `Booking` — `PARTIALLY_VERIFIED`: CalendarEvent, Booking и scheduling projection;
- `Organization` — `PARTIALLY_VERIFIED`: Organization, Membership, organizational workplace и legacy STO/seller mirrors;
- `Marketplace` — `PARTIALLY_VERIFIED`: Product/Order/Stock с выявленным параллельным `market_*` / `seller_*` контуром;
- `Community` — `PARTIALLY_VERIFIED`: типизированные CommunityPost, WorkPublication, MasterWallPost и feed projection;
- `Communication` — `PARTIALLY_VERIFIED`: Thread, Message, participant/read state и Notification с выявленным dual-store;
- `Finance` — `PARTIALLY_VERIFIED`: Invoice, Payment, Transaction, Ledger и operational projections;
- `Platform` — `PARTIALLY_VERIFIED_WITH_P0_DEBT`: projection, events, ACL, idempotency, realtime, health/reliability infrastructure.

`PARTIALLY_VERIFIED` не означает «всё закончено». Он означает, что граница подтверждена текущим `main`, а оставшиеся неизвестные, legacy paths и debt перечислены в machine-readable SoT.

`Platform` не является универсальным владельцем бизнес-логики: его generic entities, relations, events, indexes и read models не могут создавать более сильный business fact, чем owning context.

## 3. Domain ownership rule

Целевое правило:

`ONE MUTABLE BUSINESS ENTITY → ONE OWNER`

Для уже инвентаризированных частей owner/runtime store/invariant фиксируется вместе с `evidence`. Поле `targetOwner` используется там, где ownership ещё является целевой границей или требует дополнительной проверки. Отсутствие evidence не превращается в канон по умолчанию.

Другой context может читать данные только через определённый read/query contract. Запись в чужой context допускается только через owner command/API/event contract.

Запрещённый класс изменений:

- `Service → direct UPDATE garage_vehicles`;
- `Master → direct UPDATE accounts`;
- `Marketplace → direct UPDATE repair_orders`.

## 4. Ubiquitous Language

Не считать взаимозаменяемыми:

`Account != Person`
`Account != Profile`
`Role != Context`
`Role != Capability`
`Vehicle != GarageVehicle`
`ServiceRequest != RepairOrder`
`Booking != RepairOrder`
`MasterProfile != Account`
`OrganizationMembership != Account Role`

Если legacy-код использует `user`, задача обязана определить фактический смысл: Account, Person, Profile, Membership или actor projection.

## 5. Identity constraints

Целевая модель:

`Account → Person → Profiles / Memberships / Contexts`

Обязательные ограничения для будущих изменений:

1. Upgrade CLIENT → MASTER не должен создавать второй Account.
2. Upgrade CLIENT → SELLER не должен создавать второй Account.
3. Context определяет рабочую область, а не заменяет authorization.
4. Backend является authority для effective capabilities.
5. Frontend role/context не является достаточным authorization check.
6. Revoke membership должен лишать доступа к соответствующему Organization context.

Базовая цепочка Account → Person → Profile/Context, backend effective capabilities и resource-scope authorization уже подтверждены текущим кодом как `PARTIALLY_VERIFIED`. Оставшиеся Identity gaps перечислены в `BOUNDED_CONTEXTS.json`; legacy role fallback не считается новым источником authorization.

## 6. Service / Booking separation

Целевая семантика:

`ServiceRequest != Booking != RepairOrder`

- ServiceRequest — намерение/запрос клиента;
- Booking — резервирование времени;
- RepairOrder — принятый процесс диагностики/ремонта.

Booking не должен автоматически означать принятие ремонта.

Repair lifecycle должен быть описан отдельным contract; статус паузы и причина паузы хранятся раздельно.

## 7. Feature Contract

Каждая feature получает contract, который отделяет подтверждённое от целевого. Минимальный рабочий пример:

```json
{
  "featureId": "calendar.booking",
  "route": "#/calendar",
  "boundedContext": "Booking",
  "supportingContexts": ["Identity", "Master", "Service"],
  "verificationStatus": "PARTIALLY_VERIFIED",
  "primaryAggregate": "Booking",
  "runtimeStores": ["calendar_events", "service_bookings"],
  "commands": ["booking.create", "booking.cancel"],
  "queries": ["calendar.view", "booking.availability"],
  "capabilities": ["calendar.manageOwn", "calendar.manageOrganization"],
  "apiOwner": "api/domain.php",
  "invariants": ["booking conflict must be rejected"],
  "knownDebt": [],
  "evidence": ["api/domain.php", "api/migrations/067_calendar_booking.php"]
}
```

Feature нельзя переводить в `READY` только по наличию route/handler. Нужны acceptance evidence, regression evidence и отсутствие неучтённого P0 debt.

## 8. Machine-readable domain SoT

Файлы:

- `docs/domain/DOMAIN_GLOSSARY.json`
- `docs/domain/BOUNDED_CONTEXTS.json`
- `docs/domain/FEATURE_MAP.json`
- `docs/domain/DOMAIN_RULES.json`

Первый context-level factual inventory pass завершён. Поэтому эти файлы теперь имеют смешанный статус: подтверждённые поля опираются на repository evidence, а `target*`, `unverified`, `knownDebt` и специальные verification statuses явно показывают неполные или целевые части.

`BOUNDED_CONTEXTS.json` сохраняет цепочку:

`context → ownership/runtime stores → commands → queries → events → APIs → dependencies → forbiddenWrites → invariants → debt → evidence`

`FEATURE_MAP.json` связывает canonical route, feature, context, aggregate, runtime stores, API, capability, invariants, tests, debt и evidence.

Machine-readable SoT не заменяет runtime-код и не создаёт новую бизнес-модель. Он является проверяемой картой текущей реализации и целевых ограничений.

## 9. Agent Context Pack

Planner получает:

`TASK + TARGET FEATURE + FACTUAL EVIDENCE + BOUNDED CONTEXT + DOMAIN RULES + FEATURE CONTRACT + DEPENDENCY MAP`

Implementer получает только approved scope, allowed files/context, contracts, acceptance criteria и regression scope.

Verifier проверяет результат независимо от рассуждений Implementer.

## 10. Hard guardrails

Агенту запрещено:

1. менять ownership без отдельного architecture decision;
2. создавать второй SoT;
3. добавлять новый business action прямо в legacy `api/db.php`;
4. добавлять новый direct frontend fetch к legacy DB endpoint для business action;
5. подменять backend authorization frontend role check;
6. удалять legacy только потому, что новый код похож;
7. объявлять feature READY без evidence;
8. считать наличие handler/TODO/route доказательством рабочего поведения.

## 11. api/db.php strangler

`api/db.php` остаётся compatibility/router layer на период миграции.

Новые business actions в monolith не добавляются. Извлечение выполняется по одному domain contract с сохранением auth, error, idempotency и regression behavior.

## 12. Verification и Release Gate

Пока автоматизация не подключена:

`DOMAIN_CHECK = PLANNED / DOCUMENTATION-ENFORCED`

Целевая цепочка:

`DOMAIN CHECK → IMPLEMENTATION CHECK → REGRESSION CHECK → FEATURE STATUS → RELEASE GATE`

Domain Check проверяет owner/context/contract/invariants/cross-context writes/duplicate SoT/authorization boundary.

Release Gate отдельно проверяет syntax, migrations, API, security, UI, PWA, smoke, regression и staging evidence.

## 13. Domain Definition of Done

Domain change завершён только если:

```text
FACTUAL INVENTORY DONE FOR CHANGED AREA
DOMAIN OWNER VERIFIED OR EXPLICITLY MARKED TARGET
CONTRACT IDENTIFIED
NO NEW DUPLICATE ENTITY
NO DIRECT CROSS-CONTEXT WRITE
BACKEND AUTH VERIFIED
API CONTRACT VERIFIED
HAPPY PATH PASS
CRITICAL ERROR PATH PASS
REGRESSION PASS
EVIDENCE SAVED
FEATURE_MAP UPDATED WHEN APPLICABLE
DOMAIN_RULES UPDATED WHEN APPLICABLE
```

## 14. Текущая фаза внедрения

### Step 1 — Context-level Actual Domain Inventory — DONE

Первый проход по DB tables, API actions, PHP handlers, JS routes/state, permissions/capabilities и representative tests выполнен по всем основным bounded contexts. Это не означает исчерпывающий call-site audit.

### Step 2 — P0 remediation inventory / contracts — CURRENT

Для каждого P0 сначала фиксируются root cause, canonical owner, readers/writers, compatibility path, migration contract, regression scope и rollback evidence. Код до этого не переписывается.

### Step 3 — Incremental implementation

Каждый P0 исправляется отдельно, в изолированном scope. Legacy path не удаляется, пока replacement не докажет data/behavior parity и regression safety.

### Step 4 — Enforcement

После стабилизации правил они переводятся из documentation-only в machine-enforced CI/release guardrails. Сначала задаётся baseline и механизм исключений, затем blocking checks.

## 15. Приоритет после первого factual pass

Текущий порядок не определяется количеством похожего кода. Приоритет задаётся риском нарушения ownership, authorization, idempotency и пользовательских данных:

1. `P0 PLATFORM-PROJECTION-001` — projection `domain_entities/domain_relations` не должна преждевременно утверждать существование RepairOrder для любого legacy `orders` row.
2. `P0 PLATFORM-IDEMPOTENCY-001` — один idempotency key не должен принимать другой request payload; mismatch обязан давать conflict.
3. `P0 COMM-NOTIFY-SOT-001` — свести `notifications` и `notification_center` к одному semantic notification contract без преждевременного удаления legacy producers.
4. `P0 MARKET-SOT-001` — установить canonical Product/Order/Stock ownership между `market_*` и `seller_*`, предварительно доказав reader/writer/ID/lifecycle parity.
5. `P0 FIN-AUTH-001` — закрыть capability-gap в operational Finance writes, сохранив resource/STO/order scope.
6. После P0 — пройти P1 boundary/action inventory: Booking↔Service, Master scheduling, Organization membership, Community social interactions, health/repair separation и `api/db.php` strangler.

Перед изменением агент обязан ответить:

```text
WHAT DOMAIN?
WHO OWNS THE DATA — FACTUALLY?
WHAT IS THE AGGREGATE?
WHAT COMMAND/QUERY IS USED?
WHAT CAPABILITY IS REQUIRED?
WHAT INVARIANT MUST SURVIVE?
WHAT REGRESSION CAN THIS BREAK?
WHAT EVIDENCE WILL PROVE DONE?
```

Если критический ответ неизвестен — сначала аудит, потом изменение кода.

## 16. Projection, read-model and duplicate-removal rules

После фактической инвентаризации добавляется отдельное правило: визуально или структурно похожие данные не считаются дублем автоматически.

- Aggregate/owner state и projection/read model — разные вещи. Projection может объединять данные нескольких контекстов, но не получает право менять их business lifecycle.
- Один UI feed может собираться из нескольких типизированных источников. Это не причина сливать source tables в одну таблицу.
- Удалять копию можно только после доказательства semantic equivalence: одинаковый owner, identity, lifecycle, invariants, writers, readers и recovery behavior.
- Если два хранилища представляют один и тот же mutable fact, выбирается canonical writer и строится adapter/backfill/dual-read migration; если они представляют разные aggregates, унифицируется query/read contract, а не storage.
- Generic Platform tables (domain_entities/domain_relations/search/feed/index/cache) считаются projections, пока отдельным решением не доказано обратное. Они не могут создавать более сильный бизнес-факт, чем source owner.

### Idempotency

Idempotency contract: `ACTION + STABLE ACTOR/CONTEXT + KEY + REQUEST HASH -> ONE RESULT`. Повтор с тем же key и другим payload — конфликт, а не replay старого ответа. Session rotation не должна сама по себе создавать новый business-operation scope.

### Health / repair separation

Liveness/readiness проверяет состояние. Repair/migration изменяет состояние. Эти контракты не смешиваются без явного названия, разрешения и release policy. Production migration предпочтительно завершается до приёма обычного трафика; runtime auto-repair остаётся compatibility/emergency path, пока его нельзя безопасно убрать.

### Приоритеты

Порядок remediation хранится в разделе 15 и в machine-readable debt полях. Этот раздел определяет правила безопасного удаления дублей и projections, а не дублирует очередь задач.


### Notification canonicalization

Для Communication зафиксирован переходный контракт: `notification_center` — canonical in-app notification/read-state; `notifications` временно остаётся compatibility producer и источником legacy ID для внешней доставки Telegram/WhatsApp.

Новые legacy notifications с конкретным user (или разрешимым phone) зеркалятся в `notification_center` идемпотентно. Ключ bridge: `legacy:<legacyNotificationId>:user:<userId>`. Legacy ID захватывается до mirror insert и не меняется, потому что на него уже опирается Messaging.

Исторические role-only строки нельзя механически размножать по пользователям: у них общий read-state. Для них сначала определяется recipient-expansion policy. Backfill запускается dry-run инструментом `tools/backfill_notification_center_from_legacy.php`; `--apply` допустим только после проверки отчёта и regression.


### Marketplace dual-model rule

В Marketplace подтверждены два одновременно активных контура: `seller_*` обслуживает текущие `#/parts` и `#/seller`, а `market_*` обслуживает отдельный `#/market` и domain API. Это не простой дубль таблиц.

Критическое различие — stock/order semantics. `market_*` разделяет warehouse, quantity, reserved и stock movements; checkout сначала резервирует, fulfillment списывает. `seller_*` хранит `stock_qty` прямо в product и уменьшает его уже при создании заказа. Жизненные циклы заказов также различаются.

Поэтому физический canonical store пока не выбирается. Сначала используется `docs/domain/MARKETPLACE_PARITY_MATRIX.json` и read-only `tools/audit_marketplace_dual_sot.php`. SKU без owner не является идентификатором. Автоматическое копирование/слияние stock и order запрещено до явного identity/lifecycle mapping и regression parity.


### Operational Finance authorization

У operational Finance один canonical capability key: `finance.manage`. Текущие aliases `finance.manageOwn` и `finance.manageOrganization` сводятся к нему, поэтому они пока не являются отдельными permission semantics.

GET `operationalFinance.dashboard` уже capability-gated, но шесть POST mutation actions пока проходят только внутренние role/resource/STO checks. Нельзя просто добавить gate и считать задачу закрытой: сначала нужно проверить реальные deployed capability sets. В частности, `profile.master` в просмотренных seed migrations не имеет доказанного `finance.manage`.

Порядок: `docs/domain/FINANCE_AUTH_MATRIX.json` → read-only `tools/audit_operational_finance_authorization.php` → минимальный capability seed для допустимых контекстов → dispatcher gates → regression для master/STO/admin/owner. `organization.member` не получает finance.manage автоматически.
