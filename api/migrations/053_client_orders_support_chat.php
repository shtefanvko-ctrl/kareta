<?php
declare(strict_types=1);
return [
 'version'=>53,
 'note'=>'client order cards and persistent online support chat',
 'run'=>static function(PDO $pdo):void{
  $hasUpdated=(int)$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chats' AND COLUMN_NAME='updated_at'")->fetchColumn();
  if(!$hasUpdated){$pdo->exec("ALTER TABLE `chats` ADD COLUMN `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`");}
  $hasSto=(int)$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='chats' AND COLUMN_NAME='unread_sto'")->fetchColumn();
  if(!$hasSto){$pdo->exec("ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0 AFTER `unread_admin`");}
  try{$pdo->exec("ALTER TABLE `chats` ADD INDEX `idx_chats_updated` (`updated_at`)");}catch(Throwable $e){}
 }
];
