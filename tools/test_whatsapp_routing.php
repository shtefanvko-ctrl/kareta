<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once dirname(__DIR__) . '/api/messaging_whatsapp_routing.php';

$checks = 0;
function check(bool $ok, string $label): void
{
    global $checks;
    if (!$ok) throw new RuntimeException('FAIL: ' . $label);
    ++$checks;
    echo 'PASS: ' . $label . "\n";
}

function incoming(string $field, string $id, int $at, string $text = 'Ответ клиента', string $phone = '10001', string $customer = '77010000001'): array
{
    $body = ['contacts'=>[['wa_id'=>$customer, 'profile'=>['name'=>'Клиент']]],
        'messages'=>[['id'=>$id, 'from'=>$customer, 'timestamp'=>(string)$at,
            'type'=>'text', 'text'=>['body'=>$text], 'context'=>['id'=>'wamid.sent']]]];
    $value = ['messaging_product'=>'whatsapp', 'metadata'=>['phone_number_id'=>$phone]];
    if ($field === 'standby') $value['standby'] = $body;
    else $value += $body;
    return ['object'=>'whatsapp_business_account', 'entry'=>[['changes'=>[['field'=>$field, 'value'=>$value]]]]];
}

function handover(string $type, int $at, string $phone = '10001'): array
{
    return ['object'=>'whatsapp_business_account', 'entry'=>[['changes'=>[['field'=>'messaging_handovers',
        'value'=>['messaging_product'=>'whatsapp', 'type'=>$type, 'timestamp'=>(string)$at,
            'sender'=>['phone_number'=>'+77010000001'], 'recipient'=>['phone_number_id'=>$phone],
            $type=>['previous_owner_role'=>'ai_agent', 'new_owner_role'=>'customer_service']]]]]]];
}

$now = time();
$normal = kareta_messaging_whatsapp_events(incoming('messages', 'wamid.normal', $now-20), '10001', $now);
$standby = kareta_messaging_whatsapp_events(incoming('standby', 'wamid.standby', $now-10), '10001', $now);
check(count($normal) === 1 && $normal[0]['ownership'] === 'owned', 'ordinary delivery identifies ownership');
check(count($standby) === 1 && $standby[0]['ownership'] === 'standby' && $standby[0]['message']['text']['body'] === 'Ответ клиента', 'nested standby text and contact are decoded');
$owned = kareta_messaging_whatsapp_fold([], $normal[0]);
check(kareta_messaging_whatsapp_block_reason($owned, $now) === '', 'fresh owned customer message permits a service send');
$revoked = kareta_messaging_whatsapp_fold($owned, $standby[0]);
check(kareta_messaging_whatsapp_block_reason($revoked, $now) === 'whatsapp_thread_not_owned', 'standby blocks sends despite recent customer activity');
check(kareta_messaging_whatsapp_fold($revoked, $normal[0]) === $revoked, 'replayed older normal message cannot restore ownership');
$grant = kareta_messaging_whatsapp_events(handover('control_passed', $now-5), '10001', $now)[0];
$taken = kareta_messaging_whatsapp_events(handover('control_taken', $now-4), '10001', $now)[0];
$restored = kareta_messaging_whatsapp_fold($revoked, $grant);
check(kareta_messaging_whatsapp_block_reason($restored, $now) === '', 'new control_passed restores sends in the existing window');
check(kareta_messaging_whatsapp_fold($restored, $taken)['ownership'] === 'standby', 'control_taken revokes ownership');
$sameTime = $normal[0];
$sameTime['timestamp'] = $standby[0]['timestamp'];
check(kareta_messaging_whatsapp_fold($revoked, $sameTime)['ownership'] === 'standby', 'revoke wins a conflicting second-resolution timestamp');
check(kareta_messaging_whatsapp_block_reason(kareta_messaging_whatsapp_fold([], $grant), $now) === 'whatsapp_service_window_closed', 'handover without customer activity cannot open a window');
$expired = $owned;
$expired['last_customer_at'] = $now-86400;
check(kareta_messaging_whatsapp_block_reason($expired, $now) === 'whatsapp_service_window_closed', '24-hour inactivity expires the service window');
check(kareta_messaging_whatsapp_block_reason([], $now) === 'whatsapp_thread_not_owned', 'unknown ownership fails closed');
check(kareta_messaging_whatsapp_events(incoming('messages', 'foreign', $now, 'x', '99999'), '10001', $now) === [], 'another business phone cannot inject messages');
check(kareta_messaging_whatsapp_events(handover('control_passed', $now, '99999'), '10001', $now) === [], 'another business phone cannot grant ownership');
check(kareta_messaging_whatsapp_events(handover('future_event', $now), '10001', $now) === [], 'unknown handover is ignored');
check(kareta_messaging_whatsapp_events(incoming('future_field', 'unknown', $now), '10001', $now) === [], 'unknown webhook field is ignored');
check(kareta_messaging_whatsapp_events(['object'=>'instagram', 'entry'=>null], '10001', $now) === [], 'wrong topic and malformed arrays are ignored');
check(kareta_messaging_whatsapp_events(incoming('messages', 'bsuid', $now, 'x', '10001', 'BSUID_123456'), '10001', $now) === [], 'unsupported BSUID is not stripped into a phone identity');
check(kareta_messaging_whatsapp_events(handover('control_passed', $now+301), '10001', $now) === [], 'future timestamp cannot grant ownership');
$malformed = incoming('standby', 'bad', $now);
$malformed['entry'][0]['changes'][0]['value']['standby']['messages'] = 'invalid';
check(kareta_messaging_whatsapp_events($malformed, '10001', $now) === [], 'malformed standby collection is ignored');

$outbound = incoming('standby', 'unused', $now-1);
$outbound['entry'][0]['changes'][0]['value']['standby'] = [
    'message_echoes'=>[['id'=>'echo', 'timestamp'=>(string)($now-1), 'message'=>['to'=>'77010000001','type'=>'text','text'=>['body'=>'Ответ агента']]]],
    'statuses'=>[['id'=>'echo','timestamp'=>(string)$now,'recipient_id'=>'77010000001','status'=>'read']]];
$observations = kareta_messaging_whatsapp_events($outbound, '10001', $now);
check(count($observations) === 2 && !isset($observations[0]['message'], $observations[1]['message']), 'echoes and receipts never become inbound customer messages');
$state = $owned;
foreach ($observations as $event) $state = kareta_messaging_whatsapp_fold($state, $event);
check($state['ownership'] === 'standby' && $state['last_customer_at'] === $owned['last_customer_at'], 'outbound observations revoke ownership without extending the window');

echo "WhatsApp routing: {$checks} checks passed.\n";
