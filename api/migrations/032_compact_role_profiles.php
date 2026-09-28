<?php
return [
    'version' => 32,
    'note' => 'persist compact onboarding fields in role-specific profiles',
    'run' => function(PDO $pdo): void {
        $columns = [
            ['masters', 'experience_label', "ALTER TABLE `masters` ADD COLUMN `experience_label` VARCHAR(64) NOT NULL DEFAULT '' AFTER `spec`"],
            ['sto_profiles', 'primary_specialization', "ALTER TABLE `sto_profiles` ADD COLUMN `primary_specialization` VARCHAR(191) NOT NULL DEFAULT '' AFTER `work_hours`"],
        ];
        foreach ($columns as [$table, $column, $sql]) {
            $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table, $column]);
            if ((int)$st->fetchColumn() === 0) $pdo->exec($sql);
        }
    },
];
