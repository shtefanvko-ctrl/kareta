<?php
declare(strict_types=1);

return [
    'version' => 128,
    'note' => 'R188.5.5.6.84.12: MASTER first-entry K-Flow status, draft and idempotent completion state',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `master_onboarding_state` (
          `profile_id` BIGINT UNSIGNED NOT NULL,
          `context_id` BIGINT UNSIGNED NULL,
          `account_id` BIGINT UNSIGNED NOT NULL,
          `person_id` BIGINT UNSIGNED NOT NULL,
          `master_id` VARCHAR(64) NOT NULL DEFAULT '',
          `status` VARCHAR(24) NOT NULL DEFAULT 'not_started',
          `current_step` TINYINT UNSIGNED NOT NULL DEFAULT 1,
          `current_view` VARCHAR(64) NOT NULL DEFAULT 'master-profile',
          `draft_json` JSON NULL,
          `revision` INT UNSIGNED NOT NULL DEFAULT 0,
          `idempotency_key` VARCHAR(96) NULL,
          `terms_version` VARCHAR(64) NULL,
          `completed_at` DATETIME NULL,
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`profile_id`),
          KEY `idx_master_onboarding_context` (`context_id`),
          KEY `idx_master_onboarding_account` (`account_id`,`status`),
          KEY `idx_master_onboarding_master` (`master_id`),
          KEY `idx_master_onboarding_status` (`status`,`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Existing active Master profiles predate this mandatory first-entry flow.
        // Mark them completed so the new gate applies only to profiles created after migration 128.
        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo,'person_profiles') && kareta_table_exists($pdo,'persons')) {
            $contextJoin = kareta_table_exists($pdo,'contexts')
                ? "LEFT JOIN contexts c ON c.profile_id=pp.id AND c.context_type='profile' AND c.status='active'"
                : "LEFT JOIN (SELECT NULL AS id,NULL AS profile_id) c ON 1=0";
            $pdo->exec("INSERT IGNORE INTO master_onboarding_state(profile_id,context_id,account_id,person_id,master_id,status,current_step,current_view,draft_json,revision,completed_at)
              SELECT pp.id,c.id,p.account_id,p.id,COALESCE(pp.legacy_entity_id,''),'completed',4,'master-review',JSON_OBJECT('migratedExistingProfile',TRUE),1,NOW()
              FROM person_profiles pp
              JOIN persons p ON p.id=pp.person_id
              {$contextJoin}
              WHERE pp.profile_type='master' AND pp.status='active'");
            // Mirror completion in profile payload so Identity/profile readers can short-circuit without showing the new flow.
            try {
                $pdo->exec("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.onboardingStatus','completed','$.migrated_master_onboarding_status',TRUE),updated_at=CURRENT_TIMESTAMP WHERE profile_type='master' AND status='active'");
            } catch (Throwable $_) {}
        }
    },
];
