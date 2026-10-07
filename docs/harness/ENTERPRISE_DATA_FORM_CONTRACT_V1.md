# KARETA Enterprise Data/Form Contract v1

Статус: compatibility-first.

Канон: ключи DB/API/DTO/schema/ID и enum-значения — английские. RU/KK/EN используются только presentation/i18n-слоем. Пользовательский свободный текст может быть на поддерживаемом языке.

Существующие API и БД не ломаются: legacy-поля читаются через явный compatibility mapping, новые контракты используют canonical English keys.

Главные ключи: accountId, personId, contextId, cityId, vehicleId, brandId, modelId, generationId, vin, stoId, masterId, sellerId, orderId, serviceId, workOrderId, deviceId, adapterId, diagnosticSessionId, diagnosticJobId, dtcCode, pid, protocol, snapshot, requestId, idempotencyKey, schemaVersion, createdAt, updatedAt.

Цепочка автомобиля: brandId → modelId → generationId → client_vehicles.id (vehicleId) → order relation → OBD vehicleId → repair/history. Нельзя вводить carId, autoId или elmVehicleId как вторую идентичность машины.

SPA владеет UI, формами, validation, DTO и бизнес-логикой. Android владеет только native capabilities и не хранит бизнес-сущности.

Целевой поток: FORM SCHEMA → SPA renderer → shared validation → canonical DTO → API contract → authorization/context → domain service → canonical DB entity.

Известный compatibility debt: orders.client_vehicle_id — VARCHAR(64), OBD vehicle_id — VARCHAR(80). v1 не меняет эти колонки. Унификация выполняется отдельной DB-миграцией после проверки реальных данных.

VERIFIED означает только реально выполненные проверки exact head. Browser/DB/Android/Bluetooth остаются NOT RUN, пока не выполнены.
