<?php
declare(strict_types=1);
return [
 'version'=>49,
 'note'=>'Client cabinet, preferences and demo promotions',
 'run'=>static function(PDO $pdo): void {
   require_once dirname(__DIR__).'/client_cabinet.php';
   kareta_client_cabinet_ensure($pdo);
   $rows=[
    ['promo_diag','Диагностика перед поездкой','Комплексная проверка основных систем автомобиля перед дальней дорогой.','-15%','Выбрать услугу','#/services',10],
    ['promo_parts','Подбор запчастей без ошибок','Поможем найти совместимые детали по автомобилю и заказу.','Подбор','Открыть запчасти','#/parts',20],
    ['promo_history','Цифровая история автомобиля','Сохраняйте ремонты, документы и рекомендации в одном месте.','Бесплатно','Открыть гараж','#/cabinet/garage',30]
   ];
   $st=$pdo->prepare("INSERT INTO client_promotions(id,title,description,badge,action_label,action_url,role_scope,active,sort) VALUES(?,?,?,?,?,?,'client',1,?) ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),badge=VALUES(badge),action_label=VALUES(action_label),action_url=VALUES(action_url),active=1,sort=VALUES(sort)");
   foreach($rows as $r) $st->execute($r);
 }
];
