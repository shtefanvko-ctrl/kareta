<?php
declare(strict_types=1);
return ['version'=>55,'note'=>'booking slots, product reviews/questions and chat file urls','run'=>static function(PDO $pdo):void{
 $pdo->exec("CREATE TABLE IF NOT EXISTS product_reviews(id VARCHAR(64) PRIMARY KEY,product_id VARCHAR(64) NOT NULL,user_id INT NULL,author_name VARCHAR(160) NOT NULL,rating TINYINT NOT NULL DEFAULT 5,body TEXT NOT NULL,status VARCHAR(24) NOT NULL DEFAULT 'published',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_product_review_user(product_id,user_id),KEY idx_product_reviews_product(product_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $pdo->exec("CREATE TABLE IF NOT EXISTS product_questions(id VARCHAR(64) PRIMARY KEY,product_id VARCHAR(64) NOT NULL,user_id INT NULL,author_name VARCHAR(160) NOT NULL,body TEXT NOT NULL,answer TEXT NULL,status VARCHAR(24) NOT NULL DEFAULT 'published',created_at DATETIME NOT NULL,answered_at DATETIME NULL,KEY idx_product_questions_product(product_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $has=static function(string $t,string $c)use($pdo):bool{$s=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");$s->execute([$t,$c]);return (int)$s->fetchColumn()>0;};
 if(!$has('messages','file_url'))$pdo->exec("ALTER TABLE messages ADD COLUMN file_url VARCHAR(500) NULL AFTER file_type");
 if(!$has('orders','estimated_duration_min'))$pdo->exec("ALTER TABLE orders ADD COLUMN estimated_duration_min INT NOT NULL DEFAULT 120 AFTER time");
 }];
