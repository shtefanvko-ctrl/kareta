<?php
declare(strict_types=1);

return [
    'version' => 130,
    'note' => 'R188.5.5.6.84.23: once-per-local-day CLIENT first-vehicle prompt state',
    'run' => static function (PDO $pdo): void {
        $has=static function(string $column) use ($pdo): bool {
            $q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_first_entry_state' AND COLUMN_NAME=?");
            $q->execute([$column]); return (int)$q->fetchColumn()>0;
        };
        if(!$has('last_prompt_at')) $pdo->exec("ALTER TABLE client_first_entry_state ADD COLUMN last_prompt_at DATETIME NULL AFTER completed_at");
        if(!$has('last_prompt_local_date')) $pdo->exec("ALTER TABLE client_first_entry_state ADD COLUMN last_prompt_local_date DATE NULL AFTER last_prompt_at");
        if(!$has('last_prompt_timezone')) $pdo->exec("ALTER TABLE client_first_entry_state ADD COLUMN last_prompt_timezone VARCHAR(64) NULL AFTER last_prompt_local_date");
        $pdo->exec("CREATE TABLE IF NOT EXISTS account_entry_prompt_state(
          account_id BIGINT UNSIGNED NOT NULL,
          context_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
          prompt_key VARCHAR(64) NOT NULL,
          last_shown_at DATETIME NULL,
          last_shown_local_date DATE NULL,
          last_shown_timezone VARCHAR(64) NULL,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY(account_id,context_id,prompt_key),
          KEY idx_entry_prompt_date(prompt_key,last_shown_local_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
