<?php
declare(strict_types=1);
// Offline authorization contract: fake PDO rows only, no MySQL or mutation.
function kareta_normalize_phone(string $phone):string {
    $digits=preg_replace('/\\D+/', '', $phone)??'';
    if($digits!==''&&$digits[0]==='8')$digits='7'.substr($digits,1);
    if($digits!==''&&$digits[0]!=='7')$digits='7'.$digits;
    return strlen($digits)===11?'+'.$digits:'';
}
require_once __DIR__.'/../api/identity/admin_actor_gate.php';

final class AdminActorTestStatement extends PDOStatement {
    public array $record=[];
    public array $executed=[];
    public function __construct(array $record=[]){$this->record=$record;}
    public function execute(?array $params=null):bool{$this->executed=$params??[];return true;}
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0):mixed{return $this->record?:false;}
}
final class AdminActorTestPDO extends PDO {
    public ?AdminActorTestStatement $last=null;
    public string $query='';
    public function __construct(private array $record){}
    public function prepare(string $query,array $options=[]):PDOStatement|false {
        $this->query=$query;
        return $this->last=new AdminActorTestStatement($this->record);
    }
}
function check_admin_case(string $label,array $dbRecord,int $account,?array $session,bool $allowed,int $expectedUser=0):void{
    $db=new AdminActorTestPDO($dbRecord);
    try {
      $result=kareta_admin_actor_guard($db,$account,$session);
      if(!$allowed)throw new RuntimeException($label.' unexpectedly allowed');
      if($result['account']!==$account||$result['user']!==$expectedUser)throw new RuntimeException($label.' wrong validated actor');
      if($account>0&&$db->last?->executed!==[$account])throw new RuntimeException($label.' account not bound');
      if($account===0&&$db->last?->executed!==[(int)($session['id']??0)])throw new RuntimeException($label.' user not bound');
    }catch(DomainException $e){if($allowed)throw new RuntimeException($label.' unexpectedly denied: '.$e->getMessage());}
    echo "PASS ".$label."\n";
}
$admin=['id'=>18,'phone'=>'+77001234567','role'=>'admin','active'=>1,'account_status'=>'active'];
$owner=['id'=>18,'phone'=>'+77001234567','role'=>'owner','active'=>1,'account_status'=>'active'];
$legacy=['id'=>18,'phone'=>'87001234567','role'=>'admin'];
check_admin_case('identity platform admin', $admin,20,null,true,18);
check_admin_case('identity platform owner', $owner,20,null,true,18);
check_admin_case('deny organization owner wildcard without admin role',array_replace($owner,['role'=>'sto']),20,null,false);
check_admin_case('deny identity client',array_replace($admin,['role'=>'client']),20,null,false);
check_admin_case('deny inactive admin',array_replace($admin,['active'=>0]),20,null,false);
check_admin_case('deny blocked account',array_replace($admin,['account_status'=>'blocked']),20,null,false);
check_admin_case('deny unknown identity account',[],20,null,false);
check_admin_case('legacy DB-backed admin',$admin,0,$legacy,true,18);
check_admin_case('legacy DB-backed owner',$owner,0,$legacy,true,18);
check_admin_case('deny forged legacy session role',array_replace($admin,['role'=>'client']),0,$legacy,false);
check_admin_case('deny mismatched PHP session phone',$admin,0,array_replace($legacy,['phone'=>'+77007777777']),false);
check_admin_case('deny unknown PHP session id',$admin,0,array_replace($legacy,['id'=>0]),false);
check_admin_case('deny no legacy session',$admin,0,null,false);
check_admin_case('deny deactivated legacy admin',array_replace($admin,['active'=>0]),0,$legacy,false);
check_admin_case('deny missing identity role record',[],0,$legacy,false);
echo "Admin actor gate: 15 cases PASS\n";
