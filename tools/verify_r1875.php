<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$checks=[
 'css/next/social_fullscreen_pages.css'=>'k-social-commerce-card',
 'js/next/catalog_cards.js'=>'k-social-commerce-card',
 'inc/asset_registry.php'=>'css/next/social_fullscreen_pages.css',
 'css/next/social_fullscreen_pages.css'=>'k-social-commerce-card',
];
foreach($checks as $f=>$needle){$s=@file_get_contents($root.'/'.$f);if($s===false||!str_contains($s,$needle)){fwrite(STDERR,"FAIL $f\n");exit(1);}}
echo "R187.5 verifier OK\n";
