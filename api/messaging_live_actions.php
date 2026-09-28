<?php
declare(strict_types=1);

/**
 * KARETA Telegram Live Actions — R188.5.5.6.84.87
 *
 * Webhook actions never trust callback entity ids. The callback carries only an
 * opaque short-lived token stored server-side. Every mutating action resolves
 * the linked KARETA user again, checks the MASTER identity capability, verifies
 * order ownership/state under row locks and then applies the narrow mutation.
 */

require_once __DIR__ . '/identity/context_service.php';
require_once __DIR__ . '/identity/capability_service.php';
require_once __DIR__ . '/account_tariffs.php';
require_once __DIR__ . '/sto_workflow_engine.php';

function kareta_messaging_master_identity(PDO $pdo, int $userId): array
{
    if ($userId <= 0) throw new DomainException('telegram_user_not_linked');
    $q = $pdo->prepare("SELECT id,phone,role,active FROM users WHERE id=? LIMIT 1");
    $q->execute([$userId]);
    $user = $q->fetch(PDO::FETCH_ASSOC) ?: [];
    if (!$user || (int)($user['active'] ?? 0) !== 1) throw new DomainException('user_inactive');
    $phone = function_exists('kareta_normalize_phone') ? kareta_normalize_phone((string)($user['phone'] ?? '')) : preg_replace('/\D+/','',(string)($user['phone'] ?? ''));
    if ($phone === '') throw new DomainException('identity_account_unavailable');

    $q = $pdo->prepare("SELECT id FROM accounts WHERE phone=? AND status='active' LIMIT 1");
    $q->execute([$phone]);
    $accountId = (int)($q->fetchColumn() ?: 0);
    if ($accountId <= 0) throw new DomainException('identity_account_unavailable');

    $contexts = new KaretaIdentityContextService($pdo);
    $masterContext = null;
    foreach ($contexts->listContexts($accountId) as $context) {
        if ((string)($context['type'] ?? '') === 'profile' && strtolower((string)($context['profileType'] ?? $context['profile_type'] ?? '')) === 'master') {
            $masterContext = $context; break;
        }
    }
    if (!$masterContext) throw new DomainException('master_context_unavailable');

    $q = $pdo->prepare("SELECT id,user_id,name,initials,active FROM masters WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1");
    $q->execute([$userId]);
    $master = $q->fetch(PDO::FETCH_ASSOC) ?: [];
    if (!$master) throw new DomainException('master_profile_not_found');

    return [
        'user'=>$user,
        'userId'=>$userId,
        'accountId'=>$accountId,
        'contextId'=>(int)($masterContext['id'] ?? 0),
        'master'=>$master,
        'masterId'=>(string)($master['id'] ?? ''),
        'capabilities'=>new KaretaCapabilityService($pdo,$contexts),
    ];
}

function kareta_messaging_master_require_capability(PDO $pdo, int $userId, string $capability, array $resource=[]): array
{
    $identity = kareta_messaging_master_identity($pdo,$userId);
    $ok = $identity['capabilities']->can((int)$identity['accountId'],$capability,(int)$identity['contextId'],true,$resource);
    if (!$ok) throw new DomainException('capability_denied');
    return $identity;
}

function kareta_messaging_master_owned_order(PDO $pdo, array $identity, string $orderId, bool $forUpdate=false): array
{
    if ($orderId === '') throw new InvalidArgumentException('order_id_required');
    $sql = "SELECT * FROM orders WHERE id=? LIMIT 1" . ($forUpdate ? " FOR UPDATE" : "");
    $q = $pdo->prepare($sql); $q->execute([$orderId]);
    $order = $q->fetch(PDO::FETCH_ASSOC) ?: [];
    if (!$order) throw new DomainException('order_not_found');
    $masterId=(string)($identity['masterId'] ?? '');$userId=(int)($identity['userId'] ?? 0);
    $owned = ((string)($order['master_id'] ?? '') === $masterId) || ((int)($order['master_user_id'] ?? 0) === $userId);
    if (!$owned) throw new DomainException('order_not_assigned_to_master');
    return $order;
}

function kareta_messaging_insert_notification(PDO $pdo, int $recipientUserId, string $eventType, string $orderId, string $title, string $body, string $actionUrl): void
{
    if (!function_exists('kareta_table_exists') || !kareta_table_exists($pdo,'notifications') || $recipientUserId <= 0) return;
    $q=$pdo->prepare("INSERT INTO notifications(recipient_user_id,recipient_phone,recipient_role,event_type,entity_type,entity_id,title,body,action_url,is_read,meta,created_at) VALUES(?, '', 'client', ?, 'order', ?, ?, ?, ?, 0, NULL, NOW())");
    $q->execute([$recipientUserId,$eventType,$orderId,mb_substr($title,0,191,'UTF-8'),mb_substr($body,0,2000,'UTF-8'),mb_substr($actionUrl,0,255,'UTF-8')]);
    try{if(function_exists('kareta_messaging_enqueue_notification')){$notificationId=(int)$pdo->lastInsertId();if($notificationId>0)kareta_messaging_enqueue_notification($pdo,$notificationId,['recipientUserId'=>$recipientUserId,'recipientRole'=>'client','eventType'=>$eventType,'entityType'=>'order','entityId'=>$orderId,'title'=>$title,'body'=>$body,'actionUrl'=>$actionUrl,'meta'=>['orderId'=>$orderId]]);}}catch(Throwable $_){}
}

function kareta_messaging_order_event(PDO $pdo, string $orderId, string $eventType, array $meta=[]): void
{
    if (!function_exists('kareta_table_exists') || !kareta_table_exists($pdo,'order_events')) return;
    try {
        $q=$pdo->prepare("INSERT INTO order_events(order_id,event_type,meta_json,created_at) VALUES(?,?,?,NOW())");
        $q->execute([$orderId,$eventType,json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    } catch (Throwable $_) { /* event schema differs on legacy installs; action must not fail */ }
}

function kareta_messaging_action_exchange_claim(PDO $pdo, int $userId, string $orderId): array
{
    $identity = kareta_messaging_master_require_capability($pdo,$userId,'requests.respond',['type'=>'order','key'=>$orderId]);
    $masterId=(string)$identity['masterId'];$master=$identity['master'];
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare("SELECT * FROM orders WHERE id=? LIMIT 1 FOR UPDATE");$q->execute([$orderId]);$order=$q->fetch(PDO::FETCH_ASSOC)?:[];
        if(!$order) throw new DomainException('order_not_found');
        if((string)($order['master_id']??'0')!=='0' && (string)($order['master_id']??'')!=='') throw new DomainException('already_taken');
        if(!in_array((string)($order['status']??''),['new','waiting_responses'],true)) throw new DomainException('order_not_available');
        if((string)($order['exchange_status']??'open')!=='open') throw new DomainException('exchange_closed');
        if(!empty($order['exchange_deadline_at']) && strtotime((string)$order['exchange_deadline_at'])<=time()) throw new DomainException('exchange_deadline_passed');

        $date=trim((string)($order['date']??''));$time=substr(trim((string)($order['time']??'')),0,5);
        if(!preg_match('/^\d{4}-\d{2}-\d{2}$/',$date)||!preg_match('/^\d{2}:\d{2}$/',$time)) throw new DomainException('schedule_required_in_kareta');
        $requestedTs=strtotime($date.' '.$time);if($requestedTs!==false&&$requestedTs<time()-900)throw new DomainException('schedule_required_in_kareta');
        $quota=kareta_tariff_master_guard($pdo,$masterId,$date,$orderId,false);
        if(empty($quota['canAccept'])) throw new DomainException('tariff_limit_reached');

        $name=(string)($master['name']??'Мастер');$initials=trim((string)($master['initials']??''));if($initials==='')$initials=mb_substr($name,0,1,'UTF-8');
        $upd=$pdo->prepare("UPDATE orders SET master_id=?,master_user_id=?,master_name=?,status='process',accepted_at=COALESCE(accepted_at,NOW()),assigned_admin_user_id=NULL WHERE id=? AND COALESCE(master_id,'0')='0' AND status IN ('new','waiting_responses')");
        $upd->execute([$masterId,$userId,$name,$orderId]);
        if($upd->rowCount()!==1) throw new DomainException('race_condition');
        kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'telegram_exchange_claim');
        $pdo->prepare("UPDATE chats SET master_id=?,master_user_id=?,master_name=?,master_init=?,status='process',assigned_admin_user_id=NULL WHERE order_id=?")
            ->execute([$masterId,$userId,$name,$initials,$orderId]);
        $q=$pdo->prepare("SELECT id FROM chats WHERE order_id=? LIMIT 1");$q->execute([$orderId]);$chatId=(string)($q->fetchColumn()?:'');
        if($chatId!==''){
            $text='Мастер '.$name.' принял заявку через Telegram. Запись: '.$date.' примерно '.$time.'.';
            $pdo->prepare("INSERT IGNORE INTO messages(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_tg_claim_'.substr(hash('sha256',$orderId.'|'.$masterId),0,18),$chatId,$orderId,'system',$userId,'event',$text,date('H:i'),date('Y-m-d H:i:s')]);
        }
        $clientUserId=(int)($order['client_user_id']??0);
        if($clientUserId>0)kareta_messaging_insert_notification($pdo,$clientUserId,'order.assigned',$orderId,'Заявка '.$orderId.': назначен мастер','Вашу заявку взял мастер '.$name.'. Запись: '.$date.' примерно '.$time.'.','#/orders/item/'.rawurlencode($orderId));
        kareta_messaging_order_event($pdo,$orderId,'master_accepted_telegram',['masterId'=>$masterId,'masterUserId'=>$userId,'date'=>$date,'time'=>$time]);
        $pdo->commit();
        return ['ok'=>true,'message'=>'Заявка принята. '.$date.' примерно '.$time.'.','orderId'=>$orderId];
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function kareta_messaging_action_exchange_hide(PDO $pdo, int $userId, string $orderId): array
{
    $identity = kareta_messaging_master_require_capability($pdo,$userId,'requests.respond',['type'=>'order','key'=>$orderId]);
    $masterId=(string)$identity['masterId'];
    $q=$pdo->prepare("SELECT id,status,master_id,COALESCE(exchange_status,'open') exchange_status FROM orders WHERE id=? LIMIT 1");$q->execute([$orderId]);$order=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$order)throw new DomainException('order_not_found');
    if(!in_array((string)$order['status'],['new','waiting_responses'],true)||(string)$order['exchange_status']!=='open')throw new DomainException('order_not_available');
    if(!function_exists('kareta_table_exists')||!kareta_table_exists($pdo,'master_exchange_hidden'))throw new DomainException('exchange_state_unavailable');
    $pdo->prepare("INSERT INTO master_exchange_hidden(request_id,master_id,master_user_id,active) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE master_user_id=VALUES(master_user_id),active=1,updated_at=CURRENT_TIMESTAMP")
        ->execute([$orderId,$masterId,$userId]);
    return ['ok'=>true,'message'=>'Заявка скрыта из вашей Биржи.','orderId'=>$orderId];
}

function kareta_messaging_action_start_diagnostics(PDO $pdo, int $userId, string $orderId): array
{
    $identity = kareta_messaging_master_require_capability($pdo,$userId,'work_orders.update_status',['type'=>'order','key'=>$orderId]);
    $order=kareta_messaging_master_owned_order($pdo,$identity,$orderId,false);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);$stage=(string)($workflow['current_stage']??'intake');
    if($stage==='diagnostics')return ['ok'=>true,'idempotent'=>true,'message'=>'Диагностика уже начата.','orderId'=>$orderId];
    if($stage!=='intake')throw new DomainException('lifecycle_stage_conflict');
    kareta_sto_workflow_transition_apply($pdo,$orderId,'diagnostics','Диагностика начата из Telegram',['source'=>'telegram_live_action','actorUserId'=>$userId]);
    $pdo->prepare("UPDATE orders SET status='process',updated_at=NOW() WHERE id=?")->execute([$orderId]);
    kareta_messaging_order_event($pdo,$orderId,'diagnostics_started_telegram',['masterUserId'=>$userId]);
    return ['ok'=>true,'message'=>'Диагностика начата.','orderId'=>$orderId];
}

function kareta_messaging_action_complete_work(PDO $pdo, int $userId, string $orderId): array
{
    $identity = kareta_messaging_master_require_capability($pdo,$userId,'work_orders.update_status',['type'=>'order','key'=>$orderId]);
    kareta_messaging_master_owned_order($pdo,$identity,$orderId,false);
    $workflow=kareta_sto_workflow_ensure($pdo,$orderId);$stage=(string)($workflow['current_stage']??'');
    if(in_array($stage,['quality_control','payment','delivery','warranty','completed'],true))return ['ok'=>true,'idempotent'=>true,'message'=>'Работы уже переданы на следующий этап.','orderId'=>$orderId];
    if($stage!=='in_progress')throw new DomainException('lifecycle_stage_conflict');
    kareta_sto_workflow_transition_apply($pdo,$orderId,'quality_control','Работы завершены из Telegram',['source'=>'telegram_live_action','actorUserId'=>$userId]);
    kareta_messaging_order_event($pdo,$orderId,'repair_completed_telegram',['masterUserId'=>$userId]);
    return ['ok'=>true,'message'=>'Работы завершены. Автомобиль передан на контроль качества.','orderId'=>$orderId];
}

function kareta_messaging_execute_live_action(PDO $pdo, int $userId, array $tokenRow): array
{
    $action=(string)($tokenRow['action_key']??'');$entityType=(string)($tokenRow['entity_type']??'');$entityId=(string)($tokenRow['entity_id']??'');
    if($entityType!=='order'||$entityId==='')throw new InvalidArgumentException('action_entity_invalid');
    return match($action){
        'master.exchange.claim'=>kareta_messaging_action_exchange_claim($pdo,$userId,$entityId),
        'master.exchange.hide'=>kareta_messaging_action_exchange_hide($pdo,$userId,$entityId),
        'master.order.start_diagnostics'=>kareta_messaging_action_start_diagnostics($pdo,$userId,$entityId),
        'master.order.complete_work'=>kareta_messaging_action_complete_work($pdo,$userId,$entityId),
        default=>throw new InvalidArgumentException('action_not_supported'),
    };
}

function kareta_messaging_live_action_user_message(Throwable $e): string
{
    return match($e->getMessage()){
        'action_token_invalid','action_token_used'=>'Кнопка уже недействительна. Откройте актуальную карточку KARETA.',
        'action_token_expired'=>'Срок действия кнопки истёк. Откройте актуальную карточку KARETA.',
        'capability_denied'=>'Это действие недоступно в текущем профиле Мастера.',
        'master_context_unavailable','master_profile_not_found'=>'Активный профиль Мастера не найден.',
        'order_not_found'=>'Заявка больше не найдена.',
        'already_taken','race_condition'=>'Заявку уже забрал другой Мастер.',
        'order_not_available','exchange_closed','exchange_deadline_passed'=>'Заявка уже закрыта или недоступна в Бирже.',
        'schedule_required_in_kareta'=>'Для этой заявки нужно сначала выбрать время в KARETA.',
        'tariff_limit_reached'=>'Лимит тарифа не позволяет принять ещё одну машину.',
        'order_not_assigned_to_master'=>'Заказ больше не назначен вам.',
        'lifecycle_stage_conflict'=>'Действие уже не соответствует текущему этапу ремонта.',
        default=>str_starts_with($e->getMessage(),'workflow_requirements_missing:')?'Перед переходом не выполнены обязательные пункты заказ-наряда. Откройте заказ в KARETA.':'Не удалось выполнить действие. Откройте актуальный заказ в KARETA.',
    };
}
