<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/ai/owner_guard.php';
$pdo=new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE ai_user_conversations(id TEXT PRIMARY KEY,account_id INTEGER NOT NULL,title TEXT)');
$pdo->exec('CREATE TABLE ai_user_messages(id INTEGER PRIMARY KEY,conversation_id TEXT,account_id INTEGER,role TEXT,content TEXT,created_at TEXT)');
$a=str_repeat('a',32);$b=str_repeat('b',32);
$st=$pdo->prepare('INSERT INTO ai_user_conversations(id,account_id,title) VALUES(?,?,?)');
$st->execute([$a,101,'Private A']);$st->execute([$b,202,'Private B']);
$st=$pdo->prepare('INSERT INTO ai_user_messages(conversation_id,account_id,role,content,created_at) VALUES(?,?,?,?,?)');
$st->execute([$a,101,'user','Secret A','2026-10-29']);$st->execute([$b,202,'assistant','Secret B','2026-10-29']);
$checks=[
 'owner_A_reads_A'=>kareta_ai_owned_conversation($pdo,101,$a)!==null,
 'owner_B_reads_B'=>kareta_ai_owned_conversation($pdo,202,$b)!==null,
 'owner_A_denied_B'=>kareta_ai_owned_conversation($pdo,101,$b)===null,
 'owner_B_denied_A'=>kareta_ai_owned_conversation($pdo,202,$a)===null,
 'owner_A_messages_A'=>count(kareta_ai_owned_messages($pdo,101,$a))===1,
 'owner_A_messages_B_empty'=>count(kareta_ai_owned_messages($pdo,101,$b))===0,
 'owner_B_messages_A_empty'=>count(kareta_ai_owned_messages($pdo,202,$a))===0,
 'invalid_id_denied'=>kareta_ai_owned_conversation($pdo,101,"' OR 1=1 --")===null,
 'no_owner_zero_denied'=>kareta_ai_owned_conversation($pdo,0,$a)===null,
 'unowned_chat_denied'=>kareta_ai_owned_conversation($pdo,303,$a)===null,
];
foreach($checks as $n=>$pass)echo($pass?'PASS':'FAIL').' '.$n.PHP_EOL;
if(in_array(false,$checks,true))exit(1);
echo 'RESULT '.count($checks).'/'.count($checks).' PASS'.PHP_EOL;
