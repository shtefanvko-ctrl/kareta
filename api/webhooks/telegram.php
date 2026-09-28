<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/messaging_core.php';
require_once dirname(__DIR__) . '/messaging_live_actions.php';

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
    kareta_json(['ok'=>false,'error'=>'method_not_allowed'],405);
}
$cfg = kareta_messaging_config()['telegram'] ?? [];
if (!kareta_messaging_provider_configured('telegram')) kareta_json(['ok'=>false,'error'=>'provider_not_configured'],503);
$expected = (string)($cfg['webhook_secret'] ?? '');
$provided = (string)($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '');
if ($expected === '' || $provided === '' || !hash_equals($expected,$provided)) kareta_json(['ok'=>false,'error'=>'invalid_webhook_secret'],403);

$raw = (string)file_get_contents('php://input');
$update = json_decode($raw,true);
if (!is_array($update)) kareta_json(['ok'=>true]);
$eventId = (string)($update['update_id'] ?? '');
if ($eventId === '') kareta_json(['ok'=>true]);
$pdo = kareta_pdo();
if (!$pdo instanceof PDO) kareta_json(['ok'=>false,'error'=>'database_unavailable'],503);

try {
    if (!kareta_messaging_record_inbound($pdo,'telegram',$eventId,$raw)) kareta_json(['ok'=>true,'duplicate'=>true]);

    // R188.5.5.6.84.87: secure Telegram inline callback actions.
    $callback=is_array($update['callback_query']??null)?$update['callback_query']:[];
    if($callback){
        $callbackId=trim((string)($callback['id']??''));$data=trim((string)($callback['data']??''));
        $from=is_array($callback['from']??null)?$callback['from']:[];$tgUserId=trim((string)($from['id']??''));
        $tgChatId=trim((string)($callback['message']['chat']['id']??''));
        if($callbackId===''||$tgUserId===''||!preg_match('~^ka:([A-Za-z0-9_-]{12,128})$~',$data,$m)){
            if($callbackId!=='')kareta_messaging_telegram_answer_callback($callbackId,'Кнопка KARETA недействительна.',true);
            kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'ignored',0,'','','unsupported_callback');
            kareta_json(['ok'=>true]);
        }
        $userId=kareta_messaging_find_user_by_external($pdo,'telegram',$tgUserId);
        if($userId<=0){
            kareta_messaging_telegram_answer_callback($callbackId,'Сначала подключите Telegram в KARETA.',true);
            kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'rejected',0,'','','channel_not_linked');
            kareta_json(['ok'=>true]);
        }
        try{
            $token=kareta_messaging_action_token_get($pdo,$userId,'telegram',$m[1]);
            $result=kareta_messaging_execute_live_action($pdo,$userId,$token);
            kareta_messaging_action_token_finish($pdo,$userId,'telegram',$m[1],'ok');
            $messageText=(string)($result['message']??'Действие выполнено.');
            kareta_messaging_telegram_answer_callback($callbackId,$messageText,false);
            if($tgChatId!==''&&($result['orderId']??'')!=='')kareta_messaging_telegram_send_raw($tgChatId,$messageText,'',[[['text'=>'Открыть заказ KARETA','url'=>kareta_messaging_order_url((string)$result['orderId'])]]]);
            kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'action_processed',$userId,'',(string)($result['orderId']??''));
            kareta_json(['ok'=>true,'action'=>true]);
        }catch(Throwable $actionError){
            $messageText=kareta_messaging_live_action_user_message($actionError);
            kareta_messaging_telegram_answer_callback($callbackId,$messageText,true);
            kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'action_rejected',$userId,'','','action_'.preg_replace('/[^a-z0-9_:-]+/i','_',substr($actionError->getMessage(),0,48)));
            kareta_json(['ok'=>true,'action'=>false]);
        }
    }

    $message = is_array($update['message'] ?? null) ? $update['message'] : (is_array($update['edited_message'] ?? null) ? $update['edited_message'] : []);
    $from = is_array($message['from'] ?? null) ? $message['from'] : [];
    $tgUserId = trim((string)($from['id'] ?? ''));
    $tgChatId = trim((string)($message['chat']['id'] ?? ''));
    $text = trim((string)($message['text'] ?? ''));
    if ($tgUserId === '' || $tgChatId === '' || $text === '') {
        kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'ignored',0,'','','unsupported_message');
        kareta_json(['ok'=>true]);
    }
    $displayName = trim(implode(' ',array_filter([(string)($from['first_name'] ?? ''),(string)($from['last_name'] ?? '')])));
    if ($displayName === '') $displayName = trim((string)($from['username'] ?? 'Telegram'));

    if (preg_match('~^/start(?:@\w+)?\s+kareta_([A-Za-z0-9_-]{8,128})\s*$~u',$text,$m)) {
        $userId = kareta_messaging_consume_link_token($pdo,'telegram',$m[1]);
        if ($userId <= 0) {
            kareta_messaging_telegram_send_raw($tgChatId,'Ссылка подключения KARETA истекла. Создайте новую в настройках аккаунта.');
            kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'rejected',0,'','','link_token_invalid');
            kareta_json(['ok'=>true]);
        }
        kareta_messaging_link($pdo,$userId,'telegram',$tgUserId,$tgChatId,'',$displayName);
        kareta_messaging_telegram_send_raw($tgChatId,'Telegram подключён к KARETA.KZ. Ответы на сообщения KARETA будут сохранены в соответствующем чате.');
        kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'linked',$userId);
        kareta_json(['ok'=>true]);
    }

    $userId = kareta_messaging_find_user_by_external($pdo,'telegram',$tgUserId);
    if ($userId <= 0) {
        kareta_messaging_telegram_send_raw($tgChatId,'Сначала подключите Telegram в настройках аккаунта KARETA.KZ.');
        kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'rejected',0,'','','channel_not_linked');
        kareta_json(['ok'=>true]);
    }
    kareta_messaging_touch_inbound($pdo,$userId,'telegram');
    $replyId = trim((string)($message['reply_to_message']['message_id'] ?? ''));
    $chatId = kareta_messaging_resolve_chat($pdo,$userId,'telegram',$replyId);
    if ($chatId === '') {
        kareta_messaging_telegram_send_raw($tgChatId,'Не удалось определить чат KARETA. Откройте нужный чат в KARETA и ответьте на последнее сообщение бота.');
        kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'unrouted',$userId,'','','chat_not_resolved');
        kareta_json(['ok'=>true]);
    }
    $messageId = kareta_messaging_insert_external_message($pdo,$userId,'telegram',(string)($message['message_id'] ?? $eventId),$chatId,$text);
    kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'processed',$userId,$chatId,$messageId);
    kareta_json(['ok'=>true]);
} catch (Throwable $e) {
    try { kareta_messaging_finish_inbound($pdo,'telegram',$eventId,'failed',0,'','',$e instanceof DomainException ? $e->getMessage() : 'processing_failed'); } catch(Throwable $_) {}
    if (function_exists('kareta_log_error')) kareta_log_error('TELEGRAM_WEBHOOK',$e->getMessage());
    // Return 200 only for safely recorded application failures to avoid provider retry storms.
    kareta_json(['ok'=>true,'processed'=>false]);
}
