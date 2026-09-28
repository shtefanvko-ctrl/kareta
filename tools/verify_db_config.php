<?php
declare(strict_types=1);
require dirname(__DIR__) . '/config.php';

$errors = [];
if (!defined('KARETA_DB') || !is_array(KARETA_DB)) $errors[] = 'KARETA_DB missing';
if ((string)(KARETA_DB['username'] ?? '') === '') $errors[] = 'DB username is empty';
if ((string)(KARETA_DB['password'] ?? '') === '') $errors[] = 'DB password is empty';
if ((string)(KARETA_DB['database'] ?? '') === '') $errors[] = 'DB name is empty';

$result = [
    'ok' => $errors === [],
    'configurationSource' => defined('KARETA_DB_CONFIG_SOURCE') ? KARETA_DB_CONFIG_SOURCE : 'unknown',
    'privateConfigLoaded' => defined('KARETA_PRIVATE_CONFIG_LOADED') && KARETA_PRIVATE_CONFIG_LOADED,
    'hostConfigured' => trim((string)(KARETA_DB['host'] ?? '')) !== '',
    'databaseConfigured' => trim((string)(KARETA_DB['database'] ?? '')) !== '',
    'usernameConfigured' => trim((string)(KARETA_DB['username'] ?? '')) !== '',
    'passwordConfigured' => ((string)(KARETA_DB['password'] ?? '') !== ''),
    'errors' => $errors,
];
echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), PHP_EOL;
exit($errors === [] ? 0 : 1);
