<?php
declare(strict_types=1);
return [
 'version'=>51,
 'note'=>'R73.6 master schedule planning, average repair time and intake buffer',
 'run'=>static function(PDO $pdo):void{
  $pdo->exec("CREATE TABLE IF NOT EXISTS master_schedule_preferences (
    master_id VARCHAR(64) PRIMARY KEY,
    intake_buffer_min INT NOT NULL DEFAULT 60,
    default_repair_min INT NOT NULL DEFAULT 120,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS master_order_plans (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    master_id VARCHAR(64) NOT NULL,
    vehicle_id VARCHAR(64) NOT NULL DEFAULT '',
    planned_start DATETIME NULL,
    planned_end DATETIME NULL,
    estimated_repair_min INT NOT NULL DEFAULT 120,
    buffer_min INT NOT NULL DEFAULT 60,
    actual_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_master_order_plan(order_id),
    KEY idx_master_plan(master_id,planned_start)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'masters')){
    $ids=$pdo->query("SELECT id FROM masters WHERE active=1")->fetchAll(PDO::FETCH_COLUMN)?:[];
    $st=$pdo->prepare("INSERT IGNORE INTO master_schedule_preferences(master_id,intake_buffer_min,default_repair_min) VALUES(?,60,120)");
    foreach($ids as $id)$st->execute([(string)$id]);
  }
 }
];
