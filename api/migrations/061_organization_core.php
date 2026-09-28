<?php
return [
    'version' => 61,
    'note' => 'Organization core, memberships, units, relations and legacy backfill',
    'run' => static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `organizations` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `type` VARCHAR(40) NOT NULL,
            `name` VARCHAR(191) NOT NULL,
            `owner_user_id` BIGINT UNSIGNED NULL,
            `parent_organization_id` VARCHAR(64) NULL,
            `legacy_entity_type` VARCHAR(40) NOT NULL DEFAULT '',
            `legacy_entity_id` VARCHAR(64) NOT NULL DEFAULT '',
            `legal_name` VARCHAR(191) NOT NULL DEFAULT '',
            `bin_iin` VARCHAR(24) NOT NULL DEFAULT '',
            `phone` VARCHAR(32) NOT NULL DEFAULT '',
            `country_code` VARCHAR(8) NOT NULL DEFAULT 'KZ',
            `city` VARCHAR(120) NOT NULL DEFAULT '',
            `address` VARCHAR(255) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'active',
            `metadata_json` JSON NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_org_legacy` (`legacy_entity_type`,`legacy_entity_id`),
            KEY `idx_org_owner` (`owner_user_id`,`status`),
            KEY `idx_org_type_city` (`type`,`city`,`status`),
            KEY `idx_org_parent` (`parent_organization_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `organization_members` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `organization_id` VARCHAR(64) NOT NULL,
            `user_id` BIGINT UNSIGNED NULL,
            `entity_type` VARCHAR(40) NOT NULL DEFAULT 'user',
            `entity_id` VARCHAR(64) NOT NULL DEFAULT '',
            `member_role` VARCHAR(48) NOT NULL DEFAULT 'member',
            `position` VARCHAR(120) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'active',
            `branch_unit_id` VARCHAR(64) NULL,
            `permissions_json` JSON NULL,
            `invited_by` BIGINT UNSIGNED NULL,
            `joined_at` DATETIME NULL,
            `left_at` DATETIME NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_org_member_entity` (`organization_id`,`entity_type`,`entity_id`),
            KEY `idx_org_member_user` (`user_id`,`status`),
            KEY `idx_org_member_org` (`organization_id`,`status`,`member_role`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `organization_units` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `organization_id` VARCHAR(64) NOT NULL,
            `parent_unit_id` VARCHAR(64) NULL,
            `type` VARCHAR(40) NOT NULL DEFAULT 'branch',
            `name` VARCHAR(191) NOT NULL,
            `code` VARCHAR(64) NOT NULL DEFAULT '',
            `city` VARCHAR(120) NOT NULL DEFAULT '',
            `address` VARCHAR(255) NOT NULL DEFAULT '',
            `status` VARCHAR(24) NOT NULL DEFAULT 'active',
            `metadata_json` JSON NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_org_unit_code` (`organization_id`,`code`),
            KEY `idx_org_units_org` (`organization_id`,`type`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `organization_relations` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `source_organization_id` VARCHAR(64) NOT NULL,
            `target_organization_id` VARCHAR(64) NOT NULL,
            `relation_type` VARCHAR(48) NOT NULL,
            `status` VARCHAR(24) NOT NULL DEFAULT 'active',
            `metadata_json` JSON NULL,
            `starts_at` DATETIME NULL,
            `ends_at` DATETIME NULL,
            `created_by` BIGINT UNSIGNED NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_org_relation` (`source_organization_id`,`target_organization_id`,`relation_type`),
            KEY `idx_org_relation_source` (`source_organization_id`,`status`),
            KEY `idx_org_relation_target` (`target_organization_id`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `user_capabilities` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `user_id` BIGINT UNSIGNED NOT NULL,
            `context_type` VARCHAR(40) NOT NULL DEFAULT 'personal',
            `context_id` VARCHAR(64) NOT NULL DEFAULT '',
            `capability` VARCHAR(96) NOT NULL,
            `effect` ENUM('allow','deny') NOT NULL DEFAULT 'allow',
            `granted_by` BIGINT UNSIGNED NULL,
            `expires_at` DATETIME NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `uq_user_capability` (`user_id`,`context_type`,`context_id`,`capability`),
            KEY `idx_user_cap_context` (`context_type`,`context_id`,`effect`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Legacy STO profiles become service-station organizations.
        $pdo->exec("INSERT INTO organizations
            (id,type,name,owner_user_id,legacy_entity_type,legacy_entity_id,phone,country_code,city,address,status)
            SELECT CONCAT('org_sto_', s.id), 'service_station', COALESCE(NULLIF(s.name,''),'СТО'), s.user_id,
                   'sto_profile', CAST(s.id AS CHAR), COALESCE(NULLIF(s.contact_phone,''),s.user_phone,''),
                   COALESCE(NULLIF(s.country_code,''),'KZ'), COALESCE(s.city,''), COALESCE(s.address,''),
                   IF(COALESCE(s.active,1)=1,'active','inactive')
            FROM sto_profiles s
            ON DUPLICATE KEY UPDATE name=VALUES(name),owner_user_id=VALUES(owner_user_id),phone=VALUES(phone),city=VALUES(city),address=VALUES(address),status=VALUES(status)");

        // Legacy seller profiles become parts-store organizations.
        $pdo->exec("INSERT INTO organizations
            (id,type,name,owner_user_id,legacy_entity_type,legacy_entity_id,legal_name,bin_iin,phone,country_code,city,address,status)
            SELECT CONCAT('org_shop_', s.id), 'parts_store', COALESCE(NULLIF(s.store_name,''),'Магазин'), s.user_id,
                   'seller_profile', CAST(s.id AS CHAR), COALESCE(s.legal_name,''), COALESCE(s.bin_iin,''),
                   COALESCE(NULLIF(s.contact_phone,''),s.user_phone,''), COALESCE(NULLIF(s.country_code,''),'KZ'),
                   COALESCE(s.city,''), COALESCE(s.warehouse_address,''), IF(COALESCE(s.active,1)=1,'active','inactive')
            FROM seller_profiles s
            ON DUPLICATE KEY UPDATE name=VALUES(name),owner_user_id=VALUES(owner_user_id),legal_name=VALUES(legal_name),bin_iin=VALUES(bin_iin),phone=VALUES(phone),city=VALUES(city),address=VALUES(address),status=VALUES(status)");

        // Organization owners are members with full organizational responsibility.
        $pdo->exec("INSERT INTO organization_members
            (id,organization_id,user_id,entity_type,entity_id,member_role,position,status,permissions_json,joined_at)
            SELECT CONCAT('om_owner_', SUBSTRING(SHA1(CONCAT(o.id,'|',o.owner_user_id)),1,28)), o.id, o.owner_user_id,
                   'user', CAST(o.owner_user_id AS CHAR), 'owner', 'Владелец', 'active', JSON_ARRAY('*'), NOW()
            FROM organizations o WHERE o.owner_user_id IS NOT NULL AND o.owner_user_id>0
            ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),member_role='owner',status='active',permissions_json=JSON_ARRAY('*'),left_at=NULL");

        // Existing STO-master links remain authoritative and are mirrored into memberships.
        $pdo->exec("INSERT INTO organization_members
            (id,organization_id,user_id,entity_type,entity_id,member_role,position,status,joined_at,left_at)
            SELECT CONCAT('om_master_', SUBSTRING(SHA1(CONCAT(l.sto_id,'|',l.master_id)),1,27)),
                   CONCAT('org_sto_',l.sto_id), m.user_id, 'master', CAST(l.master_id AS CHAR), 'master', 'Мастер',
                   CASE l.status WHEN 'active' THEN 'active' WHEN 'pending' THEN 'invited' ELSE 'inactive' END,
                   l.accepted_at, CASE WHEN l.status='rejected' THEN COALESCE(l.accepted_at,l.created_at) ELSE NULL END
            FROM sto_master_links l LEFT JOIN masters m ON BINARY m.id=BINARY l.master_id
            ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),status=VALUES(status),joined_at=VALUES(joined_at),left_at=VALUES(left_at)");
    },
];
