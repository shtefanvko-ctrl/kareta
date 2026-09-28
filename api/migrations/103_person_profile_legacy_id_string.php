<?php
declare(strict_types=1);

return [
    'version' => 103,
    'note' => 'R188.5.5.6.15: allow string legacy entity identifiers in identity profiles',
    'run' => static function (PDO $pdo): void {
        $column = $pdo->prepare("SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='person_profiles' AND COLUMN_NAME='legacy_entity_id'
            LIMIT 1");
        $column->execute();
        $meta = $column->fetch(PDO::FETCH_ASSOC) ?: null;
        if (!$meta) {
            throw new RuntimeException('person_profiles.legacy_entity_id is missing');
        }

        $dataType = strtolower((string)($meta['DATA_TYPE'] ?? ''));
        $columnType = strtolower((string)($meta['COLUMN_TYPE'] ?? ''));
        if ($dataType !== 'varchar' || !str_starts_with($columnType, 'varchar(64)')) {
            // masters.id and sto_profiles.id are string keys (master_user_..., sto_user_...).
            // Numeric values already stored in this column are converted losslessly to text.
            $pdo->exec("ALTER TABLE `person_profiles`
                MODIFY COLUMN `legacy_entity_id` VARCHAR(64) NULL AFTER `legacy_entity_type`");
        }
    },
];
