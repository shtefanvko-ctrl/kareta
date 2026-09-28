<?php
declare(strict_types=1);

require_once __DIR__ . '/authorization_pipeline.php';

/**
 * Stage 15B compatibility bridge.
 * Canonical capability authorization is authoritative. Legacy role fallback is
 * allowed only when no Identity account can be resolved yet.
 */
final class KaretaLegacyApiBridge
{
    public static function require(PDO $pdo, string $capability, array $legacyRoles = [], array $resource = []): array
    {
        try {
            $decision = kareta_authorize($pdo, $capability, $resource, function_exists('kareta_current_user') ? (kareta_current_user() ?: null) : null);
            self::audit($pdo, $capability, 'identity', 'allow', $legacyRoles);
            return [
                'mode' => 'identity',
                'accountId' => $decision->accountId,
                'personId' => $decision->personId,
                'contextId' => $decision->contextId,
                'context' => $decision->context,
                'capabilities' => $decision->capabilities,
            ];
        } catch (DomainException $error) {
            $code = $error->getMessage();
            if (!in_array($code, ['session_required', 'identity_account_unavailable'], true)) {
                self::audit($pdo, $capability, 'identity', 'deny:' . $code, $legacyRoles);
                throw $error;
            }
        }

        if ($legacyRoles !== [] && function_exists('kareta_require_any_role')) {
            $user = kareta_require_any_role($legacyRoles);
            self::audit($pdo, $capability, 'legacy-fallback', 'allow', $legacyRoles);
            return ['mode' => 'legacy-fallback', 'legacyUser' => $user, 'context' => null, 'capabilities' => []];
        }

        self::audit($pdo, $capability, 'none', 'deny:session_required', $legacyRoles);
        throw new DomainException('session_required');
    }

    public static function optional(PDO $pdo, string $capability, array $legacyRoles = []): ?array
    {
        try { return self::require($pdo, $capability, $legacyRoles); }
        catch (Throwable $_) { return null; }
    }

    private static function audit(PDO $pdo, string $capability, string $mode, string $decision, array $legacyRoles): void
    {
        try {
            $stmt = $pdo->prepare("INSERT INTO api_legacy_bridge_audit(capability,mode,decision,legacy_roles_json,request_method,request_path,request_id) VALUES(?,?,?,?,?,?,?)");
            $stmt->execute([
                substr($capability, 0, 120), substr($mode, 0, 32), substr($decision, 0, 80),
                json_encode(array_values($legacyRoles), JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
                (string)($_SERVER['REQUEST_METHOD'] ?? ''), substr((string)($_SERVER['REQUEST_URI'] ?? ''), 0, 255),
                defined('KARETA_REQUEST_ID') ? KARETA_REQUEST_ID : null,
            ]);
        } catch (Throwable $_) {}
    }
}

function kareta_require_api_capability(PDO $pdo, string $capability, array $legacyRoles = [], array $resource = []): array
{
    try { return KaretaLegacyApiBridge::require($pdo, $capability, $legacyRoles, $resource); }
    catch (DomainException $e) {
        $code = $e->getMessage();
        $status = in_array($code, ['session_required','identity_account_unavailable'], true) ? 401 : 403;
        kareta_json(['ok'=>false,'error'=>$code,'capability'=>$capability,'stage'=>'15B'], $status);
    }
}


function kareta_resolve_api_actor(PDO $pdo): array
{
    static $cached = null;
    if (is_array($cached)) return $cached;
    try {
        $auth = (new KaretaAuthResolver($pdo))->resolve(true);
        $phone = trim((string)($auth->account['phone'] ?? $auth->identitySession['phone'] ?? $auth->legacyUser['phone'] ?? ''));
        $legacyRole = strtolower(trim((string)($auth->legacyUser['role'] ?? '')));
        $context = is_array($auth->context) ? $auth->context : [];
        $type = strtolower(trim((string)($context['type'] ?? 'personal')));
        $profileType = strtolower(trim((string)($context['profileType'] ?? $context['profile_type'] ?? '')));
        $organizationType = strtolower(trim((string)($context['organizationType'] ?? $context['organization_type'] ?? '')));
        $role = 'client';
        if (in_array($legacyRole, ['admin','owner'], true)) $role = $legacyRole;
        elseif ($type === 'profile' && $profileType === 'master') $role = 'master';
        elseif ($type === 'profile' && $profileType === 'seller') $role = 'seller';
        elseif ($type === 'organization') {
            if (in_array($organizationType, ['store','shop','parts_store','seller'], true)) $role = 'seller';
            else $role = 'sto';
        }
        $uid = (int)($auth->legacyUser['id'] ?? 0);
        $name = trim((string)($auth->legacyUser['name'] ?? $auth->account['fullname'] ?? ''));
        if ($uid <= 0 && $phone !== '') {
            try {
                $st = $pdo->prepare("SELECT id,name,role FROM users WHERE phone=? AND active=1 LIMIT 1");
                $st->execute([$phone]);
                $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
                $uid = (int)($row['id'] ?? 0);
                if ($name === '') $name = trim((string)($row['name'] ?? ''));
                if ($type === 'personal' && in_array(strtolower((string)($row['role'] ?? '')), ['admin','owner'], true)) $role = strtolower((string)$row['role']);
            } catch (Throwable $_) {}
        }
        $cached = [
            'mode'=>$auth->mode,
            'accountId'=>$auth->accountId,
            'personId'=>$auth->personId,
            'contextId'=>(int)($context['id'] ?? 0),
            'context'=>$context,
            'capabilities'=>$auth->capabilities,
            'deniedCapabilities'=>$auth->deniedCapabilities,
            'id'=>$uid,
            'phone'=>$phone,
            'name'=>$name,
            'role'=>$role,
            'legacyUser'=>$auth->legacyUser,
        ];
        return $cached;
    } catch (DomainException $e) {
        throw $e;
    }
}

function kareta_require_api_session(PDO $pdo, array $allowedRoles = []): array
{
    try {
        $actor = kareta_resolve_api_actor($pdo);
        if ($allowedRoles !== [] && !in_array((string)$actor['role'], $allowedRoles, true)) {
            throw new DomainException('role_not_allowed');
        }
        return $actor;
    } catch (DomainException $e) {
        $code = $e->getMessage();
        $status = in_array($code, ['session_required','identity_account_unavailable'], true) ? 401 : 403;
        kareta_json(['ok'=>false,'error'=>$code,'stage'=>'identity_session'], $status);
    }
}
