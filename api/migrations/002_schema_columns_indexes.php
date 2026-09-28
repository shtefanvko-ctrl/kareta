<?php
return [
    'version' => 2,
    'note' => 'soft schema columns and indexes',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
    },
];
