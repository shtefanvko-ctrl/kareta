<?php
declare(strict_types=1);

return [
    'version' => 109,
    'note' => 'R188.5.5.6.31: repair orphaned active master Identity profiles and bind them to masters rows',
    'run' => static function (PDO $pdo): void {
        $tableExists = static function (string $table) use ($pdo): bool {
            $s = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
            $s->execute([$table]);
            return (int)$s->fetchColumn() > 0;
        };
        foreach (['person_profiles','persons','accounts','users','masters'] as $table) {
            if (!$tableExists($table)) return;
        }

        // Materialize a missing legacy master row only for an already-active
        // Identity master profile. The profile is the authorization source;
        // this migration merely repairs the business entity behind it.
        $pdo->exec("INSERT INTO masters(id,user_id,user_phone,name,phone,initials,spec,active)
            SELECT
                CASE
                    WHEN COALESCE(pp.legacy_entity_id,'')<>'' AND CHAR_LENGTH(pp.legacy_entity_id)<=32 THEN pp.legacy_entity_id
                    ELSE CONCAT('master_user_',SUBSTRING(SHA1(CONCAT(u.id,'|',a.phone)),1,20))
                END AS master_id,
                u.id,
                a.phone,
                COALESCE(NULLIF(p.fullname,''),NULLIF(u.name,''),'Мастер KARETA.KZ'),
                a.phone,
                COALESCE(u.initials,''),
                COALESCE(u.spec,''),
                1
            FROM person_profiles pp
            JOIN persons p ON p.id=pp.person_id
            JOIN accounts a ON a.id=p.account_id AND a.status='active'
            JOIN users u ON u.phone=a.phone AND u.active=1
            LEFT JOIN masters legacy_master ON BINARY legacy_master.id=BINARY pp.legacy_entity_id
            LEFT JOIN masters user_master ON user_master.user_id=u.id AND COALESCE(user_master.active,1)=1
            WHERE pp.profile_type='master' AND pp.status='active'
              AND legacy_master.id IS NULL AND user_master.id IS NULL
            ON DUPLICATE KEY UPDATE
                user_id=VALUES(user_id),user_phone=VALUES(user_phone),phone=VALUES(phone),
                name=COALESCE(NULLIF(masters.name,''),VALUES(name)),
                initials=COALESCE(NULLIF(masters.initials,''),VALUES(initials)),
                spec=COALESCE(NULLIF(masters.spec,''),VALUES(spec)),active=1");

        // Normalize user/phone bindings for already-linked master rows.
        $pdo->exec("UPDATE masters m
            JOIN person_profiles pp ON BINARY pp.legacy_entity_id=BINARY m.id AND pp.profile_type='master' AND pp.status='active'
            JOIN persons p ON p.id=pp.person_id
            JOIN accounts a ON a.id=p.account_id AND a.status='active'
            JOIN users u ON u.phone=a.phone AND u.active=1
            SET m.user_id=u.id,m.user_phone=a.phone,m.phone=a.phone,m.active=1,
                m.name=COALESCE(NULLIF(m.name,''),NULLIF(p.fullname,''),NULLIF(u.name,''),'Мастер KARETA.KZ')");

        // If the active Identity profile had an empty/stale link but a master row
        // exists for the same account, restore the canonical link.
        $pdo->exec("UPDATE person_profiles pp
            JOIN persons p ON p.id=pp.person_id
            JOIN accounts a ON a.id=p.account_id AND a.status='active'
            JOIN users u ON u.phone=a.phone AND u.active=1
            JOIN masters m ON m.user_id=u.id AND COALESCE(m.active,1)=1
            SET pp.legacy_entity_type='master',pp.legacy_entity_id=m.id,pp.updated_at=CURRENT_TIMESTAMP
            WHERE pp.profile_type='master' AND pp.status='active'");
    },
];
