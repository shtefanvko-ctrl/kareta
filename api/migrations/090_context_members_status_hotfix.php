<?php
declare(strict_types=1);

return [
    'version' => 90,
    'note' => 'R187.1 remove temporary context_members.status migration bridge',
    'run' => static function (PDO $pdo): void {
        $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='context_members' AND COLUMN_NAME='status'");
        $st->execute();
        if ((int)$st->fetchColumn() > 0) {
            $pdo->exec("ALTER TABLE `context_members` DROP COLUMN `status`");
        }
    },
];
