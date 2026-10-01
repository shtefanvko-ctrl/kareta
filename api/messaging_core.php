<?php
declare(strict_types=1);

/**
 * KARETA Messaging Core — R188.5.5.6.84.87
 *
 * Internal KARETA chats remain the source of truth. Telegram and WhatsApp are
 * external transports. Provider secrets never leave server-side configuration.
 */

require_once __DIR__ . '/messaging_whatsapp_routing.php';

function kareta_messaging_config(): array
{
    return defined('KARETA_MESSAGING') && is_array(KARETA_MESSAGING) ? KARETA_MESSAGING : ['enabled'=>false];
}

function kareta_messaging_core_enabled(): bool
{
    $cfg = kareta_messaging_config();
    return !empty($cfg['enabled']);
}

function kareta_messaging_provider_configured(string $channel): bool
{
    if (!kareta_messaging_core_enabled()) return false;
    $cfg = kareta_messaging_config();
    $provider = is_array($cfg[$channel] ?? null) ? $cfg[$channel] : [];
    if (empty($provider['enabled'])) return false;
    if ($channel === 'telegram') {
        return trim((string)($provider['bot_token'] ?? '')) !== ''
            && trim((string)($provider['bot_username'] ?? '')) !== ''
            && strlen(trim((string)($provider['webhook_secret'] ?? ''))) >= 16;
    }
    if ($channel === 'whatsapp') {
        return trim((string)($provider['access_token'] ?? '')) !== ''
            && trim((string)($provider['phone_number_id'] ?? '')) !== ''
            && trim((string)($provider['business_phone'] ?? '')) !== ''
            && strlen(trim((string)($provider['verify_token'] ?? ''))) >= 16
            && strlen(trim((string)($provider['app_secret'] ?? ''))) >= 16;
    }
    return false;
}

function kareta_messaging_public_config(): array
{
    $cfg = kareta_messaging_config();
    return [
        'enabled' => !empty($cfg['enabled']),
        'publicUrl' => (string)($cfg['public_url'] ?? ''),
        'telegram' => [
            'configured' => kareta_messaging_provider_configured('telegram'),
            'botUsername' => (string)($cfg['telegram']['bot_username'] ?? ''),
        ],
        'whatsapp' => [
            'configured' => kareta_messaging_provider_configured('whatsapp'),
            'businessPhone' => (string)($cfg['whatsapp']['business_phone'] ?? ''),
        ],
    ];
}

function kareta_messaging_install_schema(PDO $pdo, bool $includeWhatsappRouting=true): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_channel_links (
        user_id BIGINT UNSIGNED NOT NULL,
        channel VARCHAR(16) NOT NULL,
        external_user_id VARCHAR(191) NOT NULL DEFAULT '',
        external_chat_id VARCHAR(191) NOT NULL DEFAULT '',
        external_phone VARCHAR(32) NOT NULL DEFAULT '',
        display_name VARCHAR(191) NOT NULL DEFAULT '',
        status VARCHAR(24) NOT NULL DEFAULT 'linked',
        verified_at DATETIME NULL,
        last_inbound_at DATETIME NULL,
        last_outbound_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id,channel),
        UNIQUE KEY uq_messaging_external(channel,external_user_id),
        KEY idx_messaging_link_status(channel,status,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_link_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        channel VARCHAR(16) NOT NULL,
        purpose VARCHAR(24) NOT NULL DEFAULT 'link',
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_messaging_token_user(user_id,channel,expires_at),
        KEY idx_messaging_token_expiry(expires_at,used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_preferences (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        primary_channel VARCHAR(16) NOT NULL DEFAULT 'kareta',
        notify_messages TINYINT(1) NOT NULL DEFAULT 1,
        notify_orders TINYINT(1) NOT NULL DEFAULT 1,
        notify_approvals TINYINT(1) NOT NULL DEFAULT 1,
        notify_schedule TINYINT(1) NOT NULL DEFAULT 1,
        allow_external_replies TINYINT(1) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_deliveries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        message_id VARCHAR(96) NOT NULL,
        chat_id VARCHAR(64) NOT NULL,
        recipient_user_id BIGINT UNSIGNED NOT NULL,
        channel VARCHAR(16) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        external_message_id VARCHAR(191) NOT NULL DEFAULT '',
        attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        next_attempt_at DATETIME NULL,
        locked_at DATETIME NULL,
        error_code VARCHAR(64) NOT NULL DEFAULT '',
        payload_json JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_messaging_delivery(message_id,recipient_user_id,channel),
        KEY idx_messaging_delivery_queue(status,next_attempt_at,id),
        KEY idx_messaging_delivery_external(channel,external_message_id),
        KEY idx_messaging_delivery_recipient(recipient_user_id,channel,updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_inbound_events (
        provider VARCHAR(16) NOT NULL,
        event_id VARCHAR(191) NOT NULL,
        payload_hash CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'received',
        user_id BIGINT UNSIGNED NULL,
        chat_id VARCHAR(64) NOT NULL DEFAULT '',
        message_id VARCHAR(96) NOT NULL DEFAULT '',
        error_code VARCHAR(64) NOT NULL DEFAULT '',
        received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        PRIMARY KEY(provider,event_id),
        KEY idx_messaging_inbound_status(status,received_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_action_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        channel VARCHAR(16) NOT NULL,
        action_key VARCHAR(64) NOT NULL,
        entity_type VARCHAR(24) NOT NULL DEFAULT '',
        entity_id VARCHAR(64) NOT NULL DEFAULT '',
        payload_json JSON NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        result_code VARCHAR(64) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_messaging_action_user(user_id,channel,expires_at),
        KEY idx_messaging_action_entity(entity_type,entity_id,expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if ($includeWhatsappRouting) kareta_messaging_whatsapp_install_schema($pdo);
}

function kareta_messaging_schema(PDO $pdo): void
{
    static $ready = false;
    if ($ready) return;

    $required = [
        'messaging_channel_links',
        'messaging_link_tokens',
        'messaging_preferences',
        'messaging_deliveries',
        'messaging_inbound_events',
        'messaging_action_tokens',
    ];
    $placeholders = implode(',', array_fill(0, count($required), '?'));
    $st = $pdo->prepare(
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        . "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ({$placeholders})"
    );
    $st->execute($required);
    $present = array_map('strval', $st->fetchAll(PDO::FETCH_COLUMN) ?: []);
    $missing = array_values(array_diff($required, $present));

    if ($missing !== []) {
        $cfg = kareta_messaging_config();
        if (!empty($cfg['auto_schema'])) {
            kareta_messaging_install_schema($pdo, false);
            $missing = [];
        }
    }
    if ($missing !== []) {
        throw new RuntimeException('messaging_schema_not_installed');
    }
    $ready = true;
}

function kareta_messaging_preferences(PDO $pdo, int $userId): array
{
    kareta_messaging_schema($pdo);
    $pdo->prepare("INSERT IGNORE INTO messaging_preferences(user_id) VALUES(?)")->execute([$userId]);
    $st = $pdo->prepare("SELECT primary_channel,notify_messages,notify_orders,notify_approvals,notify_schedule,allow_external_replies,updated_at FROM messaging_preferences WHERE user_id=? LIMIT 1");
    $st->execute([$userId]);
    $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
    return [
        'primaryChannel' => in_array((string)($row['primary_channel'] ?? 'kareta'), ['kareta','telegram','whatsapp'], true) ? (string)$row['primary_channel'] : 'kareta',
        'notifyMessages' => (int)($row['notify_messages'] ?? 1) === 1,
        'notifyOrders' => (int)($row['notify_orders'] ?? 1) === 1,
        'notifyApprovals' => (int)($row['notify_approvals'] ?? 1) === 1,
        'notifySchedule' => (int)($row['notify_schedule'] ?? 1) === 1,
        'allowExternalReplies' => (int)($row['allow_external_replies'] ?? 1) === 1,
        'updatedAt' => (string)($row['updated_at'] ?? ''),
    ];
}

function kareta_messaging_links(PDO $pdo, int $userId): array
{
    kareta_messaging_schema($pdo);
    $st = $pdo->prepare("SELECT channel,external_user_id,external_chat_id,external_phone,display_name,status,verified_at,last_inbound_at,last_outbound_at,updated_at FROM messaging_channel_links WHERE user_id=? ORDER BY channel");
    $st->execute([$userId]);
    $out = ['telegram'=>null,'whatsapp'=>null];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $channel = (string)($row['channel'] ?? '');
        if (!array_key_exists($channel, $out)) continue;
        $out[$channel] = [
            'channel'=>$channel,
            'linked'=>(string)($row['status'] ?? '') === 'linked',
            'displayName'=>(string)($row['display_name'] ?? ''),
            'externalPhone'=>(string)($row['external_phone'] ?? ''),
            'verifiedAt'=>(string)($row['verified_at'] ?? ''),
            'lastInboundAt'=>(string)($row['last_inbound_at'] ?? ''),
            'lastOutboundAt'=>(string)($row['last_outbound_at'] ?? ''),
            'updatedAt'=>(string)($row['updated_at'] ?? ''),
        ];
    }
    return $out;
}

function kareta_messaging_status(PDO $pdo, int $userId): array
{
    return [
        'providers'=>kareta_messaging_public_config(),
        'links'=>kareta_messaging_links($pdo,$userId),
        'preferences'=>kareta_messaging_preferences($pdo,$userId),
    ];
}

function kareta_messaging_random_token(int $bytes=24): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function kareta_messaging_create_link_token(PDO $pdo, int $userId, string $channel): array
{
    if (!in_array($channel,['telegram','whatsapp'],true)) throw new InvalidArgumentException('invalid_channel');
    if (!kareta_messaging_provider_configured($channel)) throw new DomainException('provider_not_configured');
    kareta_messaging_schema($pdo);
    $pdo->prepare("DELETE FROM messaging_link_tokens WHERE user_id=? AND channel=? AND used_at IS NULL")->execute([$userId,$channel]);
    $raw = kareta_messaging_random_token($channel === 'whatsapp' ? 9 : 24);
    $hash = hash('sha256',$raw);
    $pdo->prepare("INSERT INTO messaging_link_tokens(token_hash,user_id,channel,expires_at) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 15 MINUTE))")
        ->execute([$hash,$userId,$channel]);
    $cfg = kareta_messaging_config();
    if ($channel === 'telegram') {
        $username = (string)($cfg['telegram']['bot_username'] ?? '');
        $url = 'https://t.me/' . rawurlencode($username) . '?start=' . rawurlencode('kareta_'.$raw);
        return ['channel'=>$channel,'expiresIn'=>900,'connectUrl'=>$url];
    }
    $phone = preg_replace('/\D+/','',(string)($cfg['whatsapp']['business_phone'] ?? '')) ?: '';
    $text = 'KARETA ' . $raw;
    $url = 'https://wa.me/' . $phone . '?text=' . rawurlencode($text);
    return ['channel'=>$channel,'expiresIn'=>900,'connectUrl'=>$url];
}

function kareta_messaging_consume_link_token(PDO $pdo, string $channel, string $rawToken): int
{
    kareta_messaging_schema($pdo);
    $hash = hash('sha256',trim($rawToken));
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) $pdo->beginTransaction();
    try {
        $st=$pdo->prepare("SELECT user_id FROM messaging_link_tokens WHERE token_hash=? AND channel=? AND used_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE");
        $st->execute([$hash,$channel]);
        $userId=(int)($st->fetchColumn()?:0);
        if($userId<=0){if($ownTransaction)$pdo->rollBack();return 0;}
        $pdo->prepare("UPDATE messaging_link_tokens SET used_at=NOW() WHERE token_hash=?")->execute([$hash]);
        if ($ownTransaction) $pdo->commit();
        return $userId;
    } catch(Throwable $e) {
        if($ownTransaction && $pdo->inTransaction())$pdo->rollBack();
        throw $e;
    }
}

function kareta_messaging_link(PDO $pdo, int $userId, string $channel, string $externalUserId, string $externalChatId='', string $externalPhone='', string $displayName=''): void
{
    if ($userId <= 0 || !in_array($channel,['telegram','whatsapp'],true) || trim($externalUserId)==='') throw new InvalidArgumentException('invalid_link');
    kareta_messaging_schema($pdo);
    $displayName = mb_substr(trim($displayName),0,191,'UTF-8');
    $externalPhone = preg_replace('/\D+/','',$externalPhone) ?: '';
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) $pdo->beginTransaction();
    try {
        // One external identity belongs to only one KARETA account at a time.
        $pdo->prepare("DELETE FROM messaging_channel_links WHERE channel=? AND external_user_id=? AND user_id<>?")->execute([$channel,$externalUserId,$userId]);
        $pdo->prepare("INSERT INTO messaging_channel_links(user_id,channel,external_user_id,external_chat_id,external_phone,display_name,status,verified_at,last_inbound_at)
            VALUES(?,?,?,?,?,?,'linked',NOW(),NOW())
            ON DUPLICATE KEY UPDATE external_user_id=VALUES(external_user_id),external_chat_id=VALUES(external_chat_id),external_phone=VALUES(external_phone),display_name=VALUES(display_name),status='linked',verified_at=NOW(),last_inbound_at=NOW()")
            ->execute([$userId,$channel,$externalUserId,$externalChatId,$externalPhone,$displayName]);
        if ($ownTransaction) $pdo->commit();
    } catch(Throwable $e){if($ownTransaction && $pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_messaging_unlink(PDO $pdo, int $userId, string $channel): void
{
    kareta_messaging_schema($pdo);
    $pdo->prepare("DELETE FROM messaging_channel_links WHERE user_id=? AND channel=?")->execute([$userId,$channel]);
    $prefs=kareta_messaging_preferences($pdo,$userId);
    if(($prefs['primaryChannel']??'kareta')===$channel){
        $pdo->prepare("UPDATE messaging_preferences SET primary_channel='kareta' WHERE user_id=?")->execute([$userId]);
    }
}

function kareta_messaging_save_preferences(PDO $pdo, int $userId, array $input): array
{
    kareta_messaging_schema($pdo);
    $current=kareta_messaging_preferences($pdo,$userId);
    $primary=(string)($input['primaryChannel']??$input['primary_channel']??$current['primaryChannel']??'kareta');
    if(!in_array($primary,['kareta','telegram','whatsapp'],true))$primary='kareta';
    if($primary!=='kareta'){
        $st=$pdo->prepare("SELECT COUNT(*) FROM messaging_channel_links WHERE user_id=? AND channel=? AND status='linked'");$st->execute([$userId,$primary]);
        if((int)$st->fetchColumn()!==1)throw new DomainException('channel_not_linked');
        if(!kareta_messaging_provider_configured($primary))throw new DomainException('provider_not_configured');
    }
    $flag=static function(array $src,string $camel,string $snake,bool $fallback):int{
        if(array_key_exists($camel,$src))return !empty($src[$camel])?1:0;
        if(array_key_exists($snake,$src))return !empty($src[$snake])?1:0;
        return $fallback?1:0;
    };
    $vals=[
        'messages'=>$flag($input,'notifyMessages','notify_messages',(bool)($current['notifyMessages']??true)),
        'orders'=>$flag($input,'notifyOrders','notify_orders',(bool)($current['notifyOrders']??true)),
        'approvals'=>$flag($input,'notifyApprovals','notify_approvals',(bool)($current['notifyApprovals']??true)),
        'schedule'=>$flag($input,'notifySchedule','notify_schedule',(bool)($current['notifySchedule']??true)),
        'replies'=>$flag($input,'allowExternalReplies','allow_external_replies',(bool)($current['allowExternalReplies']??true)),
    ];
    $pdo->prepare("INSERT INTO messaging_preferences(user_id,primary_channel,notify_messages,notify_orders,notify_approvals,notify_schedule,allow_external_replies)
      VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE primary_channel=VALUES(primary_channel),notify_messages=VALUES(notify_messages),notify_orders=VALUES(notify_orders),notify_approvals=VALUES(notify_approvals),notify_schedule=VALUES(notify_schedule),allow_external_replies=VALUES(allow_external_replies)")
      ->execute([$userId,$primary,$vals['messages'],$vals['orders'],$vals['approvals'],$vals['schedule'],$vals['replies']]);
    return kareta_messaging_preferences($pdo,$userId);
}

function kareta_messaging_action_token_create(PDO $pdo, int $userId, string $channel, string $actionKey, string $entityType, string $entityId, array $payload=[], int $ttlSeconds=900): string
{
    kareta_messaging_schema($pdo);
    if($userId<=0||!in_array($channel,['telegram','whatsapp'],true)||$actionKey===''||$entityId==='')throw new InvalidArgumentException('action_token_invalid');
    $raw=kareta_messaging_random_token(18);$hash=hash('sha256',$raw);$ttl=max(60,min(3600,$ttlSeconds));$expires=date('Y-m-d H:i:s',time()+$ttl);
    $pdo->prepare("INSERT INTO messaging_action_tokens(token_hash,user_id,channel,action_key,entity_type,entity_id,payload_json,expires_at) VALUES(?,?,?,?,?,?,?,?)")
        ->execute([$hash,$userId,$channel,mb_substr($actionKey,0,64,'UTF-8'),mb_substr($entityType,0,24,'UTF-8'),mb_substr($entityId,0,64,'UTF-8'),json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$expires]);
    return $raw;
}

function kareta_messaging_action_token_get(PDO $pdo, int $userId, string $channel, string $rawToken): array
{
    kareta_messaging_schema($pdo);$rawToken=trim($rawToken);if($rawToken==='')throw new DomainException('action_token_invalid');
    $q=$pdo->prepare("SELECT * FROM messaging_action_tokens WHERE token_hash=? AND user_id=? AND channel=? LIMIT 1");$q->execute([hash('sha256',$rawToken),$userId,$channel]);$row=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$row)throw new DomainException('action_token_invalid');
    if(!empty($row['used_at']))throw new DomainException('action_token_used');
    if(strtotime((string)($row['expires_at']??''))<=time())throw new DomainException('action_token_expired');
    return $row;
}

function kareta_messaging_action_token_finish(PDO $pdo, int $userId, string $channel, string $rawToken, string $resultCode='ok'): void
{
    kareta_messaging_schema($pdo);
    $pdo->prepare("UPDATE messaging_action_tokens SET used_at=NOW(),result_code=? WHERE token_hash=? AND user_id=? AND channel=? AND used_at IS NULL")
        ->execute([mb_substr($resultCode,0,64,'UTF-8'),hash('sha256',trim($rawToken)),$userId,$channel]);
}

function kareta_messaging_public_url(string $target=''): string
{
    $base=rtrim((string)(kareta_messaging_config()['public_url']??'https://kareta.kz'),'/');$target=trim($target);
    if($target==='')return $base.'/';
    if(preg_match('~^https?://~i',$target))return $target;
    if(str_starts_with($target,'#'))return $base.'/'.$target;
    return $base.'/'.ltrim($target,'/');
}

function kareta_messaging_order_url(string $orderId, string $tab=''): string
{
    $hash='#/orders/item/'.rawurlencode($orderId);if($tab!=='')$hash.='?tab='.rawurlencode($tab);return kareta_messaging_public_url($hash);
}

function kareta_messaging_notification_preference(string $eventType): string
{
    $eventType=strtolower($eventType);
    if(str_contains($eventType,'approval')||str_contains($eventType,'quote'))return 'notifyApprovals';
    if(str_contains($eventType,'schedule')||str_contains($eventType,'reschedule'))return 'notifySchedule';
    if(str_contains($eventType,'message'))return 'notifyMessages';
    return 'notifyOrders';
}

function kareta_messaging_enqueue_notification(PDO $pdo, int $notificationId, array $row): int
{
    if(!kareta_messaging_core_enabled()||$notificationId<=0)return 0;
    if(!kareta_messaging_provider_configured('telegram')&&!kareta_messaging_provider_configured('whatsapp'))return 0;
    $recipientUserId=(int)($row['recipientUserId']??0);if($recipientUserId<=0)return 0;
    $eventType=trim((string)($row['eventType']??''));if($eventType==='message.new')return 0; // chat fan-out already has its own delivery
    kareta_messaging_schema($pdo);$prefs=kareta_messaging_preferences($pdo,$recipientUserId);$prefKey=kareta_messaging_notification_preference($eventType);
    if(empty($prefs[$prefKey]))return 0;$channel=(string)($prefs['primaryChannel']??'kareta');
    if(!in_array($channel,['telegram','whatsapp'],true)||!kareta_messaging_provider_configured($channel))return 0;
    $link=kareta_messaging_link_row($pdo,$recipientUserId,$channel);if(!$link)return 0;
    $payload=[
        'kind'=>'notification','notificationId'=>$notificationId,'eventType'=>$eventType,
        'entityType'=>(string)($row['entityType']??''),'entityId'=>(string)($row['entityId']??''),
        'title'=>(string)($row['title']??''),'body'=>(string)($row['body']??''),'actionUrl'=>(string)($row['actionUrl']??''),
        'recipientRole'=>(string)($row['recipientRole']??''),'meta'=>is_array($row['meta']??null)?$row['meta']:[],
    ];
    $st=$pdo->prepare("INSERT IGNORE INTO messaging_deliveries(message_id,chat_id,recipient_user_id,channel,status,payload_json,next_attempt_at) VALUES(?,?,?,?,'pending',?,NOW())");
    $st->execute(['notif:'.$notificationId,'',$recipientUserId,$channel,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);return $st->rowCount()>0?1:0;
}

function kareta_messaging_telegram_notification_keyboard(PDO $pdo, int $userId, array $payload): array
{
    $eventType=(string)($payload['eventType']??'');$entityType=(string)($payload['entityType']??'');$orderId=$entityType==='order'?(string)($payload['entityId']??''):(string)($payload['meta']['orderId']??'');
    $rows=[];$actionUrl=trim((string)($payload['actionUrl']??''));
    if($eventType==='exchange.matching_request.new'&&$orderId!==''){
        $claim=kareta_messaging_action_token_create($pdo,$userId,'telegram','master.exchange.claim','order',$orderId,[],900);
        $hide=kareta_messaging_action_token_create($pdo,$userId,'telegram','master.exchange.hide','order',$orderId,[],900);
        $rows[]=[['text'=>'Принять заявку','callback_data'=>'ka:'.$claim],['text'=>'Пропустить','callback_data'=>'ka:'.$hide]];
        $rows[]=[['text'=>'Предложить цену','url'=>kareta_messaging_public_url('#/master/exchange?focus='.rawurlencode($orderId).'&quick=1')]];
    } elseif($orderId!=='') {
        try{
            $q=$pdo->prepare("SELECT master_user_id,master_id,status FROM orders WHERE id=? LIMIT 1");$q->execute([$orderId]);$order=$q->fetch(PDO::FETCH_ASSOC)?:[];
            $isMine=(int)($order['master_user_id']??0)===$userId;
            if(!$isMine){$m=$pdo->prepare("SELECT id FROM masters WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1");$m->execute([$userId]);$mid=(string)($m->fetchColumn()?:'');$isMine=$mid!==''&&(string)($order['master_id']??'')===$mid;}
            if($isMine&&function_exists('kareta_table_exists')&&kareta_table_exists($pdo,'sto_workflows')){
                $w=$pdo->prepare("SELECT current_stage FROM sto_workflows WHERE order_id=? LIMIT 1");$w->execute([$orderId]);$stage=(string)($w->fetchColumn()?:'intake');
                if($stage==='intake'){$token=kareta_messaging_action_token_create($pdo,$userId,'telegram','master.order.start_diagnostics','order',$orderId,[],900);$rows[]=[['text'=>'Начать диагностику','callback_data'=>'ka:'.$token]];}
                elseif($stage==='in_progress'){$token=kareta_messaging_action_token_create($pdo,$userId,'telegram','master.order.complete_work','order',$orderId,[],900);$rows[]=[['text'=>'Завершить работы','callback_data'=>'ka:'.$token]];}
            }
        }catch(Throwable $_){}
    }
    $open=$actionUrl!==''?kareta_messaging_public_url($actionUrl):($orderId!==''?kareta_messaging_order_url($orderId):'');
    if($open!=='')$rows[]=[['text'=>'Открыть KARETA','url'=>$open]];
    return $rows;
}

function kareta_messaging_telegram_answer_callback(string $callbackId, string $text, bool $alert=false): array
{
    $cfg=kareta_messaging_config()['telegram']??[];if(!kareta_messaging_provider_configured('telegram'))return ['ok'=>false,'error'=>'provider_not_configured'];
    $payload=['callback_query_id'=>$callbackId,'text'=>mb_substr($text,0,180,'UTF-8'),'show_alert'=>$alert];
    return kareta_messaging_http_json('https://api.telegram.org/bot'.(string)($cfg['bot_token']??'').'/answerCallbackQuery',$payload,[],5);
}

function kareta_messaging_http_json(string $url, array $payload, array $headers=[], int $timeout=5): array
{
    $json=json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if(!is_string($json))return ['ok'=>false,'status'=>0,'json'=>null,'error'=>'json_encode_failed'];
    if(function_exists('curl_init')){
        $ch=curl_init($url);
        $baseHeaders=['Content-Type: application/json','Accept: application/json'];
        foreach($headers as $h)$baseHeaders[]=$h;
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$json,CURLOPT_HTTPHEADER=>$baseHeaders,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>$timeout,CURLOPT_HEADER=>false]);
        $body=curl_exec($ch);$errno=curl_errno($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
        $decoded=is_string($body)?json_decode($body,true):null;
        return ['ok'=>$errno===0&&$status>=200&&$status<300,'status'=>$status,'json'=>is_array($decoded)?$decoded:null,'error'=>$errno?('transport_'.$errno):($status>=200&&$status<300?'':'http_'.$status)];
    }
    $headerText="Content-Type: application/json\r\nAccept: application/json\r\n".implode("\r\n",$headers);
    $ctx=stream_context_create(['http'=>['method'=>'POST','header'=>$headerText,'content'=>$json,'timeout'=>$timeout,'ignore_errors'=>true]]);
    $body=@file_get_contents($url,false,$ctx);$status=0;
    foreach($http_response_header??[] as $line){if(preg_match('~^HTTP/\S+\s+(\d+)~',$line,$m)){$status=(int)$m[1];break;}}
    $decoded=is_string($body)?json_decode($body,true):null;
    return ['ok'=>$status>=200&&$status<300,'status'=>$status,'json'=>is_array($decoded)?$decoded:null,'error'=>$status>=200&&$status<300?'':'http_'.$status];
}

function kareta_messaging_chat_url(string $chatId): string
{
    $base=rtrim((string)(kareta_messaging_config()['public_url']??'https://kareta.kz'),'/');
    return $base.'/#/chats?chatId='.rawurlencode($chatId);
}

function kareta_messaging_telegram_send_raw(string $chatId, string $text, string $karetaChatId='', array $inlineKeyboard=[]): array
{
    $cfg=kareta_messaging_config()['telegram']??[];
    if(!kareta_messaging_provider_configured('telegram'))return ['ok'=>false,'error'=>'provider_not_configured'];
    $token=(string)($cfg['bot_token']??'');
    $payload=['chat_id'=>$chatId,'text'=>mb_substr($text,0,4096,'UTF-8'),'disable_web_page_preview'=>true];
    if($inlineKeyboard)$payload['reply_markup']=['inline_keyboard'=>$inlineKeyboard];
    elseif($karetaChatId!=='')$payload['reply_markup']=['inline_keyboard'=>[[['text'=>'Открыть чат KARETA','url'=>kareta_messaging_chat_url($karetaChatId)]]]];
    $result=kareta_messaging_http_json('https://api.telegram.org/bot'.$token.'/sendMessage',$payload,[],5);
    $messageId=(string)($result['json']['result']['message_id']??'');
    return ['ok'=>!empty($result['ok']),'externalMessageId'=>$messageId,'error'=>(string)($result['error']??'')];
}

function kareta_messaging_whatsapp_send_raw(PDO $pdo, string $waId, string $text): array
{
    $cfg=kareta_messaging_config()['whatsapp']??[];
    if(!kareta_messaging_provider_configured('whatsapp'))return ['ok'=>false,'error'=>'provider_not_configured'];
    $base=rtrim((string)($cfg['graph_base_url']??''),'/');$phoneId=(string)($cfg['phone_number_id']??'');
    if (kareta_messaging_whatsapp_customer($waId) !== $waId || $waId === '') return ['ok'=>false,'terminal'=>true,'error'=>'invalid_whatsapp_recipient'];
    try {
        $state = kareta_messaging_whatsapp_thread($pdo, $phoneId, $waId);
        $blocked = kareta_messaging_whatsapp_block_reason($state, time());
    } catch (Throwable $e) {
        $blocked = 'whatsapp_routing_unavailable';
    }
    if ($blocked !== '') return ['ok'=>false,'terminal'=>false,'blocked'=>true,'error'=>$blocked];
    $payload=['messaging_product'=>'whatsapp','recipient_type'=>'individual','to'=>$waId,'type'=>'text','text'=>['preview_url'=>false,'body'=>mb_substr($text,0,4096,'UTF-8')]];
    $result=kareta_messaging_http_json($base.'/'.$phoneId.'/messages',$payload,['Authorization: Bearer '.(string)($cfg['access_token']??'')],5);
    $messageId=(string)($result['json']['messages'][0]['id']??'');
    return ['ok'=>!empty($result['ok']),'externalMessageId'=>$messageId,'error'=>(string)($result['error']??'')];
}

function kareta_messaging_link_row(PDO $pdo, int $userId, string $channel): ?array
{
    kareta_messaging_schema($pdo);
    $st=$pdo->prepare("SELECT * FROM messaging_channel_links WHERE user_id=? AND channel=? AND status='linked' LIMIT 1");$st->execute([$userId,$channel]);
    $row=$st->fetch(PDO::FETCH_ASSOC);return $row?:null;
}

function kareta_messaging_chat_recipients(PDO $pdo, string $chatId, int $excludeUserId=0): array
{
    $ids=[];
    try{$st=$pdo->prepare("SELECT user_id FROM chat_participants WHERE chat_id=? AND left_at IS NULL");$st->execute([$chatId]);foreach($st->fetchAll(PDO::FETCH_COLUMN) as $id){$n=(int)$id;if($n>0&&$n!==$excludeUserId)$ids[$n]=true;}}catch(Throwable $_){}
    $st=$pdo->prepare("SELECT * FROM chats WHERE id=? LIMIT 1");$st->execute([$chatId]);$chat=$st->fetch(PDO::FETCH_ASSOC)?:[];
    foreach(['client_user_id','master_user_id','sto_user_id','seller_user_id','assigned_admin_user_id'] as $key){$n=(int)($chat[$key]??0);if($n>0&&$n!==$excludeUserId)$ids[$n]=true;}
    return array_map('intval',array_keys($ids));
}

function kareta_messaging_enqueue_chat_message(PDO $pdo, string $chatId, string $messageId, int $senderUserId, string $text, string $sourceChannel=''): int
{
    if(!kareta_messaging_core_enabled())return 0;
    // Do not touch Messaging tables on installations where no provider is configured.
    if(!kareta_messaging_provider_configured('telegram')&&!kareta_messaging_provider_configured('whatsapp'))return 0;
    kareta_messaging_schema($pdo);
    $text=trim($text);if($text==='')$text='Новое сообщение в KARETA.KZ';
    $count=0;
    foreach(kareta_messaging_chat_recipients($pdo,$chatId,$senderUserId) as $recipientUserId){
        $prefs=kareta_messaging_preferences($pdo,$recipientUserId);
        if(empty($prefs['notifyMessages']))continue;
        $channel=(string)($prefs['primaryChannel']??'kareta');
        if(!in_array($channel,['telegram','whatsapp'],true)||$channel===$sourceChannel)continue;
        if(!kareta_messaging_provider_configured($channel))continue;
        $link=kareta_messaging_link_row($pdo,$recipientUserId,$channel);if(!$link)continue;
        $payload=['text'=>$text,'chatUrl'=>kareta_messaging_chat_url($chatId),'sourceChannel'=>$sourceChannel];
        $st=$pdo->prepare("INSERT IGNORE INTO messaging_deliveries(message_id,chat_id,recipient_user_id,channel,status,payload_json,next_attempt_at) VALUES(?,?,?,?, 'pending', ?, NOW())");
        $st->execute([$messageId,$chatId,$recipientUserId,$channel,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $count+=$st->rowCount()>0?1:0;
    }
    return $count;
}

function kareta_messaging_delivery_text(array $delivery): string
{
    $payload=json_decode((string)($delivery['payload_json']??''),true);if(!is_array($payload))$payload=[];
    if((string)($payload['kind']??'')==='notification'){
        $title=trim((string)($payload['title']??''));$body=trim((string)($payload['body']??''));
        $text=trim($title.(($title!==''&&$body!=='')?"\n":'').$body);if($text==='')$text='Новое событие в KARETA.KZ';
        return "KARETA.KZ\n".$text;
    }
    $text=trim((string)($payload['text']??''));if($text==='')$text='Новое сообщение в KARETA.KZ';
    return "KARETA.KZ\n".$text;
}

function kareta_messaging_dispatch_delivery(PDO $pdo, array $delivery): array
{
    $id=(int)($delivery['id']??0);$channel=(string)($delivery['channel']??'');$userId=(int)($delivery['recipient_user_id']??0);$chatId=(string)($delivery['chat_id']??'');
    $link=kareta_messaging_link_row($pdo,$userId,$channel);
    if(!$link)return ['ok'=>false,'terminal'=>true,'error'=>'channel_unlinked'];
    if(!kareta_messaging_provider_configured($channel))return ['ok'=>false,'terminal'=>false,'error'=>'provider_not_configured'];
    $text=kareta_messaging_delivery_text($delivery);$payload=json_decode((string)($delivery['payload_json']??''),true);if(!is_array($payload))$payload=[];
    if($channel==='telegram'){
        $target=(string)($link['external_chat_id']??$link['external_user_id']??'');
        if((string)($payload['kind']??'')==='notification'){
            $keyboard=kareta_messaging_telegram_notification_keyboard($pdo,$userId,$payload);
            return kareta_messaging_telegram_send_raw($target,$text,'',$keyboard);
        }
        return kareta_messaging_telegram_send_raw($target,$text,$chatId);
    }
    if($channel==='whatsapp'){
        if((string)($payload['kind']??'')==='notification'){
            $url=trim((string)($payload['actionUrl']??''));if($url!=='')$text.="\n".kareta_messaging_public_url($url);
        }else{
            $chatUrl=trim((string)($payload['chatUrl']??''));if($chatUrl!=='')$text.="\n".$chatUrl;
        }
        return kareta_messaging_whatsapp_send_raw($pdo,(string)($link['external_user_id']??''),$text);
    }
    return ['ok'=>false,'terminal'=>true,'error'=>'invalid_channel'];
}

function kareta_messaging_worker_once(PDO $pdo, int $limit=25): array
{
    if(!kareta_messaging_core_enabled())return ['processed'=>0,'sent'=>0,'failed'=>0,'blocked'=>0];
    kareta_messaging_schema($pdo);$limit=max(1,min(100,$limit));
    // Recover abandoned claims after a worker crash.
    $pdo->exec("UPDATE messaging_deliveries SET status='retry',locked_at=NULL WHERE status='processing' AND locked_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)");
    $st=$pdo->query("SELECT * FROM messaging_deliveries WHERE status IN ('pending','retry','blocked_window') AND (next_attempt_at IS NULL OR next_attempt_at<=NOW()) ORDER BY id ASC LIMIT ".(int)$limit);
    $rows=$st->fetchAll(PDO::FETCH_ASSOC)?:[];$out=['processed'=>0,'sent'=>0,'failed'=>0,'blocked'=>0];
    foreach($rows as $row){
        $id=(int)$row['id'];
        $claim=$pdo->prepare("UPDATE messaging_deliveries SET status='processing',locked_at=NOW(),attempts=attempts+1 WHERE id=? AND status IN ('pending','retry','blocked_window')");$claim->execute([$id]);
        if($claim->rowCount()!==1)continue;
        $out['processed']++;
        try{$result=kareta_messaging_dispatch_delivery($pdo,$row);}catch(Throwable $e){$result=['ok'=>false,'error'=>'provider_exception'];if(function_exists('kareta_log_error'))kareta_log_error('MESSAGING_WORKER',$e->getMessage());}
        if(!empty($result['ok'])){
            $pdo->prepare("UPDATE messaging_deliveries SET status='sent',external_message_id=?,error_code='',locked_at=NULL,next_attempt_at=NULL WHERE id=?")
                ->execute([(string)($result['externalMessageId']??''),$id]);
            $pdo->prepare("UPDATE messaging_channel_links SET last_outbound_at=NOW() WHERE user_id=? AND channel=?")->execute([(int)$row['recipient_user_id'],(string)$row['channel']]);
            $out['sent']++;continue;
        }
        $error=mb_substr((string)($result['error']??'delivery_failed'),0,64,'UTF-8');
        if(!empty($result['blocked'])){
            $pdo->prepare("UPDATE messaging_deliveries SET status='blocked_window',error_code=?,locked_at=NULL,next_attempt_at=DATE_ADD(NOW(),INTERVAL 30 MINUTE) WHERE id=?")->execute([$error,$id]);$out['blocked']++;continue;
        }
        if(!empty($result['terminal'])){
            $pdo->prepare("UPDATE messaging_deliveries SET status='failed',error_code=?,locked_at=NULL,next_attempt_at=NULL WHERE id=?")->execute([$error,$id]);$out['failed']++;continue;
        }
        $attempts=(int)($row['attempts']??0)+1;$delay=min(3600,30*(2**min(6,$attempts)));
        $pdo->prepare("UPDATE messaging_deliveries SET status=?,error_code=?,locked_at=NULL,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE id=?")
            ->execute([$attempts>=8?'failed':'retry',$error,$delay,$id]);$out['failed']++;
    }
    return $out;
}

function kareta_messaging_record_inbound(PDO $pdo, string $provider, string $eventId, string $rawPayload): bool
{
    kareta_messaging_schema($pdo);$hash=hash('sha256',$rawPayload);
    $st=$pdo->prepare("INSERT IGNORE INTO messaging_inbound_events(provider,event_id,payload_hash) VALUES(?,?,?)");$st->execute([$provider,$eventId,$hash]);
    return $st->rowCount()===1;
}

function kareta_messaging_finish_inbound(PDO $pdo,string $provider,string $eventId,string $status,int $userId=0,string $chatId='',string $messageId='',string $error=''): void
{
    kareta_messaging_schema($pdo);
    $pdo->prepare("UPDATE messaging_inbound_events SET status=?,user_id=?,chat_id=?,message_id=?,error_code=?,processed_at=NOW() WHERE provider=? AND event_id=?")
        ->execute([$status,$userId?:null,$chatId,$messageId,mb_substr($error,0,64,'UTF-8'),$provider,$eventId]);
}

function kareta_messaging_find_user_by_external(PDO $pdo,string $channel,string $externalUserId): int
{
    kareta_messaging_schema($pdo);$st=$pdo->prepare("SELECT user_id FROM messaging_channel_links WHERE channel=? AND external_user_id=? AND status='linked' LIMIT 1");$st->execute([$channel,$externalUserId]);return (int)($st->fetchColumn()?:0);
}

function kareta_messaging_resolve_chat(PDO $pdo,int $userId,string $channel,string $replyExternalMessageId='',bool $strictReplyMatch=false): string
{
    kareta_messaging_schema($pdo);
    if($replyExternalMessageId!==''){
        $st=$pdo->prepare("SELECT chat_id FROM messaging_deliveries WHERE recipient_user_id=? AND channel=? AND external_message_id=? AND status='sent' ORDER BY id DESC LIMIT 1");$st->execute([$userId,$channel,$replyExternalMessageId]);$chatId=(string)($st->fetchColumn()?:'');if($chatId!==''&&kareta_messaging_user_can_access_chat($pdo,$userId,$chatId))return $chatId;
        if ($strictReplyMatch) return '';
    }
    $st=$pdo->prepare("SELECT chat_id FROM messaging_deliveries WHERE recipient_user_id=? AND channel=? AND status='sent' AND updated_at>DATE_SUB(NOW(),INTERVAL 24 HOUR) ORDER BY updated_at DESC,id DESC LIMIT 1");$st->execute([$userId,$channel]);$chatId=(string)($st->fetchColumn()?:'');
    return $chatId!==''&&kareta_messaging_user_can_access_chat($pdo,$userId,$chatId)?$chatId:'';
}

function kareta_messaging_user_can_access_chat(PDO $pdo,int $userId,string $chatId): bool
{
    if($userId<=0||$chatId==='')return false;
    try{$st=$pdo->prepare("SELECT 1 FROM chat_participants WHERE chat_id=? AND user_id=? AND left_at IS NULL LIMIT 1");$st->execute([$chatId,$userId]);if($st->fetchColumn())return true;}catch(Throwable $_){}
    $st=$pdo->prepare("SELECT * FROM chats WHERE id=? LIMIT 1");$st->execute([$chatId]);$chat=$st->fetch(PDO::FETCH_ASSOC);if(!$chat)return false;
    foreach(['client_user_id','master_user_id','sto_user_id','seller_user_id','assigned_admin_user_id'] as $key)if((int)($chat[$key]??0)===$userId)return true;
    return false;
}

function kareta_messaging_user_role(PDO $pdo,int $userId): string
{
    $st=$pdo->prepare("SELECT role FROM users WHERE id=? AND active=1 LIMIT 1");$st->execute([$userId]);$role=strtolower((string)($st->fetchColumn()?:'client'));
    return in_array($role,['client','master','sto','seller','admin','owner'],true)?($role==='owner'?'admin':$role):'client';
}

function kareta_messaging_insert_external_message(PDO $pdo,int $userId,string $channel,string $externalMessageId,string $chatId,string $text,bool $allowLegacySchemaRepair=true): string
{
    if(!kareta_messaging_user_can_access_chat($pdo,$userId,$chatId))throw new DomainException('chat_forbidden');
    $preferences=kareta_messaging_preferences($pdo,$userId);
    if(empty($preferences['allowExternalReplies']))throw new DomainException('external_replies_disabled');
    $text=trim($text);if($text==='')throw new InvalidArgumentException('empty_message');
    if ($allowLegacySchemaRepair) {
        try{kareta_ensure_column($pdo,'messages','client_message_id',"ALTER TABLE messages ADD COLUMN client_message_id VARCHAR(96) NULL DEFAULT NULL AFTER id");}catch(Throwable $_){}
        try{kareta_ensure_index($pdo,'messages','uq_messages_client_message_id',"ALTER TABLE messages ADD UNIQUE KEY uq_messages_client_message_id (chat_id,from_role,client_message_id)");}catch(Throwable $_){}
    }
    $role=kareta_messaging_user_role($pdo,$userId);$id='mx_'.substr(hash('sha256',$channel.'|'.$externalMessageId),0,32);$clientId=mb_substr($channel.':'.$externalMessageId,0,96,'UTF-8');
    $meta=json_encode(['externalChannel'=>$channel,'externalMessageId'=>$externalMessageId],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    $st=$pdo->prepare("INSERT IGNORE INTO messages(id,client_message_id,chat_id,order_id,from_role,author_user_id,type,text,meta,time,created_at)
      SELECT ?,?,c.id,COALESCE(c.order_id,''),?,?, 'text',?,?,?,NOW() FROM chats c WHERE c.id=? LIMIT 1");
    $st->execute([$id,$clientId,$role,$userId,mb_substr($text,0,4000,'UTF-8'),$meta,date('H:i'),$chatId]);
    if($st->rowCount()===0){$dup=$pdo->prepare("SELECT id FROM messages WHERE chat_id=? AND from_role=? AND client_message_id=? LIMIT 1");$dup->execute([$chatId,$role,$clientId]);$existing=(string)($dup->fetchColumn()?:'');if($existing!=='')return $existing;throw new RuntimeException('message_insert_failed');}
    try{$pdo->prepare("UPDATE chat_participants SET unread_count=unread_count+1 WHERE chat_id=? AND user_id<>? AND left_at IS NULL")->execute([$chatId,$userId]);}catch(Throwable $_){}
    $pdo->prepare("UPDATE chats SET updated_at=NOW() WHERE id=?")->execute([$chatId]);
    // Keep legacy counters in sync with the existing chat UI.
    if($role==='client')$pdo->prepare("UPDATE chats SET unread_master=unread_master+1,unread_admin=unread_admin+1 WHERE id=?")->execute([$chatId]);
    elseif(in_array($role,['master','admin'],true))$pdo->prepare("UPDATE chats SET unread_client=unread_client+1 WHERE id=?")->execute([$chatId]);
    elseif($role==='sto')$pdo->prepare("UPDATE chats SET unread_client=unread_client+1,unread_master=unread_master+1 WHERE id=?")->execute([$chatId]);
    elseif($role==='seller')$pdo->prepare("UPDATE chats SET unread_client=unread_client+1 WHERE id=?")->execute([$chatId]);
    foreach(kareta_messaging_chat_recipients($pdo,$chatId,$userId) as $recipient){
        if(function_exists('kareta_notification_insert')){
            try{kareta_notification_insert($pdo,['recipientUserId'=>$recipient,'eventType'=>'message.new','entityType'=>'chat','entityId'=>$chatId,'title'=>'Новое сообщение','body'=>mb_substr($text,0,140,'UTF-8'),'actionUrl'=>'#/chats?chatId='.rawurlencode($chatId),'meta'=>['chatId'=>$chatId,'externalChannel'=>$channel]]);}catch(Throwable $_){}
        }
    }
    kareta_messaging_enqueue_chat_message($pdo,$chatId,$id,$userId,$text,$channel);
    return $id;
}

function kareta_messaging_touch_inbound(PDO $pdo,int $userId,string $channel): void
{
    kareta_messaging_schema($pdo);$pdo->prepare("UPDATE messaging_channel_links SET last_inbound_at=NOW() WHERE user_id=? AND channel=?")->execute([$userId,$channel]);
    if($channel==='whatsapp')$pdo->prepare("UPDATE messaging_deliveries SET status='retry',next_attempt_at=NOW() WHERE recipient_user_id=? AND channel='whatsapp' AND status='blocked_window'")->execute([$userId]);
}
