<?php
return [
    'version' => 1,
    'note' => 'initial schema',
    'run' => static function (PDO $pdo): void {
        kareta_create_schema($pdo);
    },
];
