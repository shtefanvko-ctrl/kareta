<?php
declare(strict_types=1);
return [
 'version'=>92,
 'note'=>'R187.3 client smart action hub layouts',
 'run'=>static function(PDO $pdo):void{
   $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_preferences' AND COLUMN_NAME='more_menu_layout'");
   $st->execute();
   if((int)$st->fetchColumn()===0){
     $pdo->exec("ALTER TABLE client_preferences ADD COLUMN more_menu_layout ENUM('grid','arc','hex') NOT NULL DEFAULT 'grid' AFTER compact_mobile");
   }
 }
];
