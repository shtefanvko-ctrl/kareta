<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

kareta_json([
    'ok' => false,
    'error' => 'legacy_booking_flow_disabled',
    'message' => 'Публичная запись переведена на модальные окна главной страницы и единый orders.create.',
    'redirect' => '/#home'
], 410);
