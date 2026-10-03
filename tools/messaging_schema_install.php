<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
require_once dirname(__DIR__) . '/api/bootstrap.php';
require_once dirname(__DIR__) . '/api/messaging_core.php';

$pdo = kareta_pdo();
if (!$pdo instanceof PDO) { fwrite(STDERR, "database_unavailable\n"); exit(2); }

try {
    kareta_messaging_install_schema($pdo);
    // Validate through the same runtime guard used by API/webhooks/worker.
    kareta_messaging_schema($pdo);
    kareta_messaging_whatsapp_schema($pdo);
    fwrite(STDOUT, "KARETA Messaging schema installed and verified.\n");
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, "Messaging schema install failed: " . $e->getMessage() . "\n");
    exit(3);
}
