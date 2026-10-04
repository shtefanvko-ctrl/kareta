<?php
declare(strict_types=1);

/**
 * M2 read-only advisory relations between catalog services, self-reported professions
 * and declared equipment.
 *
 * Safety contract:
 * - relations are research proposals, not verified skill evidence;
 * - no row may become a hard requirement here;
 * - no ranking/filtering is enabled by this module;
 * - service selection remains the primary master declaration.
 */
function kmob_service_advisory_json(string $path,string $error): array {
    $raw=is_file($path)?file_get_contents($path):false;
    $decoded=$raw===false?null:json_decode($raw,true);
    if(!is_array($decoded))throw new RuntimeException($error);
    return $decoded;
}

function kmob_service_advisory_id_set(array $rows): array {
    $set=[];
    foreach($rows as $row){
        if(!is_array($row))continue;
        $id=(string)($row['id']??'');
        if($id!=='')$set[$id]=true;
    }
    return $set;
}

function kmob_service_advisory_validate(array $catalog): array {
    if(($catalog['status']??'')!=='RUNTIME_ADVISORY_NOT_EXPERT_VERIFIED')throw new RuntimeException('service_advisory_status_invalid');
    if(($catalog['expert_review']??'')!=='NOT_RUN')throw new RuntimeException('service_advisory_review_state_invalid');
    if(($catalog['relations_are_proposals']??null)!==true)throw new RuntimeException('service_advisory_proposal_flag_invalid');
    if(($catalog['hard_filtering']??null)!==false)throw new RuntimeException('service_advisory_hard_filtering_forbidden');
    if(($catalog['ranking_impact']??'')!=='disabled'||($catalog['matching_usage']??'')!=='disabled')throw new RuntimeException('service_advisory_matching_forbidden');
    if(!is_array($catalog['items']??null)||!array_is_list($catalog['items']))throw new RuntimeException('service_advisory_items_invalid');

    $root=dirname(__DIR__);
    $services=kmob_service_advisory_json($root.'/storage/catalog/services.json','service_advisory_services_unavailable');
    $equipment=kmob_service_advisory_json($root.'/storage/catalog/master_equipment.json','service_advisory_equipment_unavailable');
    $professions=kmob_service_advisory_json($root.'/storage/catalog/master_professions.json','service_advisory_professions_unavailable');

    $serviceRows=is_array($services['services']??null)?$services['services']:(is_array($services['items']??null)?$services['items']:[]);
    $serviceIds=kmob_service_advisory_id_set($serviceRows);
    $equipmentIds=kmob_service_advisory_id_set(is_array($equipment['items']??null)?$equipment['items']:[]);
    $professionIds=kmob_service_advisory_id_set(is_array($professions['items']??null)?$professions['items']:[]);

    $seen=[];
    foreach($catalog['items'] as $row){
        if(!is_array($row))throw new RuntimeException('service_advisory_row_invalid');
        $serviceId=(string)($row['serviceId']??'');
        if($serviceId===''||!isset($serviceIds[$serviceId]))throw new RuntimeException('service_advisory_service_unknown');
        if(isset($seen[$serviceId]))throw new RuntimeException('service_advisory_service_duplicate');
        $seen[$serviceId]=true;

        if(!is_array($row['professionIds']??null)||!array_is_list($row['professionIds']))throw new RuntimeException('service_advisory_professions_invalid');
        if(!is_array($row['suggestedEquipmentIds']??null)||!array_is_list($row['suggestedEquipmentIds']))throw new RuntimeException('service_advisory_equipment_invalid');
        foreach($row['professionIds'] as $id)if(!is_string($id)||!isset($professionIds[$id]))throw new RuntimeException('service_advisory_profession_unknown');
        foreach($row['suggestedEquipmentIds'] as $id)if(!is_string($id)||!isset($equipmentIds[$id]))throw new RuntimeException('service_advisory_equipment_unknown');

        if(($row['expertReview']??'')!=='NOT_RUN')throw new RuntimeException('service_advisory_row_review_invalid');
        if(($row['equipmentRule']??'')!=='advisory_only')throw new RuntimeException('service_advisory_rule_invalid');
        if(($row['hardRequirement']??null)!==false)throw new RuntimeException('service_advisory_hard_requirement_forbidden');
        if(($row['matchingUsage']??'')!=='disabled')throw new RuntimeException('service_advisory_row_matching_forbidden');
        if(($row['masterServiceConfirmationRequired']??null)!==true)throw new RuntimeException('service_advisory_service_confirmation_required');
    }
    return $catalog;
}

function kmob_service_advisory_catalog(): array {
    $catalog=kmob_service_advisory_json(dirname(__DIR__).'/storage/catalog/master_service_advisories.json','service_advisory_catalog_unavailable');
    return kmob_service_advisory_validate($catalog);
}

function kmob_service_advisory_find(array $catalog,string $serviceId): ?array {
    foreach($catalog['items'] as $row)if((string)($row['serviceId']??'')===$serviceId)return $row;
    return null;
}

function kmob_service_advisory_handle(string $method,string $action): void {
    if($action!=='serviceAdvisories')return;
    if($method!=='GET')kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
    try{
        $catalog=kmob_service_advisory_catalog();
        $serviceId=trim((string)($_GET['serviceId']??''));
        $items=$catalog['items'];
        if($serviceId!==''){
            $row=kmob_service_advisory_find($catalog,$serviceId);
            if($row===null)kareta_json(['ok'=>false,'error'=>'service_advisory_not_found'],404);
            $items=[$row];
        }
        kareta_json(['ok'=>true,'data'=>[
            'items'=>array_values($items),
            'meta'=>[
                'count'=>count($items),
                'total'=>count($catalog['items']),
                'status'=>$catalog['status'],
                'expertReview'=>$catalog['expert_review'],
                'hardFiltering'=>false,
                'rankingImpact'=>'disabled',
                'matchingUsage'=>'disabled',
                'advisoryUsage'=>'read_only',
                'sourceResearch'=>$catalog['source_research'],
                'sourceResearchBlob'=>$catalog['source_research_blob'],
            ],
        ]]);
    }catch(Throwable $e){
        if(function_exists('kareta_log_error'))kareta_log_error('MASTER_SERVICE_ADVISORIES',$e->getMessage());
        kareta_json(['ok'=>false,'error'=>'service_advisories_unavailable'],503);
    }
}
