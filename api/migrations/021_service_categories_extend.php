<?php
return [
    'version' => 21,
    'note'    => 'Add tires, emergency, legal categories + category_label column',
    'run'     => function(PDO $pdo): void {
        // Добавляем новые значения category_label для новых категорий
        $labels = [
            'electric'  => 'Электрика и электроника',
            'audio'     => 'Автозвук и мультимедиа',
            'body'      => 'Кузов и комфорт',
            'chassis'   => 'Ходовая и подвеска',
            'engine'    => 'Двигатель и жидкости',
            'tires'     => 'Шиномонтаж',
            'emergency' => 'Срочные услуги',
            'legal'     => 'Помощь на дороге',
        ];
        $upd = $pdo->prepare("UPDATE `services` SET category_label=? WHERE cat=? AND (category_label IS NULL OR category_label='')");
        foreach ($labels as $cat => $label) {
            $upd->execute([$label, $cat]);
        }

        // Пересеиваем каталог чтобы добавить новые услуги
        if (function_exists('kareta_ensure_catalog_content')) {
            kareta_ensure_catalog_content($pdo);
        }
    },
];
