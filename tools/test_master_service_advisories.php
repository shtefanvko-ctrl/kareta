<?php
declare(strict_types=1);
if(!function_exists('array_is_list')){function array_is_list(array $array): bool {$i=0;foreach($array as $key=>$_){if($key!==$i++)return false;}return true;}}
require_once dirname(__DIR__).'/api/master_service_advisories.php';
function advisory_assert(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}

$catalog=kmob_service_advisory_catalog();
advisory_assert(count($catalog['items'])===109,'advisory count');
advisory_assert(($catalog['expert_review']??'')==='NOT_RUN','expert review must remain NOT_RUN');
advisory_assert(($catalog['hard_filtering']??null)===false,'hard filtering must stay disabled');
advisory_assert(($catalog['matching_usage']??'')==='disabled','matching usage must stay disabled');
advisory_assert(($catalog['ranking_impact']??'')==='disabled','ranking impact must stay disabled');

$computer=kmob_service_advisory_find($catalog,'computer_diag');
advisory_assert(is_array($computer),'computer_diag relation missing');
advisory_assert(in_array('diagnostician',$computer['professionIds'],true),'computer_diag profession');
advisory_assert(in_array('obd_scanner',$computer['suggestedEquipmentIds'],true),'computer_diag equipment');
advisory_assert(($computer['hardRequirement']??null)===false,'computer_diag must not become hard requirement');

$bad=$catalog;
$bad['items'][0]['hardRequirement']=true;
$caught='';
try{kmob_service_advisory_validate($bad);}catch(RuntimeException $e){$caught=$e->getMessage();}
advisory_assert($caught==='service_advisory_hard_requirement_forbidden','hard requirement guard');

$bad=$catalog;
$bad['matching_usage']='enabled';
$caught='';
try{kmob_service_advisory_validate($bad);}catch(RuntimeException $e){$caught=$e->getMessage();}
advisory_assert($caught==='service_advisory_matching_forbidden','matching enable guard');

echo "PASS: 109 service advisories structurally valid; expert review NOT_RUN; hard filtering/ranking/matching disabled\n";
