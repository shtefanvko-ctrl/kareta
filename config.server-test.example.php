<?php
declare(strict_types=1);

/*
 * KARETA server-test template.
 * Copy to a private location allowed by config.php, then replace DB/token values.
 * Never upload real secrets to Git.
 */
return [
    'app_name' => 'KARETA.KZ',
    'base_url' => '/',
    'booking_phone' => '+77000000000',

    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'kareta_test',
    'db_user' => 'kareta_test',
    'db_pass' => 'replace-with-test-db-password',
    'db_charset' => 'utf8mb4',
    'db_auto_create' => false,
    // Safe Plesk/staging schema upgrades: only missing canonical migrations run.
    // Set false to require manual DB maintenance.
    'db_auto_upgrade' => true,
    'db_auto_migrate' => false,
    'db_timeout' => 5,

    // Prefer an absolute writable path outside public_html.
    'storage_root' => '/var/lib/kareta-test',

    'environment' => 'staging',
    'demo_seed' => false,
    'account_type_approval_mode' => 'admin_review',

    // Test server only. Production example stays webhook/fail-closed.
    'otp_transport' => 'test_static',
    'otp_test_code' => '0000',
    'otp_allow_test_fallback' => true,
    'otp_temp_static_enabled' => false,
    'otp_temp_static_until' => '',

    'otp_webhook_url' => '',
    'otp_webhook_token' => '',
    'otp_sender' => 'KARETA',

    'diagnostics_token' => 'replace-with-at-least-32-random-characters',

    'messaging_enabled' => false,
    'messaging_public_url' => 'https://s.kareta.kz',
    'messaging_worker_batch' => 25,
    'messaging_auto_schema' => false,

    'telegram_enabled' => false,
    'telegram_bot_token' => '',
    'telegram_bot_username' => '',
    'telegram_webhook_secret' => '',

    'whatsapp_enabled' => false,
    'whatsapp_access_token' => '',
    'whatsapp_phone_number_id' => '',
    'whatsapp_business_phone' => '',
    'whatsapp_verify_token' => '',
    'whatsapp_app_secret' => '',
    'whatsapp_graph_base_url' => 'https://graph.facebook.com/v23.0',
    'whatsapp_template_name' => '',
    'whatsapp_template_language' => 'ru',
];
