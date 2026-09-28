<?php
declare(strict_types=1);
return [
    'version'=>121,
    'note'=>'R188.5.5.6.68: client/master tariff plans and master acceptance capacity limits',
    'run'=>static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS account_tariff_plans(
          code VARCHAR(40) NOT NULL PRIMARY KEY,
          account_type VARCHAR(16) NOT NULL,
          name VARCHAR(120) NOT NULL,
          description VARCHAR(500) NOT NULL DEFAULT '',
          monthly_price DECIMAL(12,2) NULL,
          limits_json TEXT NOT NULL,
          features_json TEXT NOT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_tariff_plan_type(account_type,active,sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS account_tariff_assignments(
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          subject_type VARCHAR(16) NOT NULL,
          subject_id VARCHAR(64) NOT NULL,
          plan_code VARCHAR(40) NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          starts_at DATETIME NULL,
          ends_at DATETIME NULL,
          assigned_by_user_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_tariff_subject(subject_type,subject_id),
          KEY idx_tariff_assignment_plan(plan_code,status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS account_tariff_usage_events(
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          subject_type VARCHAR(16) NOT NULL,
          subject_id VARCHAR(64) NOT NULL,
          metric VARCHAR(40) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          usage_date DATE NOT NULL,
          source VARCHAR(64) NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_tariff_usage_entity(subject_type,subject_id,metric,entity_id),
          KEY idx_tariff_usage_day(subject_type,subject_id,metric,usage_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $plans=[
          ['client_start','client','Клиент Старт','Базовый личный аккаунт для заявок, гаража, истории и чатов.',0,'{"activeRequests":3,"vehicles":3}','{"requests":"Заявки на ремонт","garage":"Цифровой гараж","history":"История обслуживания","chats":"Чаты с исполнителями"}',10],
          ['client_plus','client','Клиент Plus','Расширенные лимиты для нескольких автомобилей и параллельных сервисных задач.',null,'{"activeRequests":10,"vehicles":10}','{"requests":"До 10 активных заявок","garage":"До 10 автомобилей","history":"Полная история обслуживания","chats":"Чаты и уведомления"}',20],
          ['master_start','master','Мастер Старт','Рабочий тариф для частного Мастера с контролем фактической загрузки.',0,'{"acceptedRequestsPerDay":3,"activeIntakesPerDay":3,"openRepairs":10}','{"exchange":"Биржа заявок","services":"Мои услуги и свои цены","calendar":"Рабочий календарь","chats":"Чаты и заказ-наряд"}',10],
          ['master_pro','master','Мастер Pro','Расширенная загрузка для Мастера с большим ежедневным потоком.',null,'{"acceptedRequestsPerDay":10,"activeIntakesPerDay":10,"openRepairs":30}','{"exchange":"Расширенный поток Биржи","services":"Мои услуги и свои нормативы","calendar":"Расширенная дневная загрузка","chats":"Чаты и заказ-наряд"}',20],
        ];
        $up=$pdo->prepare("INSERT INTO account_tariff_plans(code,account_type,name,description,monthly_price,limits_json,features_json,sort_order) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE account_type=VALUES(account_type),name=VALUES(name),description=VALUES(description),monthly_price=VALUES(monthly_price),limits_json=VALUES(limits_json),features_json=VALUES(features_json),active=1,sort_order=VALUES(sort_order)");
        foreach($plans as $p)$up->execute($p);
        // Backfill already accepted work so deployment cannot reset today's base-plan quota.
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'master_exchange_responses')){
            $pdo->exec("INSERT IGNORE INTO account_tariff_usage_events(id,subject_type,subject_id,metric,entity_id,usage_date,source)
              SELECT CONCAT('tue_',SUBSTRING(SHA2(CONCAT('master|',master_id,'|accepted_request|',request_id),256),1,28)),'master',master_id,'accepted_request',request_id,DATE(accepted_at),'migration_response'
              FROM master_exchange_responses WHERE response_status='accepted' AND accepted_at IS NOT NULL AND COALESCE(master_id,'')<>''");
        }
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'orders')){
            $pdo->exec("INSERT IGNORE INTO account_tariff_usage_events(id,subject_type,subject_id,metric,entity_id,usage_date,source)
              SELECT CONCAT('tue_',SUBSTRING(SHA2(CONCAT('master|',master_id,'|accepted_request|',id),256),1,28)),'master',master_id,'accepted_request',id,DATE(accepted_at),'migration_order'
              FROM orders WHERE accepted_at IS NOT NULL AND COALESCE(master_id,'') NOT IN ('','0')");
        }
    },
];
