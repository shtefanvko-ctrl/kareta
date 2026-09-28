<?php
return [
    'version' => 6,
    'note' => 'versioned migration runner enabled',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_backfill_relations($pdo);
        kareta_seed($pdo);
    },
];
