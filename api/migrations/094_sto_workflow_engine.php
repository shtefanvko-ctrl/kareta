<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS sto_workflows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    organization_context_id BIGINT UNSIGNED NULL,
    current_stage VARCHAR(40) NOT NULL DEFAULT 'intake',
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    locked_by_session_id BIGINT UNSIGNED NULL,
    locked_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_sto_workflow_order(order_id),
    KEY idx_sto_workflow_stage(current_stage),
    KEY idx_sto_workflow_context(organization_context_id,current_stage)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sto_workflow_transitions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT UNSIGNED NOT NULL,
    order_id VARCHAR(64) NOT NULL,
    from_stage VARCHAR(40) NOT NULL,
    to_stage VARCHAR(40) NOT NULL,
    actor_account_id BIGINT UNSIGNED NULL,
    actor_context_id BIGINT UNSIGNED NULL,
    reason VARCHAR(500) NOT NULL DEFAULT '',
    meta_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_sto_transition_order(order_id,created_at),
    CONSTRAINT fk_sto_transition_workflow FOREIGN KEY(workflow_id) REFERENCES sto_workflows(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sto_workflow_approvals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    workflow_id BIGINT UNSIGNED NOT NULL,
    approval_type VARCHAR(40) NOT NULL,
    status ENUM('pending','approved','declined','cancelled') NOT NULL DEFAULT 'pending',
    requested_by_account_id BIGINT UNSIGNED NULL,
    decided_by_account_id BIGINT UNSIGNED NULL,
    amount DECIMAL(14,2) NULL,
    payload_json JSON NULL,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    UNIQUE KEY uq_sto_approval(workflow_id,approval_type,status),
    CONSTRAINT fk_sto_approval_workflow FOREIGN KEY(workflow_id) REFERENCES sto_workflows(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};
