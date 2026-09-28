<?php
return [
    'version' => 25,
    'note' => 'schema auto-heal, relation backfill and perf indexes',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_backfill_relations($pdo);
        kareta_ensure_core_seed_integrity($pdo);
        kareta_rebuild_user_stats($pdo);
    },
];
