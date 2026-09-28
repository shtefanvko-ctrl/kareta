<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/api/bootstrap.php';
require_once dirname(__DIR__) . '/api/messaging_core.php';
$watch=in_array('--watch',$argv,true);$limit=(int)(kareta_messaging_config()['worker_batch']??25);$interval=2;
foreach($argv as $arg){if(str_starts_with($arg,'--limit='))$limit=max(1,min(100,(int)substr($arg,8)));if(str_starts_with($arg,'--interval='))$interval=max(1,min(60,(int)substr($arg,11)));}
$pdo=kareta_pdo();if(!$pdo instanceof PDO){fwrite(STDERR,"{\"ok\":false,\"error\":\"database_unavailable\"}\n");exit(2);}
do{
    try{$result=kareta_messaging_worker_once($pdo,$limit);$result=['ok'=>true,'time'=>date('c')]+$result;echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;}
    catch(Throwable $e){fwrite(STDERR,json_encode(['ok'=>false,'time'=>date('c'),'error'=>'worker_failed'],JSON_UNESCAPED_UNICODE).PHP_EOL);if(!$watch)exit(3);}
    if($watch)sleep($interval);
}while($watch);
