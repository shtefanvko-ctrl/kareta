<?php
declare(strict_types=1);
return [
  'version'=>125,
  'note'=>'R188.5.5.6.72: recovery control center, protected bookings and controlled batch rescheduling',
  'run'=>static function(PDO $pdo): void {
    $hasColumn=static function(string $table,string $column)use($pdo):bool{$q=$pdo->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$q->execute([$table,$column]);return (int)$q->fetchColumn()>0;};
    if(!$hasColumn('master_order_plans','auto_recovery_protected'))$pdo->exec("ALTER TABLE master_order_plans ADD COLUMN auto_recovery_protected TINYINT(1) NOT NULL DEFAULT 0 AFTER conflict_override");
    if(!$hasColumn('master_order_plans','auto_recovery_protected_at'))$pdo->exec("ALTER TABLE master_order_plans ADD COLUMN auto_recovery_protected_at DATETIME NULL AFTER auto_recovery_protected");
    if(!$hasColumn('master_order_plans','auto_recovery_protected_by_user_id'))$pdo->exec("ALTER TABLE master_order_plans ADD COLUMN auto_recovery_protected_by_user_id BIGINT UNSIGNED NULL AFTER auto_recovery_protected_at");
    try{$pdo->exec("ALTER TABLE master_order_plans ADD INDEX idx_master_recovery_protected(master_id,auto_recovery_protected,planned_start)");}catch(Throwable $_){}
  },
];
