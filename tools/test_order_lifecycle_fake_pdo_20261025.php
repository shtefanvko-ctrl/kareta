<?php
declare(strict_types=1);
// Deterministic fake PDO: exercises real PHP handlers without touching the application's DB.
class Reply extends RuntimeException {
  public function __construct(public array $payload, public int $http=200){parent::__construct('reply');}
}
class DB extends PDO {
  public array $orders=[], $stage=[], $handover=[], $events=[], $notices=[];
  public function __construct(){}
  public function prepare(string $sql,array $options=[]):PDOStatement|false{return new Stmt($this,$sql);}
}
class Stmt extends PDOStatement {
  private array $rows=[];private int $cursor=0;private int $affected=0;
  public function __construct(private DB $db,private string $sql){}
  public function execute(?array $params=null):bool {
    $p=$params??[];
    $q=strtolower(preg_replace('/\s+/',' ',str_replace(chr(96),'',$this->sql)));
    $this->rows=[];$this->cursor=0;$this->affected=0;
    if(str_starts_with($q,'select')&&str_contains($q,'from orders where id=?')){
      $id=(string)($p[0]??'');$o=$this->db->orders[$id]??null;
      if($o&&(!str_contains($q,'and master_id=?')||$o['master_id']===(string)($p[1]??'')))$this->rows=[$o];
    }elseif(str_starts_with($q,'select id, stage_key from order_stages')){
      if(($this->db->stage[(string)$p[0]]??'')==='quality')$this->rows=[['id'=>1,'stage_key'=>'quality']];
    }elseif(str_starts_with($q,'select status from work_order_handovers')){
      if(isset($this->db->handover[(string)$p[0]]))$this->rows=[['status'=>$this->db->handover[(string)$p[0]]]];
    }elseif(str_starts_with($q,'select user_id, phone from masters')){
      $this->rows=[['user_id'=>77,'phone'=>'+70000000456']];
    }elseif(str_starts_with($q,'update orders set status=? where id=? and status=?')){
      [$new,$id,$old]=$p;$id=(string)$id;
      if(isset($this->db->orders[$id])&&$this->db->orders[$id]['status']===$old){
        $this->db->orders[$id]['status']=$new;$this->affected=1;
      }
    }elseif(str_starts_with($q,'update orders set status=')&&str_contains($q,"status='process'")){
      $id=(string)$p[0];$this->db->orders[$id]['status']='process';$this->affected=1;
    }elseif(str_starts_with($q,'update orders set completed_at=')){
      $id=(string)$p[1];$this->db->orders[$id]['final_price']=$p[0];$this->affected=1;
    }elseif(str_starts_with($q,'update orders set confirmed_at=')){
      $id=(string)$p[0];$this->db->orders[$id]['confirmed_at']='test';$this->affected=1;
    }else throw new RuntimeException('Unexpected QA SQL: '.$this->sql);
    return true;
  }
  public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0):mixed{return $this->rows[$this->cursor++]??false;}
  public function fetchColumn(int $column=0):mixed{$r=$this->fetch();return $r?array_values($r)[$column]??false:false;}
  public function rowCount():int{return $this->affected;}
}
$db=new DB();$actor=['id'=>31,'phone'=>'+70000000456','role'=>'master','masterId'=>'master_qa'];$handoverCalls=0;
function kareta_json(array $data,int $status=200):void{throw new Reply($data,$status);}
function kareta_current_user():array{return $GLOBALS['actor'];}
function kareta_normalize_phone(string $s):string{return preg_replace('/\D+/','',$s);}
function kareta_resolve_master_id(?PDO $db,array $u):?string{return ($u['role']??'')==='master'?$u['masterId']:null;}
function kareta_order_snapshot(?PDO $db,string $id):array{return $db->orders[$id]??[];}
function kareta_write_event(?PDO $db,string $id,string $event,array $meta=[]):void{$db->events[]=[$id,$event];}
function kareta_sync_order_relations(?PDO $db,string $id,string $status,array $meta=[]):void{}
function kareta_notification_insert(PDO $db,array $notice):void{$db->notices[]=$notice;}
function kareta_order_can_transition(string $from,string $to,string $role):array{
  if($from===$to)return ['ok'=>true,'skipped'=>true];
  if(($from==='process'&&$to==='done_pending_client'&&$role==='master')||($from==='done_pending_client'&&$to==='done'&&$role==='client'))return ['ok'=>true];
  return ['ok'=>false,'error'=>'invalid_transition'];
}
function kareta_table_exists(PDO $db,string $name):bool{return $name==='work_order_handovers';}
function kareta_client_order_handover_confirm(PDO $db,array $body):void{++$GLOBALS['handoverCalls'];kareta_json(['ok'=>true,'native'=>true]);}
function kareta_master_order_lifecycle_require_role(PDO $db,array $roles):array{
  $u=$GLOBALS['actor'];if(!in_array($u['role'],$roles,true))kareta_json(['ok'=>false,'error'=>'forbidden'],403);
  return ['role'=>$u['role'],'masterId'=>$u['masterId']??null,'userId'=>$u['id']];
}
function kareta_master_order_lifecycle_order(PDO $db,string $id,bool $write=false):array{return $db->orders[$id]??[];}
function kareta_master_order_lifecycle_ensure(PDO $db):void{}
function kareta_master_order_lifecycle_default_checklist(PDO $db,string $id):void{}
function kareta_master_order_lifecycle_require_stage(PDO $db,string $id,array $allowed):array{
  $stage=$db->stage[$id]??'intake';if(!in_array($stage,$allowed,true))kareta_json(['ok'=>false,'error'=>'stage_conflict'],409);return ['current_stage'=>$stage];
}
function kareta_sto_workflow_transition_apply(PDO $db,string $id,string $stage,string $text,array $context=[]):void{$db->stage[$id]=$stage;}
function kareta_master_order_lifecycle_snapshot(PDO $db,string $id,array $o):array{return ['status'=>$db->orders[$id]['status'],'stage'=>$db->stage[$id]];}
function loadHandler(string $file,string $fn):void{
  $src=file_get_contents(dirname(__DIR__).'/'.$file);if($src===false)throw new RuntimeException('missing '.$file);
  $a=strpos($src,'function '.$fn.'(');if($a===false)throw new RuntimeException('missing '.$fn);
  $b=strpos($src,"\n}\n",$a);if($b===false)throw new RuntimeException('unterminated '.$fn);
  eval(substr($src,$a,$b-$a+2));
}
foreach(['kareta_order_transition','orders_complete_by_master','orders_confirm_done_by_client'] as $fn)loadHandler('api/db.php',$fn);
loadHandler('api/master_order_lifecycle.php','kareta_master_order_accept');
function callHandler(string $fn,DB $db,string $id):Reply{
  try{$fn($db,['orderId'=>$id,'finalPrice'=>15000]);}catch(Reply $r){return $r;}
  throw new RuntimeException('missing API response: '.$fn);
}
function check(bool $v,string $msg):void{if(!$v)throw new RuntimeException('FAIL: '.$msg);}
function events(DB $db,string $name):int{return count(array_filter($db->events,fn($x)=>$x[1]===$name));}
$db->orders['qa']=['id'=>'qa','status'=>'process','client_phone'=>'+70000000123','client_user_id'=>11,'master_id'=>'master_qa'];
$db->stage['qa']='quality';
$r=callHandler('orders_complete_by_master',$db,'qa');
check($r->http===200&&$r->payload['status']==='done_pending_client','initial complete');
check(events($db,'order_completed_by_master')===1&&count($db->notices)===1,'one completion event and notice');
$r=callHandler('orders_complete_by_master',$db,'qa');
check($r->http===200&&$r->payload['skipped']===true,'idempotent completion');
check(events($db,'order_completed_by_master')===1&&count($db->notices)===1,'no repeat completion side effects');
$actor=['id'=>11,'phone'=>'+70000000123','role'=>'client'];
$r=callHandler('orders_confirm_done_by_client',$db,'qa');
check($r->http===200&&$r->payload['status']==='done','initial client confirmation');
check(events($db,'order_confirmed_by_client')===1&&count($db->notices)===2,'one client confirmation event and notice');
$r=callHandler('orders_confirm_done_by_client',$db,'qa');
check($r->http===200&&$r->payload['skipped']===true,'idempotent client confirmation');
check(events($db,'order_confirmed_by_client')===1&&count($db->notices)===2,'no repeat client confirmation side effects');
$db->orders['foreign']=['id'=>'foreign','status'=>'done_pending_client','client_phone'=>'+70000000999','client_user_id'=>999,'master_id'=>'master_qa'];
$db->handover['foreign']='ready';
$r=callHandler('orders_confirm_done_by_client',$db,'foreign');
check($r->http===403&&$r->payload['error']==='forbidden_order_owner','foreign ownership denied');
check($handoverCalls===0&&$db->orders['foreign']['status']==='done_pending_client','no unowned handover mutations');
$actor=['id'=>31,'phone'=>'+70000000456','role'=>'master','masterId'=>'master_qa'];
$db->orders['accept']=['id'=>'accept','status'=>'new','client_phone'=>'+70000000123','client_user_id'=>11,'master_id'=>'master_qa'];
$db->stage['accept']='intake';
$r=callHandler('kareta_master_order_accept',$db,'accept');
check($r->http===200&&$db->stage['accept']==='diagnostics','first acceptance');
check(events($db,'master_order_accepted')===1,'first acceptance event');
$r=callHandler('kareta_master_order_accept',$db,'accept');
check($r->http===200&&$r->payload['idempotent']===true,'idempotent acceptance');
check(events($db,'master_order_accepted')===1,'no duplicate acceptance event');
echo "PASS: fake-PDO behavioral QA (accept/complete/confirm retries, access, events, notices)\n";
