<?php
declare(strict_types=1);
return [
 'version'=>46,
 'note'=>'R72.2 master workplace: stage timers, shift dashboard and demo schedules',
 'run'=>static function(PDO $pdo):void{
  $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_timers (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    stage_key VARCHAR(64) NOT NULL,
    master_id VARCHAR(64) NOT NULL DEFAULT '',
    started_by_user_id BIGINT NULL,
    started_at DATETIME NOT NULL,
    stopped_at DATETIME NULL,
    duration_sec INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'running',
    note VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wot_order(order_id,started_at),
    INDEX idx_wot_master(master_id,status),
    INDEX idx_wot_stage(order_id,stage_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS master_shift_notes (
    id VARCHAR(64) PRIMARY KEY,
    master_id VARCHAR(64) NOT NULL,
    work_date DATE NOT NULL,
    note TEXT NULL,
    created_by_user_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_master_shift_note(master_id,work_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'orders')){
    try{$pdo->exec("UPDATE orders SET date=CURDATE(),time='10:00' WHERE id='D0000001'");$pdo->exec("UPDATE orders SET date=CURDATE(),time='14:00' WHERE id='D0000002'");}catch(Throwable $_e){}
  }
  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'masters')){
    $masters=$pdo->query("SELECT id FROM masters WHERE id LIKE 'demo-master-%' ORDER BY id LIMIT 5")->fetchAll(PDO::FETCH_COLUMN) ?: [];
    $schedule=$pdo->prepare("INSERT INTO master_schedules(id,master_id,work_date,start_time,end_time,is_day_off,note) VALUES(?,?,CURDATE(),?,?,0,?) ON DUPLICATE KEY UPDATE start_time=VALUES(start_time),end_time=VALUES(end_time),is_day_off=0,note=VALUES(note)");
    foreach($masters as $i=>$masterId){
      $schedule->execute(['demo-shift-'.($i+1),$masterId,'09:00:00','18:00:00','Рабочая смена: диагностика и ремонт']);
    }
  }
 }
];
