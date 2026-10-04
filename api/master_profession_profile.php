<?php
declare(strict_types=1);

/* Self-reported Master professions. This does not verify qualification and is not used for matching yet. */
function kmob_profession_catalog(): array {
    $path=dirname(__DIR__).'/storage/catalog/master_professions.json';
    $raw=is_file($path)?file_get_contents($path):false;
    $catalog=$raw===false?null:json_decode($raw,true);
    if(!is_array($catalog)||!is_array($catalog['items']??null))throw new RuntimeException('profession_catalog_unavailable');
    return $catalog;
}

function kmob_profession_validate(array $selection,array $catalog): array {
    if(!array_is_list($selection)||count($selection)>count($catalog['items']))throw new InvalidArgumentException('profession_selection_invalid');
    $allowed=[];foreach($catalog['items'] as $item)$allowed[(string)($item['id']??'')]=true;
    $seen=[];$result=[];
    foreach($selection as $id){
        if(!is_string($id)||!isset($allowed[$id]))throw new InvalidArgumentException('profession_unknown');
        if(isset($seen[$id]))throw new InvalidArgumentException('profession_duplicate');
        $seen[$id]=true;$result[]=$id;
    }
    sort($result,SORT_STRING);return $result;
}

function kmob_profession_read($payload): array {
    $decoded=is_string($payload)?json_decode($payload,true):$payload;
    if(is_string($payload)&&trim($payload)!==''&&json_last_error()!==JSON_ERROR_NONE)throw new RuntimeException('profession_profile_invalid');
    if($decoded!==null&&!is_array($decoded))throw new RuntimeException('profession_profile_invalid');
    $profile=$decoded['masterProfessions']??[];
    if(!is_array($profile))throw new RuntimeException('profession_profile_invalid');
    return [
        'revision'=>max(0,(int)($profile['revision']??0)),
        'selection'=>is_array($profile['selection']??null)?array_values($profile['selection']):[],
        'lastMutationId'=>(string)($profile['lastMutationId']??''),
    ];
}

function kmob_profession_handle(PDO $pdo,int $profileId,int $contextId,string $method,string $action,array $body): void {
    if(($action==='professions'&&$method!=='GET')||($action==='professions.save'&&$method!=='POST'))kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
    try{
        $catalog=kmob_profession_catalog();
        if($action==='professions'){
            $q=$pdo->prepare('SELECT payload_json FROM person_profiles WHERE id=? LIMIT 1');$q->execute([$profileId]);
            $raw=$q->fetch(PDO::FETCH_ASSOC);if(!$raw)kareta_json(['ok'=>false,'error'=>'master_profile_not_found'],404);
            $profile=kmob_profession_read($raw['payload_json']??null);
            $selection=kmob_profession_validate($profile['selection'],$catalog);
            kareta_json(['ok'=>true,'data'=>[
                'contextId'=>$contextId,'revision'=>$profile['revision'],'selection'=>$selection,'items'=>$catalog['items'],
                'declaration'=>'self_reported','skillVerification'=>'not_implied','matchingUsage'=>'disabled','serviceAutoEnable'=>false
            ]]);
        }
        if(!isset($body['contextId'])||(int)$body['contextId']!==$contextId)kareta_json(['ok'=>false,'error'=>'profession_context_changed','message'=>'Контекст изменился. Откройте профессии заново.'],409);
        if(!isset($body['expectedRevision'])||!is_int($body['expectedRevision'])||$body['expectedRevision']<0||!is_array($body['selection']??null))kareta_json(['ok'=>false,'error'=>'profession_selection_invalid'],422);
        $selection=kmob_profession_validate($body['selection'],$catalog);
        $mutation=$body['mutationId']??null;
        if(!is_string($mutation)||!preg_match('/^[A-Za-z0-9._:-]{1,96}$/D',$mutation))kareta_json(['ok'=>false,'error'=>'profession_mutation_invalid'],422);

        $pdo->beginTransaction();
        $q=$pdo->prepare('SELECT payload_json FROM person_profiles WHERE id=? FOR UPDATE');$q->execute([$profileId]);
        $raw=$q->fetch(PDO::FETCH_ASSOC);if(!$raw){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'master_profile_not_found'],404);}
        $current=kmob_profession_read($raw['payload_json']??null);
        if($current['lastMutationId']!==''&&hash_equals($current['lastMutationId'],$mutation)){
            $pdo->rollBack();
            if($current['selection']!==$selection)kareta_json(['ok'=>false,'error'=>'profession_mutation_conflict'],409);
            kareta_json(['ok'=>true,'data'=>['contextId'=>$contextId,'revision'=>$current['revision'],'selection'=>$current['selection'],'declaration'=>'self_reported','idempotent'=>true,'matchingUsage'=>'disabled']]);
        }
        if($current['revision']!==$body['expectedRevision']){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'profession_revision_conflict','message'=>'Профессии изменены в другой вкладке. Ваш выбор пока не сохранён.','revision'=>$current['revision']],409);}
        $revision=$current['revision']+1;
        $json=json_encode(['revision'=>$revision,'selection'=>$selection,'lastMutationId'=>$mutation,'declaration'=>'self_reported','matchingUsage'=>'disabled','updatedAt'=>gmdate('c')],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        if($json===false)throw new RuntimeException('profession_encode_failed');
        $q=$pdo->prepare("UPDATE person_profiles SET payload_json=JSON_SET(COALESCE(payload_json,JSON_OBJECT()),'$.masterProfessions',JSON_EXTRACT(?, '$')),updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $q->execute([$json,$profileId]);$pdo->commit();
        if(function_exists('kareta_log_audit'))kareta_log_audit($pdo,'master.professions.saved',['profileId'=>$profileId,'contextId'=>$contextId,'count'=>count($selection)]);
        kareta_json(['ok'=>true,'data'=>['contextId'=>$contextId,'revision'=>$revision,'selection'=>$selection,'declaration'=>'self_reported','matchingUsage'=>'disabled']]);
    }catch(InvalidArgumentException $e){if($pdo->inTransaction())$pdo->rollBack();kareta_json(['ok'=>false,'error'=>$e->getMessage()],422);
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if(function_exists('kareta_log_error'))kareta_log_error('MASTER_PROFESSIONS',$e->getMessage());kareta_json(['ok'=>false,'error'=>'professions_unavailable','message'=>'Профессии временно недоступны. Выбор не подтверждён как сохранённый.'],503);}
}
