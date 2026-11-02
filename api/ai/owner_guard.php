<?php
declare(strict_types=1);
/** Reusable account-isolation queries. Never accept a user-selected account id. */
function kareta_ai_owned_conversation(PDO $pdo,int $accountId,string $conversationId): ?array {
 if($accountId<=0||!preg_match('/^[a-f0-9]{32}$/D',$conversationId))return null;
 $st=$pdo->prepare('SELECT id,title FROM ai_user_conversations WHERE id=? AND account_id=? LIMIT 1');
 $st->execute([$conversationId,$accountId]);
 $row=$st->fetch(PDO::FETCH_ASSOC);
 return is_array($row)?$row:null;
}
function kareta_ai_owned_messages(PDO $pdo,int $accountId,string $conversationId,int $limit=30): array {
 if(!kareta_ai_owned_conversation($pdo,$accountId,$conversationId))return [];
 $limit=max(1,min($limit,30));
 $st=$pdo->prepare('SELECT role,content,created_at FROM ai_user_messages WHERE conversation_id=? AND account_id=? ORDER BY id DESC LIMIT '.$limit);
 $st->execute([$conversationId,$accountId]);
 return array_reverse($st->fetchAll(PDO::FETCH_ASSOC));
}
