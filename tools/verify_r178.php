<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
'inc/asset_version.php'=>'20260803-r1861-realtime-stability|20260803-r1861-realtime-stability',
'inc/asset_registry.php'=>'js/next/pages/profile_relations.js',
'js/next/route_registry.js'=>"profile:Object.freeze",
'js/next/app_next.js'=>'KaretaProfileRelationsPages',
'js/next/pages/profile_relations.js'=>'KaretaProfileRelationsPages',
'css/next/profile_relations.css'=>'.k-profile-page'
];
foreach($checks as $file=>$needle){$body=file_get_contents($root.'/'.$file);$ok=$body!==false && array_reduce(explode('|',$needle),fn($carry,$part)=>$carry||str_contains($body,$part),false);if(!$ok){fwrite(STDERR,"FAIL $file\n");exit(1);}}
echo "R178 verifier OK\n";
