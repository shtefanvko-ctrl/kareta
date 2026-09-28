<?php
declare(strict_types=1);

return [
    'version' => 132,
    'note' => 'R188.5.5.6.84.25: normalize CLIENT first vehicle entry from legacy four-step UI to three parent steps',
    'run' => static function (PDO $pdo): void {
        $exists = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_first_entry_state'")->fetchColumn();
        if (!$exists) return;

        // Legacy UI mapping:
        //   intro/1 -> 1, vehicle/2 -> 1, details/3 -> 2, garage/review/4 -> 3.
        // Completed rows stay terminal and are normalized to the review parent step.
        $pdo->exec("UPDATE client_first_entry_state
            SET current_step=CASE
                WHEN current_step>=4 THEN 3
                WHEN current_step=3 THEN 2
                WHEN current_step=2 THEN 1
                ELSE 1
            END
            WHERE status<>'completed'");
        $pdo->exec("UPDATE client_first_entry_state SET current_step=3 WHERE status='completed'");
    },
];
