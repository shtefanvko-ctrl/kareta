<?php
require __DIR__.'/../api/bootstrap.php';
$pdo=kareta_pdo();
$rows=$pdo->query("SELECT cp.user_id,cp.role,COUNT(*) chats,SUM(cp.unread_count) unread
FROM chat_participants cp
WHERE cp.chat_id LIKE 'demo84_127_chat_%' AND cp.left_at IS NULL
GROUP BY cp.user_id,cp.role ORDER BY cp.user_id,cp.role")->fetchAll(PDO::FETCH_ASSOC);
$bad=(int)$pdo->query("SELECT COUNT(*) FROM chat_participants WHERE chat_id LIKE 'demo84_127_chat_%' AND left_at IS NULL AND user_id NOT IN (1,3)")->fetchColumn();
echo json_encode(['active'=>$rows,'unexpectedActive'=>$bad],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),PHP_EOL;
