<?php
declare(strict_types=1);

return [
    'version' => 130,
    'note' => 'R188.5.5.6.84.22: independent account type, onboarding, publication and verification lifecycle',
    'run' => static function (PDO $pdo): void {
        $columnExists=static function(string $table,string $column)use($pdo):bool{
            $q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $q->execute([$table,$column]);
            return (int)$q->fetchColumn()>0;
        };

        $pdo->exec("CREATE TABLE IF NOT EXISTS `account_types` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `account_id` BIGINT UNSIGNED NOT NULL,
            `person_id` BIGINT UNSIGNED NOT NULL,
            `account_type` ENUM('client','master','sto','seller') NOT NULL,
            `status` ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
            `source` VARCHAR(64) NOT NULL DEFAULT 'runtime',
            `metadata_json` JSON NULL,
            `activated_at` DATETIME NULL,
            `suspended_at` DATETIME NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_account_type` (`account_id`,`account_type`),
            KEY `idx_account_types_person` (`person_id`,`status`),
            KEY `idx_account_types_type` (`account_type`,`status`),
            CONSTRAINT `fk_account_types_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_account_types_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        if(!$columnExists('person_profiles','onboarding_status')){
            $pdo->exec("ALTER TABLE `person_profiles` ADD COLUMN `onboarding_status` VARCHAR(24) NOT NULL DEFAULT 'not_started' AFTER `status`");
        }
        if(!$columnExists('person_profiles','publication_status')){
            $pdo->exec("ALTER TABLE `person_profiles` ADD COLUMN `publication_status` VARCHAR(32) NOT NULL DEFAULT 'inactive' AFTER `onboarding_status`");
        }
        if(!$columnExists('person_profiles','verification_status')){
            $pdo->exec("ALTER TABLE `person_profiles` ADD COLUMN `verification_status` VARCHAR(24) NOT NULL DEFAULT 'unverified' AFTER `publication_status`");
        }

        // Every identity has the CLIENT account type. This is existence/membership,
        // not a publication or verification decision.
        $pdo->exec("INSERT INTO account_types(account_id,person_id,account_type,status,source,activated_at,metadata_json)
            SELECT a.id,p.id,'client',IF(a.status='active','active','suspended'),'migration_130_personal',NOW(),JSON_OBJECT('source','personal_identity')
            FROM accounts a JOIN persons p ON p.account_id=a.id
            ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),status=IF(account_types.status='archived',account_types.status,VALUES(status)),updated_at=CURRENT_TIMESTAMP");

        // Existing profile contexts are already authoritative evidence that an account
        // type exists. Do not require role_applications after this migration.
        $pdo->exec("INSERT INTO account_types(account_id,person_id,account_type,status,source,activated_at,metadata_json)
            SELECT p.account_id,p.id,pp.profile_type,
                   IF(pp.status='active','active','suspended'),
                   'migration_130_existing_profile',NOW(),
                   JSON_OBJECT('profileId',pp.id,'legacyEntityType',COALESCE(pp.legacy_entity_type,''),'legacyEntityId',COALESCE(pp.legacy_entity_id,''))
            FROM person_profiles pp
            JOIN persons p ON p.id=pp.person_id
            WHERE pp.profile_type IN ('master','seller')
            ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),status=IF(account_types.status='archived',account_types.status,VALUES(status)),metadata_json=JSON_MERGE_PATCH(COALESCE(account_types.metadata_json,JSON_OBJECT()),VALUES(metadata_json)),updated_at=CURRENT_TIMESTAMP");

        // Migrate historical authoritative role values/application approvals once.
        // From this point forward role_applications is workflow history, not identity authority.
        $pdo->exec("INSERT INTO account_types(account_id,person_id,account_type,status,source,activated_at,metadata_json)
            SELECT a.id,p.id,u.role,'active','migration_130_legacy_role',NOW(),JSON_OBJECT('legacyUserId',u.id)
            FROM users u JOIN accounts a ON a.phone=u.phone JOIN persons p ON p.account_id=a.id
            WHERE u.active=1 AND u.role IN ('master','sto','seller')
            ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),status='active',updated_at=CURRENT_TIMESTAMP");

        if((int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='role_applications'")->fetchColumn()>0){
            $pdo->exec("INSERT INTO account_types(account_id,person_id,account_type,status,source,activated_at,metadata_json)
                SELECT a.id,p.id,ra.requested_role,'active','migration_130_approved_application',COALESCE(ra.reviewed_at,NOW()),
                       JSON_OBJECT('legacyApplicationId',ra.id,'migratedApproval',TRUE)
                FROM role_applications ra
                JOIN users u ON u.id=ra.user_id
                JOIN accounts a ON a.phone=u.phone
                JOIN persons p ON p.account_id=a.id
                WHERE ra.status='approved' AND ra.requested_role IN ('master','sto','seller')
                ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),status='active',metadata_json=JSON_MERGE_PATCH(COALESCE(account_types.metadata_json,JSON_OBJECT()),VALUES(metadata_json)),updated_at=CURRENT_TIMESTAMP");
        }

        // Backfill independent MASTER lifecycle. Migration 128 is the source of truth
        // for onboarding completion; profile visibility is the publication signal.
        if((int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='master_onboarding_state'")->fetchColumn()>0){
            $pdo->exec("UPDATE person_profiles pp
                LEFT JOIN master_onboarding_state mos ON mos.profile_id=pp.id
                SET pp.onboarding_status=COALESCE(NULLIF(mos.status,''),NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pp.payload_json,'$.onboardingStatus')),''),'not_started')
                WHERE pp.profile_type='master'");
        } else {
            $pdo->exec("UPDATE person_profiles pp
                SET pp.onboarding_status=COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pp.payload_json,'$.onboardingStatus')),''),'not_started')
                WHERE pp.profile_type='master'");
        }

        if((int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='masters'")->fetchColumn()>0){
            $pdo->exec("UPDATE person_profiles pp
                LEFT JOIN masters m ON BINARY m.id=BINARY pp.legacy_entity_id
                SET pp.publication_status=CASE
                    WHEN pp.onboarding_status<>'completed' THEN 'pending_onboarding'
                    WHEN COALESCE(m.profile_visible,0)=1 THEN 'active'
                    ELSE 'inactive'
                END
                WHERE pp.profile_type='master'");
        } else {
            $pdo->exec("UPDATE person_profiles SET publication_status=IF(onboarding_status='completed','inactive','pending_onboarding') WHERE profile_type='master'");
        }

        $pdo->exec("UPDATE person_profiles
            SET verification_status=COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.verificationStatus')),''),'unverified')
            WHERE profile_type='master'");

        $pdo->exec("UPDATE person_profiles SET
            payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),
              '$.onboardingStatus',onboarding_status,
              '$.publicationStatus',publication_status,
              '$.verificationStatus',verification_status,
              '$.accountTypeLifecycleSeparated',TRUE),
            updated_at=CURRENT_TIMESTAMP
            WHERE profile_type='master'");
    },
];
