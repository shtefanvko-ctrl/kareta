<?php
declare(strict_types=1);

return [
    'version' => 111,
    'note' => 'R188.5.5.6.53: verified Master reviews, dimension ratings, replies and identity-aware work comments',
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

        if ($hasTable('reviews_public')) {
            $columns = [
                'quality_rating' => "TINYINT NULL AFTER `stars`",
                'timing_rating' => "TINYINT NULL AFTER `quality_rating`",
                'neatness_rating' => "TINYINT NULL AFTER `timing_rating`",
                'communication_rating' => "TINYINT NULL AFTER `neatness_rating`",
                'master_reply' => "TEXT NULL AFTER `text`",
                'master_reply_at' => "DATETIME NULL AFTER `master_reply`",
            ];
            foreach ($columns as $column=>$definition) {
                if (!$hasColumn('reviews_public',$column)) $pdo->exec("ALTER TABLE `reviews_public` ADD COLUMN `{$column}` {$definition}");
            }
        }

        if ($hasTable('master_reviews')) {
            $columns = [
                'client_user_id' => "INT NULL AFTER `author_phone`",
                'source_review_id' => "VARCHAR(64) NULL AFTER `client_user_id`",
                'master_reply_at' => "DATETIME NULL AFTER `master_reply`",
                'updated_at' => "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`",
            ];
            foreach ($columns as $column=>$definition) {
                if (!$hasColumn('master_reviews',$column)) $pdo->exec("ALTER TABLE `master_reviews` ADD COLUMN `{$column}` {$definition}");
            }
            try { $pdo->exec("CREATE INDEX idx_master_reviews_source ON master_reviews(source_review_id)"); } catch (Throwable $_) {}
        }

        if ($hasTable('work_post_comments')) {
            $columns = [
                'account_id' => "BIGINT NULL AFTER `user_id`",
                'person_id' => "BIGINT NULL AFTER `account_id`",
                'author_master_id' => "VARCHAR(64) NULL AFTER `author_role`",
                'author_sto_id' => "VARCHAR(64) NULL AFTER `author_master_id`",
            ];
            foreach ($columns as $column=>$definition) {
                if (!$hasColumn('work_post_comments',$column)) $pdo->exec("ALTER TABLE `work_post_comments` ADD COLUMN `{$column}` {$definition}");
            }
            try { $pdo->exec("CREATE INDEX idx_work_post_comments_account ON work_post_comments(account_id,active,created_at)"); } catch (Throwable $_) {}
        }

        // Service reviews created by the order flow become the canonical verified Master-review stream.
        if ($hasTable('reviews_public') && $hasTable('master_reviews')) {
            $pdo->exec("INSERT IGNORE INTO master_reviews
                (id,master_id,order_id,author_name,author_phone,client_user_id,source_review_id,rating,quality_rating,timing_rating,neatness_rating,communication_rating,text,master_reply,master_reply_at,status,created_at)
                SELECT CONCAT('mr_',LEFT(SHA2(CONCAT(COALESCE(r.master_id,''),':',COALESCE(r.order_id,''),':',r.id),256),24)),
                       r.master_id,r.order_id,r.author_name,'',NULL,r.id,r.stars,
                       r.quality_rating,r.timing_rating,r.neatness_rating,r.communication_rating,r.text,r.master_reply,r.master_reply_at,'published',r.created_at
                  FROM reviews_public r JOIN orders o ON o.id=r.order_id AND o.status='done'
                 WHERE r.active=1 AND r.review_type='service' AND COALESCE(r.master_id,'')<>'' AND COALESCE(r.order_id,'')<>''");

            $pdo->exec("UPDATE master_reviews mr
                JOIN reviews_public r ON r.active=1 AND r.review_type='service' AND r.master_id=mr.master_id AND r.order_id=mr.order_id
                   SET mr.source_review_id=r.id,
                       mr.rating=r.stars,
                       mr.quality_rating=r.quality_rating,
                       mr.timing_rating=r.timing_rating,
                       mr.neatness_rating=r.neatness_rating,
                       mr.communication_rating=r.communication_rating,
                       mr.text=r.text,
                       mr.master_reply=COALESCE(r.master_reply,mr.master_reply),
                       mr.master_reply_at=COALESCE(r.master_reply_at,mr.master_reply_at),
                       mr.status='published'");

            $pdo->exec("UPDATE reviews_public r
                JOIN master_reviews mr ON mr.status='published' AND mr.master_id=r.master_id AND mr.order_id=r.order_id
                   SET r.quality_rating=COALESCE(r.quality_rating,mr.quality_rating),
                       r.timing_rating=COALESCE(r.timing_rating,mr.timing_rating),
                       r.neatness_rating=COALESCE(r.neatness_rating,mr.neatness_rating),
                       r.communication_rating=COALESCE(r.communication_rating,mr.communication_rating),
                       r.master_reply=COALESCE(r.master_reply,mr.master_reply),
                       r.master_reply_at=COALESCE(r.master_reply_at,mr.master_reply_at)
                 WHERE r.active=1 AND r.review_type='service'");

            if ($hasTable('masters')) {
                $pdo->exec("UPDATE masters m LEFT JOIN (SELECT mr.master_id,ROUND(AVG(mr.rating),2) avg_rating,COUNT(*) cnt FROM master_reviews mr JOIN orders o ON o.id=mr.order_id AND o.status='done' WHERE mr.status='published' GROUP BY mr.master_id) x ON x.master_id=m.id SET m.rating=COALESCE(x.avg_rating,0),m.reviews_count=COALESCE(x.cnt,0)");
            }
        }
    },
];
