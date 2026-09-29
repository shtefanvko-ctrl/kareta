<?php
declare(strict_types=1);

/**
 * Read-only capability audit for FIN-AUTH-001.
 * Does not load bootstrap.php and does not mutate capability/context state.
 *
 * Usage:
 *   php tools/audit_operational_finance_authorization.php
 *   php tools/audit_operational_finance_authorization.php --json=/tmp/finance_auth.json
 */

$root=dirname(__DIR__);
$configFile=$root.'/config.php';
if(!is_file($configFile)){fwrite(STDERR,"config.php is missing\n");exit(2);}
require $configFile;
$db=defined('KARETA_DB')?constant('KARETA_DB'):($KARETA_DB??$GLOBALS['KARETA_DB']??[]);
if(!is_array($db)){fwrite(STDERR,"Database configuration is unavailable\n");exit(2);}
$name=(string)($db['database']??$db['dbname']??'');
if($name===''){fwrite(STDERR,"Database name is empty\n");exit(2);}

$pdo=new PDO(
    sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s',
        (string)($db['host']??'localhost'),
        (int)($db['port']??3306),
        $name,
        (string)($db['charset']??'utf8mb4')),
    (string)($db['username']??$db['user']??''),
    (string)($db['password']??$db['pass']??''),
    [
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES=>false,
        PDO::ATTR_TIMEOUT=>max(1,min(5,(int)($db['connect_timeout']??3))),
    ]
);

$tableExists=static function(PDO $pdo,string $table):bool{
    $st=$pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? LIMIT 1");
    $st->execute([$table]);
    return (bool)$st->fetchColumn();
};

foreach(['capability_sets','capabilities','contexts','context_members'] as $table){
    if(!$tableExists($pdo,$table)){fwrite(STDERR,"Missing required table: {$table}\n");exit(2);}
}

$sets=$pdo->query("SELECT id,code,title,scope_type,is_system FROM capability_sets ORDER BY code")->fetchAll()?:[];
$financeRows=$pdo->query("SELECT cs.code,c.capability_key,c.effect
 FROM capabilities c JOIN capability_sets cs ON cs.id=c.capability_set_id
 WHERE c.capability_key LIKE 'finance.%' OR c.capability_key='*'
 ORDER BY cs.code,c.capability_key")->fetchAll()?:[];

$bySet=[];
foreach($sets as $set)$bySet[(string)$set['code']]=[
    'id'=>(int)$set['id'],
    'scope'=>(string)$set['scope_type'],
    'financeCapabilities'=>[],
];
foreach($financeRows as $row){
    $code=(string)$row['code'];
    if(!isset($bySet[$code]))$bySet[$code]=['id'=>0,'scope'=>'','financeCapabilities'=>[]];
    $bySet[$code]['financeCapabilities'][]=[
        'key'=>(string)$row['capability_key'],
        'effect'=>(string)$row['effect'],
    ];
}

$focusCodes=['profile.master','organization.owner','organization.master','organization.member','personal.client'];
$focus=[];
foreach($focusCodes as $code)$focus[$code]=$bySet[$code]??null;

$contextCounts=$pdo->query("SELECT
  c.context_type,
  COALESCE(cs_member.code,cs_context.code,'') capability_set_code,
  COUNT(*) n
 FROM contexts c
 LEFT JOIN context_members cm ON cm.context_id=c.id AND cm.membership_status='active'
 LEFT JOIN capability_sets cs_member ON cs_member.id=cm.capability_set_id
 LEFT JOIN capability_sets cs_context ON cs_context.id=c.capability_set_id
 WHERE c.status='active'
 GROUP BY c.context_type,COALESCE(cs_member.code,cs_context.code,'')
 ORDER BY c.context_type,capability_set_code")->fetchAll()?:[];

$overrides=[];
if($tableExists($pdo,'context_capability_overrides')){
    $overrides=$pdo->query("SELECT context_id,account_id,capability_key,effect,expires_at
      FROM context_capability_overrides
      WHERE capability_key LIKE 'finance.%' OR capability_key='*'
      ORDER BY context_id,account_id,capability_key")->fetchAll()?:[];
}

$masterHas=false;
foreach(($focus['profile.master']['financeCapabilities']??[]) as $cap){
    if($cap['effect']==='allow'&&in_array($cap['key'],['finance.manage','finance.manageOwn','*'],true))$masterHas=true;
}
$orgOwnerHas=false;
foreach(($focus['organization.owner']['financeCapabilities']??[]) as $cap){
    if($cap['effect']==='allow'&&in_array($cap['key'],['finance.manage','finance.manageOrganization','*'],true))$orgOwnerHas=true;
}
$memberHas=false;
foreach(($focus['organization.member']['financeCapabilities']??[]) as $cap){
    if($cap['effect']==='allow'&&in_array($cap['key'],['finance.manage','finance.manageOrganization','*'],true))$memberHas=true;
}

$report=[
    'schema'=>'kareta.operational-finance-auth-audit.v1',
    'checkedAt'=>gmdate('c'),
    'readOnly'=>true,
    'canonicalCapability'=>'finance.manage',
    'focusSets'=>$focus,
    'allFinanceCapabilityRows'=>$financeRows,
    'activeContextCapabilitySetCounts'=>$contextCounts,
    'financeOverrides'=>$overrides,
    'preconditions'=>[
        'profileMasterFinanceManage'=>$masterHas,
        'organizationOwnerFinanceManage'=>$orgOwnerHas,
        'organizationMemberFinanceManage'=>$memberHas,
    ],
    'expected'=>[
        'profileMasterFinanceManage'=>true,
        'organizationOwnerFinanceManage'=>true,
        'organizationMemberFinanceManage'=>false,
    ],
    'gaps'=>array_values(array_filter([
        !$masterHas?'profile.master lacks finance.manage for the existing master dashboard/own-order finance contract':null,
        !$orgOwnerHas?'organization.owner lacks finance.manage for STO owner finance contract':null,
        $memberHas?'organization.member unexpectedly has finance.manage; do not add POST gates until membership policy is reviewed':null,
    ])),
    'nextAction'=>'Only after expected capability coverage is true: gate every operationalFinance POST mutation with finance.manage while preserving internal resource/STO/role checks.',
];
$report['status']=empty($report['gaps'])?'READY_TO_GATE_POST_WRITES':'CAPABILITY_SEED_REQUIRED_BEFORE_GATE';

$json=json_encode($report,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;
$jsonPath='';
foreach($argv as $arg)if(str_starts_with($arg,'--json='))$jsonPath=substr($arg,7);
if($jsonPath!=='')file_put_contents($jsonPath,$json);
echo $json;
