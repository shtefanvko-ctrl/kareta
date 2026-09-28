<?php
return [
 'version'=>67,
 'note'=>'Unified calendar booking, resources and booking lifecycle',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS service_bookings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_key VARCHAR(64) NOT NULL,
    calendar_event_id BIGINT UNSIGNED NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    master_user_id BIGINT UNSIGNED NULL,
    resource_key VARCHAR(128) NULL,
    entity_type VARCHAR(64) NULL,
    entity_key VARCHAR(128) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'confirmed',
    notes TEXT NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_service_booking_key(booking_key),
    UNIQUE KEY uq_service_booking_calendar(calendar_event_id),
    KEY idx_service_booking_owner(owner_user_id,status),
    KEY idx_service_booking_org(organization_id,status),
    KEY idx_service_booking_master(master_user_id,status),
    KEY idx_service_booking_resource(resource_key,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
