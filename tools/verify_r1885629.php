<?php
declare(strict_types=1);
$root=dirname(__DIR__);$required=['api/migrations/122_master_shift_breaks_arrival.php','api/master_shift_arrival.php','css/next/master_shift_breaks_arrival.css','tools/test_r1885629_master_shift_breaks_arrival.js'];
foreach($required as $file)if(!is_file($root.'/'.$file)){fwrite(STDERR,"Missing $file\n");exit(1);} $config=file_get_contents($root.'/config.php');if(!str_contains((string)$config,"KARETA_DB_VERSION', 122")){fwrite(STDERR,"DB version must be 122\n");exit(1);}echo "R188.5.5.6.69 verifier OK\n";
