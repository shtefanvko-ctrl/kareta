<?php
return [
    'version' => 62,
    'note' => 'Persistent work contexts and capability resolution',
    'run' => static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `user_context_preferences` (
            `user_id` BIGINT UNSIGNED NOT NULL PRIMARY KEY,
            `context_id` VARCHAR(128) NOT NULL DEFAULT '',
            `context_type` VARCHAR(40) NOT NULL DEFAULT 'personal',
            `organization_id` VARCHAR(64) NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_context_preference_org` (`organization_id`,`context_type`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Normalize owner memberships to an explicit wildcard permission.
        $pdo->exec("UPDATE organization_members
            SET permissions_json=JSON_ARRAY('*')
            WHERE member_role IN ('owner','admin')
              AND (permissions_json IS NULL OR JSON_LENGTH(permissions_json)=0)");

        // Seed safe role defaults only where a membership has no explicit permissions.
        $pdo->exec("UPDATE organization_members
            SET permissions_json=JSON_ARRAY('orders.read','orders.updateAssigned','chats.use','profile.master','parts.browse')
            WHERE member_role='master' AND (permissions_json IS NULL OR JSON_LENGTH(permissions_json)=0)");
        $pdo->exec("UPDATE organization_members
            SET permissions_json=JSON_ARRAY('orders.read','clients.read','services.read','chats.use')
            WHERE member_role='member' AND (permissions_json IS NULL OR JSON_LENGTH(permissions_json)=0)");
    },
];
