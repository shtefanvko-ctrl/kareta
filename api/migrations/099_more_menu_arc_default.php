<?php
declare(strict_types=1);

return static function(PDO $pdo): void {
    $columnExists=static function(string $table,string $column) use ($pdo): bool {
        $statement=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
        $statement->execute([$table,$column]);
        return (int)$statement->fetchColumn()>0;
    };
    if($columnExists('client_preferences','more_menu_layout')){
        $pdo->exec("ALTER TABLE client_preferences MODIFY more_menu_layout ENUM('grid','arc','hex') NOT NULL DEFAULT 'arc'");
    }
    if($columnExists('account_ui_preferences','more_menu_layout')){
        $pdo->exec("ALTER TABLE account_ui_preferences MODIFY more_menu_layout ENUM('grid','arc','hex') NOT NULL DEFAULT 'arc'");
    }
};
