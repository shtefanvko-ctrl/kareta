<?php
declare(strict_types=1);
return [
  'version'=>108,
  'note'=>'Production dispatch engine: master load, STO capacity, bay slots, ETA, SLA and automatic reassignment',
  'run'=>static function(PDO $pdo):void{
    $hasColumn=static function(string $table,string $column) use($pdo):bool{
      $s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
      $s->execute([$table,$column]); return (int)$s->fetchColumn()>0;
    };
    if(!$hasColumn('sto_service_bays','bay_type'))$pdo->exec("ALTER TABLE sto_service_bays ADD COLUMN bay_type VARCHAR(32) NOT NULL DEFAULT 'general' AFTER code");
    if(!$hasColumn('sto_service_bays','capability_keys'))$pdo->exec("ALTER TABLE sto_service_bays ADD COLUMN capability_keys TEXT NULL AFTER bay_type");
    if(!$hasColumn('sto_service_bays','slot_minutes'))$pdo->exec("ALTER TABLE sto_service_bays ADD COLUMN slot_minutes INT NOT NULL DEFAULT 30 AFTER capacity");
    if(!$hasColumn('sto_service_bays','daily_capacity_min'))$pdo->exec("ALTER TABLE sto_service_bays ADD COLUMN daily_capacity_min INT NOT NULL DEFAULT 600 AFTER slot_minutes");
    if(!$hasColumn('sto_bay_assignments','planned_start'))$pdo->exec("ALTER TABLE sto_bay_assignments ADD COLUMN planned_start DATETIME NULL AFTER status");
    if(!$hasColumn('sto_bay_assignments','estimated_minutes'))$pdo->exec("ALTER TABLE sto_bay_assignments ADD COLUMN estimated_minutes INT NOT NULL DEFAULT 120 AFTER planned_end");
    if(!$hasColumn('sto_bay_assignments','priority_score'))$pdo->exec("ALTER TABLE sto_bay_assignments ADD COLUMN priority_score DECIMAL(8,2) NOT NULL DEFAULT 0 AFTER estimated_minutes");
    try{$pdo->exec("ALTER TABLE sto_bay_assignments ADD INDEX idx_sto_bay_plan(sto_id,bay_id,status,planned_start,planned_end)");}catch(Throwable $_){}

    $pdo->exec("CREATE TABLE IF NOT EXISTS master_dispatch_settings (
      master_id VARCHAR(64) PRIMARY KEY,
      shift_capacity_min INT NOT NULL DEFAULT 480,
      max_concurrent_orders INT NOT NULL DEFAULT 2,
      response_sla_min INT NOT NULL DEFAULT 20,
      overload_threshold_pct INT NOT NULL DEFAULT 105,
      preferred_radius_km INT NOT NULL DEFAULT 30,
      auto_reassign_enabled TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS sto_dispatch_settings (
      sto_id VARCHAR(64) PRIMARY KEY,
      response_sla_min INT NOT NULL DEFAULT 15,
      overload_threshold_pct INT NOT NULL DEFAULT 100,
      auto_reassign_enabled TINYINT(1) NOT NULL DEFAULT 1,
      reassign_score_delta INT NOT NULL DEFAULT 12,
      default_job_min INT NOT NULL DEFAULT 120,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_dispatch_state (
      order_id VARCHAR(64) PRIMARY KEY,
      sto_id VARCHAR(64) NOT NULL DEFAULT '',
      master_id VARCHAR(64) NOT NULL DEFAULT '',
      bay_id VARCHAR(64) NOT NULL DEFAULT '',
      status VARCHAR(24) NOT NULL DEFAULT 'queued',
      estimated_minutes INT NOT NULL DEFAULT 120,
      priority_score DECIMAL(8,2) NOT NULL DEFAULT 0,
      match_score DECIMAL(8,2) NOT NULL DEFAULT 0,
      load_pct DECIMAL(8,2) NOT NULL DEFAULT 0,
      queued_at DATETIME NULL,
      planned_start DATETIME NULL,
      planned_end DATETIME NULL,
      eta_start DATETIME NULL,
      eta_end DATETIME NULL,
      sla_due_at DATETIME NULL,
      first_response_at DATETIME NULL,
      reassign_count INT NOT NULL DEFAULT 0,
      last_ranked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_dispatch_sto_queue(sto_id,status,priority_score,queued_at),
      KEY idx_dispatch_master_plan(master_id,status,planned_start),
      KEY idx_dispatch_sla(status,sla_due_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_dispatch_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      sto_id VARCHAR(64) NOT NULL DEFAULT '',
      from_master_id VARCHAR(64) NOT NULL DEFAULT '',
      to_master_id VARCHAR(64) NOT NULL DEFAULT '',
      event_type VARCHAR(48) NOT NULL,
      reason VARCHAR(255) NOT NULL DEFAULT '',
      payload_json LONGTEXT NULL,
      actor_user_id BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_dispatch_events_order(order_id,created_at),
      KEY idx_dispatch_events_sto(sto_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("INSERT IGNORE INTO master_dispatch_settings(master_id) SELECT id FROM masters WHERE active=1");
    $pdo->exec("INSERT IGNORE INTO sto_dispatch_settings(sto_id) SELECT id FROM sto_profiles WHERE active=1");
    $pdo->exec("UPDATE sto_service_bays SET bay_type=CASE WHEN code IN ('P1','P2') THEN 'lift' WHEN code='P3' THEN 'diagnostic' ELSE bay_type END WHERE bay_type='general' OR bay_type=''");
  }
];
