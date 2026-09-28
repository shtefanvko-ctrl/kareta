<?php
declare(strict_types=1);

return [
    'version' => 12,
    'note' => 'public content pages and reviews',
    'run' => static function (PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `site_content`(
        `content_key` VARCHAR(100) NOT NULL PRIMARY KEY,
        `title` VARCHAR(255) NOT NULL DEFAULT '',
        `body_json` LONGTEXT NULL,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `reviews_public`(
        `id` VARCHAR(40) NOT NULL PRIMARY KEY,
        `author_name` VARCHAR(120) NOT NULL DEFAULT '',
        `initials` VARCHAR(12) NOT NULL DEFAULT '',
        `date_label` VARCHAR(40) NOT NULL DEFAULT '',
        `stars` TINYINT UNSIGNED NOT NULL DEFAULT 5,
        `text` TEXT NOT NULL,
        `source_label` VARCHAR(80) NOT NULL DEFAULT 'KARETA',
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `sort` INT NOT NULL DEFAULT 100,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY `idx_reviews_public_active_sort` (`active`,`sort`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $content = [
        'services_faq' => [
            'title' => 'FAQ по услугам',
            'body' => [
                ['q'=>'Даёте ли гарантию?','a'=>'Да — 6 месяцев на все работы по электрике и 3 месяца на установку сигнализаций. Если проблема вернётся — переделаем бесплатно.'],
                ['q'=>'Можно ли привезти деталь самому?','a'=>'Да. Вы можете купить деталь сами, мы поставим её и дадим гарантию на работу.'],
                ['q'=>'Сколько ждать ремонта?','a'=>'Большинство работ занимают 1–4 часа. Капитальный ремонт генератора или стартера — 1 рабочий день.'],
                ['q'=>'Нужна ли предварительная запись?','a'=>'Желательна — тогда мастер будет свободен в нужное время. Но принимаем и без записи при наличии мест.'],
                ['q'=>'Работаете в субботу?','a'=>'Да, с 10:00 до 17:00. В воскресенье выходной.'],
            ],
        ],
        'about_intro' => [
            'title' => 'О компании',
            'body' => [
                'lead' => 'KARETA.KZ — специализированный автосервис в Усть-Каменогорске. Работаем с 2016 года, фокус — электрооборудование автомобилей: генераторы, стартеры, проводка, сигнализации.',
                'text' => 'Мы не занимаемся «всем подряд» — только электрикой. Это значит глубокую экспертизу, нужное оборудование и реальную экономию для клиента: 95% деталей восстанавливаем без замены агрегата.',
                'address' => '📍 ул. Гоголя 36А, Усть-Каменогорск · Пн–Пт 9:00–19:00 · Сб 10:00–17:00',
            ],
        ],
        'about_facts' => [
            'title' => 'Факты о KARETA',
            'body' => [
                ['n'=>'2016','l'=>'год основания'],
                ['n'=>'8+','l'=>'лет опыта'],
                ['n'=>'500+','l'=>'клиентов'],
                ['n'=>'95%','l'=>'деталей восстанавливаем'],
                ['n'=>'1 день','l'=>'среднее время ремонта'],
                ['n'=>'6 мес.','l'=>'гарантия на работы'],
            ],
        ],
        'about_values' => [
            'title' => 'Принципы работы',
            'body' => [
                ['e'=>'🔍','t'=>'Точная диагностика','d'=>'Сначала находим причину — потом ремонтируем. Никаких лишних работ.'],
                ['e'=>'💰','t'=>'Честная цена','d'=>'Называем итог до начала работ. Цена не меняется в процессе.'],
                ['e'=>'⚡','t'=>'Скорость','d'=>'Большинство работ — в день обращения. Предупреждаем заранее, если дольше.'],
                ['e'=>'🔧','t'=>'Восстановление','d'=>'95% деталей восстанавливаем. Это дешевле замены и экономит ваши деньги.'],
                ['e'=>'✅','t'=>'Гарантия','d'=>'6 месяцев на электрику, 3 месяца на сигнализации. Всё официально.'],
                ['e'=>'📞','t'=>'Обратная связь','d'=>'После ремонта звоним и уточняем — всё ли в порядке с автомобилем.'],
            ],
        ],
        'contacts_page' => [
            'title' => 'Контакты KARETA',
            'body' => [
                'phone' => '+77072980649',
                'phoneLabel' => '8 (707) 298 06 49',
                'address' => 'ул. Гоголя 36А, Усть-Каменогорск',
                'email' => 'admin@kareta.kz',
                'mapHint' => 'Автосервис KARETA.KZ · ориентир — район центра города',
                'worktime' => [
                    ['d'=>'Понедельник','t'=>'9:00–19:00','w'=>1],
                    ['d'=>'Вторник','t'=>'9:00–19:00','w'=>2],
                    ['d'=>'Среда','t'=>'9:00–19:00','w'=>3],
                    ['d'=>'Четверг','t'=>'9:00–19:00','w'=>4],
                    ['d'=>'Пятница','t'=>'9:00–19:00','w'=>5],
                    ['d'=>'Суббота','t'=>'10:00–17:00','w'=>6],
                    ['d'=>'Воскресенье','t'=>'Выходной','w'=>0,'off'=>true],
                ],
            ],
        ],
    ];

    $st = $pdo->prepare("INSERT INTO `site_content`(`content_key`,`title`,`body_json`,`active`) VALUES(?,?,?,1)
        ON DUPLICATE KEY UPDATE `title`=`title`");
    foreach ($content as $key => $row) {
        $st->execute([$key, (string)$row['title'], json_encode($row['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    }

    $reviews = [
        ['id'=>'rv_001','author_name'=>'Алексей К.','initials'=>'А','date_label'=>'Фев 2025','stars'=>5,'text'=>'Восстановили генератор за 1 день! Думал придётся менять — обошлись ремонтом. Сэкономил очень прилично.','sort'=>10],
        ['id'=>'rv_002','author_name'=>'Марина Д.','initials'=>'М','date_label'=>'Янв 2025','stars'=>5,'text'=>'Сигнализация установлена аккуратно, проводка спрятана полностью. Рекомендую!','sort'=>20],
        ['id'=>'rv_003','author_name'=>'Руслан Т.','initials'=>'Р','date_label'=>'Дек 2024','stars'=>5,'text'=>'Нашли утечку тока за час. Другой сервис две недели не мог. Теперь только сюда.','sort'=>30],
        ['id'=>'rv_004','author_name'=>'Дмитрий В.','initials'=>'Д','date_label'=>'Ноя 2024','stars'=>4,'text'=>'Стартер как новый. Цены честные, без лишних накруток. Отдельное спасибо за объяснение.','sort'=>40],
        ['id'=>'rv_005','author_name'=>'Светлана Ж.','initials'=>'С','date_label'=>'Окт 2024','stars'=>5,'text'=>'Объяснили всё понятно, ничего лишнего не навязали. Приеду снова при необходимости.','sort'=>50],
        ['id'=>'rv_006','author_name'=>'Нурлан А.','initials'=>'Н','date_label'=>'Сен 2024','stars'=>5,'text'=>'Привёз утром — забрал вечером исправную машину. Профессионально и по делу!','sort'=>60],
    ];
    $rst = $pdo->prepare("INSERT INTO `reviews_public`(`id`,`author_name`,`initials`,`date_label`,`stars`,`text`,`source_label`,`active`,`sort`) VALUES(?,?,?,?,?,?, 'KARETA',1,?)
        ON DUPLICATE KEY UPDATE `author_name`=`author_name`");
    foreach ($reviews as $r) {
        $rst->execute([$r['id'],$r['author_name'],$r['initials'],$r['date_label'],$r['stars'],$r['text'],$r['sort']]);
    }

    },
];
