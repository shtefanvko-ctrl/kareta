<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/inc/request_logger.php';
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/onboarding_identity_bridge.php';
require_once __DIR__ . '/identity/challenge_service.php';

$pdo = kareta_pdo();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';


function kareta_role_access_payload(string $role): array
{
    $policies = [
        'client' => [
            'defaultRoute' => 'home',
            'routes' => ['home','services','servicesQuick','masters','parts','orders','chats','cabinet'],
            'capabilities' => ['orders.create','orders.readOwn','chats.use','parts.browse','masters.browse'],
        ],
        'master' => [
            'defaultRoute' => 'masterDashboard',
            'routes' => ['masterDashboard','home','services','parts','orders','chats','cabinet'],
            'capabilities' => ['orders.take','orders.updateAssigned','chats.use','profile.master','parts.browse'],
        ],
        'sto' => [
            'defaultRoute' => 'stoDashboard',
            'routes' => ['stoDashboard','home','services','masters','parts','orders','chats','cabinet'],
            'capabilities' => ['orders.manageService','masters.manageTeam','services.manage','chats.use','profile.sto'],
        ],
        'seller' => [
            'defaultRoute' => 'seller',
            'routes' => ['seller','parts','orders','chats','cabinet'],
            'capabilities' => ['seller.products.manage','seller.stock.manage','seller.orders.manage','seller.profile.manage','parts.browse'],
        ],
        'admin' => ['defaultRoute' => 'home', 'routes' => ['*'], 'capabilities' => ['*']],
        'owner' => ['defaultRoute' => 'home', 'routes' => ['*'], 'capabilities' => ['*']],
    ];
    $safeRole = array_key_exists($role, $policies) ? $role : 'client';
    return ['role' => $safeRole] + $policies[$safeRole];
}

function kareta_auth_cookie_options(int $expires): array
{
    return [
        'expires'=>$expires,
        'path'=>'/',
        'secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))==='https',
        'httponly'=>true,
        'samesite'=>'Lax',
    ];
}

function kareta_revoke_identity_cookie_session(?PDO $pdo): void
{
    if(!$pdo instanceof PDO)return;
    try{(new KaretaSessionService($pdo))->revokeCurrent();}catch(Throwable $error){kareta_log_error('IDENTITY_LOGOUT',$error->getMessage());}
}


function kareta_identity_profile_snapshot_by_phone(PDO $pdo, string $phone): ?array
{
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return null;
    try {
        $st = $pdo->prepare("SELECT a.id AS account_id,a.phone,a.status,p.id AS person_id,p.fullname,
            EXISTS(SELECT 1 FROM person_profiles ppm WHERE ppm.person_id=p.id AND ppm.profile_type='master' AND ppm.status='active') AS has_master,
            EXISTS(SELECT 1 FROM person_profiles pps WHERE pps.person_id=p.id AND pps.profile_type='seller' AND pps.status='active') AS has_seller
            FROM accounts a LEFT JOIN persons p ON p.account_id=a.id WHERE a.phone=? LIMIT 1");
        $st->execute([$norm]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        $role = !empty($row['has_master']) ? 'master' : (!empty($row['has_seller']) ? 'seller' : 'client');
        $name = trim((string)($row['fullname'] ?? '')) ?: ($role === 'master' ? 'Мастер' : ($role === 'seller' ? 'Магазин' : 'Клиент'));
        return [
            'id'=>0,'phone'=>$norm,'name'=>$name,'role'=>$role,'entry_role'=>$role,
            'onboarding_stage'=>'done','onboarded'=>1,'country_code'=>'KZ','city'=>'','initials'=>'','car'=>'','spec'=>'','email'=>'',
            'active'=>(string)($row['status'] ?? 'active') === 'active' ? 1 : 0,
            '_identity_only'=>true,'_identity_account_id'=>(int)($row['account_id'] ?? 0),'_identity_person_id'=>(int)($row['person_id'] ?? 0),
        ];
    } catch (Throwable $error) {
        kareta_log_error('ONBOARDING_IDENTITY_LOOKUP', $error->getMessage());
        return null;
    }
}

function kareta_restore_legacy_profile_from_identity(PDO $pdo, array $snapshot, string $selectedEntryRole='client'): array
{
    if (empty($snapshot['_identity_only'])) return $snapshot;
    $phone = kareta_normalize_phone((string)($snapshot['phone'] ?? ''));
    if ($phone === '') return $snapshot;
    $role = strtolower((string)($snapshot['role'] ?? 'client'));
    if (!in_array($role, ['client','master','seller'], true)) $role = 'client';
    $entryRole = strtolower(trim($selectedEntryRole));
    if (!in_array($entryRole, ['client','master'], true)) $entryRole = $role;
    $name = trim((string)($snapshot['name'] ?? '')) ?: ($role === 'master' ? 'Мастер' : ($role === 'seller' ? 'Магазин' : 'Клиент'));
    $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $initials = mb_substr($parts[0] ?? '', 0, 1) . mb_substr($parts[1] ?? '', 0, 1);
    try {
        $pdo->prepare("INSERT INTO users(phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active)
                       VALUES(?,?,?,?,'done',1,NOW(),'KZ','',?,'','','',?)
                       ON DUPLICATE KEY UPDATE name=IF(name='',VALUES(name),name),entry_role=VALUES(entry_role),onboarding_stage='done',onboarded=1,onboarded_at=COALESCE(onboarded_at,NOW()),active=VALUES(active)")
            ->execute([$phone,$name,$role,$entryRole,$initials,(int)($snapshot['active'] ?? 1)]);
        $restored = kareta_profile_by_phone($pdo, $phone);
        if ($restored) {
            kareta_safe_sync_user_entity($pdo, $phone);
            return $restored;
        }
    } catch (Throwable $error) {
        kareta_log_error('ONBOARDING_LEGACY_PROJECTION_REPAIR', $error->getMessage());
    }
    unset($snapshot['_identity_only'], $snapshot['_identity_account_id'], $snapshot['_identity_person_id']);
    return $snapshot;
}

function kareta_onboarding_profile_by_phone(?PDO $pdo, string $phone): ?array
{
    if (!$pdo instanceof PDO) return null;
    $norm = kareta_normalize_phone($phone);
    if ($norm === '') return null;
    try {
        $legacy = kareta_profile_by_phone($pdo, $norm);
        if ($legacy) return $legacy;
    } catch (Throwable $error) {
        // Older installations may not have every column used by the current helper.
        try {
            $st = $pdo->prepare("SELECT * FROM `users` WHERE phone=? LIMIT 1");
            $st->execute([$norm]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $role = (string)($row['role'] ?? $row['entry_role'] ?? 'client');
                if (!in_array($role, ['client','master','sto','seller','admin','owner'], true)) $role = 'client';
                return [
                    'id'=>(int)($row['id'] ?? 0),'phone'=>$norm,'name'=>(string)($row['name'] ?? 'Клиент'),
                    'role'=>$role,'entry_role'=>(string)($row['entry_role'] ?? $role),'onboarding_stage'=>(string)($row['onboarding_stage'] ?? ''),
                    'onboarded'=>(int)($row['onboarded'] ?? 1),'country_code'=>(string)($row['country_code'] ?? 'KZ'),'city'=>(string)($row['city'] ?? ''),
                    'initials'=>(string)($row['initials'] ?? ''),'car'=>(string)($row['car'] ?? ''),'spec'=>(string)($row['spec'] ?? ''),'email'=>(string)($row['email'] ?? ''),'active'=>(int)($row['active'] ?? 1),
                ];
            }
        } catch (Throwable $fallbackError) {
            kareta_log_error('ONBOARDING_PROFILE_LOOKUP', $fallbackError->getMessage());
        }
    }
    // Identity Core is authoritative enough to prove that this phone already owns
    // an account even when an old overwrite deployment lost the legacy users projection.
    return kareta_identity_profile_snapshot_by_phone($pdo, $norm);
}

function kareta_sync_compact_role_profile(PDO $pdo, array $user, array $profileData, array $vehicleData): void
{
    $phone = kareta_normalize_phone((string)($user['phone'] ?? ''));
    if ($phone === '') return;

    kareta_sync_user_entity($pdo, $phone);
    $role = (string)($user['role'] ?? 'client');
    $userId = (int)($user['id'] ?? 0);
    $specialization = trim((string)($profileData['specialization'] ?? ''));
    $experience = trim((string)($profileData['experience'] ?? ''));
    $address = trim((string)($profileData['address'] ?? $profileData['area'] ?? ''));

    if ($role === 'master') {
        kareta_ensure_column($pdo, 'masters', 'experience_label', "ALTER TABLE `masters` ADD COLUMN `experience_label` VARCHAR(64) NOT NULL DEFAULT '' AFTER `spec`");
        $pdo->prepare("UPDATE `masters` SET user_id=?, name=?, phone=?, city=?, spec=?, experience_label=?, active=? WHERE user_phone=? OR phone=?")
            ->execute([
                $userId ?: null,
                (string)($user['name'] ?? 'Мастер'),
                $phone,
                (string)($user['city'] ?? ''),
                $specialization,
                $experience,
                (int)($user['active'] ?? 1),
                $phone,
                $phone,
            ]);
        return;
    }

    if ($role === 'sto') {
        kareta_ensure_column($pdo, 'sto_profiles', 'primary_specialization', "ALTER TABLE `sto_profiles` ADD COLUMN `primary_specialization` VARCHAR(191) NOT NULL DEFAULT '' AFTER `work_hours`");
        $pdo->prepare("UPDATE `sto_profiles` SET user_id=?, name=?, contact_phone=?, country_code=?, city=?, address=?, primary_specialization=?, active=? WHERE user_phone=? OR contact_phone=?")
            ->execute([
                $userId ?: null,
                (string)($user['name'] ?? 'СТО'),
                $phone,
                (string)($user['country_code'] ?? 'KZ'),
                (string)($user['city'] ?? ''),
                $address,
                $specialization,
                (int)($user['active'] ?? 1),
                $phone,
                $phone,
            ]);
        return;
    }

    if ($role !== 'client') return;
    $brand = trim((string)($vehicleData['make'] ?? ''));
    $model = trim((string)($vehicleData['model'] ?? ''));
    $year = trim((string)($vehicleData['year'] ?? ''));
    $plate = strtoupper(trim((string)($vehicleData['plate'] ?? '')));
    $title = trim(implode(' ', array_filter([$brand, $model, $year])));
    if ($title === '') return;

    $vehicleId = 'veh_onb_' . substr(sha1(($userId ?: $phone) . '|' . mb_strtolower($title)), 0, 20);
    $st = $pdo->prepare("SELECT COUNT(*) FROM `client_vehicles` WHERE active=1 AND (user_id=? OR user_phone=?)");
    $st->execute([$userId ?: 0, $phone]);
    $isDefault = ((int)$st->fetchColumn() === 0) ? 1 : 0;
    $pdo->prepare("INSERT INTO `client_vehicles`(id,user_id,user_phone,title,brand,model,year_label,plate,is_default,active)
                   VALUES(?,?,?,?,?,?,?,?,?,1)
                   ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),user_phone=VALUES(user_phone),title=VALUES(title),brand=VALUES(brand),model=VALUES(model),year_label=VALUES(year_label),plate=VALUES(plate),active=1")
        ->execute([$vehicleId, $userId ?: null, $phone, $title, $brand, $model, $year, $plate, $isDefault]);
}


if ($method === 'GET') {
    $user = $_SESSION['kareta_user'] ?? null;
    if ($user && $pdo) {
        // Session exists — refresh role/active from DB to pick up any admin changes
        $phone = kareta_normalize_phone((string)($user['phone'] ?? ''));
        if ($phone !== '') {
            $fresh = kareta_onboarding_profile_by_phone($pdo, $phone);
            if ($fresh) {
                // Source of truth is the moderated role stored in the DB profile.
                $user['role']   = $fresh['role'];
                $user['entry_role'] = $fresh['entry_role'] ?? ($user['entry_role'] ?? $user['role']);
                $user['onboarding_stage'] = $fresh['onboarding_stage'] ?? ($user['onboarding_stage'] ?? '');
                $user['onboarded'] = !empty($fresh['onboarded']);
                $user['country_code'] = $fresh['country_code'] ?? ($user['country_code'] ?? 'KZ');
                $user['city'] = $fresh['city'] ?? ($user['city'] ?? '');
                $user['active'] = $fresh['active'];
                $user['name']   = $fresh['name']   ?: $user['name'];
                $user['initials'] = $fresh['initials'] ?: $user['initials'];
                $user['id']     = $fresh['id'] ?? ($user['id'] ?? null);
                $_SESSION['kareta_user'] = $user;
            }
        }
    }
    // Block inactive accounts
    if ($user && (int)($user['active'] ?? 1) !== 1) {
        kareta_revoke_identity_cookie_session($pdo);
        $_SESSION = [];
        session_destroy();
        kareta_json(['ok' => false, 'error' => 'account_blocked', 'user' => null], 403);
    }
    if ($user) {
        $user['access'] = kareta_role_access_payload((string)($user['role'] ?? 'client'));
        $_SESSION['kareta_user'] = $user;
    }
    kareta_json(['ok' => true, 'user' => $user, 'access' => $user['access'] ?? null, 'dbReady' => kareta_db_ready()]);
}

if ($method === 'POST') {
    $body = kareta_read_json();
    $action = (string)($body['action'] ?? 'login');
    $logPhone = (string)($body['phone'] ?? (($body['profile']['phone'] ?? '') ?: ''));
    kareta_request_log_context(['action'=>$action, 'phone'=>preg_replace('~\D+~','',$logPhone)]);

    if ($action === 'logout') {
        $pushDisabled = 0;
        $pushToken = trim((string)($body['pushToken'] ?? ''));
        $sessionUser = $_SESSION['kareta_user'] ?? null;
        if (
            $pdo instanceof PDO &&
            is_array($sessionUser) &&
            strlen($pushToken) >= 20 &&
            strlen($pushToken) <= 512
        ) {
            $sessionPhone = kareta_normalize_phone((string)($sessionUser['phone'] ?? ''));
            if ($sessionPhone !== '') {
                try {
                    $accountStmt = $pdo->prepare('SELECT id FROM accounts WHERE phone=? LIMIT 1');
                    $accountStmt->execute([$sessionPhone]);
                    $accountId = (int)($accountStmt->fetchColumn() ?: 0);
                    if ($accountId > 0) {
                        $pushStmt = $pdo->prepare(
                            'UPDATE mobile_push_tokens SET enabled=0,last_seen_at=NOW() WHERE account_id=? AND token_hash=?'
                        );
                        $pushStmt->execute([$accountId, hash('sha256', $pushToken)]);
                        $pushDisabled = $pushStmt->rowCount();
                    }
                } catch (Throwable $pushError) {
                    // Push cleanup must never block account logout. Missing legacy
                    // tables or a transient DB error are handled as best effort.
                    kareta_log_error('LOGOUT_PUSH_CLEANUP', $pushError->getMessage());
                }
            }
        }

        kareta_revoke_identity_cookie_session($pdo);
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', ['expires'=>time()-3600,'path'=>$params['path']??'/','domain'=>$params['domain']??'','secure'=>(bool)($params['secure']??false),'httponly'=>true,'samesite'=>'Lax']);
        }
        foreach(['kareta_phone','kareta_role','kareta_onb_done','kareta_entry_role','kareta_demo_role'] as $cookieName) {
            setcookie($cookieName,'',kareta_auth_cookie_options(time()-3600));
        }
        session_destroy();
        kareta_json(['ok' => true, 'loggedOut' => true, 'pushDisabled' => $pushDisabled]);
    }

    if (!$pdo instanceof PDO) {
        $databaseState = kareta_db_public_state($pdo);
        $failureMeta = kareta_db_public_failure_meta();
        kareta_json([
            'ok'=>false,
            'error'=>'database_unavailable',
            'databaseState'=>$databaseState,
            'recoveryAction'=>kareta_db_public_recovery_action($databaseState),
            'failureStage'=>$failureMeta['failureStage'],'failedMigrationVersion'=>$failureMeta['failedMigrationVersion'],
            'diagnosticCode'=>$failureMeta['diagnosticCode'],'failureCategory'=>$failureMeta['failureCategory'],
            'failureSqlState'=>$failureMeta['failureSqlState'],'failureDriverCode'=>$failureMeta['failureDriverCode'],'requestId'=>KARETA_REQUEST_ID,
        ],503);
    }

    if ($action === 'onboarding.requestCode') {
        $phone = kareta_normalize_phone((string)($body['phone'] ?? ''));
        if ($phone === '') kareta_json(['ok' => false, 'error' => 'invalid_phone'], 422);
        try {
            $challenge = (new KaretaChallengeService($pdo))->create($phone, 'login');
        } catch (DomainException $error) {
            kareta_json(
                kareta_challenge_error_payload($error,['requestId'=>KARETA_REQUEST_ID]),
                kareta_challenge_http_status($error)
            );
        }
        $_SESSION['kareta_onboarding_verification'] = [
            'phone' => $phone,
            'challenge_key' => (string)$challenge['challengeKey'],
            'expires_at' => time() + 600,
            'verified' => false,
        ];
        // Do not disclose whether a phone is registered before possession of
        // that phone has been proven with the one-time code.
        $response = [
            'ok'=>true,'sent'=>true,'expiresIn'=>(int)$challenge['expiresIn'],
            'resendAfter'=>(int)($challenge['resendAfter']??60),
            'deliveryMode'=>(string)($challenge['deliveryMode']??'webhook'),
            'codeLength'=>(int)($challenge['codeLength']??6),
            'testMode'=>(bool)($challenge['testMode']??false),
        ];
        if (isset($challenge['testCode'])) $response['testCode'] = (string)$challenge['testCode'];
        if (isset($challenge['devCode'])) $response['devCode'] = (string)$challenge['devCode'];
        kareta_json($response);
    }

    if ($action === 'onboarding.verifyCode') {
        $phone = kareta_normalize_phone((string)($body['phone'] ?? ''));
        $code = preg_replace('~\D+~', '', (string)($body['code'] ?? '')) ?: '';
        $selectedEntryRole = strtolower(trim((string)($body['entryRole'] ?? $body['role'] ?? 'client')));
        if (!in_array($selectedEntryRole, ['client','master'], true)) $selectedEntryRole = 'client';
        $verification = is_array($_SESSION['kareta_onboarding_verification'] ?? null)
            ? $_SESSION['kareta_onboarding_verification'] : null;
        if (!$verification || !hash_equals((string)($verification['phone'] ?? ''), $phone)) {
            kareta_json(['ok' => false, 'error' => 'verification_required'], 409);
        }
        if ((int)($verification['expires_at'] ?? 0) < time()) {
            unset($_SESSION['kareta_onboarding_verification']);
            kareta_json(['ok' => false, 'error' => 'verification_expired'], 410);
        }
        try {
            (new KaretaChallengeService($pdo))->verify((string)($verification['challenge_key'] ?? ''), $code);
        } catch (DomainException|InvalidArgumentException $error) {
            $status = $error->getMessage() === 'challenge_attempts_exceeded' ? 429 : 422;
            kareta_json(['ok'=>false,'error'=>$error->getMessage(),'requestId'=>KARETA_REQUEST_ID],$status);
        }
        session_regenerate_id(true);
        $verification['verified'] = true;
        $verification['verified_at'] = time();
        $_SESSION['kareta_onboarding_verification'] = $verification;

        // Existing number means sign-in, not another registration/upsert.
        $existingProfile = kareta_onboarding_profile_by_phone($pdo, $phone);
        if ($existingProfile && !empty($existingProfile['_identity_only'])) {
            $existingProfile = kareta_restore_legacy_profile_from_identity($pdo, $existingProfile, $selectedEntryRole);
        }
        if ($existingProfile) {
            if ((int)($existingProfile['active'] ?? 1) !== 1) {
                unset($_SESSION['kareta_onboarding_verification']);
                kareta_json(['ok' => false, 'error' => 'account_blocked'], 403);
            }
            $role = (string)($existingProfile['role'] ?? 'client');
            $existingProfile['access'] = kareta_role_access_payload($role);
            $_SESSION['kareta_user'] = $existingProfile;
            unset($_SESSION['kareta_onboarding_verification']);
            $cookieExpires=time()+60*60*24*KARETA_APP['cookie_days'];
            setcookie('kareta_phone',$existingProfile['phone'],kareta_auth_cookie_options($cookieExpires));
            setcookie('kareta_role',$role,kareta_auth_cookie_options($cookieExpires));
            setcookie('kareta_onb_done','1',kareta_auth_cookie_options($cookieExpires));
            $identity = null;
            $identityWarnings = [];
            try {
                $identity = (new KaretaOnboardingIdentityBridge($pdo))->establish($existingProfile,$selectedEntryRole);
            } catch (Throwable $error) {
                // OTP + legacy PHP session already succeeded. Identity/context hydration is a
                // secondary subsystem and must not turn a valid repeated login into HTTP 500.
                $identityWarnings[] = 'identity_session_degraded';
                kareta_log_error('ONBOARDING_IDENTITY_SESSION_DEGRADED', KARETA_REQUEST_ID . ' ' . $error->getMessage());
            }
            $existingProfile['entry_role']=$selectedEntryRole;
            $_SESSION['kareta_user']=$existingProfile;
            setcookie('kareta_entry_role',$selectedEntryRole,kareta_auth_cookie_options($cookieExpires));
            kareta_json([
                'ok' => true,
                'verified' => true,
                'phone' => $phone,
                'existingAccount' => true,
                'user' => $existingProfile,
                'access' => $existingProfile['access'],
                'identity' => $identity,
                'selectedRole' => $selectedEntryRole,
                'entryRole' => $selectedEntryRole,
                'postAuth' => is_array($identity) ? ($identity['postAuth'] ?? null) : null,
                'warnings' => $identityWarnings,
                'identityDegraded' => $identity === null,
                'dbReady' => kareta_db_ready(),
            ]);
        }
        kareta_json(['ok' => true, 'verified' => true, 'phone' => $phone, 'existingAccount' => false, 'selectedRole'=>$selectedEntryRole, 'entryRole'=>$selectedEntryRole]);
    }

    if ($action === 'onboarding.complete') {
        $input = is_array($body['profile'] ?? null) ? $body['profile'] : [];
        $requestedRole = (string)($input['role'] ?? 'client');
        if (!in_array($requestedRole, ['client', 'master', 'sto', 'seller'], true)) {
            kareta_json(['ok' => false, 'error' => 'invalid_role'], 422);
        }
        $profileData = is_array($input['profile'] ?? null) ? $input['profile'] : [];
        $vehicleData = is_array($input['vehicle'] ?? null) ? $input['vehicle'] : [];
        $sellerData = is_array($input['seller'] ?? null) ? $input['seller'] : [];
        $phone = kareta_normalize_phone((string)($input['phone'] ?? ($_SESSION['kareta_user']['phone'] ?? '')));
        $displayName = trim((string)($input['name'] ?? ''));
        $city = trim((string)($input['city'] ?? ''));
        $specialization = trim((string)($profileData['specialization'] ?? ''));
        $profileAddress = trim((string)($profileData['address'] ?? $profileData['area'] ?? ''));
        if ($phone === '') kareta_json(['ok' => false, 'error' => 'phone_required'], 422);
        if ($displayName === '') kareta_json(['ok' => false, 'error' => 'name_required'], 422);
        $verification = is_array($_SESSION['kareta_onboarding_verification'] ?? null) ? $_SESSION['kareta_onboarding_verification'] : null;
        if (!$verification || empty($verification['verified']) || !hash_equals((string)($verification['phone'] ?? ''), $phone)) {
            kareta_json(['ok' => false, 'error' => 'verification_required'], 409);
        }
        if ((int)($verification['expires_at'] ?? 0) < time()) {
            unset($_SESSION['kareta_onboarding_verification']);
            kareta_json(['ok' => false, 'error' => 'verification_expired'], 410);
        }
        if ($requestedRole === 'seller') {
            $sellerData['storeName'] = trim((string)($sellerData['storeName'] ?? $input['name'] ?? '')) ?: $displayName;
        }
        $user = [
            'phone' => $phone,
            'name' => $displayName,
            'role' => $requestedRole,
            'entry_role' => $requestedRole,
            'onboarding_stage' => 'done',
            'onboarded' => 1,
            'city' => trim((string)($input['city'] ?? '')),
            'spec' => trim((string)($profileData['specialization'] ?? '')),
            'car' => trim(implode(' ', array_filter([
                (string)($vehicleData['make'] ?? ''),
                (string)($vehicleData['model'] ?? ''),
                (string)($vehicleData['year'] ?? ''),
            ]))),
        ];
        if (!$pdo instanceof PDO) {
            kareta_json(['ok' => false, 'error' => 'database_unavailable', 'requestId' => KARETA_REQUEST_ID], 503);
        }

        // Save the core user first. Role-specific profile tables are secondary and must
        // never prevent account creation (some of them evolve schema with ALTER TABLE,
        // which implicitly commits transactions in MySQL).
        try {
            $profile = kareta_upsert_profile($pdo, $user);
        } catch (Throwable $error) {
            kareta_log_error('ONBOARDING_CORE_PROFILE', KARETA_REQUEST_ID . ' ' . $error->getMessage());
            kareta_json(['ok' => false, 'error' => 'profile_save_failed', 'requestId' => KARETA_REQUEST_ID], 500);
        }

        $sellerProfile = null;
        $profileWarnings = [];
        try {
            kareta_safe_sync_user_entity($pdo, (string)($profile['phone'] ?? $phone));
            kareta_sync_compact_role_profile($pdo, $profile, $profileData, $vehicleData);
        } catch (Throwable $error) {
            $profileWarnings[] = 'role_profile_sync_failed';
            kareta_log_error('ONBOARDING_ROLE_PROFILE', KARETA_REQUEST_ID . ' ' . $error->getMessage());
        }
        $grantedRole = (string)($profile['role'] ?? 'client');
        if ($requestedRole === 'seller' && $grantedRole === 'seller') {
            try {
                $sellerProfile = kareta_upsert_seller_profile($pdo, $profile, $sellerData);
            } catch (Throwable $error) {
                $profileWarnings[] = 'seller_profile_sync_failed';
                kareta_log_error('ONBOARDING_SELLER_PROFILE', KARETA_REQUEST_ID . ' ' . $error->getMessage());
            }
        }
        if ((int)($profile['active'] ?? 1) !== 1) {
            kareta_json(['ok' => false, 'error' => 'account_blocked'], 403);
        }
        session_regenerate_id(true);
        $profile['access'] = kareta_role_access_payload($grantedRole);
        $_SESSION['kareta_user'] = $profile;
        unset($_SESSION['kareta_onboarding_verification']);
        $cookieExpires=time()+60*60*24*KARETA_APP['cookie_days'];
        setcookie('kareta_phone',$profile['phone'],kareta_auth_cookie_options($cookieExpires));
        setcookie('kareta_role',$grantedRole,kareta_auth_cookie_options($cookieExpires));
        setcookie('kareta_onb_done','1',kareta_auth_cookie_options($cookieExpires));
        $identity = null;
        try {
            $identity = (new KaretaOnboardingIdentityBridge($pdo))->establish($profile,$requestedRole);
        } catch (Throwable $error) {
            $profileWarnings[] = 'identity_session_degraded';
            kareta_log_error('ONBOARDING_IDENTITY_SESSION_DEGRADED', KARETA_REQUEST_ID . ' ' . $error->getMessage());
        }
        $profile['entry_role']=$requestedRole;
        $_SESSION['kareta_user']=$profile;
        setcookie('kareta_entry_role',$requestedRole,kareta_auth_cookie_options($cookieExpires));
        $entryActivationStatus=$requestedRole==='master'?'active':(in_array($requestedRole,['sto','seller'],true)&&$grantedRole!==$requestedRole?'pending':'active');
        kareta_json(['ok' => true, 'confirmed' => true, 'user' => $profile, 'access' => $profile['access'], 'identity' => $identity, 'selectedRole'=>$requestedRole, 'entryRole'=>$requestedRole, 'postAuth'=>is_array($identity)?($identity['postAuth']??null):null, 'identityDegraded'=>$identity===null, 'sellerProfile' => $sellerProfile, 'roleApplication'=>in_array($requestedRole,['master','sto','seller'],true)&&$grantedRole!==$requestedRole?['requestedRole'=>$requestedRole,'status'=>$entryActivationStatus]:null, 'warnings' => $profileWarnings, 'requestId' => KARETA_REQUEST_ID, 'dbReady' => kareta_db_ready()]);
    }
    kareta_json(['ok'=>false,'error'=>'unknown_action','requestId'=>KARETA_REQUEST_ID],404);
}

kareta_json(['ok' => false, 'error' => 'Method not allowed'], 405);
