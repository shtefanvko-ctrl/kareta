<?php
declare(strict_types=1);

/** Stable application IDs, independent of translated display names. */
function kareta_city_catalog(): array {
    return [
        'kz:oskemen'=>['Усть-Каменогорск','Өскемен','Oskemen','Ust-Kamenogorsk'],
        'kz:semey'=>['Семей','Semey'], 'kz:ridder'=>['Риддер','Ridder'],
        'kz:almaty'=>['Алматы','Almaty'], 'kz:astana'=>['Астана','Astana'],
        'kz:shymkent'=>['Шымкент','Shymkent'], 'kz:karaganda'=>['Караганда','Қарағанды','Karaganda'],
        'kz:pavlodar'=>['Павлодар','Pavlodar'], 'kz:kostanay'=>['Костанай','Қостанай','Kostanay'],
        'kz:petropavl'=>['Петропавловск','Петропавл','Petropavl','Petropavlovsk'],
        'kz:kokshetau'=>['Кокшетау','Көкшетау','Kokshetau'], 'kz:aktobe'=>['Актобе','Ақтөбе','Aktobe'],
        'kz:atyrau'=>['Атырау','Atyrau'], 'kz:aktau'=>['Актау','Ақтау','Aktau'],
        'kz:oral'=>['Уральск','Орал','Oral','Uralsk'], 'kz:taraz'=>['Тараз','Taraz'],
        'kz:taldykorgan'=>['Талдыкорган','Талдықорған','Taldykorgan'],
        'kz:kyzylorda'=>['Кызылорда','Қызылорда','Kyzylorda'], 'kz:turkistan'=>['Туркестан','Түркістан','Turkistan'],
    ];
}
function kareta_city_normalize(string $value): string {
    return preg_replace('/[\s\p{Pd}_]+/u',' ',mb_strtolower(trim($value),'UTF-8'))??'';
}
function kareta_city_id(string $value): string {
    $key=kareta_city_normalize($value);
    foreach(kareta_city_catalog() as $id=>$names){
        if($key===$id)return $id;
        foreach($names as $name)if($key===kareta_city_normalize($name))return $id;
    }
    return '';
}
function kareta_order_city_snapshot(array $request,?array $sto=null): array {
    $field=!empty($request['fieldService'])||!empty($request['field_service'])||(($request['workFormat']??$request['work_format']??'')==='field');
    if($sto!==null&&!$field){
        $name=trim((string)($sto['city']??''));$id=kareta_city_id($name);
        if($id==='')throw new DomainException('sto_city_unverified');
        return ['city'=>kareta_city_catalog()[$id][0],'cityId'=>$id,'source'=>'sto'];
    }
    $values=[];
    foreach(['city','cityId','city_id'] as $key)if(trim((string)($request[$key]??''))!=='')$values[]=(string)$request[$key];
    if(!$values)foreach(preg_split('/\R/u',(string)($request['notes']??''))?:[] as $line)if(preg_match('/^\s*(?:Город|City|Қала)\s*:\s*(.+?)\s*$/ui',$line,$m))$values[]=$m[1];
    if(!$values)return ['city'=>'','cityId'=>'','source'=>'unknown'];
    $ids=array_map('kareta_city_id',$values);
    if(in_array('',$ids,true)||count(array_unique($ids))!==1)throw new DomainException('request_city_invalid');
    $id=$ids[0];return ['city'=>kareta_city_catalog()[$id][0],'cityId'=>$id,'source'=>'request'];
}
