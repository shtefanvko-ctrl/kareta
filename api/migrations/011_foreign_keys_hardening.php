<?php
return [
    'version' => 11,
    'note' => 'normalize relation columns and add safe foreign keys for users clients masters orders chats logs stats',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_backfill_relations($pdo);

        // Make relation columns nullable where empty-string legacy values were used.
        $alterChecks = [
            ['orders', 'client_id', "ALTER TABLE `orders` MODIFY `client_id` VARCHAR(64) NULL DEFAULT NULL"],
            ['orders', 'master_id', "ALTER TABLE `orders` MODIFY `master_id` VARCHAR(32) NULL DEFAULT NULL"],
            ['chats', 'order_id', "ALTER TABLE `chats` MODIFY `order_id` VARCHAR(16) NULL DEFAULT NULL"],
            ['chats', 'client_id', "ALTER TABLE `chats` MODIFY `client_id` VARCHAR(64) NULL DEFAULT NULL"],
            ['chats', 'master_id', "ALTER TABLE `chats` MODIFY `master_id` VARCHAR(32) NULL DEFAULT NULL"],
        ];
        foreach ($alterChecks as [$table, $column, $sql]) {
            if (kareta_column_exists($pdo, $table, $column)) {
                $pdo->exec($sql);
            }
        }

        // Normalize legacy empty strings to NULL before adding FK constraints.
        $pdo->exec("UPDATE `orders` SET client_id=NULL WHERE TRIM(COALESCE(client_id,''))=''");
        $pdo->exec("UPDATE `orders` SET master_id=NULL WHERE TRIM(COALESCE(master_id,''))=''");
        $pdo->exec("UPDATE `chats` SET order_id=NULL WHERE TRIM(COALESCE(order_id,''))=''");
        $pdo->exec("UPDATE `chats` SET client_id=NULL WHERE TRIM(COALESCE(client_id,''))=''");
        $pdo->exec("UPDATE `chats` SET master_id=NULL WHERE TRIM(COALESCE(master_id,''))=''");

        // Remove invalid references safely; keep rows, null only broken links.
        $pdo->exec("UPDATE `clients` c LEFT JOIN `users` u ON u.id = c.user_id SET c.user_id = NULL WHERE c.user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `masters` m LEFT JOIN `users` u ON u.id = m.user_id SET m.user_id = NULL WHERE m.user_id IS NOT NULL AND u.id IS NULL");

        $pdo->exec("UPDATE `orders` o LEFT JOIN `clients` c ON c.id = o.client_id SET o.client_id = NULL WHERE o.client_id IS NOT NULL AND c.id IS NULL");
        $pdo->exec("UPDATE `orders` o LEFT JOIN `masters` m ON m.id = o.master_id SET o.master_id = NULL WHERE o.master_id IS NOT NULL AND m.id IS NULL");
        $pdo->exec("UPDATE `orders` o LEFT JOIN `users` u ON u.id = o.client_user_id SET o.client_user_id = NULL WHERE o.client_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `orders` o LEFT JOIN `users` u ON u.id = o.master_user_id SET o.master_user_id = NULL WHERE o.master_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `orders` o LEFT JOIN `users` u ON u.id = o.assigned_admin_user_id SET o.assigned_admin_user_id = NULL WHERE o.assigned_admin_user_id IS NOT NULL AND u.id IS NULL");

        $pdo->exec("UPDATE `chats` c LEFT JOIN `orders` o ON o.id = c.order_id SET c.order_id = NULL WHERE c.order_id IS NOT NULL AND o.id IS NULL");
        $pdo->exec("UPDATE `chats` c LEFT JOIN `clients` cl ON cl.id = c.client_id SET c.client_id = NULL WHERE c.client_id IS NOT NULL AND cl.id IS NULL");
        $pdo->exec("UPDATE `chats` c LEFT JOIN `masters` m ON m.id = c.master_id SET c.master_id = NULL WHERE c.master_id IS NOT NULL AND m.id IS NULL");
        $pdo->exec("UPDATE `chats` c LEFT JOIN `users` u ON u.id = c.client_user_id SET c.client_user_id = NULL WHERE c.client_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `chats` c LEFT JOIN `users` u ON u.id = c.master_user_id SET c.master_user_id = NULL WHERE c.master_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `chats` c LEFT JOIN `users` u ON u.id = c.assigned_admin_user_id SET c.assigned_admin_user_id = NULL WHERE c.assigned_admin_user_id IS NOT NULL AND u.id IS NULL");

        $pdo->exec("UPDATE `messages` m LEFT JOIN `users` u ON u.id = m.author_user_id SET m.author_user_id = NULL WHERE m.author_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `audit_log` a LEFT JOIN `users` u ON u.id = a.actor_user_id SET a.actor_user_id = NULL WHERE a.actor_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("UPDATE `system_logs` s LEFT JOIN `users` u ON u.id = s.actor_user_id SET s.actor_user_id = NULL WHERE s.actor_user_id IS NOT NULL AND u.id IS NULL");
        $pdo->exec("DELETE us FROM `user_stats` us LEFT JOIN `users` u ON u.id = us.user_id WHERE u.id IS NULL");

        // Foreign keys to users.
        kareta_ensure_foreign_key($pdo, 'clients', 'fk_clients_user_id', "ALTER TABLE `clients` ADD CONSTRAINT `fk_clients_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'masters', 'fk_masters_user_id', "ALTER TABLE `masters` ADD CONSTRAINT `fk_masters_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'orders', 'fk_orders_client_user_id', "ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_client_user_id` FOREIGN KEY (`client_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'orders', 'fk_orders_master_user_id', "ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_master_user_id` FOREIGN KEY (`master_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'orders', 'fk_orders_assigned_admin_user_id', "ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_assigned_admin_user_id` FOREIGN KEY (`assigned_admin_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_client_user_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_client_user_id` FOREIGN KEY (`client_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_master_user_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_master_user_id` FOREIGN KEY (`master_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_assigned_admin_user_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_assigned_admin_user_id` FOREIGN KEY (`assigned_admin_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'messages', 'fk_messages_author_user_id', "ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_author_user_id` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'audit_log', 'fk_audit_log_actor_user_id', "ALTER TABLE `audit_log` ADD CONSTRAINT `fk_audit_log_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'system_logs', 'fk_system_logs_actor_user_id', "ALTER TABLE `system_logs` ADD CONSTRAINT `fk_system_logs_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'user_stats', 'fk_user_stats_user_id', "ALTER TABLE `user_stats` ADD CONSTRAINT `fk_user_stats_user_id` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE");

        // Foreign keys between domain tables.
        kareta_ensure_foreign_key($pdo, 'orders', 'fk_orders_client_id', "ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_client_id` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'orders', 'fk_orders_master_id', "ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_master_id` FOREIGN KEY (`master_id`) REFERENCES `masters`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_order_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_client_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_client_id` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");
        kareta_ensure_foreign_key($pdo, 'chats', 'fk_chats_master_id', "ALTER TABLE `chats` ADD CONSTRAINT `fk_chats_master_id` FOREIGN KEY (`master_id`) REFERENCES `masters`(`id`) ON UPDATE CASCADE ON DELETE SET NULL");

        kareta_rebuild_user_stats($pdo);
    },
];
