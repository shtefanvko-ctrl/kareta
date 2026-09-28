<?php
return [
    'version' => 16,
    'note' => 'core seed integrity and reseed after partial migration failures',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_ensure_core_seed_integrity($pdo);
    },
];
