<?php
declare(strict_types=1);
return [
 'version'=>78,
 'note'=>'R186.5 stage 9: API authorization pipeline audit',
 'run'=>static function(PDO $pdo):void{
   $pdo->exec("CREATE TABLE IF NOT EXISTS authorization_pipeline_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id BIGINT UNSIGNED NULL,
      context_id BIGINT UNSIGNED NULL,
      capability_key VARCHAR(160) NOT NULL,
      decision ENUM('allow','deny') NOT NULL,
      reason VARCHAR(96) NOT NULL,
      resource_type VARCHAR(96) NULL,
      resource_key VARCHAR(190) NULL,
      request_method VARCHAR(12) NULL,
      request_path VARCHAR(255) NULL,
      request_id VARCHAR(96) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id),
      KEY idx_authz_account_created(account_id,created_at),
      KEY idx_authz_context_created(context_id,created_at),
      KEY idx_authz_decision_created(decision,created_at),
      CONSTRAINT fk_authz_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      CONSTRAINT fk_authz_context FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
