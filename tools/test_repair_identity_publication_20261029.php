<?php
declare(strict_types=1);
// Standalone regression: does not connect to production or QA MySQL.
$root=dirname(__DIR__);
function kareta_normalize_phone(string $raw): string { return preg_replace('/\D+/', '', $raw) ?: ''; }
function kareta_order_scope(PDO $pdo): array { return $GLOBALS['QA_ROLE_SCOPE']; }
require $root.'/api/work_orders.php';
$pdo=(new ReflectionClass(PDO::class))->newInstanceWithoutConstructor();
function check(bool $pass,string $label): void {
    if (!$pass) { fwrite(STDERR,"FAIL $label\n"); exit(1); }
    echo "PASS $label\n";
}
$order=[
 'client_user_id'=>42,'client_phone'=>'77000009001',
 'master_id'=>'master_qa_1','sto_id'=>'sto_qa_1'
];
$cases=[
 ['unauthenticated', ['role'=>'client','userId'=>0,'phone'=>''],false],
 ['legitimate_client_id', ['role'=>'client','userId'=>42,'phone'=>''],true],
 ['other_client_id', ['role'=>'client','userId'=>99,'phone'=>''],false],
 ['legitimate_client_phone', ['role'=>'client','userId'=>0,'phone'=>'77000009001'],true],
 ['other_client_phone', ['role'=>'client','userId'=>0,'phone'=>'77000009002'],false],
 ['master_owner', ['role'=>'master','masterId'=>'master_qa_1'],true],
 ['master_other', ['role'=>'master','masterId'=>'master_other'],false],
 ['master_empty_both', ['role'=>'master','masterId'=>''],false],
 ['sto_owner', ['role'=>'sto','stoId'=>'sto_qa_1'],true],
 ['sto_other', ['role'=>'sto','stoId'=>'sto_other'],false],
 ['sto_empty_both', ['role'=>'sto','stoId'=>''],false],
 ['seller_denied', ['role'=>'seller'],false]
];
foreach($cases as [$name,$scope,$expected]) {
    $GLOBALS['QA_ROLE_SCOPE']=$scope;
    check(kareta_work_order_can_view($pdo,$order)===$expected,'ownership_'.$name);
}
foreach(['master','sto','client'] as $role) {
    $GLOBALS['QA_ROLE_SCOPE']=['role'=>$role,'userId'=>0,'phone'=>'','masterId'=>'','stoId'=>''];
    check(!kareta_work_order_can_view($pdo,['client_user_id'=>0,'client_phone'=>'','master_id'=>'','sto_id'=>'']),
          'empty_order_not_public_'.$role);
}
$db=file_get_contents($root.'/api/db.php');
check(str_contains($db,"case 'orders.create':     if(!".'$pdo'.")_no_db(); kareta_require_api_session("),'orders_create_authoritative_login');
check(str_contains($db,'$actorUser = kareta_resolve_api_actor($pdo);'),'orders_create_authoritative_actor');
$post=file_get_contents($root.'/api/work_posts.php');
check(preg_match('/INSERT INTO work_posts\((.*?)\) VALUES\((.*?)\) ON DUPLICATE/s',$post,$m)===1,'work_post_sql_visible');
check(count(explode(',',$m[1]))===28 && count(explode(',',$m[2]))===28 && substr_count($m[2],'?')===24,'work_post_sql_arity');
$lifecycle=file_get_contents($root.'/api/master_order_lifecycle.php');
check(str_contains($lifecycle,'car_handover_confirmed=1,completed_at=COALESCE(completed_at,NOW())'),'handover_completed_at');
$manifest=require $root.'/api/migration_manifest.php';
$migration=$root.'/api/migrations/146_order_workflow_updated_at.php';
check($manifest['version']===146 && hash_file('sha256',$migration)===$manifest['files'][146]['checksum'],'migration_manifest_146');
echo "REPAIR_IDENTITY_PUBLICATION: PASS\n";
