<?php
return [
    'version' => 9,
    'note' => 'normalize user based links for clients masters orders chats messages logs',
    'run' => static function (PDO $pdo): void {
        kareta_ensure_schema_columns($pdo);
        kareta_ensure_index($pdo, 'clients', 'idx_user_id', "ALTER TABLE `clients` ADD INDEX `idx_user_id` (`user_id`)");
        kareta_ensure_index($pdo, 'masters', 'idx_user_id', "ALTER TABLE `masters` ADD INDEX `idx_user_id` (`user_id`)");

        $pdo->exec("UPDATE `clients` c INNER JOIN `users` u ON u.phone = c.user_phone SET c.user_id = u.id WHERE c.user_id IS NULL AND TRIM(COALESCE(c.user_phone,'')) <> ''");
        $pdo->exec("UPDATE `masters` m INNER JOIN `users` u ON u.phone = m.user_phone SET m.user_id = u.id WHERE m.user_id IS NULL AND TRIM(COALESCE(m.user_phone,'')) <> ''");
        $pdo->exec("UPDATE `orders` o INNER JOIN `clients` c ON c.id = o.client_id SET o.client_user_id = c.user_id WHERE o.client_user_id IS NULL AND c.user_id IS NOT NULL");
        $pdo->exec("UPDATE `orders` o INNER JOIN `masters` m ON m.id = o.master_id SET o.master_user_id = m.user_id WHERE o.master_user_id IS NULL AND m.user_id IS NOT NULL");
        $pdo->exec("UPDATE `chats` c INNER JOIN `clients` cl ON cl.id = c.client_id SET c.client_user_id = cl.user_id WHERE c.client_user_id IS NULL AND cl.user_id IS NOT NULL");
        $pdo->exec("UPDATE `chats` c INNER JOIN `masters` m ON m.id = c.master_id SET c.master_user_id = m.user_id WHERE c.master_user_id IS NULL AND m.user_id IS NOT NULL");
        $pdo->exec("UPDATE `messages` msg INNER JOIN `chats` c ON c.id = msg.chat_id SET msg.author_user_id = CASE WHEN msg.from_role='client' THEN c.client_user_id WHEN msg.from_role='master' THEN c.master_user_id WHEN msg.from_role IN ('admin','owner') THEN c.assigned_admin_user_id ELSE msg.author_user_id END WHERE msg.author_user_id IS NULL");
        $pdo->exec("UPDATE `system_logs` sl INNER JOIN `users` u ON u.phone = sl.actor_phone SET sl.actor_user_id = u.id WHERE sl.actor_user_id IS NULL AND TRIM(COALESCE(sl.actor_phone,'')) <> ''");
        kareta_rebuild_user_stats($pdo);
    },
];
