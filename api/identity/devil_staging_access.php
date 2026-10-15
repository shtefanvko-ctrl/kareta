<?php
declare(strict_types=1);

/**
 * Staging-only experimental feature access.
 *
 * This guard is ADDITIONAL to each operation's existing permissions, CSRF,
 * ownership and idempotency checks. Import and call kareta_devil_require_tester()
 * before entering an experimental server action. Never trust a client-side
 * feature flag, role, URL or cookie to grant this entitlement.
 */
require_once __DIR__ . '/session_service.php';

/**
 * Pure allowlist predicate for defensive unit testing.
 * Empty/malformed allowlists fail closed, including any invalid entry.
 *
 * @param mixed $configuredIds Private-config comma-separated account IDs.
 */
function kareta_devil_staging_allows_account(string $environment, ?int $accountId, $configuredIds): bool
{
    if ($environment !== 'staging' || $accountId === null || $accountId <= 0) return false;
    if (!is_string($configuredIds)) return false;

    $raw = trim($configuredIds);
    if ($raw === '' || strlen($raw) > 4096) return false;
    if (!preg_match('/\\A[1-9][0-9]*(?:[ \\t]*,[ \\t]*[1-9][0-9]*)*\\z/D', $raw)) return false;

    $matched = false;
    foreach (explode(',', $raw) as $entry) {
        $candidate = filter_var(trim($entry), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($candidate === false) return false;
        if ($candidate === $accountId) $matched = true;
    }
    return $matched;
}

/**
 * Requires an actual, database-validated KARETA identity session.
 *
 * Throws DomainException:
 * - devil_not_available -> HTTP 404 (production/development/test)
 * - session_required -> HTTP 401
 * - devil_tester_denied -> HTTP 403
 *
 * The calling endpoint must map these codes to HTTP status and must still
 * enforce its normal resource capability/ownership checks.
 */
function kareta_devil_require_tester(PDO $pdo): int
{
    if (!defined('KARETA_ENVIRONMENT') || KARETA_ENVIRONMENT !== 'staging') {
        throw new DomainException('devil_not_available');
    }

    $session = (new KaretaSessionService($pdo))->current(false);
    $accountId = is_array($session) ? (int)($session['account_id'] ?? 0) : 0;
    if ($accountId <= 0) throw new DomainException('session_required');

    $configuredIds = function_exists('kareta_config_value')
        ? kareta_config_value('KARETA_DEVIL_TESTER_ACCOUNT_IDS', 'devil_tester_account_ids', '')
        : '';

    if (!kareta_devil_staging_allows_account(KARETA_ENVIRONMENT, $accountId, $configuredIds)) {
        throw new DomainException('devil_tester_denied');
    }
    return $accountId;
}
