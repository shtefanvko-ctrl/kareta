<?php
declare(strict_types=1);

return [
    'version' => 77,
    'note' => 'R186.5 stage 6: profile and organization context switch reconciliation',
    'run' => static function (PDO $pdo): void {
        $columnExists = static function (PDO $pdo, string $table, string $column): bool {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $stmt->execute([$table, $column]);
            return (int)$stmt->fetchColumn() > 0;
        };
        $indexExists = static function (PDO $pdo, string $table, string $index): bool {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");
            $stmt->execute([$table, $index]);
            return (int)$stmt->fetchColumn() > 0;
        };

        if (!$columnExists($pdo, 'contexts', 'organization_key')) {
            $pdo->exec("ALTER TABLE contexts ADD COLUMN organization_key VARCHAR(64) NULL AFTER organization_id");
        }
        if (!$indexExists($pdo, 'contexts', 'idx_contexts_organization_key')) {
            $pdo->exec("ALTER TABLE contexts ADD KEY idx_contexts_organization_key (organization_key,status)");
        }
        if (!$columnExists($pdo, 'auth_sessions', 'context_revision')) {
            $pdo->exec("ALTER TABLE auth_sessions ADD COLUMN context_revision BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER current_context_id");
        }
        if (!$columnExists($pdo, 'auth_sessions', 'context_changed_at')) {
            $pdo->exec("ALTER TABLE auth_sessions ADD COLUMN context_changed_at DATETIME NULL AFTER context_revision");
        }

        $sets = [
            ['organization.owner', 'Владелец организации', 'organization', 1],
            ['organization.master', 'Мастер организации', 'organization', 1],
            ['organization.seller', 'Продавец организации', 'organization', 1],
        ];
        $setStmt = $pdo->prepare("INSERT INTO capability_sets(code,title,scope_type,is_system) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),scope_type=VALUES(scope_type),is_system=VALUES(is_system)");
        foreach ($sets as $set) $setStmt->execute($set);

        $capsBySet = [
            'organization.owner' => ['*'],
            'organization.master' => ['order.read','workorder.read','workorder.edit','calendar.read','calendar.manage','crm.read','vehicle.read'],
            'organization.seller' => ['market.read','market.manage','warehouse.read','warehouse.reserve','warehouse.manage','finance.read'],
        ];
        $setIdStmt = $pdo->prepare("SELECT id FROM capability_sets WHERE code=? LIMIT 1");
        $capStmt = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect) VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach ($capsBySet as $code => $caps) {
            $setIdStmt->execute([$code]); $setId = (int)($setIdStmt->fetchColumn() ?: 0);
            foreach ($caps as $cap) if ($setId > 0) $capStmt->execute([$setId,$cap]);
        }

        // Existing active legacy master and seller records become profiles of the same person/account.
        $pdo->exec("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json)
            SELECT p.id,'master','active','master',CAST(m.id AS CHAR),JSON_OBJECT('source','stage6','legacyUserId',u.id)
            FROM accounts a
            JOIN persons p ON p.account_id=a.id
            JOIN users u ON u.phone=a.phone
            JOIN masters m ON m.user_id=u.id AND COALESCE(m.active,1)=1
            ON DUPLICATE KEY UPDATE status='active',legacy_entity_type='master',legacy_entity_id=VALUES(legacy_entity_id),updated_at=CURRENT_TIMESTAMP");

        $pdo->exec("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json)
            SELECT p.id,'seller','active','seller_profile',CAST(s.id AS CHAR),JSON_OBJECT('source','stage6','legacyUserId',u.id)
            FROM accounts a
            JOIN persons p ON p.account_id=a.id
            JOIN users u ON u.phone=a.phone
            JOIN seller_profiles s ON s.user_id=u.id AND COALESCE(s.active,1)=1
            ON DUPLICATE KEY UPDATE status='active',legacy_entity_type='seller_profile',legacy_entity_id=VALUES(legacy_entity_id),updated_at=CURRENT_TIMESTAMP");

        // Active professional profiles receive dedicated contexts.
        $pdo->exec("INSERT INTO contexts(context_key,context_type,account_id,person_id,profile_id,capability_set_id,status)
            SELECT CONCAT('profile:',pp.profile_type,':',pp.id),'profile',p.account_id,p.id,pp.id,cs.id,'active'
            FROM person_profiles pp
            JOIN persons p ON p.id=pp.person_id
            LEFT JOIN capability_sets cs ON cs.code=CONCAT('profile.',pp.profile_type)
            WHERE pp.status='active' AND pp.profile_type IN ('master','seller')
            ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),capability_set_id=VALUES(capability_set_id),status='active'");

        // Organization IDs in the legacy organization core are strings, so stage 6 uses organization_key.
        $pdo->exec("INSERT INTO contexts(context_key,context_type,organization_key,capability_set_id,status)
            SELECT CONCAT('organization:',o.id),'organization',o.id,cs.id,'active'
            FROM organizations o
            LEFT JOIN capability_sets cs ON cs.code='organization.member'
            WHERE o.status='active'
            ON DUPLICATE KEY UPDATE organization_key=VALUES(organization_key),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status='active'");

        // Mirror active legacy organization membership into the identity context membership model.
        $pdo->exec("INSERT INTO context_members(context_id,account_id,person_id,capability_set_id,membership_status)
            SELECT c.id,a.id,p.id,
                   COALESCE(roleSet.id,baseSet.id),
                   'active'
            FROM organization_members om
            JOIN organizations o ON o.id=om.organization_id AND o.status='active'
            JOIN contexts c ON c.context_key=CONCAT('organization:',o.id)
            JOIN users u ON u.id=om.user_id
            JOIN accounts a ON a.phone=u.phone AND a.status='active'
            JOIN persons p ON p.account_id=a.id
            LEFT JOIN capability_sets baseSet ON baseSet.code='organization.member'
            LEFT JOIN capability_sets roleSet ON roleSet.code=CASE
                WHEN om.member_role='owner' THEN 'organization.owner'
                WHEN om.member_role='master' THEN 'organization.master'
                WHEN om.member_role IN ('seller','manager') THEN 'organization.seller'
                ELSE 'organization.member' END
            WHERE om.status='active'
            ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),capability_set_id=VALUES(capability_set_id),membership_status='active',updated_at=CURRENT_TIMESTAMP");
    },
];
