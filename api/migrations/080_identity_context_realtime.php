<?php
declare(strict_types=1);
return [
 'version'=>80,
 'note'=>'R186.5 stage 11: context-aware realtime cursors and recipient scopes',
 'run'=>static function(PDO $pdo):void{
   $hasColumn=static function(string $table,string $column)use($pdo):bool{$s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$s->execute([$table,$column]);return (int)$s->fetchColumn()>0;};
   if(!$hasColumn('domain_event_recipients','context_id'))$pdo->exec("ALTER TABLE domain_event_recipients ADD COLUMN context_id BIGINT UNSIGNED NULL AFTER user_id");
   if(!$hasColumn('notification_center','context_id'))$pdo->exec("ALTER TABLE notification_center ADD COLUMN context_id BIGINT UNSIGNED NULL AFTER user_id");
   try{$pdo->exec("ALTER TABLE domain_event_recipients ADD KEY idx_der_context_event(context_id,event_id), ADD CONSTRAINT fk_der_context FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE SET NULL");}catch(Throwable $_e){}
   try{$pdo->exec("ALTER TABLE notification_center ADD KEY idx_nc_context_status(context_id,status,id), ADD CONSTRAINT fk_nc_context FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE SET NULL");}catch(Throwable $_e){}
   $pdo->exec("CREATE TABLE IF NOT EXISTS realtime_context_cursors (
      account_id BIGINT UNSIGNED NOT NULL,
      context_id BIGINT UNSIGNED NOT NULL,
      last_event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
      last_seen_at DATETIME NULL,
      transport VARCHAR(16) NOT NULL DEFAULT 'none',
      client_id VARCHAR(80) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY(account_id,context_id),
      KEY idx_rt_context_seen(last_seen_at),
      CONSTRAINT fk_rt_cursor_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_rt_cursor_context FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
   $pdo->exec("UPDATE domain_event_recipients r JOIN domain_events e ON e.id=r.event_id JOIN domain_entities d ON d.entity_type=e.aggregate_type AND d.entity_key=e.aggregate_key SET r.context_id=d.owner_context_id WHERE r.context_id IS NULL AND d.owner_context_id IS NOT NULL");
   $pdo->exec("UPDATE domain_event_recipients r JOIN users u ON u.id=r.user_id JOIN accounts a ON a.phone=u.phone JOIN contexts c ON c.account_id=a.id AND c.context_type='personal' AND c.status='active' SET r.context_id=c.id WHERE r.context_id IS NULL");
   $pdo->exec("UPDATE notification_center n JOIN domain_event_recipients r ON r.event_id=n.event_id AND r.user_id=n.user_id SET n.context_id=r.context_id WHERE n.context_id IS NULL");
 }
];
