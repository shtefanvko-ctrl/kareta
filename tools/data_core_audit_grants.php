<?php
declare(strict_types=1);

/**
 * Inspect SHOW GRANTS results without exposing account names or grant statements.
 * Fail closed on roles, write privileges, global SELECT, delegation, or unknown syntax.
 * Only schema-scoped SELECT on db_migrations (or its database) is accepted.
 */
function kareta_data_core_audit_grants_readonly(array $grants, string $schema): bool
{
    if ($schema === '' || !$grants) return false;
    $hasSelect = false;
    foreach ($grants as $grant) {
        if (!is_string($grant) || $grant === '' || stripos($grant, 'WITH GRANT OPTION') !== false) {
            return false;
        }
        if (preg_match('/^GRANT\\s+USAGE\\s+ON\\s+\\*\\.\\*\\s+TO\\s+.+$/iD', $grant)) {
            continue;
        }
        if (!preg_match('/^GRANT\\s+SELECT\\s+ON\\s+(?:\\x60([^\\x60]+)\\x60|([a-zA-Z0-9_]+))\\.(?:\\x60([^\\x60]+)\\x60|(\\*))\\s+TO\\s+.+$/iD', $grant, $m)) {
            return false;
        }
        $grantedDb = ($m[1] ?? '') !== '' ? $m[1] : ($m[2] ?? '');
        $grantedTable = ($m[3] ?? '') !== '' ? $m[3] : ($m[4] ?? '');
        if ($grantedDb !== $schema || !in_array($grantedTable, ['db_migrations', '*'], true)) {
            return false;
        }
        $hasSelect = true;
    }
    return $hasSelect;
}
