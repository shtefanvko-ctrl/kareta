<?php
require __DIR__.'/../api/bootstrap.php';
$pdo=kareta_pdo();
$out=[];
$out['masters_current']=$pdo->query("SELECT id,user_id,user_phone,name,active FROM masters WHERE user_id IN (1,3) OR user_phone IN (SELECT phone FROM users WHERE id IN (1,3)) ORDER BY user_id,id")->fetchAll(PDO::FETCH_ASSOC);
$out['chat_counts']=$pdo->query("SELECT COUNT(*) chats,(SELECT COUNT(*) FROM messages WHERE id LIKE 'demo84_127_msg_%') messages,(SELECT COUNT(*) FROM chat_participants WHERE chat_id LIKE 'demo84_127_chat_%') participants FROM chats WHERE id LIKE 'demo84_127_chat_%'")->fetch(PDO::FETCH_ASSOC);
$out['participants']=$pdo->query("SELECT cp.user_id,u.name,u.role,COUNT(*) chats,SUM(cp.unread_count) unread FROM chat_participants cp LEFT JOIN users u ON u.id=cp.user_id WHERE cp.chat_id LIKE 'demo84_127_chat_%' GROUP BY cp.user_id,u.name,u.role ORDER BY chats DESC,cp.user_id")->fetchAll(PDO::FETCH_ASSOC);
$out['sample_messages']=$pdo->query("SELECT chat_id,from_role,author_user_id,text,time FROM messages WHERE id LIKE 'demo84_127_msg_%' ORDER BY chat_id,created_at LIMIT 12")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT),PHP_EOL;
