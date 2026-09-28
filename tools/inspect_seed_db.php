<?php
declare(strict_types=1);
require __DIR__.'/../api/bootstrap.php';
$pdo=kareta_pdo();
if(!$pdo){fwrite(STDERR,"NO_DB\n");exit(2);}
$tables=['users','accounts','persons','contexts','community_posts','master_wall_comments_social','chats','chat_participants','messages'];
foreach($tables as $t){
 echo "=== $t ===\n";
 try{
  $st=$pdo->query("SHOW COLUMNS FROM `$t`");
  foreach($st->fetchAll(PDO::FETCH_ASSOC) as $r){
   echo $r['Field']."|".$r['Type']."|".$r['Null']."|".($r['Key']??'')."|".($r['Default']??'')."\n";
  }
 }catch(Throwable $e){echo "ERR|".$e->getMessage()."\n";}
}
echo "=== users_sample ===\n";
try{
 $rows=$pdo->query("SELECT id,phone,name,role,active FROM users ORDER BY id LIMIT 30")->fetchAll(PDO::FETCH_ASSOC);
 foreach($rows as $r) echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
}catch(Throwable $e){echo "ERR|".$e->getMessage()."\n";}
echo "=== identity_links ===\n";
try{
 $sql="SELECT a.id account_id,a.phone,p.id person_id,p.fullname,c.id context_id,c.context_key,c.context_type,c.status
 FROM accounts a LEFT JOIN persons p ON p.account_id=a.id LEFT JOIN contexts c ON c.account_id=a.id
 ORDER BY a.id LIMIT 40";
 foreach($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
}catch(Throwable $e){echo "ERR|".$e->getMessage()."\n";}
echo "=== chats_sample ===\n";
try{
 foreach($pdo->query("SELECT id,chat_type,title,client_user_id,master_user_id,client_name,master_name,status,created_at FROM chats ORDER BY created_at DESC LIMIT 20")->fetchAll(PDO::FETCH_ASSOC) as $r) echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
}catch(Throwable $e){echo "ERR|".$e->getMessage()."\n";}
