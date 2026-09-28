<?php
declare(strict_types=1);
return [
 'version'=>47,
 'note'=>'R72.3 digital vehicle passport, history, documents, issues and recommendations',
 'run'=>static function(PDO $pdo):void{
  $tables=[
   "CREATE TABLE IF NOT EXISTS vehicle_history_events (id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,order_id VARCHAR(64) NOT NULL DEFAULT '',event_type VARCHAR(40) NOT NULL DEFAULT 'service',title VARCHAR(255) NOT NULL,summary TEXT NULL,mileage_km INT NOT NULL DEFAULT 0,amount DECIMAL(12,2) NOT NULL DEFAULT 0,performed_by VARCHAR(191) NOT NULL DEFAULT '',event_at DATETIME NOT NULL,visibility VARCHAR(24) NOT NULL DEFAULT 'owner',meta JSON NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_vhe_vehicle(vehicle_id,event_at),INDEX idx_vhe_order(order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
   "CREATE TABLE IF NOT EXISTS vehicle_documents (id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,document_type VARCHAR(40) NOT NULL DEFAULT 'other',title VARCHAR(191) NOT NULL,file_url VARCHAR(500) NOT NULL DEFAULT '',number_value VARCHAR(120) NOT NULL DEFAULT '',issued_at DATE NULL,expires_at DATE NULL,visibility VARCHAR(24) NOT NULL DEFAULT 'owner',created_by_user_id BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_vdoc_vehicle(vehicle_id),INDEX idx_vdoc_expiry(expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
   "CREATE TABLE IF NOT EXISTS vehicle_issues (id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,order_id VARCHAR(64) NOT NULL DEFAULT '',code_value VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,description TEXT NULL,status VARCHAR(24) NOT NULL DEFAULT 'open',severity VARCHAR(24) NOT NULL DEFAULT 'medium',detected_at DATETIME NOT NULL,resolved_at DATETIME NULL,resolution TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_vi_vehicle(vehicle_id,status),INDEX idx_vi_order(order_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
   "CREATE TABLE IF NOT EXISTS vehicle_recommendations (id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL,source_order_id VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,description TEXT NULL,due_date DATE NULL,due_mileage_km INT NULL,priority VARCHAR(24) NOT NULL DEFAULT 'normal',status VARCHAR(24) NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_vr_vehicle(vehicle_id,status),INDEX idx_vr_due(due_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
   "CREATE TABLE IF NOT EXISTS vehicle_public_tokens (id VARCHAR(64) PRIMARY KEY,vehicle_id VARCHAR(64) NOT NULL UNIQUE,token_hash CHAR(64) NOT NULL UNIQUE,enabled TINYINT(1) NOT NULL DEFAULT 0,show_history TINYINT(1) NOT NULL DEFAULT 1,show_specs TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  ];
  foreach($tables as $sql)$pdo->exec($sql);
  $orders=$pdo->query("SELECT id,client_vehicle_id,client_car,vehicle_title,service_names,price,status,master_name,completed_at,created_at FROM orders WHERE COALESCE(client_vehicle_id,'')<>'' ORDER BY created_at")->fetchAll(PDO::FETCH_ASSOC)?:[];
  $ins=$pdo->prepare("INSERT IGNORE INTO vehicle_history_events(id,vehicle_id,order_id,event_type,title,summary,amount,performed_by,event_at,visibility) VALUES(?,?,?,?,?,?,?,?,?,'owner')");
  foreach($orders as $o){
   $eventAt=(string)($o['completed_at']?:$o['created_at']);
   $ins->execute(['vhe_'.$o['id'],(string)$o['client_vehicle_id'],(string)$o['id'],($o['status']==='completed'?'repair':'service'),(string)($o['service_names']?:'Заказ-наряд'),(string)($o['client_car']?:$o['vehicle_title']?:''),(float)($o['price']??0),(string)($o['master_name']??''),$eventAt]);
  }
  for($i=1;$i<=5;$i++){
   $vehicle='demo-vehicle-'.$i;
   $pdo->prepare("INSERT IGNORE INTO vehicle_recommendations(id,vehicle_id,title,description,due_date,due_mileage_km,priority,status) VALUES(?,?,?,?,DATE_ADD(CURDATE(),INTERVAL ? DAY),?,'normal','active')")
       ->execute(['demo-rec-'.$i,$vehicle,'Плановое техническое обслуживание','Проверить масло, фильтры, тормозную систему и уровень технических жидкостей',30+$i*10,85000+$i*12000]);
   $pdo->prepare("INSERT IGNORE INTO vehicle_documents(id,vehicle_id,document_type,title,expires_at,visibility) VALUES(?,?,?,?,DATE_ADD(CURDATE(),INTERVAL ? DAY),'owner')")
       ->execute(['demo-doc-'.$i,$vehicle,'insurance','Страховой полис',60+$i*20]);
  }
 }
];
