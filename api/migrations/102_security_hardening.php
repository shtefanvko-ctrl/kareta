<?php
declare(strict_types=1);

return [
    'version'=>102,
    'note'=>'R188.5.5.6: authentication, role moderation and upload security hardening',
    'run'=>static function(PDO $pdo): void {
        $columnExists=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
        $indexExists=static function(string $table,string $index)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?");$q->execute([$table,$index]);return (int)$q->fetchColumn()>0;};
        if(!$columnExists('auth_challenges','request_ip_hash'))$pdo->exec("ALTER TABLE auth_challenges ADD COLUMN request_ip_hash CHAR(64) NULL AFTER purpose");
        if(!$indexExists('auth_challenges','idx_auth_challenges_ip'))$pdo->exec("ALTER TABLE auth_challenges ADD KEY idx_auth_challenges_ip(request_ip_hash,created_at)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `role_applications`(
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `user_id` BIGINT UNSIGNED NOT NULL,
            `requested_role` ENUM('master','sto','seller') NOT NULL,
            `status` ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
            `payload_json` JSON NULL,
            `reviewed_by_user_id` BIGINT UNSIGNED NULL,
            `reviewed_at` DATETIME NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_role_application_pending` (`user_id`,`requested_role`,`status`),
            KEY `idx_role_application_status` (`status`,`created_at`),
            CONSTRAINT `fk_role_application_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
            CONSTRAINT `fk_role_application_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Preserve already-authoritative production roles as approved. A mere
        // entry_role preference is deliberately not used here.
        $pdo->exec("INSERT INTO role_applications(user_id,requested_role,status,payload_json,reviewed_at)
            SELECT id,role,'approved',JSON_OBJECT('source','migration_102_existing_authoritative_role'),NOW()
            FROM users WHERE role IN ('master','sto','seller')
            ON DUPLICATE KEY UPDATE reviewed_at=COALESCE(role_applications.reviewed_at,VALUES(reviewed_at))");
        $pdo->exec("DELETE pending FROM role_applications pending
            JOIN role_applications approved ON approved.user_id=pending.user_id
             AND approved.requested_role=pending.requested_role AND approved.status='approved'
            WHERE pending.status='pending'");

        // Keep the new identity account status aligned with the legacy user
        // switch. Otherwise a user blocked before this migration could sign in
        // again through the identity endpoint.
        $pdo->exec("UPDATE accounts a JOIN users u ON u.phone=a.phone
            SET a.status=CASE WHEN u.active=1 THEN 'active' ELSE 'blocked' END
            WHERE a.status<>'deleted'");

        // Profiles created earlier from entry_role or an unmoderated linked row
        // lose their capabilities. The user keeps the personal client context.
        $pdo->exec("UPDATE person_profiles pp
            JOIN persons p ON p.id=pp.person_id
            JOIN accounts a ON a.id=p.account_id
            LEFT JOIN users u ON u.phone=a.phone
            SET pp.status='suspended'
            WHERE pp.profile_type IN ('master','seller') AND pp.status='active'
              AND NOT (
                COALESCE(u.role=pp.profile_type,0) OR EXISTS(
                    SELECT 1 FROM role_applications ra
                    WHERE ra.user_id=u.id AND ra.requested_role=pp.profile_type AND ra.status='approved'
                )
              )");
        $pdo->exec("UPDATE contexts c JOIN person_profiles pp ON pp.id=c.profile_id
            SET c.status='suspended'
            WHERE c.context_type='profile' AND pp.status<>'active'");
        $pdo->exec("UPDATE auth_sessions s JOIN contexts c ON c.id=s.current_context_id
            SET s.current_context_id=NULL,s.context_revision=s.context_revision+1,s.context_changed_at=NOW()
            WHERE c.status<>'active' AND s.revoked_at IS NULL");
        // Treat the authentication bypass as a credential incident: sessions
        // issued by a vulnerable build cannot remain trusted after deployment.
        $pdo->exec("UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,NOW()),rotation_grace_until=NULL WHERE revoked_at IS NULL");
    },
];
