<?php
declare(strict_types=1);
return [
    'version' => 110,
    'note' => 'R188.5.5.6.52: verified Master work portfolio story fields and explicit public price consent',
    'run' => static function (PDO $pdo): void {
        $hasColumn = static function (string $table, string $column) use ($pdo): bool {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
            $st->execute([$table,$column]);
            return (int)$st->fetchColumn()>0;
        };
        require_once dirname(__DIR__).'/work_posts.php';
        kareta_work_posts_ensure($pdo);
        $columns=[
            'problem_text'=>"MEDIUMTEXT NULL AFTER `body`",
            'diagnosis_text'=>"MEDIUMTEXT NULL AFTER `problem_text`",
            'solution_text'=>"MEDIUMTEXT NULL AFTER `diagnosis_text`",
            'parts_json'=>"JSON NULL AFTER `solution_text`",
            'duration_minutes'=>"INT UNSIGNED NOT NULL DEFAULT 0 AFTER `parts_json`",
            'public_price'=>"DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER `duration_minutes`",
            'price_visible'=>"TINYINT(1) NOT NULL DEFAULT 0 AFTER `public_price`",
            'warranty_days'=>"INT UNSIGNED NOT NULL DEFAULT 0 AFTER `price_visible`",
            'completed_at'=>"DATETIME NULL AFTER `warranty_days`",
        ];
        foreach($columns as $column=>$definition){
            if(!$hasColumn('work_posts',$column))$pdo->exec("ALTER TABLE `work_posts` ADD COLUMN `{$column}` {$definition}");
        }
        if(function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'work_order_publication_policies')&&!$hasColumn('work_order_publication_policies','show_price')){
            $pdo->exec("ALTER TABLE `work_order_publication_policies` ADD COLUMN `show_price` TINYINT(1) NOT NULL DEFAULT 0 AFTER `anonymize_client`");
        }
    },
];
