<?php
declare(strict_types=1);
return ['version'=>57,'note'=>'vehicle maintenance, consumables, tires, battery and warranties','run'=>static function(PDO $pdo):void{
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_maintenance_items(
      id VARCHAR(64) PRIMARY KEY,
      vehicle_id VARCHAR(64) NOT NULL,
      item_type VARCHAR(32) NOT NULL,
      title VARCHAR(191) NOT NULL,
      brand VARCHAR(120) NOT NULL DEFAULT '',
      model VARCHAR(120) NOT NULL DEFAULT '',
      installed_at DATE NULL,
      installed_mileage_km INT NULL,
      next_due_at DATE NULL,
      next_due_mileage_km INT NULL,
      warranty_until DATE NULL,
      note VARCHAR(500) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vmi_vehicle(vehicle_id,item_type,status),
      INDEX idx_vmi_due(next_due_at,next_due_mileage_km)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_expenses(
      id VARCHAR(64) PRIMARY KEY,
      vehicle_id VARCHAR(64) NOT NULL,
      source_order_id VARCHAR(64) NOT NULL DEFAULT '',
      expense_type VARCHAR(32) NOT NULL DEFAULT 'service',
      title VARCHAR(191) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      expense_date DATE NOT NULL,
      note VARCHAR(500) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_vehicle_expenses(vehicle_id,expense_date),
      INDEX idx_vehicle_expenses_order(source_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS vehicle_warranties(
      id VARCHAR(64) PRIMARY KEY,
      vehicle_id VARCHAR(64) NOT NULL,
      source_order_id VARCHAR(64) NOT NULL DEFAULT '',
      title VARCHAR(191) NOT NULL,
      provider_name VARCHAR(191) NOT NULL DEFAULT '',
      starts_at DATE NULL,
      expires_at DATE NULL,
      mileage_limit_km INT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      note VARCHAR(500) NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vehicle_warranty(vehicle_id,status,expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}];
