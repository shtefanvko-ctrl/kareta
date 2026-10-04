<?php
declare(strict_types=1);
if(!function_exists('array_is_list')){function array_is_list(array $array): bool {$i=0;foreach($array as $key=>$_){if($key!==$i++)return false;}return true;}}
require_once dirname(__DIR__).'/api/master_equipment_profile.php';
function equipment_assert(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$catalog=kmob_equipment_catalog();equipment_assert(count($catalog['items'])===82,'equipment count');
$selected=kmob_equipment_validate([['equipmentId'=>'obd_scanner','access'=>'owned']],$catalog);
equipment_assert($selected===[['equipmentId'=>'obd_scanner','access'=>'owned']],'normalized selection');
equipment_assert(kmob_equipment_validate([],$catalog)===[],'empty selection must clear equipment');
foreach([
  [[['equipmentId'=>'unknown','access'=>'owned']],'equipment_unknown'],
  [[['equipmentId'=>'obd_scanner','access'=>'broken']],'equipment_access_invalid'],
  [[['equipmentId'=>'obd_scanner','access'=>'owned'],['equipmentId'=>'obd_scanner','access'=>'rented']],'equipment_duplicate'],
  [[['equipmentId'=>['obd_scanner'],'access'=>'owned']],'equipment_selection_invalid'],
] as [$input,$code]){
  $caught='';try{kmob_equipment_validate($input,$catalog);}catch(InvalidArgumentException $e){$caught=$e->getMessage();}equipment_assert($caught===$code,$code.' not rejected');
}
$profile=kmob_equipment_read('{"onboardingStatus":"completed","masterEquipment":{"revision":3,"selection":[{"equipmentId":"obd_scanner","access":"need_buy"}],"lastGroupId":"diagnostic"}}');
equipment_assert($profile['revision']===3&&$profile['lastGroupId']==='diagnostic','profile read');
equipment_assert($profile['selection'][0]['access']==='need_buy','purchase state not converted into owned');
$caught=false;try{kmob_equipment_read('malformed');}catch(RuntimeException $e){$caught=true;}equipment_assert($caught,'malformed stored JSON accepted');
echo "PASS: equipment validation and profile decode (no database integration)\n";
