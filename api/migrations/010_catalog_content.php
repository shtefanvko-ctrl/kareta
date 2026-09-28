<?php
return [
    'version' => 10,
    'note' => 'service content and parts catalog',
    'run' => static function (PDO $pdo): void {
        $checks = [
            ['services', 'short_desc', "ALTER TABLE `services` ADD COLUMN `short_desc` TEXT NULL AFTER `name`"],
            ['services', 'why_text', "ALTER TABLE `services` ADD COLUMN `why_text` TEXT NULL AFTER `short_desc`"],
            ['services', 'steps_json', "ALTER TABLE `services` ADD COLUMN `steps_json` LONGTEXT NULL AFTER `why_text`"],
            ['services', 'list_json', "ALTER TABLE `services` ADD COLUMN `list_json` LONGTEXT NULL AFTER `steps_json`"],
            ['services', 'price_label', "ALTER TABLE `services` ADD COLUMN `price_label` VARCHAR(96) NOT NULL DEFAULT '' AFTER `base_price`"],
            ['services', 'time_label', "ALTER TABLE `services` ADD COLUMN `time_label` VARCHAR(96) NOT NULL DEFAULT '' AFTER `avg_time`"],
        ];
        foreach ($checks as [$table, $column, $sql]) {
            $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $st->execute([$table, $column]);
            if ((int)$st->fetchColumn() === 0) {
                $pdo->exec($sql);
            }
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_catalog`(
            `id` VARCHAR(32) NOT NULL PRIMARY KEY,
            `cat` VARCHAR(32) NOT NULL DEFAULT 'other',
            `name` VARCHAR(191) NOT NULL,
            `sku` VARCHAR(64) NOT NULL,
            `price_label` VARCHAR(96) NOT NULL DEFAULT '',
            `stock` TINYINT(1) NOT NULL DEFAULT 1,
            `note` VARCHAR(255) NOT NULL DEFAULT '',
            `sort` INT NOT NULL DEFAULT 0,
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` DATE NULL,
            UNIQUE KEY `uq_parts_catalog_sku` (`sku`),
            KEY `idx_parts_catalog_cat_active_sort` (`cat`,`active`,`sort`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $svcMeta = [
            'gen' => [
                'short_desc' => 'Восстанавливаем генераторы любых марок без замены агрегата.',
                'why_text' => 'Генератор не заряжает аккумулятор, горит лампа, слышен свист — это к нам.',
                'steps_json' => json_encode(['Бесплатная диагностика','Дефектовка деталей','Ремонт или замена','Проверка на стенде','Гарантия 6 мес.'], JSON_UNESCAPED_UNICODE),
                'list_json' => json_encode(['Замена щёток','Диодный мост','Регулятор напряжения','Перемотка ротора','Капитальный ремонт'], JSON_UNESCAPED_UNICODE),
                'price_label' => 'от 1 500 ₸',
                'time_label' => 'от 1 часа',
            ],
            'start' => [
                'short_desc' => 'Ремонт и восстановление стартеров с гарантией на работы.',
                'why_text' => 'Стартер крутит слабо, щёлкает, не крутит совсем — приезжайте.',
                'steps_json' => json_encode(['Диагностика','Разборка','Замена узлов','Сборка','Тест-прокрутка'], JSON_UNESCAPED_UNICODE),
                'list_json' => json_encode(['Бендикс','Втягивающее реле','Щётки коллектора','Перемотка якоря','Капремонт'], JSON_UNESCAPED_UNICODE),
                'price_label' => 'от 1 500 ₸',
                'time_label' => 'от 1 часа',
            ],
            'wire' => [
                'short_desc' => 'Диагностика и ремонт любых электрических проблем авто.',
                'why_text' => 'Разряжается АКБ, мигают приборы, что-то не работает — найдём причину.',
                'steps_json' => json_encode(['Диагностика мультиметром','Поиск КЗ/утечки','Локализация','Ремонт жгута','Проверка'], JSON_UNESCAPED_UNICODE),
                'list_json' => json_encode(['Поиск КЗ','Утечка тока','Ремонт жгута','Прокладка новой линии','Замена предохранителей'], JSON_UNESCAPED_UNICODE),
                'price_label' => 'от 3 000 ₸',
                'time_label' => 'от 1 часа',
            ],
            'alarm' => [
                'short_desc' => 'Установка, настройка и ремонт охранных систем.',
                'why_text' => 'Нужна надёжная защита авто или сломалась старая сигнализация — мы поможем.',
                'steps_json' => json_encode(['Подбор системы','Монтаж','Программирование','Выдача брелоков','Инструктаж'], JSON_UNESCAPED_UNICODE),
                'list_json' => json_encode(['Starline A93/A96','Pandect X-1000','Автозапуск','GPS-трекер','Ремонт блока'], JSON_UNESCAPED_UNICODE),
                'price_label' => 'от 8 000 ₸',
                'time_label' => 'от 2 часов',
            ],
            'diag' => [
                'short_desc' => 'Компьютерная и ручная диагностика электрики автомобиля.',
                'why_text' => 'Если причина неясна — начинаем с точной диагностики и схемы работ.',
                'steps_json' => json_encode(['Проверка симптомов','Замер напряжения и утечек','Локализация узла','Заключение мастера'], JSON_UNESCAPED_UNICODE),
                'list_json' => json_encode(['Диагностика АКБ','Проверка генератора','Проверка стартера','Поиск утечки тока'], JSON_UNESCAPED_UNICODE),
                'price_label' => 'от 3 000 ₸',
                'time_label' => '30 мин',
            ],
        ];
        $svcStmt = $pdo->prepare("UPDATE `services` SET short_desc=?, why_text=?, steps_json=?, list_json=?, price_label=?, time_label=? WHERE id=?");
        foreach ($svcMeta as $id => $row) {
            $svcStmt->execute([$row['short_desc'],$row['why_text'],$row['steps_json'],$row['list_json'],$row['price_label'],$row['time_label'],$id]);
        }

        // production не должен сидировать демо-запчасти pc_*.
        // Реальный каталог импортируется из GlobalTuning / parts_catalog, а dev-демо должно включаться отдельно.
    },
];
