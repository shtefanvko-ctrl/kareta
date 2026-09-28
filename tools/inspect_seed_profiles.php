<?php
declare(strict_types=1);
require __DIR__.'/../api/bootstrap.php';
$pdo=kareta_pdo();
foreach(['clients','masters','sto_profiles','seller_profiles','person_profiles','context_members'] as $t){
 echo "=== $t ===\n";
 try{
  foreach($pdo->query("SHOW COLUMNS FROM `$t`")->fetchAll(PDO::FETCH_ASSOC) as $r){
   echo $r['Field']."|".$r['Type']."|".$r['Null']."|".($r['Key']??'')."|".($r['Default']??'')."\n";
  }
 }catch(Throwable $e){echo "ERR|".$e->getMessage()."\n";}
}
