<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/messaging_core.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$cfg = kareta_messaging_config()['whatsapp'] ?? [];
if ($method === 'GET') {
    $mode=(string)($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
    $token=(string)($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
    $challenge=(string)($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
    $expected=(string)($cfg['verify_token'] ?? '');
    if ($mode==='subscribe' && $expected!=='' && $token!=='' && hash_equals($expected,$token)) {
        header('Content-Type: text/plain; charset=utf-8'); echo $challenge; exit;
    }
    kareta_json(['ok'=>false,'error'=>'verification_failed'],403);
}
if ($method !== 'POST') kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
if (!kareta_messaging_provider_configured('whatsapp')) kareta_json(['ok'=>false,'error'=>'provider_not_configured'],503);
$raw = (string)file_get_contents('php://input');
$appSecret=(string)($cfg['app_secret'] ?? '');
$signature=(string)($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
$expectedSignature='sha256='.hash_hmac('sha256',$raw,$appSecret);
if ($appSecret==='' || $signature==='' || !hash_equals($expectedSignature,$signature)) kareta_json(['ok'=>false,'error'=>'invalid_signature'],403);
$payload=json_decode($raw,true);if(!is_array($payload))kareta_json(['ok'=>true]);
$pdo=kareta_pdo();if(!$pdo instanceof PDO)kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);

foreach (($payload['entry'] ?? []) as $entry) {
    if (!is_array($entry)) continue;
    foreach (($entry['changes'] ?? []) as $change) {
        $value=is_array($change['value'] ?? null)?$change['value']:[];
        $contacts=is_array($value['contacts'] ?? null)?$value['contacts']:[];
        $names=[];foreach($contacts as $contact){if(!is_array($contact))continue;$wa=(string)($contact['wa_id']??'');if($wa!=='')$names[$wa]=(string)($contact['profile']['name']??'');}
        foreach (($value['messages'] ?? []) as $message) {
            if(!is_array($message))continue;
            $eventId=trim((string)($message['id']??''));if($eventId==='')continue;
            try {
                $eventRaw=json_encode($message,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?: $raw;
                if(!kareta_messaging_record_inbound($pdo,'whatsapp',$eventId,$eventRaw))continue;
                $waId=preg_replace('/\D+/','',(string)($message['from']??''))?:'';
                $text=trim((string)($message['text']['body']??''));
                if($waId===''||$text===''){
                    kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'ignored',0,'','','unsupported_message');continue;
                }
                if(preg_match('~^KARETA\s+([A-Za-z0-9_-]{8,128})\s*$~ui',$text,$m)){
                    $userId=kareta_messaging_consume_link_token($pdo,'whatsapp',$m[1]);
                    if($userId<=0){kareta_messaging_whatsapp_send_raw($waId,'Ссылка подключения KARETA истекла. Создайте новую в настройках аккаунта.');kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'rejected',0,'','','link_token_invalid');continue;}
                    kareta_messaging_link($pdo,$userId,'whatsapp',$waId,$waId,$waId,(string)($names[$waId]??''));
                    kareta_messaging_whatsapp_send_raw($waId,'WhatsApp подключён к KARETA.KZ. Ответы на сообщения KARETA будут сохранены в соответствующем чате.');
                    kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'linked',$userId);continue;
                }
                $userId=kareta_messaging_find_user_by_external($pdo,'whatsapp',$waId);
                if($userId<=0){kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'rejected',0,'','','channel_not_linked');continue;}
                kareta_messaging_touch_inbound($pdo,$userId,'whatsapp');
                $replyId=trim((string)($message['context']['id']??''));
                $chatId=kareta_messaging_resolve_chat($pdo,$userId,'whatsapp',$replyId);
                if($chatId===''){kareta_messaging_whatsapp_send_raw($waId,'Не удалось определить чат KARETA. Откройте нужный чат KARETA и ответьте на последнее сообщение.');kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'unrouted',$userId,'','','chat_not_resolved');continue;}
                $messageId=kareta_messaging_insert_external_message($pdo,$userId,'whatsapp',$eventId,$chatId,$text);
                kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'processed',$userId,$chatId,$messageId);
            } catch(Throwable $e) {
                try{kareta_messaging_finish_inbound($pdo,'whatsapp',$eventId,'failed',0,'','',$e instanceof DomainException?$e->getMessage():'processing_failed');}catch(Throwable $_){}
                if(function_exists('kareta_log_error'))kareta_log_error('WHATSAPP_WEBHOOK',$e->getMessage());
            }
        }
    }
}
kareta_json(['ok'=>true]);
