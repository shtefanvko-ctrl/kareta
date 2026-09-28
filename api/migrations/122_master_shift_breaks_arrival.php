<?php
declare(strict_types=1);
return [
    'version'=>122,
    'note'=>'R188.5.5.6.69: master weekly shifts, blocked intervals, client arrival and no-show control',
    'run'=>static function(PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS master_weekly_shifts(
          master_id VARCHAR(64) NOT NULL,
          weekday TINYINT UNSIGNED NOT NULL,
          start_time TIME NULL,
          end_time TIME NULL,
          is_day_off TINYINT(1) NOT NULL DEFAULT 0,
          note VARCHAR(191) NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY(master_id,weekday),
          KEY idx_master_weekly_day(master_id,weekday)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS master_schedule_blocks(
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          master_id VARCHAR(64) NOT NULL,
          block_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          block_type VARCHAR(24) NOT NULL DEFAULT 'technical',
          note VARCHAR(191) NOT NULL DEFAULT '',
          active TINYINT(1) NOT NULL DEFAULT 1,
          created_by_user_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_master_block_date(master_id,block_date,active,start_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS order_arrival_states(
          order_id VARCHAR(64) NOT NULL PRIMARY KEY,
          client_user_id BIGINT UNSIGNED NULL,
          master_id VARCHAR(64) NOT NULL DEFAULT '',
          status VARCHAR(24) NOT NULL DEFAULT '',
          eta_minutes INT NOT NULL DEFAULT 0,
          eta_at DATETIME NULL,
          arrived_at DATETIME NULL,
          no_show_at DATETIME NULL,
          source VARCHAR(24) NOT NULL DEFAULT '',
          note VARCHAR(255) NOT NULL DEFAULT '',
          updated_by_user_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_arrival_master(master_id,status,updated_at),
          KEY idx_arrival_client(client_user_id,status,updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'masters')){
            $masters=$pdo->query("SELECT id FROM masters WHERE active=1")->fetchAll(PDO::FETCH_COLUMN)?:[];
            $ins=$pdo->prepare("INSERT IGNORE INTO master_weekly_shifts(master_id,weekday,start_time,end_time,is_day_off,note) VALUES(?,?,'09:00:00','18:00:00',0,'')");
            foreach($masters as $masterId)for($weekday=1;$weekday<=7;$weekday++)$ins->execute([(string)$masterId,$weekday]);
        }
    },
];
