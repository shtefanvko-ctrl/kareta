# KARETA 3D Garage — межагентная передача

Дата: 18.11.2026. Ветка: `feat/3d-garage-asset-pack-20261118`.
Состояние: изолированный прототип; **не продакшн**, нет реального E2E-записи, нет OBD-адаптера.

## Source of truth
Репозиторий `shtefanvko-ctrl/kareta`; текущий код `experiments/garage-3d/`; 9 GLB, лицензии, SHA-256. Отдельная копия на KaretaMeneger: `/home/karetadmin/kareta-external/3d-garage-assets`.
Токены KARETA: оранжевый `#FC6606`, графитовый `#474747`, белый `#FFFFFF`, фон `#F7F7F5`. Оригинальный знак из `assets/onboarding/kareta_logo_icon.png`. Цвета CARAT Control Center не подменяют палитру KARETA.

## Задачи и точные промты агентам

### P0 / Frontend + Three.js
«Прочитай AGENTS.md, ai/CONTEXT_ROUTER.md, ai/rules/web-spa.md, experiments/garage-3d/README.md. Улучши изолированный 3D-прототип с real GLB, responsive WebGL2 и fallback. Реализуй измеряемый mobile QA; ограничь DPR, прекращай рендер в фоне, освобождай GPU-ресурсы. Не трогай главную и навигацию других ролей. Верни SHA, bundle size, PASS/FAIL, скриншоты устройств и PR. Не делай фиктивных деталей, которых нет в GLB».

### P0 / Backend + service orders
«Изучи действующий поток `#/orders/new`, существующие vehicle/service identifiers, schema and authorization. Предложи серверный контракт передачи структуры `mode, part_id, symptom_id, vehicle_id, note` в стандартную заявку. Не создавай заказ через незащищённый API. RBAC, CSRF, idempotency, server validation обязательны. Предзаполнение через уже утверждённый интерфейс. Не меняй БД без миграций и QA. Сначала изолированный PR».

### P1 / Geometry + UX
«Обработай 9 Kenney Car Kit GLB из experiments/garage-3d/models по их CC0 provenance. Создай отдельные hit zones для кузова с устойчивыми IDs. Не утверждай, что low-poly sedan является Peugeot 301 или что single-mesh body размечен по панелям. Для механики/электрики разработай независимую сцену узлов только по проверенным моделям и данным, с ясной маркировкой demo».

### P1 / Android
«Проверь 3D-гараж в WebView Android на устройствах с WebGL2 и без него: canvas touch, pinch, orientation, pause/resume, memory, thermal/FPS. Сравни с ПК 320/390/768/1440. Собери протокол, а не декларативный PASS. Никаких внешних CDN в пользовательском runtime».

### P1 / Diagnostic interface
«Свяжи сценарии выбора автоэлектрики и механики с заявками и диагностической историей. ELM327/ThinkDiag не подключать без подтверждённой поддержки протокола. Не синтезировать OBD DTC или живые PID. Измерения и ошибки обозначай как demo только в демо-режиме».

### P1 / CARAT Studio
«Создай draft/publish flow версий сцены, права агента лишь на черновик и предпросмотр; публикация требует владельца, QA и release-gate. Не добавляй arbitrary HTML/JS executables, нужен безопасный декларативный формат scene config».

## Проверка / Release gates
1. Локальная сборка `npm ci && npm run check && npm run build`; проверка манифеста по SHA.
2. Загрузка модели и fallback с сетевой ошибкой, неполным GLB, без WebGL2.
3. Ручной визуальный QA: Android WebView, 320/390/768/1440, touch, memory/contexts; сохранение существующего `#/orders/new`.
4. Security: отказ от произвольного model URL, server-side schema contract, RBAC/CSRF на запись, отсутствие фальшивых OBD данных.
5. PR в main только после gates; deploy только с согласованной трассировкой commit -> built artifact -> runtime. Проверить флаг, маршрут и откат.

## Что безопасно выкладывать раньше
Фирменный статический asset pack с CC0 лицензиями, только **после merge и проверки**. Любые привязки к боевым заявкам, клиентским машинам и диагностике требуют отдельных этапов.
