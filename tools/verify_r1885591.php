<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$config=(string)file_get_contents($root.'/config.php');preg_match('/KARETA_DB_VERSION\',\s*(\d+)/',$config,$m);$db=(int)($m[1]??0);
$work=(string)file_get_contents($root.'/api/master_workplace.php');
$feed=(string)file_get_contents($root.'/js/next/pages/work_feed.js');
$css=(string)file_get_contents($root.'/css/next/app_next.css');
$checks=[
 'db version 109'=>$db>=109,
 'migration 109'=>is_file($root.'/api/migrations/109_master_profile_runtime_repair.php'),
 'master repair helper'=>str_contains($work,'kareta_master_workplace_repair_profile'),
 'repair requires authorized master'=>str_contains($work,"\$contextType==='profile'&&\$profileType==='master'")&&str_contains($work,"requested_role='master' AND status='approved'"),
 'repair materializes masters'=>str_contains($work,'INSERT INTO masters(id,user_id,user_phone,name,phone,initials,spec,active)'),
 'repair relinks identity profile'=>str_contains($work,"legacy_entity_type='master',legacy_entity_id=?"),
 'legacy KPI block removed'=>!str_contains($feed,'class="k-exchange-kpi"'),
 'KPI button'=>str_contains($feed,'data-exchange-kpi-toggle')&&(str_contains($feed,'>КПИ</button>')||str_contains($feed,'<span>КПИ</span>')),
 'KPI dialog'=>str_contains($feed,'data-exchange-kpi-dialog')&&str_contains($feed,'k-exchange-kpi-panel'),
 'mobile exchange hero hidden'=>str_contains($css,'.k-exchange-page--production>.k-exchange-hero{display:none!important}'),
 'asset version'=>str_contains((string)file_get_contents($root.'/inc/asset_version.php'),'r1885591-master-profile-exchange-kpi'),
 'service worker version'=>str_contains((string)file_get_contents($root.'/sw.js'),'r1885591-master-profile-exchange-kpi'),
];
$bad=array_keys(array_filter($checks,fn($v)=>!$v));
if($bad){fwrite(STDERR,'FAIL '.implode(', ',$bad).PHP_EOL);exit(1);}echo "OK R188.5.5.6.31 master profile repair + exchange KPI cleanup\n";
