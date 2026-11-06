<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/api/identity/context_service.php';
require_once dirname(__DIR__).'/api/identity/authorization_pipeline.php';
$pdo=new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$pdo->sqliteCreateFunction('DATABASE',static fn()=> 'qa');
$pdo->exec("ATTACH DATABASE ':memory:' AS information_schema");
$pdo->exec("CREATE TABLE information_schema.TABLES (TABLE_SCHEMA TEXT, TABLE_NAME TEXT)");
$pdo->exec("CREATE TABLE accounts(id INTEGER PRIMARY KEY,phone TEXT)");
$pdo->exec("CREATE TABLE users(id INTEGER PRIMARY KEY,phone TEXT,role TEXT,active INTEGER)");
$fixtures=[
 [1,'77000001001','admin',1],
 [2,'77000001002','owner',1],
 [3,'77000001003','sto',1],
 [4,'77000001004','seller',1],
 [5,'77000001005','admin',0],
];
foreach($fixtures as [$id,$phone,$role,$active]){
 $pdo->prepare('INSERT INTO accounts(id,phone) VALUES(?,?)')->execute([$id,$phone]);
 $pdo->prepare('INSERT INTO users(id,phone,role,active) VALUES(?,?,?,?)')->execute([$id,$phone,$role,$active]);
}
$contexts=new KaretaIdentityContextService($pdo);
function check(bool $value,string $reason):void{if(!$value)throw new RuntimeException($reason);}
$results=[];
foreach($fixtures as [$id,$phone,$role,$active]){
 $personal=['id'=>$id*100+1,'type'=>'personal','key'=>'personal:'.$id,'status'=>'active'];
 $business=['id'=>$id*100+2,'type'=>'organization','organizationType'=>'service_station',
            'key'=>'organization:'.$id,'status'=>'active'];
 $types=$contexts->listAccountTypes($id,[$personal,$business]);
 $admin=array_values(array_filter($types,static fn($x)=>$x['role']==='admin'));
 $expect=$active===1&&in_array($role,['admin','owner'],true);
 check(count($admin)==($expect?1:0),'admin type unexpected for '.$role);
 if($expect)check($admin[0]['contextId']===$personal['id'] && $admin[0]['status']==='active','admin personal binding invalid');
 foreach([['personal',$personal],['organization',$business]] as [$type,$context]){
  $decision=new KaretaAuthorizationDecision($id,1,(int)$context['id'],$context,['allowed'=>['*'],'denied'=>[]],'*');
  $allowed=kareta_is_global_admin_decision($pdo,$decision);
  $want=$expect&&$type==='personal';
  check($allowed===$want,'server admin authority invalid for '.$role.'/'.$type);
  $results[]=['role'=>$role,'active'=>(bool)$active,'context'=>$type,'allowed'=>$allowed,'result'=>'PASS'];
 }
}
echo json_encode(['result'=>'PASS','cases'=>count($results),'matrix'=>$results],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."
";