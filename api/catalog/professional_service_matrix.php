<?php
declare(strict_types=1);
/** Read-only professional service suggestions for KARETA staging. Never publishes services. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);echo json_encode(['ok'=>false,'error'=>'method_not_allowed']);exit;
}
$root=dirname(__DIR__,2);
try {
    $raw=trim((string)($_GET['professions']??''));
    if (strlen($raw)>1000) {http_response_code(422);throw new InvalidArgumentException('professions_invalid');}
    $professions=json_decode((string)file_get_contents($root.'/storage/catalog/master_professions.json'),true,512,JSON_THROW_ON_ERROR);
    $allowed=array_fill_keys(array_column($professions['items'],'id'),true);
    $wanted=[];
    foreach (explode(',',$raw) as $term) {
        $id=trim($term);if ($id==='')continue;
        if (!isset($allowed[$id])) {http_response_code(422);throw new InvalidArgumentException('profession_unknown');}
        $wanted[$id]=true;
    }
    $old=json_decode((string)file_get_contents($root.'/storage/catalog/master_service_advisories.json'),true,512,JSON_THROW_ON_ERROR);
    $new=json_decode((string)file_get_contents($root.'/storage/catalog/professional_services_draft.json'),true,512,JSON_THROW_ON_ERROR);
    if (($old['hard_filtering']??true)!==false || ($old['matching_usage']??'')!=='disabled'
        || ($new['matchingEnabled']??true)!==false) throw new RuntimeException('suggestion_guard_failed');
    $ids=[];
    foreach (array_merge($old['items']??[],$new['items']??[]) as $row) {
        if (count(array_intersect(array_keys($wanted),$row['professionIds']??[]))===0)continue;
        $id=(string)($row['serviceId']??'');
        if ($id!=='' && preg_match('/^[a-zA-Z0-9_:-]{1,64}$/D',$id))$ids[$id]=true;
    }
    echo json_encode(['ok'=>true,'data'=>['serviceIds'=>array_keys($ids),
        'professions'=>array_keys($wanted),'suggestionsOnly'=>true,
        'notQualificationProof'=>true,'autoEnable'=>false,'hardFilter'=>false]],
        JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
} catch (InvalidArgumentException $e) {
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['ok'=>false,'error'=>'professional_suggestions_unavailable']);
}
