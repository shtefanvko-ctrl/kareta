<?php
return [
    'version' => 7,
    'note' => 'unify users clients masters around users.phone (duplicate-safe)',
    'run' => static function (PDO $pdo): void {
        $colChecks = [
            ['clients', 'user_phone', "ALTER TABLE `clients` ADD COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL AFTER `id`"],
            ['masters', 'user_phone', "ALTER TABLE `masters` ADD COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL AFTER `id`"],
        ];
        foreach ($colChecks as [$table, $column, $sql]) {
            $st = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $st->execute([$table, $column]);
            if ((int)$st->fetchColumn() === 0) {
                $pdo->exec($sql);
            }
        }

        // Legacy installations could have NOT NULL + empty-string values. Empty strings
        // cannot coexist under a UNIQUE index and duplicate legacy profiles can share a
        // phone. Make the relation nullable before normalizing/backfilling it.
        $pdo->exec("ALTER TABLE `clients` MODIFY COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL");
        $pdo->exec("ALTER TABLE `masters` MODIFY COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL");
        $pdo->exec("UPDATE `clients` SET `user_phone` = NULL WHERE TRIM(COALESCE(`user_phone`, '')) = ''");
        $pdo->exec("UPDATE `masters` SET `user_phone` = NULL WHERE TRIM(COALESCE(`user_phone`, '')) = ''");

        // Keep one canonical entity row for each normalized phone. Any duplicate legacy
        // rows remain available, but are detached from the unique user relation.
        foreach (['clients', 'masters'] as $table) {
            $pdo->exec("UPDATE `{$table}` t
                INNER JOIN (
                    SELECT normalized_phone, MIN(id) AS keep_id
                    FROM (
                        SELECT id, TRIM(COALESCE(NULLIF(user_phone, ''), NULLIF(phone, ''))) AS normalized_phone
                        FROM `{$table}`
                    ) source_rows
                    WHERE normalized_phone IS NOT NULL AND normalized_phone <> ''
                    GROUP BY normalized_phone
                    HAVING COUNT(*) > 1
                ) duplicates
                    ON TRIM(COALESCE(NULLIF(t.user_phone, ''), NULLIF(t.phone, ''))) = duplicates.normalized_phone
                   AND t.id <> duplicates.keep_id
                SET t.user_phone = NULL");

            $pdo->exec("UPDATE `{$table}` t
                LEFT JOIN (
                    SELECT normalized_phone, MIN(id) AS keep_id
                    FROM (
                        SELECT id, TRIM(COALESCE(NULLIF(user_phone, ''), NULLIF(phone, ''))) AS normalized_phone
                        FROM `{$table}`
                    ) source_rows
                    WHERE normalized_phone IS NOT NULL AND normalized_phone <> ''
                    GROUP BY normalized_phone
                ) canonical
                  ON canonical.normalized_phone = TRIM(t.phone)
                 AND canonical.keep_id = t.id
                SET t.user_phone = TRIM(t.phone)
                WHERE t.user_phone IS NULL
                  AND TRIM(COALESCE(t.phone, '')) <> ''
                  AND canonical.keep_id IS NOT NULL");
        }

        // Do not add a second unique index when a legacy installation already has one
        // with another name (for example uq_user_phone).
        foreach ([['clients', 'uq_clients_user_phone'], ['masters', 'uq_masters_user_phone']] as [$table, $indexName]) {
            $st = $pdo->prepare("SELECT COUNT(*)
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = 'user_phone'
                  AND NON_UNIQUE = 0");
            $st->execute([$table]);
            if ((int)$st->fetchColumn() === 0) {
                $pdo->exec("ALTER TABLE `{$table}` ADD UNIQUE INDEX `{$indexName}` (`user_phone`)");
            }
        }

        $pdo->exec("INSERT IGNORE INTO `users`(`phone`,`name`,`role`,`initials`,`car`,`spec`,`email`,`active`)
            SELECT c.user_phone,
                   COALESCE(NULLIF(c.name,''), 'Клиент'),
                   'client',
                   '',
                   COALESCE(c.car,''),
                   '',
                   '',
                   1
            FROM `clients` c
            WHERE TRIM(COALESCE(c.user_phone,'')) <> ''");

        $pdo->exec("INSERT IGNORE INTO `users`(`phone`,`name`,`role`,`initials`,`car`,`spec`,`email`,`active`)
            SELECT m.user_phone,
                   COALESCE(NULLIF(m.name,''), 'Мастер'),
                   'master',
                   COALESCE(m.initials,''),
                   '',
                   COALESCE(m.spec,''),
                   '',
                   COALESCE(m.active,1)
            FROM `masters` m
            WHERE TRIM(COALESCE(m.user_phone,'')) <> ''");

        $pdo->exec("UPDATE `users` u
            INNER JOIN `masters` m ON m.user_phone = u.phone
            SET u.role = CASE WHEN u.role IN ('owner','admin') THEN u.role ELSE 'master' END,
                u.name = COALESCE(NULLIF(u.name,''), NULLIF(m.name,''), u.name),
                u.initials = COALESCE(NULLIF(u.initials,''), NULLIF(m.initials,''), u.initials),
                u.spec = COALESCE(NULLIF(u.spec,''), NULLIF(m.spec,''), u.spec),
                u.active = COALESCE(m.active, u.active)");

        $pdo->exec("UPDATE `users` u
            INNER JOIN `clients` c ON c.user_phone = u.phone
            SET u.name = COALESCE(NULLIF(u.name,''), NULLIF(c.name,''), u.name),
                u.car = COALESCE(NULLIF(u.car,''), NULLIF(c.car,''), u.car)");

        $pdo->exec("UPDATE `clients` c
            INNER JOIN `users` u ON u.phone = c.user_phone
            SET c.name = COALESCE(NULLIF(u.name,''), c.name),
                c.phone = u.phone,
                c.car = COALESCE(NULLIF(u.car,''), c.car)");

        $pdo->exec("UPDATE `masters` m
            INNER JOIN `users` u ON u.phone = m.user_phone
            SET m.name = COALESCE(NULLIF(u.name,''), m.name),
                m.phone = u.phone,
                m.initials = COALESCE(NULLIF(u.initials,''), m.initials),
                m.spec = COALESCE(NULLIF(u.spec,''), m.spec),
                m.active = u.active
            WHERE u.role IN ('master','admin','owner')");
    },
];
