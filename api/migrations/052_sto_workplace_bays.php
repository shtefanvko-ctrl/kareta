<?php
declare(strict_types=1);
return [
 'version'=>52,
 'note'=>'service station workplace with bays, queue and order assignments',
 'run'=>static function(PDO $pdo):void{
  $pdo->exec("CREATE TABLE IF NOT EXISTS sto_service_bays (id VARCHAR(64) PRIMARY KEY,sto_id VARCHAR(64) NOT NULL,name VARCHAR(120) NOT NULL,code VARCHAR(32) NOT NULL DEFAULT '',capacity INT NOT NULL DEFAULT 1,active TINYINT(1) NOT NULL DEFAULT 1,sort_order INT NOT NULL DEFAULT 0,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_sto_bay(sto_id,code),INDEX idx_sto_bays(sto_id,active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sto_bay_assignments (id VARCHAR(64) PRIMARY KEY,sto_id VARCHAR(64) NOT NULL,bay_id VARCHAR(64) NOT NULL,order_id VARCHAR(64) NOT NULL,master_id VARCHAR(64) NOT NULL DEFAULT '',status VARCHAR(24) NOT NULL DEFAULT 'planned',started_at DATETIME NULL,planned_end DATETIME NULL,released_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_sto_order_active(sto_id,order_id),INDEX idx_bay_status(bay_id,status),INDEX idx_sto_assign(sto_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $stos=$pdo->query("SELECT id FROM sto_profiles WHERE active=1")->fetchAll(PDO::FETCH_COLUMN)?:[];
  $ins=$pdo->prepare("INSERT IGNORE INTO sto_service_bays(id,sto_id,name,code,sort_order) VALUES(?,?,?,?,?)");
  foreach($stos as $sid){for($i=1;$i<=4;$i++)$ins->execute(['bay_'.$sid.'_'.$i,$sid,'Пост '.$i,'P'.$i,$i]);}
 }
];
