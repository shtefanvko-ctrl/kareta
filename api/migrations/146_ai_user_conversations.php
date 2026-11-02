<?php
declare(strict_types=1);
return [
 'version'=>146,
 'note'=>'KARETA AI: account-owned conversations with bounded message history',
 'run'=>static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS ai_user_conversations (
   id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
   account_id BIGINT UNSIGNED NOT NULL,
   title VARCHAR(160) NOT NULL DEFAULT 'Новый диалог',
   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY(id),
   UNIQUE KEY uq_ai_conversation_account(id,account_id),
   KEY idx_ai_conversations_owner(account_id,updated_at),
   CONSTRAINT fk_ai_conversation_owner FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS ai_user_messages (
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
   conversation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
   account_id BIGINT UNSIGNED NOT NULL,
   role ENUM('user','assistant') NOT NULL,
   content TEXT NOT NULL,
   created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(id),
   KEY idx_ai_message_owner(account_id,created_at),
   KEY idx_ai_message_thread(conversation_id,id),
   CONSTRAINT fk_ai_message_owner_binding FOREIGN KEY(conversation_id,account_id) REFERENCES ai_user_conversations(id,account_id) ON DELETE CASCADE,
   CONSTRAINT fk_ai_message_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
