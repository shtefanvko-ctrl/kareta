<?php
return [
    'version' => 4,
    'note' => 'backfill clients orders and master names',
    'run' => static function (PDO $pdo): void {
        kareta_backfill_relations($pdo);
    },
];
