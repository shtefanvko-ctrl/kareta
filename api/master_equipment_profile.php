<?php
declare(strict_types=1);

/* Called only by the authenticated Master context in master_onboarding.php. */
function kmob_equipment_catalog(): array {
    $path=dirname(__DIR__).'/storage/catalog/master_equipment.json';
    $raw=is_file($path)?file_get_contents($path):false;
    $catalog=$raw===false?null:json_decode($raw,true);
    if(!is_array($catalog)||!is_array($catalog['groups']??null)||!is_array($catalog['items']??null)) {
        throw new RuntimeException('equipment_catalog_unavailable');
    }
    return $catalog;
}

function kmob_equipment_validate(array $selection,array $catalog): array {
    if(!array_is_list($selection)||count($selection)>count($catalog['items']))throw new InvalidArgumentException('equipment_selection_invalid');
    $items=[];foreach($catalog['items'] as $item)$items[(string)$item['id']]=$item;
    $result=[];$seen=[];
    foreach($selection as $row){
        if(!is_array($row)||!is_string($row['equipmentId']??null)||!is_string($row['access']??null))throw new InvalidArgumentException('equipment_selection_invalid');
        $id=$row['equipmentId'];$access=$row['access'];
        if(!isset($items[$id]))throw new InvalidArgumentException('equipment_unknown');
        if(isset($seen[$id]))throw new InvalidArgumentException('equipment_duplicate');
        if(!in_array($access,$items[$id]['access_choices'],true))throw new InvalidArgumentException('equipment_access_invalid');
        $seen[$id]=true;$result[]=['equipmentId'=>$id,'access'=>$access];
    }
    usort($result,static function(array $a,array $b): int {return strcmp($a['equipmentId'],$b['equipmentId']);});
    return $result;
}

function kmob_equipment_read($payload): array {
    $decoded=is_string($payload)?json_decode($payload,true):$payload;
    if(is_string($payload)&&trim($payload)!==''&&json_last_error()!==JSON_ERROR_NONE)throw new RuntimeException('equipment_profile_invalid');
    if($decoded!==null&&!is_array($decoded))throw new RuntimeException('equipment_profile_invalid');
    $profile=$decoded['masterEquipment']??[];
    if(!is_array($profile))throw new RuntimeException('equipment_profile_invalid');
    return ['revision'=>max(0,(int)($profile['revision']??0)),'selection'=>is_array($profile['selection']??null)?array_values($profile['selection']):[],'lastGroupId'=>(string)($profile['lastGroupId']??''),'lastMutationId'=>(string)($profile['lastMutationId']??'')];
}

function kmob_equipment_handle(PDO $pdo,int $profileId,int $contextId,string $method,string $action,array $body): void {
    if(($action==='equipment'&&$method!=='GET')||($action==='equipment.save'&&$method!=='POST'))kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
    try {
        $catalog=kmob_equipment_catalog();
        if($action==='equipment'){
            $group=(string)($_GET['group']??'');$groups=$catalog['groups'];
            $q=$pdo->prepare('SELECT payload_json FROM person_profiles WHERE id=? LIMIT 1');$q->execute([$profileId]);
            $raw=$q->fetch(PDO::FETCH_ASSOC);if(!$raw)kareta_json(['ok'=>false,'error'=>'master_profile_not_found'],404);
            $profile=kmob_equipment_read($raw['payload_json']??null);
            if($group==='')$group=in_array($profile['lastGroupId'],array_column($groups,'id'),true)?$profile['lastGroupId']:(string)($groups[0]['id']??'');
            if(!in_array($group,array_column($groups,'id'),true))kareta_json(['ok'=>false,'error'=>'equipment_group_invalid'],422);
            $items=[];foreach($catalog['items'] as $item)if($item['group_id']===$group)$items[]=['id'=>$item['id'],'name'=>$item['label_tablet'],'shortName'=>$item['label_mobile'],'iconId'=>$item['icon_id'],'groupId'=>$item['group_id']];
            $selected=[];foreach($catalog['items'] as $item)$selected[$item['id']]=['name'=>$item['label_mobile'],'iconId'=>$item['icon_id'],'groupId'=>$item['group_id']];
            $selection=[];foreach($profile['selection'] as $row)if(isset($selected[$row['equipmentId']??'']))$selection[]=array_merge($row,$selected[$row['equipmentId']]);
            kareta_json(['ok'=>true,'data'=>['contextId'=>$contextId,'revision'=>$profile['revision'],'selection'=>$selection,'groups'=>$groups,'groupId'=>$group,'resumeStage'=>$profile['lastGroupId']!==''?2:1,'items'=>$items,'total'=>count($catalog['items']),'declaration'=>'self_reported','skillVerification'=>'not_implied']]);
        }
        if(!isset($body['contextId'])||(int)$body['contextId']!==$contextId)kareta_json(['ok'=>false,'error'=>'equipment_context_changed','message'=>'Контекст изменился. Откройте оборудование заново.'],409);
        if(!isset($body['expectedRevision'])||!is_int($body['expectedRevision'])||$body['expectedRevision']<0||!is_array($body['selection']??null))kareta_json(['ok'=>false,'error'=>'equipment_selection_invalid'],422);
        $selection=kmob_equipment_validate($body['selection'],$catalog);
        $lastGroup=(string)($body['lastGroupId']??'');
        if(!in_array($lastGroup,array_column($catalog['groups'],'id'),true))kareta_json(['ok'=>false,'error'=>'equipment_group_invalid'],422);
        $mutation=$body['mutationId']??null;
        if(!is_string($mutation)||!preg_match('/^[A-Za-z0-9._:-]{1,96}$/D',$mutation))kareta_json(['ok'=>false,'error'=>'equipment_mutation_invalid'],422);
        $pdo->beginTransaction();
        $q=$pdo->prepare('SELECT payload_json FROM person_profiles WHERE id=? FOR UPDATE');$q->execute([$profileId]);
        $raw=$q->fetch(PDO::FETCH_ASSOC);
        if(!$raw){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'master_profile_not_found'],404);}
        $current=kmob_equipment_read($raw['payload_json']??null);
        if($current['lastMutationId']!==''&&hash_equals($current['lastMutationId'],$mutation)){
            $pdo->rollBack();
            if($current['selection']!==$selection||$current['lastGroupId']!==$lastGroup)kareta_json(['ok'=>false,'error'=>'equipment_mutation_conflict'],409);
            kareta_json(['ok'=>true,'data'=>['contextId'=>$contextId,'revision'=>$current['revision'],'selection'=>$current['selection'],'declaration'=>'self_reported','idempotent'=>true]]);
        }
        if($current['revision']!==$body['expectedRevision']){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'equipment_revision_conflict','message'=>'Оборудование изменено в другой вкладке. Ваш выбор пока не сохранён.','revision'=>$current['revision']],409);}
        $revision=$current['revision']+1;
        $json=json_encode(['revision'=>$revision,'selection'=>$selection,'lastGroupId'=>$lastGroup,'lastMutationId'=>$mutation,'declaration'=>'self_reported','updatedAt'=>gmdate('c')],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        if($json===false)throw new RuntimeException('equipment_encode_failed');
        $q=$pdo->prepare("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.masterEquipment',JSON_EXTRACT(?, '$')),updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $q->execute([$json,$profileId]);$pdo->commit();
        if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'master.equipment.saved',['profileId'=>$profileId,'contextId'=>$contextId,'count'=>count($selection)]);
        kareta_json(['ok'=>true,'data'=>['contextId'=>$contextId,'revision'=>$revision,'selection'=>$selection,'declaration'=>'self_reported']]);
    } catch(InvalidArgumentException $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if(function_exists('kareta_log_error'))kareta_log_error('MASTER_EQUIPMENT',$e->getMessage());kareta_json(['ok'=>false,'error'=>'equipment_unavailable','message'=>'Оборудование временно недоступно. Ваш выбор не подтверждён как сохранённый.'],503);}
}
