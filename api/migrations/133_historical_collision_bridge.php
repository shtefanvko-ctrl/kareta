<?php
declare(strict_types=1);

/**
 * Compatibility bridge for historical migration version 133.
 *
 * Parallel pre-canonical branches reused versions 130-134 for different operations.
 * Production databases may already contain one of those version markers with a
 * different checksum. The migration runner intentionally does not replay an
 * already-recorded version. Therefore this canonical slot must remain side-effect
 * free; real schema work resumes at version 135.
 */
return [
    'version' => 133,
    'note' => 'R188.5.5.6.84.149 historical migration collision bridge 133',
    'run' => static function (PDO $pdo): void {
        // Deliberate no-op. Preserve historical db_migrations markers safely.
    },
];
