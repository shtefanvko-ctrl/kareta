<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/catalog/service_catalog.php';

return [
    'version' => 37,
    'note' => 'role-owned service offers for masters and service stations: price, duration, warranty and availability',
    'run' => static function (PDO $pdo): void {
        kareta_service_catalog_ensure_schema($pdo);
        // Rebuild platform offers without touching offers owned by masters or service stations.
        $pdo->exec("INSERT INTO `service_offers`
            (`service_id`,`owner_type`,`owner_user_id`,`owner_entity_id`,`city`,`price`,`duration_min`,`warranty_days`,`availability_status`,`booking_enabled`,`notes`,`active`,`moderation_status`)
            SELECT `id`,'platform',0,'','',`base_price`,0,0,'available',1,'',`active`,'approved'
            FROM `service_catalog`
            ON DUPLICATE KEY UPDATE
                `price`=VALUES(`price`),
                `active`=VALUES(`active`),
                `booking_enabled`=VALUES(`booking_enabled`),
                `moderation_status`='approved',
                `updated_at`=CURRENT_TIMESTAMP");
    },
];
