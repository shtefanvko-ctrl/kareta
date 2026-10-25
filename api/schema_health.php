<?php
declare(strict_types=1);

ini_set('display_errors','0');
ini_set('html_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$respond=static function(array $payload,int $status=200):void{
    http_response_code($status);
    echo json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
    exit;
};

try{
    $configFile=dirname(__DIR__).'/config.php';
    if(!is_file($configFile))throw new RuntimeException('config.php is missing');
    require $configFile;
    require_once __DIR__.'/identity/schema_contract.php';

    $db=defined('KARETA_DB')?constant('KARETA_DB'):($KARETA_DB??$GLOBALS['KARETA_DB']??[]);
    if(!is_array($db))throw new RuntimeException('Database configuration is unavailable');

    $name=(string)($db['database']??$db['dbname']??'');
    if($name==='')throw new RuntimeException('Database name is empty');
    $charset=trim((string)($db['charset']??'utf8mb4'))?:'utf8mb4';
    $socket=trim((string)($db['socket']??''));
    $dsn=$socket!==''
        ? 'mysql:unix_socket='.$socket.';dbname='.$name.';charset='.$charset
        : sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            (string)($db['host']??'localhost'),
            (int)($db['port']??3306),
            $name,
            $charset
        );

    $pdo=new PDO(
        $dsn,
        (string)($db['username']??$db['user']??''),
        (string)($db['password']??$db['pass']??''),
        [
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false,
            PDO::ATTR_TIMEOUT=>max(1,min(3,(int)($db['connect_timeout']??2))),
        ]
    );

    // Pure inspection only. This endpoint deliberately does not load bootstrap.php
    // and never records schema_contract_audit rows or runs migration/repair logic.
    $schema=KaretaSchemaContract::inspect($pdo);

    $configuredToken=defined('KARETA_DIAGNOSTICS_TOKEN')?trim((string)KARETA_DIAGNOSTICS_TOKEN):'';
    $providedToken=trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN']??''));
    $tokenAuthorized=$configuredToken!==''&&strlen($configuredToken)>=32&&$providedToken!==''&&hash_equals($configuredToken,$providedToken);

    $sessionAuthorized=false;
    $sessionName=is_array(defined('KARETA_APP')?constant('KARETA_APP'):null)
        ? trim((string)(constant('KARETA_APP')['session_name']??''))
        : '';
    if($sessionName!==''&&!empty($_COOKIE[$sessionName])){
        session_name($sessionName);
        if(session_status()!==PHP_SESSION_ACTIVE){
            @session_start(['read_and_close'=>true]);
        }
        $role=strtolower(trim((string)($_SESSION['kareta_user']['role']??'')));
        $sessionAuthorized=in_array($role,['admin','owner'],true);
    }
    $detailAuthorized=$tokenAuthorized||$sessionAuthorized;

    $status=$schema['ok']?'ready':'degraded';
    $httpStatus=$schema['ok']?200:503;
    if(!$detailAuthorized){
        $respond([
            'ok'=>(bool)$schema['ok'],
            'status'=>$status,
            'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
        ],$httpStatus);
    }

    $respond([
        'ok'=>(bool)$schema['ok'],
        'status'=>$status,
        'schema'=>$schema,
        'dbVersion'=>defined('KARETA_DB_VERSION')?KARETA_DB_VERSION:0,
        'assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:'',
        'readOnly'=>true,
        'serverTime'=>date(DATE_ATOM),
    ],$httpStatus);
}catch(Throwable $e){
    $configuredToken=defined('KARETA_DIAGNOSTICS_TOKEN')?trim((string)KARETA_DIAGNOSTICS_TOKEN):'';
    $providedToken=trim((string)($_SERVER['HTTP_X_KARETA_DIAGNOSTICS_TOKEN']??''));
    $detailAuthorized=$configuredToken!==''&&strlen($configuredToken)>=32&&$providedToken!==''&&hash_equals($configuredToken,$providedToken);
    $payload=['ok'=>false,'status'=>'unavailable','error'=>'schema_health_unavailable'];
    if($detailAuthorized)$payload['diagnostic']=['type'=>get_class($e),'message'=>$e->getMessage()];
    $respond($payload,503);
}
