<?php
declare(strict_types=1);
return [
    'version'=>123,
    'note'=>'R188.5.5.6.69.1: admin-editable four tariff plans and paid KARETA PRO naming',
    'run'=>static function(PDO $pdo): void {
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'account_tariff_plans')){
            if(function_exists('kareta_column_exists')&&!kareta_column_exists($pdo,'account_tariff_plans','is_paid'))$pdo->exec("ALTER TABLE account_tariff_plans ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0 AFTER monthly_price");
            $plans=[
              ['client_start','client','Клиент','Обычный тариф клиента для заявок, гаража, истории и чатов.',0,0,'{"activeRequests":3,"vehicles":3}',10],
              ['client_plus','client','KARETA PRO','Платный тариф клиента с расширенными лимитами аккаунта.',null,1,'{"activeRequests":10,"vehicles":10}',20],
              ['master_start','master','Мастер','Обычный рабочий тариф Мастера с контролем фактической загрузки.',0,0,'{"acceptedRequestsPerDay":3,"activeIntakesPerDay":3,"openRepairs":10}',10],
              ['master_pro','master','KARETA PRO','Платный тариф Мастера с расширенной рабочей ёмкостью.',null,1,'{"acceptedRequestsPerDay":10,"activeIntakesPerDay":10,"openRepairs":30}',20],
            ];
            $up=$pdo->prepare("UPDATE account_tariff_plans SET account_type=?,name=?,description=?,monthly_price=IF(?=1,COALESCE(monthly_price,?),0),is_paid=?,sort_order=?,active=1 WHERE code=?");
            foreach($plans as $p){[$code,$type,$name,$description,$price,$paid,$limits,$sort]=$p;$up->execute([$type,$name,$description,$paid,$price,$paid,$sort,$code]);$exists=$pdo->prepare("SELECT COUNT(*) FROM account_tariff_plans WHERE code=?");$exists->execute([$code]);if(!(int)$exists->fetchColumn()){$features=$type==='master'?'{"exchange":"Биржа заявок","services":"Мои услуги и свои цены","calendar":"Рабочий календарь","chats":"Чаты и заказ-наряд"}':'{"requests":"Заявки на ремонт","garage":"Цифровой гараж","history":"История обслуживания","chats":"Чаты с исполнителями"}';$pdo->prepare("INSERT INTO account_tariff_plans(code,account_type,name,description,monthly_price,is_paid,limits_json,features_json,active,sort_order) VALUES(?,?,?,?,?,?,?,?,1,?)")->execute([$code,$type,$name,$description,$price,$paid,$limits,$features,$sort]);}}
        }
    },
];
