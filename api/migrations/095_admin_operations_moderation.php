<?php
declare(strict_types=1);
return [
 'version'=>95,
 'note'=>'R188.2 admin operations, moderation and audit',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS admin_operation_audit (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_account_id BIGINT UNSIGNED NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    action_key VARCHAR(96) NOT NULL,
    target_type VARCHAR(48) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    before_json JSON NULL,
    after_json JSON NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    request_id VARCHAR(96) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_admin_audit_actor(actor_account_id,created_at),
    KEY idx_admin_audit_target(target_type,target_id,created_at),
    KEY idx_admin_audit_action(action_key,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS moderation_cases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_key VARCHAR(80) NOT NULL,
    entity_type VARCHAR(48) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    status ENUM('open','approved','rejected','hidden','escalated','closed') NOT NULL DEFAULT 'open',
    priority ENUM('low','normal','high','critical') NOT NULL DEFAULT 'normal',
    reason VARCHAR(500) NOT NULL DEFAULT '',
    payload_json JSON NULL,
    assigned_account_id BIGINT UNSIGNED NULL,
    created_by_account_id BIGINT UNSIGNED NULL,
    resolved_by_account_id BIGINT UNSIGNED NULL,
    resolved_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_moderation_case_key(case_key),
    KEY idx_moderation_status(status,priority,updated_at),
    KEY idx_moderation_entity(entity_type,entity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
