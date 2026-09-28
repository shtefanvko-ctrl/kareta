<?php
declare(strict_types=1);
return [
 'version'=>91,
 'note'=>'R187.2 schema contract and startup recovery audit',
 'run'=>static function(PDO $pdo):void{
   $pdo->exec("CREATE TABLE IF NOT EXISTS schema_contract_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source_name VARCHAR(64) NOT NULL,
      status ENUM('ok','failed') NOT NULL,
      missing_tables_json JSON NULL,
      missing_columns_json JSON NULL,
      checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_schema_contract_checked (checked_at),
      KEY idx_schema_contract_status (status,checked_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
