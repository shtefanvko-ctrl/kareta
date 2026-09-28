<?php
declare(strict_types=1);
return [
  'version'=>124,
  'note'=>'R188.5.5.6.70: master day operations, auto notifications, automatic schedule recovery and one-off shift extensions',
  'run'=>static function(PDO $pdo): void {
    $hasColumn=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
    if(!$hasColumn('master_schedule_preferences','auto_recovery_enabled'))$pdo->exec("ALTER TABLE master_schedule_preferences ADD COLUMN auto_recovery_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER capacity_warn_pct");
    if(!$hasColumn('master_schedule_preferences','auto_notify_enabled'))$pdo->exec("ALTER TABLE master_schedule_preferences ADD COLUMN auto_notify_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER auto_recovery_enabled");
    if(!$hasColumn('master_schedule_preferences','auto_recovery_mode'))$pdo->exec("ALTER TABLE master_schedule_preferences ADD COLUMN auto_recovery_mode VARCHAR(24) NOT NULL DEFAULT 'auto' AFTER auto_notify_enabled");
    if(!$hasColumn('master_schedule_preferences','auto_recovery_horizon_days'))$pdo->exec("ALTER TABLE master_schedule_preferences ADD COLUMN auto_recovery_horizon_days INT NOT NULL DEFAULT 14 AFTER auto_recovery_mode");
    if(!$hasColumn('master_schedule_preferences','auto_recovery_grace_min'))$pdo->exec("ALTER TABLE master_schedule_preferences ADD COLUMN auto_recovery_grace_min INT NOT NULL DEFAULT 15 AFTER auto_recovery_horizon_days");
    $pdo->exec("CREATE TABLE IF NOT EXISTS master_shift_extensions(
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      master_id VARCHAR(64) NOT NULL,
      work_date DATE NOT NULL,
      extended_end_time TIME NOT NULL,
      note VARCHAR(191) NOT NULL DEFAULT '',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_by_user_id BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_master_shift_extension(master_id,work_date),
      KEY idx_master_shift_extension(master_id,work_date,active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS master_schedule_recovery_events(
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      master_id VARCHAR(64) NOT NULL,
      trigger_type VARCHAR(64) NOT NULL,
      trigger_ref VARCHAR(96) NOT NULL DEFAULT '',
      affected_date DATE NULL,
      moved_count INT NOT NULL DEFAULT 0,
      notified_count INT NOT NULL DEFAULT 0,
      result_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_master_recovery(master_id,created_at),
      KEY idx_master_recovery_date(master_id,affected_date,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  },
];
