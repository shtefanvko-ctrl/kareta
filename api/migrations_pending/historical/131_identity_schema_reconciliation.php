<?php
declare(strict_types=1);

return [
    'version' => 131,
    'note' => 'R188.5.5.6.84.26: reconcile Identity schema after historical migration-version collisions',
    'run' => static function (PDO $pdo): void {
        $root = __DIR__;
        $repairVersions = [72, 128, 129, 130];
        $files = [
            72 => '072_identity_core_stage1.php',
            128 => '128_master_first_entry_onboarding.php',
            129 => '129_client_first_entry_state.php',
            130 => '130_account_type_profile_lifecycle.php',
        ];

        // Production has had parallel full-build branches where the same migration
        // number could carry a different checksum. Applied historical versions must
        // never be blindly rerun by the normal runner. Migration 131 is the explicit
        // reconciliation point: execute only the current idempotent schema builders
        // needed by the active Identity contract under a new, unambiguous version.
        foreach ($repairVersions as $version) {
            $file = $root . '/' . $files[$version];
            if (!is_file($file) || !is_readable($file)) {
                throw new RuntimeException('Identity schema reconciliation source missing: ' . basename($file));
            }
            $migration = require $file;
            if (!is_array($migration) || (int)($migration['version'] ?? 0) !== $version || !is_callable($migration['run'] ?? null)) {
                throw new RuntimeException('Identity schema reconciliation source invalid: ' . basename($file));
            }
            ($migration['run'])($pdo);
        }

        require_once dirname(__DIR__) . '/identity/schema_contract.php';
        $contract = KaretaSchemaContract::inspect($pdo);
        KaretaSchemaContract::record($pdo, $contract, 'migration_131_reconciliation');
        if (!$contract['ok']) {
            throw new RuntimeException(
                'Schema reconciliation incomplete: tables=' . implode(',', $contract['missingTables'])
                . '; columns=' . implode(',', $contract['missingColumns'])
            );
        }
    },
];
