<?php
declare(strict_types=1);
return ['version'=>85,'note'=>'R186.5 stage 14C unified auth resolver and conflict audit','run'=>static function(PDO $pdo):void{
 $pdo->exec("CREATE TABLE IF NOT EXISTS auth_resolver_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NULL,
  decision VARCHAR(24) NOT NULL,
  reason VARCHAR(80) NOT NULL,
  request_method VARCHAR(12) NOT NULL DEFAULT '',
  request_path VARCHAR(255) NOT NULL DEFAULT '',
  request_id VARCHAR(96) NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id), KEY idx_auth_resolver_account(account_id,created_at), KEY idx_auth_resolver_reason(reason,created_at)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}];
