<?php
declare(strict_types=1);
return [
 'version'=>48,
 'note'=>'R72.4 work feed, publication media, likes and demo publications',
 'run'=>static function(PDO $pdo):void{
  require_once dirname(__DIR__).'/work_posts.php';
  kareta_work_posts_ensure($pdo);
  if(!function_exists('kareta_table_exists') || !kareta_table_exists($pdo,'orders')) return;
  kareta_ensure_column($pdo,'orders','sto_id',"ALTER TABLE `orders` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `master_name`");
  kareta_ensure_column($pdo,'orders','sto_name',"ALTER TABLE `orders` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `sto_id`");
  $rows=$pdo->query("SELECT id,client_vehicle_id,client_car,vehicle_title,service_names,master_id,sto_id,master_name,sto_name,created_at FROM orders ORDER BY created_at DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC)?:[];
  $ins=$pdo->prepare("INSERT IGNORE INTO work_posts(id,order_id,master_id,sto_id,vehicle_id,post_type,title,summary,body,vehicle_label,service_label,master_name,sto_name,visibility,status,client_consent,published_at) VALUES(?,?,?,?,?,'repair',?,?,?,?,?,?,?,'public','published',1,?)");
  foreach($rows as $r){$vehicle=(string)($r['client_car']?:$r['vehicle_title']?:'Автомобиль');$service=(string)($r['service_names']?:'Выполненная работа');$ins->execute(['work_'.$r['id'],$r['id'],(string)$r['master_id'],(string)$r['sto_id'],(string)$r['client_vehicle_id'],$service.' — '.$vehicle,'Реальная работа из демонстрационного заказ-наряда.','Проведена диагностика, выполнены согласованные работы и контрольная проверка.',$vehicle,$service,(string)$r['master_name'],(string)$r['sto_name'],(string)$r['created_at']]);}
 }
];
