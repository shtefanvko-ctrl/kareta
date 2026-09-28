<?php
return [
    'version' => 60,
    'note' => 'Safe normalization of user-master-STO-order relations',
    'run' => function(PDO $pdo): void {
        $tableExists = static function(string $table) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?");
            $st->execute([$table]); return (int)$st->fetchColumn()>0;
        };
        $columnExists = static function(string $table,string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?");
            $st->execute([$table,$column]); return (int)$st->fetchColumn()>0;
        };
        if (!$tableExists('masters') || !$tableExists('users')) return;

        $pdo->exec("CREATE TABLE IF NOT EXISTS relation_integrity_log (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            issue_type VARCHAR(80) NOT NULL,
            entity_type VARCHAR(40) NOT NULL,
            entity_id VARCHAR(64) NOT NULL DEFAULT '',
            details_json JSON NULL,
            resolution VARCHAR(40) NOT NULL DEFAULT 'detected',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ril_issue(issue_type,resolution),
            INDEX idx_ril_entity(entity_type,entity_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // 1. Restore masters.user_id only when phone identifies exactly one master user.
        if ($columnExists('masters','user_id') && $columnExists('masters','user_phone')) {
            $pdo->exec("UPDATE masters m
                JOIN (
                    SELECT m2.id master_id, MIN(u.id) user_id, COUNT(*) matches_count
                    FROM masters m2 JOIN users u
                      ON REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(u.phone,'+',''),' ',''),'(',''),')',''),'-','')
                       = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(NULLIF(m2.user_phone,''),m2.phone),'+',''),' ',''),'(',''),')',''),'-','')
                    WHERE LOWER(COALESCE(u.role,u.entry_role,'')) IN ('master','мастер')
                    GROUP BY m2.id
                ) x ON x.master_id=m.id AND x.matches_count=1
                SET m.user_id=x.user_id
                WHERE (m.user_id IS NULL OR m.user_id=0)");
        }

        // 2. Restore STO profile user_id only for an unambiguous STO phone match.
        if ($tableExists('sto_profiles') && $columnExists('sto_profiles','user_id')) {
            $pdo->exec("UPDATE sto_profiles s
                JOIN (
                    SELECT s2.id sto_id, MIN(u.id) user_id, COUNT(*) matches_count
                    FROM sto_profiles s2 JOIN users u
                      ON REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(u.phone,'+',''),' ',''),'(',''),')',''),'-','')
                       = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(NULLIF(s2.user_phone,''),s2.contact_phone),'+',''),' ',''),'(',''),')',''),'-','')
                    WHERE LOWER(COALESCE(u.role,u.entry_role,'')) IN ('sto','сто')
                    GROUP BY s2.id
                ) x ON x.sto_id=s.id AND x.matches_count=1
                SET s.user_id=x.user_id
                WHERE (s.user_id IS NULL OR s.user_id=0)");
        }

        // 3. Link a master to STO only when exactly one active relation exists.
        if ($tableExists('sto_master_links') && $columnExists('masters','sto_id')) {
            $pdo->exec("UPDATE masters m
                JOIN (
                    SELECT master_id, MIN(sto_id) sto_id, COUNT(*) active_count
                    FROM sto_master_links WHERE status='active' GROUP BY master_id
                ) x ON x.master_id=m.id AND x.active_count=1
                LEFT JOIN sto_profiles s ON s.id=x.sto_id
                SET m.sto_id=x.sto_id, m.sto_name=COALESCE(s.name,m.sto_name,'')
                WHERE COALESCE(m.sto_id,'')='' OR m.sto_id=x.sto_id");
        }

        if (!$tableExists('orders')) return;
        // 4. Backfill order master_user_id from the selected master.
        if ($columnExists('orders','master_user_id') && $columnExists('orders','master_id')) {
            $pdo->exec("UPDATE orders o JOIN masters m ON m.id=o.master_id
                SET o.master_user_id=m.user_id
                WHERE COALESCE(o.master_id,'')<>'' AND (o.master_user_id IS NULL OR o.master_user_id=0) AND m.user_id IS NOT NULL");
        }
        // 5. Backfill order STO only through the explicitly selected master's normalized STO.
        if ($columnExists('orders','sto_id') && $columnExists('orders','master_id')) {
            $setName = $columnExists('orders','sto_name') ? ", o.sto_name=COALESCE(s.name,o.sto_name,'')" : '';
            $pdo->exec("UPDATE orders o JOIN masters m ON m.id=o.master_id LEFT JOIN sto_profiles s ON s.id=m.sto_id
                SET o.sto_id=m.sto_id{$setName}
                WHERE COALESCE(o.sto_id,'')='' AND COALESCE(m.sto_id,'')<>''");
        }

        // Helpful indexes; duplicate-index errors are intentionally ignored.
        foreach ([
            "ALTER TABLE masters ADD INDEX idx_masters_sto_active(sto_id,active)",
            "ALTER TABLE orders ADD INDEX idx_orders_scope_master(master_id,master_user_id)",
            "ALTER TABLE orders ADD INDEX idx_orders_scope_sto(sto_id,status)",
        ] as $sql) { try { $pdo->exec($sql); } catch(Throwable $_) {} }
    },
];
