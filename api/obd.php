<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = strtolower(trim((string)($_GET['action'] ?? 'history')));

if ($action === 'config' && $method === 'GET') {
    kareta_json([
        'ok'=>true,
        'feature'=>'obd',
        'transport'=>'bluetooth_classic_spp',
        'nativeRequired'=>true,
        'nativeApiVersion'=>5,
        'commands'=>['ATZ','ATE0','ATL0','ATS0','ATH0','ATSP0','010C','010D','0105','03','0902','ATRV'],
        'offlineSync'=>true,
        'liveData'=>true,
        'reconnectLast'=>true,
        'vehicleBinding'=>true,
    ]);
}

$pdo = kareta_pdo();
$user = $_SESSION['kareta_user'] ?? null;
if (!is_array($user) || empty($user['phone'])) {
    kareta_json(['ok'=>false,'code'=>'AUTH_REQUIRED'],401);
}
$phone = kareta_normalize_phone((string)$user['phone']);
$stmt = $pdo->prepare('SELECT id,status FROM accounts WHERE phone=? LIMIT 1');
$stmt->execute([$phone]);
$account = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$account || (string)($account['status'] ?? 'active') !== 'active') {
    kareta_json(['ok'=>false,'code'=>'ACCOUNT_NOT_ACTIVE'],403);
}
$accountId = (int)$account['id'];
$actorUserId=(int)($user['id']??0);
$actorRole=strtolower(trim((string)($user['role']??'client')));

function kareta_obd_vehicle_access(PDO $pdo,string $vehicleId,int $userId,string $phone,string $role): bool {
    if($vehicleId==='')return true;
    $st=$pdo->prepare("SELECT id,user_id,user_phone FROM client_vehicles WHERE id=? AND active=1 LIMIT 1");
    $st->execute([$vehicleId]);
    $vehicle=$st->fetch(PDO::FETCH_ASSOC);
    if(!$vehicle)return false;
    if(in_array($role,['admin','owner'],true))return true;
    if($userId>0&&(int)($vehicle['user_id']??0)===$userId)return true;
    if($phone!==''&&hash_equals($phone,(string)($vehicle['user_phone']??'')))return true;
    if(in_array($role,['master','sto'],true)&&kareta_table_exists($pdo,'orders')){
        try{
            $q=$pdo->prepare("SELECT COUNT(*) FROM orders WHERE client_vehicle_id=? AND (master_user_id=? OR master_id IN (SELECT id FROM masters WHERE user_id=?))");
            $q->execute([$vehicleId,$userId,$userId]);
            return (int)$q->fetchColumn()>0;
        }catch(Throwable $_){}
    }
    return false;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS obd_diagnostic_sessions(
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  account_id BIGINT UNSIGNED NOT NULL,
  vehicle_id VARCHAR(80) NULL,
  sync_key VARCHAR(120) NOT NULL,
  adapter_name VARCHAR(120) NOT NULL DEFAULT '',
  adapter_address VARCHAR(32) NOT NULL DEFAULT '',
  vin VARCHAR(32) NOT NULL DEFAULT '',
  protocol_label VARCHAR(80) NOT NULL DEFAULT '',
  dtc_json LONGTEXT NULL,
  snapshot_json LONGTEXT NULL,
  raw_json LONGTEXT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'android',
  captured_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_obd_sync_key(account_id,sync_key),
  KEY idx_obd_account_captured(account_id,captured_at),
  KEY idx_obd_vehicle_captured(vehicle_id,captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

if ($action === 'history' && $method === 'GET') {
    if (!kareta_table_exists($pdo,'obd_diagnostic_sessions')) {
        kareta_json(['ok'=>true,'sessions'=>[],'schemaPending'=>true]);
    }
    $limit = max(1,min(100,(int)($_GET['limit'] ?? 30)));
    $vehicleFilter=trim((string)($_GET['vehicleId']??''));
    if($vehicleFilter!==''&&!kareta_obd_vehicle_access($pdo,$vehicleFilter,$actorUserId,$phone,$actorRole)){
        kareta_json(['ok'=>false,'code'=>'VEHICLE_FORBIDDEN'],403);
    }
    $where="account_id=?";
    $params=[$accountId];
    if($vehicleFilter!==''){$where.=" AND vehicle_id=?";$params[]=$vehicleFilter;}
    $q = $pdo->prepare("SELECT id,vehicle_id AS vehicleId,adapter_name AS adapterName,
      adapter_address AS adapterAddress,vin,protocol_label AS protocolLabel,
      dtc_json AS dtcJson,snapshot_json AS snapshotJson,source,
      captured_at AS capturedAt,created_at AS createdAt
      FROM obd_diagnostic_sessions
      WHERE {$where}
      ORDER BY captured_at DESC,id DESC
      LIMIT {$limit}");
    $q->execute($params);
    $rows = $q->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($rows as &$row) {
        foreach (['dtcJson','snapshotJson'] as $key) {
            $decoded = json_decode((string)($row[$key] ?? ''),true);
            $row[$key] = is_array($decoded) ? $decoded : [];
        }
    }
    unset($row);
    kareta_json(['ok'=>true,'sessions'=>$rows]);
}

if ($method !== 'POST' || $action !== 'sync') {
    kareta_json(['ok'=>false,'code'=>'METHOD_NOT_ALLOWED'],405);
}

$raw = file_get_contents('php://input') ?: '{}';
$body = json_decode($raw,true);
if (!is_array($body)) kareta_json(['ok'=>false,'code'=>'INVALID_JSON'],400);
$items = $body['items'] ?? [];
if (!is_array($items)) kareta_json(['ok'=>false,'code'=>'ITEMS_REQUIRED'],422);
if (count($items) > 100) kareta_json(['ok'=>false,'code'=>'TOO_MANY_ITEMS'],422);

if (!kareta_table_exists($pdo,'obd_diagnostic_sessions')) {
    kareta_json(['ok'=>false,'code'=>'OBD_SCHEMA_PENDING'],503);
}

$upsert = $pdo->prepare("INSERT INTO obd_diagnostic_sessions(
    id,account_id,vehicle_id,sync_key,adapter_name,adapter_address,vin,protocol_label,
    dtc_json,snapshot_json,raw_json,source,captured_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON DUPLICATE KEY UPDATE
    vehicle_id=VALUES(vehicle_id),
    adapter_name=VALUES(adapter_name),
    adapter_address=VALUES(adapter_address),
    vin=VALUES(vin),
    protocol_label=VALUES(protocol_label),
    dtc_json=VALUES(dtc_json),
    snapshot_json=VALUES(snapshot_json),
    raw_json=VALUES(raw_json),
    source=VALUES(source),
    captured_at=VALUES(captured_at)");

$accepted = [];
foreach ($items as $item) {
    if (!is_array($item)) continue;
    $payload = isset($item['payload']) && is_array($item['payload']) ? $item['payload'] : $item;
    $syncKey = trim((string)($item['id'] ?? $payload['syncKey'] ?? ''));
    if ($syncKey === '') $syncKey = 'obd_'.bin2hex(random_bytes(12));
    $id = 'obd_'.substr(hash('sha256',$accountId.'|'.$syncKey),0,40);
    $capturedMs = (int)($payload['capturedAt'] ?? $item['createdAt'] ?? 0);
    $capturedAt = $capturedMs > 0 ? date('Y-m-d H:i:s',(int)floor($capturedMs/1000)) : date('Y-m-d H:i:s');
    $adapter = is_array($payload['adapter'] ?? null) ? $payload['adapter'] : [];
    $snapshot = is_array($payload['snapshot'] ?? null) ? $payload['snapshot'] : [];
    $dtc = is_array($payload['dtc'] ?? null) ? $payload['dtc'] : [];
    $vehicleId=trim((string)($payload['vehicleId'] ?? ''));
    if($vehicleId!==''&&!kareta_obd_vehicle_access($pdo,$vehicleId,$actorUserId,$phone,$actorRole)){
        kareta_json(['ok'=>false,'code'=>'VEHICLE_FORBIDDEN','vehicleId'=>$vehicleId],403);
    }
    $upsert->execute([
        $id,$accountId,
        $vehicleId!==''?$vehicleId:null,
        substr($syncKey,0,120),
        substr(trim((string)($adapter['name'] ?? '')),0,120),
        substr(trim((string)($adapter['address'] ?? '')),0,32),
        substr(trim((string)($payload['vin'] ?? '')),0,32),
        substr(trim((string)($payload['protocol'] ?? '')),0,80),
        json_encode($dtc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
        json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
        json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
        'android',
        $capturedAt
    ]);
    $accepted[] = $syncKey;
}
kareta_json(['ok'=>true,'accepted'=>$accepted,'count'=>count($accepted)]);
