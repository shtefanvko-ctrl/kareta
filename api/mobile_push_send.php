<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$pdo = kareta_pdo();
$user = $_SESSION['kareta_user'] ?? null;
$role = strtolower((string)($user['role'] ?? ''));
if (!is_array($user) || !in_array($role, ['admin','owner'], true)) {
    kareta_json(['ok'=>false,'code'=>'FORBIDDEN'], 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    kareta_json(['ok'=>false,'code'=>'METHOD_NOT_ALLOWED'], 405);
}

$raw = file_get_contents('php://input') ?: '{}';
$body = json_decode($raw, true);
if (!is_array($body)) kareta_json(['ok'=>false,'code'=>'INVALID_JSON'], 400);

$accountId = max(0, (int)($body['accountId'] ?? 0));
$title = trim((string)($body['title'] ?? 'KARETA.KZ'));
$message = trim((string)($body['body'] ?? ''));
$url = trim((string)($body['url'] ?? ''));
if ($accountId <= 0 || $message === '') {
    kareta_json(['ok'=>false,'code'=>'ACCOUNT_AND_BODY_REQUIRED'], 422);
}
function kareta_b64url(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function kareta_firebase_credentials(): array {
    $raw = trim((string)getenv('KARETA_FIREBASE_SERVICE_ACCOUNT_JSON'));
    if ($raw === '') throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED');
    if ($raw[0] !== '{') {
        if (!is_file($raw) || !is_readable($raw)) {
            throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_NOT_READABLE');
        }
        $raw = (string)file_get_contents($raw);
    }
    $json = json_decode($raw, true);
    if (!is_array($json)) throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_INVALID');
    foreach (['client_email','private_key','token_uri','project_id'] as $key) {
        if (empty($json[$key])) throw new RuntimeException('FIREBASE_SERVICE_ACCOUNT_MISSING_' . strtoupper($key));
    }
    return $json;
}

function kareta_firebase_access_token(array $credentials): string {
    $now = time();
    $header = kareta_b64url(json_encode(['alg'=>'RS256','typ'=>'JWT'], JSON_UNESCAPED_SLASHES));
    $claims = kareta_b64url(json_encode([
        'iss'=>(string)$credentials['client_email'],
        'scope'=>'https://www.googleapis.com/auth/firebase.messaging',
        'aud'=>(string)$credentials['token_uri'],
        'iat'=>$now,
        'exp'=>$now + 3300,
    ], JSON_UNESCAPED_SLASHES));
    $unsigned = $header . '.' . $claims;
    $signature = '';
    if (!openssl_sign($unsigned, $signature, (string)$credentials['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('FIREBASE_JWT_SIGN_FAILED');
    }
    $jwt = $unsigned . '.' . kareta_b64url($signature);

    $ch = curl_init((string)$credentials['token_uri']);
    curl_setopt_array($ch, [
        CURLOPT_POST=>true,
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_TIMEOUT=>15,
        CURLOPT_HTTPHEADER=>['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_POSTFIELDS=>http_build_query([
            'grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'=>$jwt,
        ]),
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($response === false || $status < 200 || $status >= 300) {
        throw new RuntimeException('FIREBASE_OAUTH_FAILED:' . $status . ':' . $error);
    }
    $payload = json_decode((string)$response, true);
    $token = trim((string)($payload['access_token'] ?? ''));
    if ($token === '') throw new RuntimeException('FIREBASE_ACCESS_TOKEN_MISSING');
    return $token;
}
function kareta_fcm_send(array $credentials, string $accessToken, string $token, array $notification, array $data): array {
    $projectId = rawurlencode((string)$credentials['project_id']);
    $endpoint = 'https://fcm.googleapis.com/v1/projects/' . $projectId . '/messages:send';
    $payload = json_encode([
        'message'=>[
            'token'=>$token,
            'notification'=>$notification,
            'data'=>$data,
            'android'=>[
                'priority'=>'high',
                'notification'=>['channel_id'=>'kareta_main'],
            ],
        ],
    ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST=>true,
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_TIMEOUT=>15,
        CURLOPT_HTTPHEADER=>[
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json; charset=utf-8',
        ],
        CURLOPT_POSTFIELDS=>$payload,
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status'=>$status,'response'=>(string)$response];
}
try {
    $credentials = kareta_firebase_credentials();
    $accessToken = kareta_firebase_access_token($credentials);

    $stmt = $pdo->prepare("SELECT id,token,platform FROM mobile_push_tokens
        WHERE account_id=? AND enabled=1 ORDER BY updated_at DESC LIMIT 20");
    $stmt->execute([$accountId]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $sent = 0;
    $failed = 0;
    $iosPending = 0;
    $invalidIds = [];
    foreach ($devices as $device) {
        $platform = strtolower((string)($device['platform'] ?? 'android'));
        if ($platform === 'ios') {
            // APNs delivery is a separate transport. Never send an APNs token
            // to FCM; keep it enabled for the APNs sender once configured.
            $iosPending++;
            continue;
        }
        if ($platform !== 'android') {
            $failed++;
            continue;
        }
        $result = kareta_fcm_send(
            $credentials,
            $accessToken,
            (string)$device['token'],
            ['title'=>$title ?: 'KARETA.KZ','body'=>$message],
            ['url'=>$url,'type'=>(string)($body['type'] ?? 'general')]
        );
        if ($result['status'] >= 200 && $result['status'] < 300) {
            $sent++;
        } else {
            $failed++;
            if (in_array($result['status'], [400,404], true)) $invalidIds[] = (int)$device['id'];
        }
    }

    if ($invalidIds) {
        $marks = implode(',', array_fill(0, count($invalidIds), '?'));
        $pdo->prepare("UPDATE mobile_push_tokens SET enabled=0 WHERE id IN ($marks)")
            ->execute($invalidIds);
    }
    kareta_json([
        'ok'=>true,
        'sent'=>$sent,
        'failed'=>$failed,
        'iosPending'=>$iosPending,
        'devices'=>count($devices),
    ]);
} catch (Throwable $error) {
    kareta_log_error('MOBILE_PUSH_SEND', $error->getMessage());
    kareta_json(['ok'=>false,'code'=>'PUSH_SEND_FAILED','message'=>$error->getMessage()], 503);
}
