<?php
declare(strict_types=1);

return [
    'app_name' => 'KARETA.KZ',
    'base_url' => '/',
    'booking_phone' => '+77000000000',

    'db_host' => '127.0.0.1',
    'db_port' => 3306,
    'db_name' => 'database_name',
    'db_user' => 'database_user',
    'db_pass' => 'database_password',
    'db_charset' => 'utf8mb4',
    'db_auto_create' => false,
    'db_auto_migrate' => false,
    // Safe default for PHP-FPM/Plesk. Dedicated infrastructure may opt into 'sse'.
    'realtime_transport' => 'poll',
    'realtime_poll_interval_ms' => 15000,
    'realtime_request_timeout_ms' => 8000,

    'runtime_maintenance_interval' => 900,
    'api_max_body_bytes' => 20971520,
    'db_timeout' => 5,
    // Absolute path outside the public document root. PHP must be able to write it.
    'storage_root' => '/var/lib/kareta',

    'environment' => 'production',
    'demo_seed' => false,

    // Production-safe defaults. test_auto is ignored when environment=production.
    'account_type_approval_mode' => 'admin_review',

    // Production accepts only HTTPS webhook delivery. Static/test OTP is blocked
    // even if an obsolete private config accidentally enables it.
    'otp_transport' => 'webhook',
    'otp_test_code' => '',
    'otp_allow_test_fallback' => false,

    // TEMPORARY commissioning override. Disable it when the SMS provider is connected.
    // Leave otp_temp_static_until empty for manual-off mode, or set a deadline explicitly.
    'otp_temp_static_enabled' => true,
    'otp_temp_static_until' => '',

    // Configure the real SMS provider:
    'otp_webhook_url' => 'https://sms-provider.example/send',
    'otp_webhook_token' => 'replace-with-provider-token',
    'otp_sender' => 'KARETA',
    // Generate at least 32 random characters and keep it outside the public repository.
    'diagnostics_token' => 'replace-with-a-long-random-diagnostics-token',
    // Omnichannel messaging. Keep every provider secret in this private file or environment.
    'messaging_enabled' => true,
    'messaging_public_url' => 'https://kareta.kz',
    'messaging_worker_batch' => 25,
    // Keep false in production. Install schema explicitly with tools/messaging_schema_install.php.
    'messaging_auto_schema' => false,

    // Telegram Bot API. Configure webhook to /api/webhooks/telegram.php and pass the
    // same secret through setWebhook(secret_token=...).
    'telegram_enabled' => false,
    'telegram_bot_token' => '',
    'telegram_bot_username' => '',
    'telegram_webhook_secret' => '',

    // WhatsApp Business Platform / Cloud API.
    'whatsapp_enabled' => false,
    'whatsapp_access_token' => '',
    'whatsapp_phone_number_id' => '',
    'whatsapp_business_phone' => '',
    'whatsapp_verify_token' => '',
    'whatsapp_app_secret' => '',
    'whatsapp_graph_base_url' => 'https://graph.facebook.com/v23.0',
    // Optional approved template used when a WhatsApp user is outside the service window.
    'whatsapp_template_name' => '',
    'whatsapp_template_language' => 'ru',
];
