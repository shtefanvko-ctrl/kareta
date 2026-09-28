<?php
declare(strict_types=1);
return [
 'version'=>54,
 'note'=>'schema integrity repair and chat attachment columns',
 'run'=>static function(PDO $pdo):void{
  $hasTable=static function(string $table)use($pdo):bool{$st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");$st->execute([$table]);return (int)$st->fetchColumn()>0;};
  $hasColumn=static function(string $table,string $column)use($pdo):bool{$st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$st->execute([$table,$column]);return (int)$st->fetchColumn()>0;};
  if($hasTable('vehicle_documents')){
   if(!$hasColumn('vehicle_documents','document_number')){$pdo->exec("ALTER TABLE `vehicle_documents` ADD COLUMN `document_number` VARCHAR(120) NULL AFTER `title`");if($hasColumn('vehicle_documents','number')){$pdo->exec("UPDATE `vehicle_documents` SET `document_number`=`number` WHERE (`document_number` IS NULL OR `document_number`='')");}}
   if(!$hasColumn('vehicle_documents','issued_at'))$pdo->exec("ALTER TABLE `vehicle_documents` ADD COLUMN `issued_at` DATE NULL");
   if(!$hasColumn('vehicle_documents','expires_at'))$pdo->exec("ALTER TABLE `vehicle_documents` ADD COLUMN `expires_at` DATE NULL");
   if(!$hasColumn('vehicle_documents','file_url'))$pdo->exec("ALTER TABLE `vehicle_documents` ADD COLUMN `file_url` VARCHAR(500) NULL");
  }
  if($hasTable('messages')){
   if(!$hasColumn('messages','file_name'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `file_name` VARCHAR(191) NULL");
   if(!$hasColumn('messages','file_type'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `file_type` VARCHAR(120) NULL");
   if(!$hasColumn('messages','file_data'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `file_data` MEDIUMTEXT NULL");
   if(!$hasColumn('messages','client_message_id'))$pdo->exec("ALTER TABLE `messages` ADD COLUMN `client_message_id` VARCHAR(96) NULL");
   try{$pdo->exec("ALTER TABLE `messages` ADD UNIQUE KEY `uq_messages_client_message_id` (`chat_id`,`from_role`,`client_message_id`)");}catch(Throwable $e){}
  }
 }
];
