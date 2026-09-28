<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){exit(1);} $root=dirname(__DIR__);$css=file_get_contents($root.'/css/next/community_group_slide_width.css');$js=file_get_contents($root.'/js/next/pages/community.js');$asset=file_get_contents($root.'/inc/asset_version.php');
$checks=[
 'css_file'=>is_file($root.'/css/next/community_group_slide_width.css'),
 'max_150'=>str_contains($css,'max-width:150px!important'),
 'width_150'=>str_contains($css,'width:150px!important'),
 'flex_150'=>str_contains($css,'flex:0 0 150px!important'),
 'swiper_auto'=>str_contains($js,"slidesPerView:'auto'") || (str_contains($asset,'r1885609-community-native-ui') && !str_contains($js,'window.Swiper')), 
 'asset_version'=>str_contains($asset,'r1885598-community-group-slide-150'),
];
foreach($checks as $n=>$ok) echo ($ok?'[OK] ':'[FAIL] ').$n.PHP_EOL;exit(in_array(false,$checks,true)?1:0);
