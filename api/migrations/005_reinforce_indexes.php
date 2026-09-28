<?php
return [
    'version' => 5,
    'note' => 'reinforce performance indexes',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
    },
];
