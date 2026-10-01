# KARETA Route Branch Design Map

Дата: 01.10.2026  
Статус: AUDIT_BASELINE — карта строится от фактического `js/next/route_registry.js`, не от меню.  
Цель: один дизайн-контракт на ветку, явные уровни переходов и отсутствие «солянки» между родственными страницами.

## Легенда цветов

- 🟧 CLIENT / CORE — #FF6A00
- 🟦 MASTER — #2563EB
- 🟩 COMMERCE / PARTS / SELLER — #16A34A
- 🟪 COMMUNITY / CONTENT — #7C3AED
- 🟨 CABINET / IDENTITY — #D97706
- 🟥 ADMIN / PLATFORM — #DC2626
- ⬛ SYSTEM / SUPPORT — #374151

Цвет — идентификатор ветки в аудите, а не требование перекрашивать UI страницы.

## Уровни

- L0 — корень ветки / dashboard / hub.
- L1 — основной модуль ветки.
- L2 — список, подмодуль, категория или рабочая область.
- L3 — конкретная сущность / detail.
- ACTION — создание, редактирование, booking, wizard/dialog.
- ENTRY — альтернативный вход: direct URL, push, notification, legacy alias.
- RETURN — ожидаемый возврат внутри ветки.
- CROSS — контролируемый переход в другую ветку.

## Ветки по фактическому route registry

### 🟧 CLIENT / CORE

L0: `#/home`  
L1: `#/services`, `#/masters`, `#/orders`, `#/chats`  
L2: `#/services/group/:id`, `#/services/category/:id`  
L3: `#/services/item/:id`, `#/masters/profile/{master|sto}/:id`, `#/orders/item/:id`  
ACTION: `#/orders/new`, `#/masters/book/master/:id`  
Связанные detail: `#/masters/reviews/{master|sto}/:id`

### 🟦 MASTER

L0: `#/master`  
L1: `#/master/exchange`, `#/services/manage`, `#/master/schedule`, `#/master/profile`, `#/master/wall`, `#/master/works`, `#/master/reviews`  
L2: `#/master/news`  
ACTION: `#/onboarding/master`, `#/master/news/create`, `#/master/news/edit/:id`  
CROSS: `#/orders`, `#/chats`, `#/community`, `#/cabinet/settings`

### 🟩 COMMERCE / PARTS / SELLER

L0/L1: `#/parts`, `#/seller`  
L2: `#/parts/used`, `#/seller/products`, `#/seller/orders`  
L3: `#/parts/item/:id`, `#/parts/store/:id`

### 🟪 COMMUNITY / CONTENT

L0/L1: `#/works`, `#/community`  
L2: `#/following`, `#/real-works`  
L3: `#/works/item/:id`, `#/profile`, `#/profile/{person|organization}/:id`  
LEGACY ENTRY: `#/news -> #/works`

### 🟨 CABINET / IDENTITY

L0: `#/cabinet`  
L1/L2: `#/cabinet/garage`, `#/cabinet/data`, `#/cabinet/history`, `#/cabinet/documents`, `#/cabinet/promotions`, `#/cabinet/tariff`, `#/cabinet/settings`  
L3: `#/garage/car/:id`  
ENTRY: `#/notifications`

### 🟥 ADMIN / PLATFORM

L0/L1: `#/platform`, `#/core`, `#/calendar`, `#/finance`, `#/market`, `#/crm`  
L2: `#/admin/users`, `#/admin/organizations`, `#/admin/monitoring`, `#/admin/management`, `#/admin/identity-migration`  
Рабочая системная ветка: `#/workflow`

### ⬛ SYSTEM / SUPPORT

`#/about`, `#/rules`, `#/help`, `#/assistant`, `#/diagnostics`, `#/privacy`, `#/contacts`, `#/lawyer`, `#/tow-truck`, `#/404`

## Правило маршрутизации для дальнейшего аудита

1. Аудируем ветку целиком, а не пункты меню.
2. У каждого маршрута должны быть определены parent, допустимые child-переходы, RETURN и CROSS.
3. Direct URL / push / notification должны приводить в тот же L2/L3 без обязательного предварительного посещения L0/L1.
4. Back возвращает к логическому parent; отсутствие history не должно отправлять пользователя в случайную ветку.
5. Legacy alias не образует отдельную дизайн-ветку.
6. Modal/dialog не создаёт новый уровень основной пользовательской заявки.
7. Shell остаётся общим; цвет ветки используется только в карте аудита.
8. Следующий проход обязан проверить фактические переходы в router/app code. Эта версия фиксирует реестр маршрутов, но ещё не доказывает runtime navigation graph.

## Следующий аудит

Для каждого маршрута заполнить:
`route | branch | level | parent | children | entry | return | cross | surface | design archetype | runtime verified`.

Статусы runtime: `SOURCE_CONFIRMED / VERIFIED / NOT_RUN / CONFLICT`.
