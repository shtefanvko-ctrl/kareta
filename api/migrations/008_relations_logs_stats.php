<?php
return [
    'version' => 8,
    'note' => 'user links for orders chats messages audit plus db system logs and unified stats',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_create_schema($pdo);
        kareta_backfill_relations($pdo);
        kareta_rebuild_user_stats($pdo);
    },
];
