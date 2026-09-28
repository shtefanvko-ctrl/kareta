<?php
declare(strict_types=1);

return [
    'version' => 112,
    'note' => 'R188.5.5.6.54: unified Master social wall, typed publications, linked parts and server-backed social interactions',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        $hasTable = static function (string $table) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
            $st->execute([$table]);
            return (int)$st->fetchColumn()>0;
        };

        if (!$hasTable('master_wall_posts')) {
            $pdo->exec("CREATE TABLE master_wall_posts (
              id VARCHAR(64) PRIMARY KEY, master_id VARCHAR(64) NOT NULL DEFAULT '', master_user_id BIGINT UNSIGNED NULL,
              master_name VARCHAR(191) NOT NULL DEFAULT '', order_id VARCHAR(64) NOT NULL DEFAULT '', post_type VARCHAR(32) NOT NULL DEFAULT 'note',
              stage_code VARCHAR(32) NOT NULL DEFAULT '', category VARCHAR(64) NOT NULL DEFAULT 'note', visibility VARCHAR(24) NOT NULL DEFAULT 'public',
              linked_product_id VARCHAR(64) NULL, video_url VARCHAR(500) NULL, published_at DATETIME NULL, preview TEXT NULL, title VARCHAR(255) NULL,
              text MEDIUMTEXT NULL, links_json JSON NULL, photos_json JSON NULL, files_json JSON NULL, steps_json JSON NULL, parts_json JSON NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              active TINYINT(1) NOT NULL DEFAULT 1, KEY idx_master_wall_master_id(master_id), KEY idx_master_wall_public(master_id,active,visibility,published_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } else {
            $columns=[
              'visibility' => "VARCHAR(24) NOT NULL DEFAULT 'public' AFTER `category`",
              'linked_product_id' => "VARCHAR(64) NULL AFTER `visibility`",
              'video_url' => "VARCHAR(500) NULL AFTER `linked_product_id`",
              'published_at' => "DATETIME NULL AFTER `video_url`",
            ];
            foreach($columns as $column=>$definition) if(!$hasColumn('master_wall_posts',$column)) $pdo->exec("ALTER TABLE master_wall_posts ADD COLUMN `{$column}` {$definition}");
            try{$pdo->exec("CREATE INDEX idx_master_wall_public ON master_wall_posts(master_id,active,visibility,published_at)");}catch(Throwable $_){}
        }
        $pdo->exec("UPDATE master_wall_posts SET visibility='public' WHERE visibility IS NULL OR visibility='' ");
        $pdo->exec("UPDATE master_wall_posts SET published_at=COALESCE(published_at,created_at) WHERE active=1 AND visibility='public' AND published_at IS NULL");

        $pdo->exec("CREATE TABLE IF NOT EXISTS master_wall_reactions (
          id VARCHAR(64) PRIMARY KEY, entity_key VARCHAR(160) NOT NULL, actor_key VARCHAR(80) NOT NULL,
          account_id BIGINT NULL, user_id BIGINT NULL, reaction VARCHAR(24) NOT NULL DEFAULT 'like', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_master_wall_reaction(entity_key,actor_key,reaction), KEY idx_master_wall_reaction_entity(entity_key,reaction)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS master_wall_saved (
          id VARCHAR(64) PRIMARY KEY, entity_key VARCHAR(160) NOT NULL, actor_key VARCHAR(80) NOT NULL,
          account_id BIGINT NULL, user_id BIGINT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_master_wall_saved(entity_key,actor_key), KEY idx_master_wall_saved_actor(actor_key,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $pdo->exec("CREATE TABLE IF NOT EXISTS master_wall_comments_social (
          id VARCHAR(64) PRIMARY KEY, entity_key VARCHAR(160) NOT NULL, parent_id VARCHAR(64) NOT NULL DEFAULT '', actor_key VARCHAR(80) NOT NULL,
          account_id BIGINT NULL, person_id BIGINT NULL, user_id BIGINT NULL, author_name VARCHAR(160) NOT NULL,
          author_role VARCHAR(32) NOT NULL DEFAULT 'client', author_master_id VARCHAR(64) NULL, body TEXT NOT NULL,
          active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_master_wall_comment_entity(entity_key,active,created_at), KEY idx_master_wall_comment_parent(parent_id,active,created_at),
          KEY idx_master_wall_comment_actor(actor_key,active,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
