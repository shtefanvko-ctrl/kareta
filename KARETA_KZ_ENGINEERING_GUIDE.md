# KARETA.KZ — ENGINEERING GUIDE

Version: 2026-09-29
Status: TARGET UNTIL VERIFIED
Scope: architecture, domain boundaries, agent workflow, verification and release discipline.

> Важно: этот документ задаёт целевую инженерную модель. Граница bounded context или ownership не считается фактически подтверждённой, пока она не сверена с текущими DB tables, API actions, PHP handlers, JS state, routes, permissions и tests.

## 0. Основной принцип

KARETA.KZ развивается инкрементально. Рабочая архитектура не переписывается с нуля без доказанной необходимости.

Обязательная цепочка для изменения:

`TASK → FACTUAL INVENTORY → DOMAIN → CONTEXT → CONTRACT → IMPLEMENT → VERIFY → REGRESSION → RELEASE GATE`

Запрещено:

`TASK → SEARCH SIMILAR CODE → MODIFY EVERYTHING → DONE`

До реализации должны быть определены: целевая feature, фактический владелец данных, разрешённые commands/queries, API contract, invariants, regression scope и acceptance evidence.

## 1. Статусы архитектурных утверждений

Используются три статуса:

- `VERIFIED` — подтверждено фактическим кодом/БД/API/tests;
- `TARGET_UNTIL_VERIFIED` — целевая архитектурная граница, ещё требующая инвентаризации;
- `PLANNED` — механизм описан, но ещё не включён как автоматический enforcement.

Нельзя называть ownership каноническим только потому, что он логично выглядит в DDD-модели.

## 2. Целевые bounded contexts

До завершения Actual Domain Inventory следующие границы имеют статус `TARGET_UNTIL_VERIFIED`:

- `Identity` — Account, Person, AuthSession, AuthChallenge, Context, Capability;
- `Garage` — GarageVehicle, VehicleProfile, vehicle ownership, garage state;
- `Master` — MasterProfile, skills, master services, working status, operational settings;
- `Service` — ServiceRequest, RepairOrder, diagnostics, repair lifecycle;
- `Booking` — Booking, CalendarSlot, appointment/time reservation;
- `Organization` — Organization/STO, Membership, workplace, organization settings;
- `Marketplace` — Product, PartProduct, SellerOffer, Stock, PartOrder;
- `Community` — Post, WorkPublication, Subscription, Like, Comment;
- `Communication` — Thread, Message, Notification, delivery state;
- `Finance` — Payment, Invoice, Transaction, Commission, Settlement;
- `Platform` — Audit, Feature Registry, Runtime Config, Integration Health, Idempotency, Trace.

`Platform` не должен превращаться в универсального владельца бизнес-логики.

## 3. Domain ownership rule

Целевое правило:

`ONE MUTABLE BUSINESS ENTITY → ONE OWNER`

До фактической проверки владелец в документации считается `targetOwner`, а не доказанным canonical owner.

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

Фактическое соответствие текущего кода этим правилам проверяется отдельно и не предполагается автоматически.

## 6. Service / Booking separation

Целевая семантика:

`ServiceRequest != Booking != RepairOrder`

- ServiceRequest — намерение/запрос клиента;
- Booking — резервирование времени;
- RepairOrder — принятый процесс диагностики/ремонта.

Booking не должен автоматически означать принятие ремонта.

Repair lifecycle должен быть описан отдельным contract; статус паузы и причина паузы хранятся раздельно.

## 7. Feature Contract

Каждая feature получает contract минимум с полями:

```json
{
  "featureId": "master.schedule",
  "route": "#/master/schedule",
  "boundedContext": "Booking",
  "verificationStatus": "TARGET_UNTIL_VERIFIED",
  "primaryAggregate": "Booking",
  "commands": [],
  "queries": [],
  "capabilities": [],
  "apiOwner": null,
  "invariants": [],
  "evidence": []
}
```

Feature нельзя переводить в `READY`, пока обязательное evidence не подтверждено.

## 8. Machine-readable domain SoT

Файлы:

- `docs/domain/DOMAIN_GLOSSARY.json`
- `docs/domain/BOUNDED_CONTEXTS.json`
- `docs/domain/FEATURE_MAP.json`
- `docs/domain/DOMAIN_RULES.json`

Пока inventory не завершён, эти файлы являются `TARGET_UNTIL_VERIFIED`, а не доказанным описанием текущей реализации.

`BOUNDED_CONTEXTS.json` должен со временем содержать:

`context → owns → commands → queries → events → APIs → dependencies → forbiddenWrites → evidence`

`FEATURE_MAP.json` должен со временем покрыть все canonical routes/features и связать route, feature, context, aggregate, API, capability, invariants, tests и readiness evidence.

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

## 14. Порядок внедрения

### Step 1 — Actual Domain Inventory

Инвентаризировать DB tables, API actions, PHP handlers, JS state/models, routes, permissions и tests. Не переименовывать и не переносить код ради красивой схемы.

### Step 2 — Verify SoT

Для каждого контекста заполнить фактические commands, queries, APIs, dependencies, events, tests и evidence. Только после этого менять статус отдельных утверждений на `VERIFIED`.

### Step 3 — Enforcement

Сначала включить guardrails для новых изменений: no new monolith business actions, no direct cross-context writes, no duplicate entities, mandatory owner/context, mandatory contract evidence.

Старые нарушения устраняются инкрементально при работе с соответствующей feature.

## 15. Приоритет инвентаризации

1. Identity: `Account / Person / Profile / Context / Capability / Membership`.
2. Vehicle: `Vehicle / GarageVehicle / ownership / service-history projection`.
3. Service: `Service / ServiceRequest / Booking / RepairOrder / RepairStatus`.
4. Затем Organization/STO, Marketplace, Communication, Finance, Community.

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
