<?php
return [
 'version'=>63,
 'note'=>'Unified domain entities, events, calendar, payments and notifications',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS domain_entities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_key VARCHAR(128) NOT NULL,
    owner_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    title VARCHAR(255) NOT NULL DEFAULT '',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_domain_entity (entity_type,entity_key),
    KEY idx_domain_owner (owner_user_id,entity_type),
    KEY idx_domain_org (organization_id,entity_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS domain_relations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_type VARCHAR(64) NOT NULL, source_key VARCHAR(128) NOT NULL,
    relation_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL, target_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_domain_relation (source_type,source_key,relation_type,target_type,target_key),
    KEY idx_domain_relation_target (target_type,target_key,relation_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS domain_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(96) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_key VARCHAR(128) NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    payload_json JSON NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_domain_event_aggregate (aggregate_type,aggregate_key,id),
    KEY idx_domain_event_type (event_type,id),
    KEY idx_domain_event_actor (actor_user_id,id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS calendar_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    entity_type VARCHAR(64) NULL, entity_key VARCHAR(128) NULL,
    title VARCHAR(255) NOT NULL,
    starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_calendar_owner (owner_user_id,starts_at),
    KEY idx_calendar_org (organization_id,starts_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS payment_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_key VARCHAR(64) NOT NULL,
    payer_user_id BIGINT UNSIGNED NULL, payee_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    entity_type VARCHAR(64) NULL, entity_key VARCHAR(128) NULL,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'KZT',
    status VARCHAR(32) NOT NULL DEFAULT 'pending', method VARCHAR(32) NOT NULL DEFAULT 'manual',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_key (payment_key),
    KEY idx_payment_entity (entity_type,entity_key),
    KEY idx_payment_payer (payer_user_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS notification_center (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    event_id BIGINT UNSIGNED NULL,
    notification_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL, body TEXT NULL,
    entity_type VARCHAR(64) NULL, entity_key VARCHAR(128) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'unread',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    KEY idx_notification_user (user_id,status,id),
    KEY idx_notification_event (event_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
