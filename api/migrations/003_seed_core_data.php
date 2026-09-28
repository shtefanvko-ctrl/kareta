<?php
return [
    'version' => 3,
    'note' => 'seed core data',
    'run' => static function (PDO $pdo): void {
        kareta_seed($pdo);
    },
];
