<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$pdo = kareta_pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$sessionUser = kareta_require_any_role(['client','master','sto','seller','admin','owner']);

if ($method === 'GET') {
    $sessionPhone = (string)($sessionUser['phone'] ?? '');
    $phone = kareta_has_role('admin') ? (string)($_GET['phone'] ?? $sessionPhone) : $sessionPhone;
    if ($phone === '') {
        kareta_json(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    if (kareta_normalize_phone($phone) !== kareta_normalize_phone($sessionPhone) && !kareta_has_role('admin')) {
        kareta_json(['ok' => false, 'error' => 'forbidden'], 403);
    }
    $profile = $phone !== '' ? (kareta_profile_by_phone($pdo, $phone) ?? ($_SESSION['kareta_user'] ?? null)) : null;
    kareta_json(['ok' => true, 'profile' => $profile, 'dbReady' => kareta_db_ready()]);
}

if ($method === 'POST') {
    $body = kareta_read_json();
    $profile = is_array($body['profile'] ?? null) ? $body['profile'] : [];
    if (!kareta_has_role('admin')) {
        $profile['phone'] = (string)($sessionUser['phone'] ?? '');
        foreach (['role','entry_role','active','onboarding_stage','onboarded','onboarded_at','id'] as $protected) unset($profile[$protected]);
    } elseif (!isset($profile['phone'])) {
        $profile['phone'] = (string)($sessionUser['phone'] ?? '');
    }
    $saved = kareta_upsert_profile($pdo, $profile);
    if (!empty($saved['phone'])) {
        kareta_safe_sync_user_entity($pdo, (string)$saved['phone']);
    }
    if (kareta_normalize_phone((string)($saved['phone'] ?? '')) === kareta_normalize_phone((string)($sessionUser['phone'] ?? ''))) {
        $_SESSION['kareta_user'] = array_merge($_SESSION['kareta_user'] ?? [], $saved);
    }
    kareta_json(['ok' => true, 'profile' => $saved, 'dbReady' => kareta_db_ready()]);
}

kareta_json(['ok' => false, 'error' => 'Method not allowed'], 405);
