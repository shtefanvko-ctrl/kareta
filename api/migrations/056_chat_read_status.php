<?php
declare(strict_types=1);
return ['version'=>56,'note'=>'chat read receipts and safe unread counters','run'=>static function(PDO $pdo):void{
    $has=static function(string $t,string $c)use($pdo):bool{$s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$s->execute([$t,$c]);return (int)$s->fetchColumn()>0;};
    foreach(['client','master','sto','admin'] as $role){
        $column='read_'.$role.'_at';
        if(!$has('messages',$column)) $pdo->exec("ALTER TABLE messages ADD COLUMN `{$column}` DATETIME NULL DEFAULT NULL AFTER created_at");
    }
    if(!$has('chats','updated_at')) $pdo->exec("ALTER TABLE chats ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    try{$pdo->exec("ALTER TABLE messages ADD INDEX idx_messages_chat_read (chat_id,created_at)");}catch(Throwable $_){}
}];
