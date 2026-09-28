<?php
declare(strict_types=1);
return [
 'version'=>42,
 'note'=>'activate shared news_articles feed for all account roles',
 'run'=>static function(PDO $pdo):void{
   $pdo->exec("CREATE TABLE IF NOT EXISTS `news_articles` (
     `id` VARCHAR(40) NOT NULL PRIMARY KEY,
     `slug` VARCHAR(160) NOT NULL DEFAULT '',
     `title` VARCHAR(255) NOT NULL DEFAULT '',
     `intro` TEXT NOT NULL,
     `body` LONGTEXT NOT NULL,
     `cover_url` VARCHAR(500) NOT NULL DEFAULT '',
     `category` VARCHAR(60) NOT NULL DEFAULT 'auto',
     `tags` VARCHAR(500) NOT NULL DEFAULT '[]',
     `author_name` VARCHAR(120) NOT NULL DEFAULT '',
     `author_role` VARCHAR(120) NOT NULL DEFAULT '',
     `author_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
     `published_at` DATE NOT NULL,
     `reading_time` TINYINT UNSIGNED NOT NULL DEFAULT 3,
     `views_count` INT UNSIGNED NOT NULL DEFAULT 0,
     `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
     `active` TINYINT(1) NOT NULL DEFAULT 1,
     `sort` INT UNSIGNED NOT NULL DEFAULT 0,
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY `uq_news_slug` (`slug`),
     KEY `idx_news_category` (`category`,`active`),
     KEY `idx_news_featured` (`is_featured`,`active`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
