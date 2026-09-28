<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$required=['css/next/sto_schedule_capacity_command_center.css','api/migrations/127_sto_schedule_capacity_command_center.php','tools/test_r1885634_sto_schedule_capacity_command_center.js','docs/releases/changelog/CHANGELOG_R188_5_5_6_74.md'];
foreach($required as $f)if(!is_file($root.'/'.$f)){fwrite(STDERR,"Missing $f\n");exit(1);}passthru('node '.escapeshellarg($root.'/tools/test_r1885634_sto_schedule_capacity_command_center.js'),$code);exit($code);
