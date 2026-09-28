<?php
declare(strict_types=1);
return [
 'version'=>45,
 'note'=>'R72 work-order core: checklist, media, publication drafts and demo workflow',
 'run'=>static function(PDO $pdo):void{
  $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_checklist_items (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL,stage_key VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,done TINYINT(1) NOT NULL DEFAULT 0,sort_order INT NOT NULL DEFAULT 0,completed_by_user_id BIGINT NULL,completed_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_woc_order(order_id),INDEX idx_woc_stage(order_id,stage_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_media (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL,stage_key VARCHAR(64) NOT NULL DEFAULT '',media_type VARCHAR(24) NOT NULL DEFAULT 'photo',file_url VARCHAR(500) NOT NULL,caption VARCHAR(500) NOT NULL DEFAULT '',visibility VARCHAR(24) NOT NULL DEFAULT 'client',created_by_user_id BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_wom_order(order_id),INDEX idx_wom_stage(order_id,stage_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS work_order_publication_drafts (id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64) NOT NULL UNIQUE,master_id VARCHAR(64) NOT NULL DEFAULT '',sto_id VARCHAR(64) NOT NULL DEFAULT '',title VARCHAR(255) NOT NULL,body MEDIUMTEXT NULL,status VARCHAR(24) NOT NULL DEFAULT 'draft',visibility VARCHAR(24) NOT NULL DEFAULT 'public',cover_url VARCHAR(500) NOT NULL DEFAULT '',created_by_user_id BIGINT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_wop_master(master_id,status),INDEX idx_wop_sto(sto_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $items=[
   ['diagnosis','Зафиксировать жалобу клиента'],['diagnosis','Считать ошибки и параметры'],['diagnosis','Подтвердить причину неисправности'],
   ['repair','Согласовать стоимость'],['repair','Зафиксировать фото до ремонта'],['repair','Выполнить основные работы'],
   ['quality','Проверить моменты затяжки'],['quality','Выполнить контрольный запуск'],['quality','Провести тест-драйв'],['delivery','Добавить рекомендации клиенту']
  ];
  $st=$pdo->prepare("INSERT IGNORE INTO work_order_checklist_items(id,order_id,stage_key,title,done,sort_order) VALUES(?,?,?,?,?,?)");
  for($o=1;$o<=5;$o++){ $order='D'.str_pad((string)$o,7,'0',STR_PAD_LEFT); foreach($items as $i=>$it){$st->execute(['demo-check-'.$o.'-'.($i+1),$order,$it[0],$it[1],$i<min(3,$o)?1:0,$i+1]);}}
  if(function_exists('kareta_table_exists') && kareta_table_exists($pdo,'orders')){
   try{$pdo->exec("UPDATE orders SET stages=JSON_ARRAY(JSON_OBJECT('id','accepted','label','Автомобиль принят','done',true),JSON_OBJECT('id','diagnosed','label','Диагностика','done',IF(status IN ('accepted','in_progress','completed'),true,false)),JSON_OBJECT('id','started','label','Ремонт','done',IF(status IN ('in_progress','completed'),true,false)),JSON_OBJECT('id','quality','label','Контроль качества','done',IF(status='completed',true,false)),JSON_OBJECT('id','done','label','Работа завершена','done',IF(status='completed',true,false))) WHERE id LIKE 'D000000%'");}catch(Throwable $_e){}
  }
 }
];
