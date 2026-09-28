<?php
declare(strict_types=1);

function kareta_sto_workflow_stages(): array {
    return ['intake','diagnostics','estimate','approval','work_order','parts_reservation','in_progress','quality_control','payment','delivery','warranty','completed'];
}
function kareta_sto_workflow_edges(): array {
    return [
      'intake'=>['diagnostics'], 'diagnostics'=>['estimate'], 'estimate'=>['approval'],
      'approval'=>['work_order','estimate'], 'work_order'=>['parts_reservation','in_progress'],
      'parts_reservation'=>['in_progress'], 'in_progress'=>['quality_control'],
      'quality_control'=>['payment','in_progress'], 'payment'=>['delivery'],
      'delivery'=>['warranty'], 'warranty'=>['completed'], 'completed'=>[]
    ];
}
function kareta_sto_workflow_ensure(PDO $pdo,string $orderId): array {
    $q=$pdo->prepare("SELECT * FROM sto_workflows WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$row=$q->fetch(PDO::FETCH_ASSOC);
    if($row) return $row;
    $contextId=null;
    if(function_exists('kareta_auth_resolve')) { $auth=kareta_auth_resolve($pdo,false); $contextId=(int)($auth['context']['id']??0)?:null; }
    $pdo->prepare("INSERT INTO sto_workflows(order_id,organization_context_id,current_stage) VALUES(?,?,'intake')")->execute([$orderId,$contextId]);
    $q->execute([$orderId]); return $q->fetch(PDO::FETCH_ASSOC)?:[];
}
function kareta_sto_workflow_requirements(PDO $pdo,string $orderId,string $to): array {
    $missing=[];
    if($to==='estimate'){
      if(kareta_table_exists($pdo,'master_order_diagnostics')){$q=$pdo->prepare("SELECT COUNT(*) FROM master_order_diagnostics WHERE order_id=? AND status='completed'");$q->execute([$orderId]);if((int)$q->fetchColumn()===0)$missing[]='diagnostics_report';}
      else{$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_checklist_items WHERE order_id=? AND stage_key='diagnostics' AND done=1");$q->execute([$orderId]);if((int)$q->fetchColumn()===0)$missing[]='diagnostics_checklist';}
    }
    if($to==='work_order'){
      $q=$pdo->prepare("SELECT COUNT(*) FROM sto_workflow_approvals a JOIN sto_workflows w ON w.id=a.workflow_id WHERE w.order_id=? AND a.approval_type='estimate' AND a.status='approved'");$q->execute([$orderId]);
      if((int)$q->fetchColumn()===0)$missing[]='estimate_approval';
      if(kareta_table_exists($pdo,'order_extra_quotes')){$q=$pdo->prepare("SELECT COUNT(*) FROM order_extra_quotes WHERE order_id=? AND status='pending'");$q->execute([$orderId]);if((int)$q->fetchColumn()>0)$missing[]='pending_extra_quotes';}
    }
    if($to==='in_progress'&&kareta_table_exists($pdo,'master_order_diagnostics')){
      $q=$pdo->prepare("SELECT parts_required FROM master_order_diagnostics WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$partsRequired=(int)($q->fetchColumn()?:0)>0;
      if($partsRequired&&kareta_table_exists($pdo,'work_order_part_reservations')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_part_reservations WHERE order_id=? AND (status NOT IN ('reserved','issued') OR qty_reserved<qty_requested)");$q->execute([$orderId]);$bad=(int)$q->fetchColumn();$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_part_reservations WHERE order_id=?");$q->execute([$orderId]);if((int)$q->fetchColumn()===0||$bad>0)$missing[]='parts_not_reserved';}
    }
    if($to==='quality_control'){
      $q=$pdo->prepare("SELECT COUNT(*) FROM work_order_checklist_items WHERE order_id=? AND stage_key IN ('in_progress','repair') AND done=0");$q->execute([$orderId]);
      if((int)$q->fetchColumn()>0)$missing[]='unfinished_work_checklist';
      if(kareta_table_exists($pdo,'work_order_timers')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_timers WHERE order_id=? AND status='running'");$q->execute([$orderId]);if((int)$q->fetchColumn()>0)$missing[]='running_work_timer';}
    }
    if($to==='payment'){
      if(kareta_table_exists($pdo,'work_order_quality_checks')){$q=$pdo->prepare("SELECT result FROM work_order_quality_checks WHERE order_id=? ORDER BY attempt_no DESC,created_at DESC LIMIT 1");$q->execute([$orderId]);if((string)($q->fetchColumn()?:'')!=='pass')$missing[]='quality_not_passed';}
      else{$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_checklist_items WHERE order_id=? AND done=0");$q->execute([$orderId]);if((int)$q->fetchColumn()>0)$missing[]='unfinished_checklist';}
    }
    if($to==='delivery'){
      $q=$pdo->prepare("SELECT COUNT(*) FROM sto_workflow_approvals a JOIN sto_workflows w ON w.id=a.workflow_id WHERE w.order_id=? AND a.approval_type='payment' AND a.status='approved'");$q->execute([$orderId]);
      if((int)$q->fetchColumn()===0)$missing[]='payment_confirmation';
      if(kareta_table_exists($pdo,'work_order_handovers')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_handovers WHERE order_id=? AND status IN ('ready','accepted')");$q->execute([$orderId]);if((int)$q->fetchColumn()===0)$missing[]='handover_not_ready';}
    }
    if($to==='warranty'&&kareta_table_exists($pdo,'work_order_handovers')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_handovers WHERE order_id=? AND status='accepted'");$q->execute([$orderId]);if((int)$q->fetchColumn()===0)$missing[]='handover_not_accepted';}
    if($to==='completed'&&kareta_table_exists($pdo,'work_order_warranties')){$q=$pdo->prepare("SELECT COUNT(*) FROM work_order_warranties WHERE order_id=? AND status='active'");$q->execute([$orderId]);if((int)$q->fetchColumn()===0)$missing[]='warranty_not_activated';}
    return array_values(array_unique($missing));
}
function kareta_sto_workflow_sync_order_status(PDO $pdo,string $orderId,string $stage): void {
    $statusMap=['diagnostics'=>'process','estimate'=>'process','approval'=>'process','work_order'=>'process','parts_reservation'=>'process','in_progress'=>'process','quality_control'=>'process','payment'=>'process','delivery'=>'done_pending_client','warranty'=>'done','completed'=>'done'];
    if(isset($statusMap[$stage])){$pdo->prepare("UPDATE orders SET status=?,updated_at=NOW() WHERE id=?")->execute([$statusMap[$stage],$orderId]);}
}
function kareta_sto_workflow_transition_apply(PDO $pdo,string $orderId,string $to,string $reason='',array $meta=[]): array {
    $ownsTransaction=!$pdo->inTransaction();if($ownsTransaction)$pdo->beginTransaction();
    try{
      $workflow=kareta_sto_workflow_ensure($pdo,$orderId);$q=$pdo->prepare("SELECT * FROM sto_workflows WHERE id=? FOR UPDATE");$q->execute([(int)$workflow['id']]);$workflow=$q->fetch(PDO::FETCH_ASSOC)?:$workflow;
      $from=(string)$workflow['current_stage'];if($from===$to){if($ownsTransaction)$pdo->commit();return ['orderId'=>$orderId,'fromStage'=>$from,'toStage'=>$to,'skipped'=>true];}
      $allowed=kareta_sto_workflow_edges()[$from]??[];if(!in_array($to,$allowed,true))throw new DomainException('workflow_transition_not_allowed');
      $missing=kareta_sto_workflow_requirements($pdo,$orderId,$to);if($missing)throw new UnexpectedValueException('workflow_requirements_missing:'.implode(',',$missing));
      $auth=function_exists('kareta_auth_resolve')?kareta_auth_resolve($pdo,false):[];$accountId=(int)($auth['account']['id']??0)?:null;$contextId=(int)($auth['context']['id']??0)?:null;
      $pdo->prepare("UPDATE sto_workflows SET current_stage=?,revision=revision+1,completed_at=IF(?='completed',NOW(),completed_at),updated_at=NOW() WHERE id=?")->execute([$to,$to,(int)$workflow['id']]);
      $payload=array_merge(['source'=>'sto_workflow_engine'],$meta);
      $pdo->prepare("INSERT INTO sto_workflow_transitions(workflow_id,order_id,from_stage,to_stage,actor_account_id,actor_context_id,reason,meta_json) VALUES(?,?,?,?,?,?,?,?)")->execute([(int)$workflow['id'],$orderId,$from,$to,$accountId,$contextId,mb_substr($reason,0,500),json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
      kareta_sto_workflow_sync_order_status($pdo,$orderId,$to);
      if(function_exists('kareta_write_event'))kareta_write_event($pdo,$orderId,'workflow_transition',['from'=>$from,'to'=>$to]+$meta);
      if($ownsTransaction)$pdo->commit();return ['orderId'=>$orderId,'fromStage'=>$from,'toStage'=>$to];
    }catch(Throwable $e){if($ownsTransaction&&$pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function kareta_sto_workflow_approval_record(PDO $pdo,string $orderId,string $type,string $status,?float $amount=null,array $payload=[]): array {
    if(!in_array($type,['estimate','payment','quality'],true)||!in_array($status,['pending','approved','declined','cancelled'],true))throw new InvalidArgumentException('approval_invalid');
    $w=kareta_sto_workflow_ensure($pdo,$orderId);$auth=function_exists('kareta_auth_resolve')?kareta_auth_resolve($pdo,false):[];$aid=(int)($auth['account']['id']??0)?:null;
    $sql="INSERT INTO sto_workflow_approvals(workflow_id,approval_type,status,requested_by_account_id,decided_by_account_id,amount,payload_json,decided_at) VALUES(?,?,?,?,?,?,?,IF(?='pending',NULL,NOW())) ON DUPLICATE KEY UPDATE requested_by_account_id=VALUES(requested_by_account_id),decided_by_account_id=VALUES(decided_by_account_id),amount=VALUES(amount),payload_json=VALUES(payload_json),decided_at=VALUES(decided_at),requested_at=NOW()";
    $pdo->prepare($sql)->execute([(int)$w['id'],$type,$status,$aid,$status==='pending'?null:$aid,$amount,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$status]);
    return ['workflowId'=>(int)$w['id'],'approvalType'=>$type,'status'=>$status];
}
function kareta_sto_workflow_get(PDO $pdo,array $input): void {
    $orderId=trim((string)($input['orderId']??$input['id']??'')); if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],400);
    $order=kareta_work_order_require($pdo,$orderId,false); $workflow=kareta_sto_workflow_ensure($pdo,$orderId);
    $q=$pdo->prepare("SELECT from_stage AS fromStage,to_stage AS toStage,reason,meta_json AS meta,created_at AS createdAt FROM sto_workflow_transitions WHERE order_id=? ORDER BY id DESC LIMIT 100");$q->execute([$orderId]);$history=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    foreach($history as &$h){$h['meta']=json_decode((string)($h['meta']??''),true)?:[];}unset($h);
    $q=$pdo->prepare("SELECT approval_type AS approvalType,status,amount,payload_json AS payload,requested_at AS requestedAt,decided_at AS decidedAt FROM sto_workflow_approvals WHERE workflow_id=? ORDER BY id DESC");$q->execute([(int)$workflow['id']]);$approvals=$q->fetchAll(PDO::FETCH_ASSOC)?:[];
    foreach($approvals as &$a){$a['payload']=json_decode((string)($a['payload']??''),true)?:[];}unset($a);
    $data=['workflow'=>$workflow,'stages'=>kareta_sto_workflow_stages(),'allowedNext'=>kareta_sto_workflow_edges()[$workflow['current_stage']]??[],'history'=>$history,'approvals'=>$approvals,'requirements'=>[]];
    foreach($data['allowedNext'] as $stage)$data['requirements'][$stage]=kareta_sto_workflow_requirements($pdo,$orderId,$stage);
    if(function_exists('kareta_master_order_lifecycle_snapshot'))$data['lifecycle']=kareta_master_order_lifecycle_snapshot($pdo,$orderId,$order);
    kareta_json(['ok'=>true,'data'=>$data]);
}
function kareta_sto_workflow_transition(PDO $pdo,array $body): void {
    $orderId=trim((string)($body['orderId']??''));$to=trim((string)($body['toStage']??''));$reason=mb_substr(trim((string)($body['reason']??'')),0,500);
    if($orderId===''||$to==='')kareta_json(['ok'=>false,'error'=>'workflow_transition_invalid'],400);
    kareta_work_order_require($pdo,$orderId,true);
    try{$result=kareta_sto_workflow_transition_apply($pdo,$orderId,$to,$reason);kareta_json(['ok'=>true,'data'=>$result]);}
    catch(Throwable $e){$code=$e instanceof DomainException?409:($e instanceof UnexpectedValueException?422:500);kareta_json(['ok'=>false,'error'=>$e->getMessage()],$code);}
}
function kareta_sto_workflow_approval(PDO $pdo,array $body): void {
    $orderId=trim((string)($body['orderId']??''));$type=trim((string)($body['approvalType']??''));$decision=trim((string)($body['decision']??'pending'));
    if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],400);kareta_work_order_require($pdo,$orderId,true);
    try{$result=kareta_sto_workflow_approval_record($pdo,$orderId,$type,$decision,isset($body['amount'])?(float)$body['amount']:null,is_array($body['payload']??null)?$body['payload']:[]);kareta_json(['ok'=>true,'data'=>$result]);}
    catch(Throwable $e){kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);}
}
