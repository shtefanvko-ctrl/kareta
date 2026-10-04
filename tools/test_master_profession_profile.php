<?php
declare(strict_types=1);
if(!function_exists('array_is_list')){function array_is_list(array $array): bool {$i=0;foreach($array as $key=>$_){if($key!==$i++)return false;}return true;}}
require_once dirname(__DIR__).'/api/master_profession_profile.php';
function profession_assert(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$catalog=kmob_profession_catalog();
profession_assert(count($catalog['items'])===21,'profession count');
foreach($catalog['items'] as $item){
    profession_assert((string)($item['label_ru']??'')!=='','label_ru');
    profession_assert((string)($item['label_kk']??'')!=='','label_kk');
    profession_assert((string)($item['label_en']??'')!=='','label_en');
}
$selected=kmob_profession_validate(['diagnostician','mechanic'],$catalog);
profession_assert($selected===['diagnostician','mechanic'],'selection normalization');
profession_assert(kmob_profession_validate([],$catalog)===[],'empty selection must clear professions');
foreach([
    [['unknown'],'profession_unknown'],
    [['mechanic','mechanic'],'profession_duplicate'],
    [[['mechanic']],'profession_unknown'],
] as [$input,$code]){
    $caught='';try{kmob_profession_validate($input,$catalog);}catch(InvalidArgumentException $e){$caught=$e->getMessage();}
    profession_assert($caught===$code,$code.' not rejected');
}
$profile=kmob_profession_read('{"masterProfessions":{"revision":2,"selection":["mechanic"],"lastMutationId":"m1"}}');
profession_assert($profile['revision']===2&&$profile['selection']===['mechanic'],'profile read');
$caught=false;try{kmob_profession_read('malformed');}catch(RuntimeException $e){$caught=true;}profession_assert($caught,'malformed stored JSON accepted');
echo "PASS: profession validation/profile decode (self-reported, matching disabled, no DB integration)\n";
