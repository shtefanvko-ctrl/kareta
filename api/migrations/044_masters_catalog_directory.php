<?php
return [
    'version'=>44,
    'note'=>'public masters and STO directory fields and demo metrics',
    'run'=>function(PDO $pdo): void {
        $columns = [];
        try { $columns = array_column($pdo->query("SHOW COLUMNS FROM `masters`")->fetchAll(PDO::FETCH_ASSOC), 'Field'); } catch(Throwable $_e) {}
        $add = [
            'rating'=>"ALTER TABLE `masters` ADD COLUMN `rating` DECIMAL(3,1) NOT NULL DEFAULT 4.8",
            'orders_count'=>"ALTER TABLE `masters` ADD COLUMN `orders_count` INT UNSIGNED NOT NULL DEFAULT 0",
            'experience_label'=>"ALTER TABLE `masters` ADD COLUMN `experience_label` VARCHAR(191) NOT NULL DEFAULT ''",
            'description'=>"ALTER TABLE `masters` ADD COLUMN `description` TEXT NULL DEFAULT NULL",
        ];
        foreach($add as $name=>$sql) if(!in_array($name,$columns,true)) { try{$pdo->exec($sql);}catch(Throwable $_e){} }
        $pdo->exec("UPDATE masters SET rating=CASE id WHEN 'demo-master-1' THEN 4.9 WHEN 'demo-master-2' THEN 4.8 WHEN 'demo-master-3' THEN 4.9 WHEN 'demo-master-4' THEN 4.7 WHEN 'demo-master-5' THEN 4.8 ELSE rating END, orders_count=CASE id WHEN 'demo-master-1' THEN 184 WHEN 'demo-master-2' THEN 147 WHEN 'demo-master-3' THEN 213 WHEN 'demo-master-4' THEN 96 WHEN 'demo-master-5' THEN 132 ELSE orders_count END, experience_label=CASE id WHEN 'demo-master-1' THEN '9 лет опыта' WHEN 'demo-master-2' THEN '11 лет опыта' WHEN 'demo-master-3' THEN '8 лет опыта' WHEN 'demo-master-4' THEN '7 лет опыта' WHEN 'demo-master-5' THEN '10 лет опыта' ELSE experience_label END WHERE id LIKE 'demo-master-%'");
        try { $pdo->exec("UPDATE sto_profiles SET rating=CASE id WHEN 'demo-sto-1' THEN 4.9 WHEN 'demo-sto-2' THEN 4.8 WHEN 'demo-sto-3' THEN 4.7 WHEN 'demo-sto-4' THEN 4.8 WHEN 'demo-sto-5' THEN 4.9 ELSE rating END, orders_count=CASE id WHEN 'demo-sto-1' THEN 1180 WHEN 'demo-sto-2' THEN 860 WHEN 'demo-sto-3' THEN 690 WHEN 'demo-sto-4' THEN 520 WHEN 'demo-sto-5' THEN 940 ELSE orders_count END WHERE id LIKE 'demo-sto-%'"); } catch(Throwable $_e) {}
    },
];
