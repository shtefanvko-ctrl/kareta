<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';
/* R88: diagnostics must be registered before any dependency is loaded. */
$karetaDbRequestId = 'db_' . date('YmdHis') . '_' . bin2hex(random_bytes(4));
$karetaDbStartedAt = microtime(true);
$karetaDbActionHint = (string)($_GET['action'] ?? '');

function kareta_db_diag_write(array $entry): void {
    $dir = KARETA_LOG_ROOT;
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $entry['time'] = $entry['time'] ?? date('c');
    @file_put_contents($dir . '/db_' . date('Y-m-d') . '.jsonl', json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
}

function kareta_db_diag_respond(Throwable $e, string $phase = 'runtime'): void {
    global $karetaDbRequestId, $karetaDbStartedAt, $karetaDbActionHint;
    $action = $karetaDbActionHint;
    if ($action === '') {
        $raw = file_get_contents('php://input');
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $action = (string)($decoded['action'] ?? '');
        }
    }
    $entry = [
        'requestId' => $karetaDbRequestId,
        'phase' => $phase,
        'action' => $action,
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
        'uri' => $_SERVER['REQUEST_URI'] ?? '',
        'type' => get_class($e),
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString(),
        'durationMs' => (int)round((microtime(true) - $karetaDbStartedAt) * 1000),
        'memoryPeak' => memory_get_peak_usage(true),
    ];
    kareta_db_diag_write($entry);
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Kareta-Request-Id: ' . $karetaDbRequestId);
    }
    $payload=['ok'=>false,'error'=>'db_runtime_failure','requestId'=>$karetaDbRequestId,'action'=>$action];
    if(function_exists('kareta_diagnostics_authorized')&&kareta_diagnostics_authorized())$payload['diagnostic']=['type'=>get_class($e),'phase'=>$phase];
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(static function (Throwable $e): void { kareta_db_diag_respond($e, 'uncaught_exception'); });
register_shutdown_function(static function (): void {
    $last = error_get_last();
    if (!$last || !in_array($last['type'], [E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR,E_USER_ERROR], true)) return;
    kareta_db_diag_respond(new ErrorException((string)$last['message'], 0, (int)$last['type'], (string)$last['file'], (int)$last['line']), 'fatal_shutdown');
});


/**
 * KARETA.KZ — Universal DB API  /api/db.php
 * GET  ?action=pull          — полная выгрузка данных
 * GET  ?action=ping          — проверка соединения
 * POST { action, ...params } — CRUD операции
 */
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/identity/challenge_service.php';
require_once __DIR__ . '/identity/onboarding_identity_bridge.php';
require_once __DIR__ . '/identity/legacy_api_bridge.php';
require_once __DIR__ . '/identity/context_service.php';
require_once __DIR__ . '/catalog_fallback.php';
require_once __DIR__ . '/catalog/product_catalog.php';
require_once __DIR__ . '/catalog/service_catalog.php';
require_once __DIR__ . '/seller_shop.php';
require_once __DIR__ . '/masters_catalog.php';
require_once __DIR__ . '/master_social.php';
require_once __DIR__ . '/catalog_details.php';
require_once __DIR__ . '/work_orders.php';
require_once __DIR__ . '/client_exchange_scale.php';
require_once __DIR__ . '/sto_workflow_engine.php';
require_once __DIR__ . '/master_workplace.php';
require_once __DIR__ . '/master_shift_arrival.php';
require_once __DIR__ . '/master_day_operations.php';
require_once __DIR__ . '/account_tariffs.php';
require_once __DIR__ . '/sto_workplace.php';
require_once __DIR__ . '/production_dispatch.php';
require_once __DIR__ . '/master_recovery_control.php';
require_once __DIR__ . '/order_scope.php';
require_once __DIR__ . '/data_integrity.php';
require_once __DIR__ . '/vehicle_passport.php';
require_once __DIR__ . '/work_posts.php';
require_once __DIR__ . '/master_social_wall.php';
require_once __DIR__ . '/community_posts.php';
require_once __DIR__ . '/master_order_lifecycle.php';
require_once __DIR__ . '/master_order_aftercare.php';
require_once __DIR__ . '/operational_finance.php';
require_once __DIR__ . '/client_cabinet.php';
require_once __DIR__ . '/booking_product_interactions.php';
require_once __DIR__ . '/used_market.php';
require_once __DIR__ . '/messaging_core.php';

/* ══════════════════════════════════════════════════════════════════
   KARETA CONFIG — Demo/Prod переключатель (ТЗ 8)
══════════════════════════════════════════════════════════════════ */
function kareta_bool_env(string $name, bool $default): bool {
    $v = getenv($name);
    if ($v === false || $v === '') return $default;
    $parsed = filter_var($v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    return $parsed !== null ? $parsed : $default;
}
if (!defined('KARETA_DEMO_MODE'))        define('KARETA_DEMO_MODE',        kareta_bool_env('KARETA_DEMO_MODE',        false));
if (!defined('KARETA_DEMO_EXCHANGE'))    define('KARETA_DEMO_EXCHANGE',    kareta_bool_env('KARETA_DEMO_EXCHANGE',    false));
if (!defined('KARETA_SEED_ON_EMPTY_DB')) define('KARETA_SEED_ON_EMPTY_DB', kareta_bool_env('KARETA_SEED_ON_EMPTY_DB', false));

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo    = kareta_pdo();

/* GET ─────────────────────────────────────────────────────────────── */
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'ping';
    if ($action === 'ping') {
        $databaseState=kareta_db_public_state($pdo);
        $failureMeta=$databaseState==='ready'
            ? ['failureStage'=>'','failedMigrationVersion'=>0,'diagnosticCode'=>'','failureCategory'=>'','failureSqlState'=>'','failureDriverCode'=>'']
            : kareta_db_public_failure_meta();
        kareta_json([
            'ok'=>true,'dbReady'=>$pdo instanceof PDO,'databaseState'=>$databaseState,
            'recoveryAction'=>kareta_db_public_recovery_action($databaseState),
            'failureStage'=>$failureMeta['failureStage'],'failedMigrationVersion'=>$failureMeta['failedMigrationVersion'],
            'diagnosticCode'=>$failureMeta['diagnosticCode'],'failureCategory'=>$failureMeta['failureCategory'],
            'failureSqlState'=>$failureMeta['failureSqlState'],'failureDriverCode'=>$failureMeta['failureDriverCode'],
            'assetVersion'=>(defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : ''),
        ]);
    }
    if ($action === 'health') {
        if(!kareta_diagnostics_authorized())kareta_json(['ok'=>$pdo instanceof PDO,'status'=>$pdo instanceof PDO?'ready':'degraded','assetVersion'=>defined('KARETA_ASSET_VERSION')?KARETA_ASSET_VERSION:''],$pdo instanceof PDO?200:503);
        db_health($pdo);
    }
    if ($action === 'dataIntegrity.audit') { kareta_require_any_role(['admin','owner']); if (!$pdo) _no_db(); kareta_data_integrity_audit($pdo); }
    if ($action === 'shop.catalog') shop_catalog($pdo, $_GET);
    if ($action === 'shop.product') kareta_product_detail($pdo, $_GET);
    if ($action === 'shop.store') shop_storefront($pdo, $_GET);
    if ($action === 'usedMarket.list') { if (!$pdo) _no_db(); kareta_used_market_list($pdo,$_GET); }
    if ($action === 'usedMarket.detail') { if (!$pdo) _no_db(); kareta_used_market_detail($pdo,$_GET); }
    if ($action === 'booking.slots') { kareta_require_any_role(['client','master','sto','seller','admin','owner']); kareta_booking_slots($pdo,$_GET); }
    if ($action === 'services.detail') kareta_service_detail($pdo, $_GET);
    if ($action === 'providers.detail') kareta_provider_detail($pdo, $_GET);
    if ($action === 'news.list') news_public_list($pdo, $_GET);
    if ($action === 'news.mine') { if (!$pdo) _no_db(); kareta_require_any_role(['master','admin','owner']); news_mine($pdo); }
    if ($action === 'workPosts.list') { kareta_work_posts_list($pdo,$_GET); }
    if ($action === 'workPosts.detail') { kareta_work_post_detail($pdo,$_GET); }
    if ($action === 'workPosts.comments') { kareta_work_post_comments_list($pdo,$_GET); }
    if ($action === 'workPosts.socialState') { kareta_work_post_social_state($pdo,$_GET); }
    if ($action === 'masterSocialWall.feed') { kareta_master_social_wall_feed($pdo,$_GET); }
    if ($action === 'masterSocialWall.community') { kareta_master_social_wall_community($pdo,$_GET); }
    if ($action === 'masterSocialWall.mine') { if(!$pdo)_no_db(); kareta_master_social_wall_mine($pdo); }
    if ($action === 'masterSocialWall.comments') { if(!$pdo)_no_db(); kareta_master_social_wall_comments($pdo,$_GET); }
    if ($action === 'communityPosts.list') { kareta_community_posts_list($pdo,$_GET); }
    if ($action === 'communityGroups.list') { kareta_community_groups_list($pdo,$_GET); }
    if ($action === 'communityGroups.members') { if(!$pdo)_no_db(); kareta_community_group_members($pdo,$_GET); }
    if ($action === 'masterSocial.following') { if (!$pdo) _no_db(); kareta_require_any_role(['client','master','sto','seller','admin','owner']); kareta_master_social_following($pdo); }
    if ($action === 'masterWorks.portfolio') { if(!$pdo)_no_db(); kareta_master_works_portfolio($pdo,$_GET); }
    if ($action === 'services.catalog') kareta_json(['ok'=>true,'data'=>kareta_service_catalog_public_payload($pdo)]);
    if ($action === 'masters.catalog') masters_public_catalog($pdo, $_GET);
    if ($action === 'workOrders.detail') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'work_orders.read',['client','master','sto','admin','owner']); kareta_work_order_detail($pdo,$_GET); }
    if ($action === 'stoWorkflow.get') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'work_orders.read',['client','master','sto','admin','owner']); kareta_sto_workflow_get($pdo,$_GET); }
    if ($action === 'masterWorkplace.get') { if (!$pdo) _no_db(); kareta_master_workplace_require_onboarding_completed($pdo); kareta_require_api_capability($pdo,'work_orders.read',['master','admin','owner']); kareta_master_workplace_get($pdo); }
    if ($action === 'tariffs.getMine') { if (!$pdo) _no_db(); kareta_require_any_role(['client','master','admin','owner']); kareta_tariff_get_mine($pdo); }
    if ($action === 'tariffs.adminList') { if (!$pdo) _no_db(); kareta_tariff_admin_list($pdo); }
    if ($action === 'masterProfile.get') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); kareta_master_owner_profile_get($pdo); }
    if ($action === 'masterSchedule.get') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'calendar.read',['master','admin','owner']); kareta_master_schedule_get($pdo); }
    if ($action === 'clientSchedule.arrival.list') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'requests.read',['client']); kareta_client_arrival_list($pdo); }
    if ($action === 'stoWorkplace.get') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'organization.read',['sto','admin','owner']); kareta_sto_workplace_get($pdo); }
    if ($action === 'productionDispatch.dashboard') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_production_dispatch_dashboard($pdo); }
    if ($action === 'productionDispatch.rank') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_production_dispatch_rank($pdo,$_GET); }
    if ($action === 'operationalFinance.dashboard') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'finance.manage',['master','sto','admin','owner']); kareta_operational_finance_dashboard($pdo,$_GET); }
    if ($action === 'clientCabinet.get') { kareta_client_cabinet_get($pdo); }
    if ($action === 'clientFirstEntry.current') { kareta_client_first_entry_current($pdo); }
    if ($action === 'vehicles.detail') { if (!$pdo) _no_db(); kareta_require_api_capability($pdo,'vehicles.read',['client','master','sto','admin','owner']); kareta_vehicle_detail($pdo,$_GET); }
    if ($action === 'masters.catalog') kareta_json(['ok'=>true,'data'=>kareta_masters_catalog_payload($pdo)]);
    if ($action === 'serviceOffers.mine') {
        if (!$pdo) _no_db();
        kareta_service_offer_ensure_master_capability($pdo);
        kareta_require_api_capability($pdo,'services.manageOwn',['master','sto','admin','owner']);
        kareta_json(['ok'=>true,'data'=>kareta_service_offers_mine($pdo)]);
    }
    if ($action === 'masterExchange.feed') {
        if (!$pdo) _no_db();
        kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']);
        kareta_master_exchange_feed_v2($pdo);
    }
    if ($action === 'pull') {
        kareta_require_api_session($pdo,['client','master','sto','seller','admin','owner']);
        try {
            db_pull($pdo);
        } catch (Throwable $e) {
            if ($pdo instanceof PDO) {
                try { kareta_log_error('DB_PULL_FATAL', $e->getMessage()); } catch (Throwable $_) {}
            }
            db_pull_recovery($pdo, $e);
        }
    }
    kareta_json(['ok'=>false,'error'=>'unknown_action'],400);
}

/* POST ────────────────────────────────────────────────────────────── */
$body   = kareta_read_json();
$action = (string)($body['action'] ?? '');

switch ($action) {
    case 'dataIntegrity.repair': kareta_require_any_role(['admin','owner']); if (!$pdo) _no_db(); kareta_data_integrity_repair($pdo); break;
    case 'auth.sendOtp':   auth_send_otp($pdo, $body);   break;
    case 'auth.verifyOtp': auth_verify_otp($pdo, $body); break;
    case 'users.getAll':      kareta_require_role('admin'); users_getAll($pdo);             break;
    case 'users.setRole':     kareta_require_role('admin'); users_setRole($pdo,$body);      break;
    case 'users.setActive':   kareta_require_role('admin'); users_setActive($pdo,$body);    break;
    // users.upsert закрыт — использовать profile.updateMine или users.upsertAdmin
    case 'users.upsert':      kareta_json(['ok'=>false,'error'=>'method_deprecated','message'=>'Use profile.updateMine or users.upsertAdmin'], 405); break;
    case 'profile.updateMine': profile_update_mine($pdo,$body); break;
    case 'clientPreferences.save': kareta_client_preferences_save($pdo,$body); break;
    case 'clientFirstEntry.saveDraft': kareta_client_first_entry_save_draft($pdo,$body); break;
    case 'clientFirstEntry.dismiss': kareta_client_first_entry_dismiss($pdo,$body); break;
    case 'clientMaintenance.save': kareta_client_maintenance_save($pdo,$body); break;
    case 'clientExpense.save': kareta_client_expense_save($pdo,$body); break;
    case 'clientWarranty.save': kareta_client_warranty_save($pdo,$body); break;
    case 'clientDocument.save': kareta_client_document_save($pdo,$body); break;
    case 'clientDocument.delete': kareta_client_document_delete($pdo,$body); break;
    case 'seller.dashboard': seller_dashboard($pdo); break;
    case 'seller.profile.save': seller_profile_save($pdo,$body); break;
    case 'seller.products.save': seller_product_save($pdo,$body); break;
    case 'seller.products.delete': seller_product_delete($pdo,$body); break;
    case 'seller.products.restore': seller_product_restore($pdo,$body); break;
    case 'seller.products.stock': seller_product_stock($pdo,$body); break;
    case 'seller.orders.updateStatus': seller_order_update_status($pdo,$body); break;
    case 'seller.moderate': seller_moderate($pdo,$body); break;
    case 'shop.catalog': shop_catalog($pdo,$body); break;
    case 'shop.order.create': kareta_idempotency_begin($pdo,$action,$body); shop_create_order($pdo,$body); break;
    case 'usedMarket.save': if(!$pdo)_no_db(); kareta_idempotency_begin($pdo,$action,$body); kareta_used_market_save($pdo,$body); break;
    case 'usedMarket.delete': if(!$pdo)_no_db(); kareta_used_market_delete($pdo,$body); break;
    case 'usedMarket.favorite': if(!$pdo)_no_db(); kareta_used_market_favorite($pdo,$body); break;
    case 'usedMarket.view': if(!$pdo)_no_db(); kareta_used_market_view($pdo,$body); break;
    case 'usedMarket.status': if(!$pdo)_no_db(); kareta_used_market_status($pdo,$body); break;
    case 'productReviews.submit': kareta_require_api_capability($pdo,'market.reviews.create',['client','master','sto','seller','admin','owner']); kareta_idempotency_begin($pdo,$action,$body); kareta_product_review_submit($pdo,$body); break;
    case 'productQuestions.submit': kareta_require_api_capability($pdo,'market.questions.create',['client','master','sto','seller','admin','owner']); kareta_idempotency_begin($pdo,$action,$body); kareta_product_question_submit($pdo,$body); break;
    case 'users.upsertAdmin': kareta_require_role('admin'); kareta_json(['ok'=>true,'user'=>kareta_upsert_profile($pdo,$body['user']??$body)]); break;

    case 'services.save':     kareta_require_role('admin'); services_save($pdo,$body);      break;
    case 'services.delete':   kareta_require_role('admin'); services_delete($pdo,$body);    break;
    case 'services.importSource': kareta_require_role('admin'); services_import_source($pdo); break;
    case 'serviceOffers.save': if (!$pdo) _no_db(); kareta_service_offer_ensure_master_capability($pdo); kareta_require_api_capability($pdo,'services.manageOwn',['master','sto','admin','owner']); kareta_json(['ok'=>true,'offer'=>kareta_service_offer_save($pdo,$body)]); break;
    case 'serviceOffers.delete': if (!$pdo) _no_db(); kareta_service_offer_ensure_master_capability($pdo); kareta_require_api_capability($pdo,'services.manageOwn',['master','sto','admin','owner']); kareta_json(['ok'=>true,'result'=>kareta_service_offer_delete($pdo,$body)]); break;
    case 'masterSocial.update': kareta_require_any_role(['client','master','sto','seller','admin','owner']); if(!$pdo)_no_db(); kareta_master_social_update($pdo,$body); break;
    case 'stoSocial.update': kareta_require_any_role(['client','master','sto','seller','admin','owner']); if(!$pdo)_no_db(); kareta_sto_social_update($pdo,$body); break;
    case 'masterSocial.following': kareta_require_any_role(['client','master','sto','seller','admin','owner']); if(!$pdo)_no_db(); kareta_master_social_following($pdo); break;
    case 'masters.save':      kareta_require_api_capability($pdo,'profile.master.update',['master','admin','owner']); masters_save($pdo,$body);       break;
    case 'masters.debug':    kareta_require_role('admin'); $rows=$pdo?$pdo->query("SELECT id,name,phone,active FROM `masters` LIMIT 20")->fetchAll():[]; kareta_json(['ok'=>true,'count'=>count($rows),'rows'=>$rows]); break;
    case 'masters.delete':    kareta_require_role('admin'); masters_delete($pdo,$body);     break;
    case 'masterSchedules.save': kareta_require_api_capability($pdo,'calendar.manage',['admin','owner','master']); master_schedule_save($pdo,$body); break;
    case 'masterSchedules.delete': kareta_require_api_capability($pdo,'calendar.manage',['admin','owner','master']); master_schedule_delete($pdo,$body); break;
    case 'masterExchange.feed': kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); kareta_master_exchange_feed_v2($pdo); break;
    case 'masterExchange.getMine': kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); master_exchange_get_mine($pdo); break;
    case 'masterExchange.saveResponse': kareta_require_api_capability($pdo,'requests.respond',['master','sto','admin','owner']); kareta_idempotency_begin($pdo,$action,$body); master_exchange_save_response($pdo,$body); break;
    case 'masterExchange.cancelResponse': kareta_require_api_capability($pdo,'requests.respond',['master','sto','admin','owner']); master_exchange_cancel_response($pdo,$body); break;
    case 'masterExchange.toggleSaved': kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); master_exchange_toggle_saved($pdo,$body); break;
    case 'masterExchange.toggleHidden': kareta_require_api_capability($pdo,'requests.read',['master','sto','admin','owner']); master_exchange_toggle_hidden($pdo,$body); break;
    case 'stoOrders.assignMaster': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_master_assign($pdo,$body); break;
    case 'stoOrders.masterCandidates': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_order_master_candidates($pdo,$body); break;
    case 'stoBays.candidates': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_order_bay_candidates($pdo,$body); break;
    case 'stoRecovery.preview': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_recovery_preview($pdo,$body); break;
    case 'stoRecovery.apply': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_recovery_apply($pdo,$body); break;
    case 'stoRecovery.protect': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_recovery_protect($pdo,$body); break;
    case 'stoRecovery.notifyResend': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_recovery_notify_resend($pdo,$body); break;
    case 'stoSchedule.preferencesSave': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_schedule_preferences_save($pdo,$body); break;
    case 'stoCapacity.alternatives': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_order_alternative_pairs($pdo,$body); break;
    case 'stoCapacity.assignPair': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_assign_pair($pdo,$body); break;
    case 'stoCapacity.incidentPreview': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_capacity_incident_preview($pdo,$body); break;
    case 'stoCapacity.incidentApply': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_capacity_incident_apply($pdo,$body); break;
    case 'stoCapacity.incidentResolve': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_sto_capacity_incident_resolve($pdo,$body); break;
    case 'productionDispatch.rebalance': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'work_orders.assign',['sto','admin','owner']); kareta_production_dispatch_rebalance($pdo); break;
    case 'clientExchange.getResponses': kareta_require_api_capability($pdo,'requests.read',['client']); client_exchange_get_responses($pdo); break;
    case 'clientExchange.dashboard': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'requests.read',['client']); kareta_client_exchange_scale_dashboard($pdo,$body); break;
    case 'clientExchange.republish': if(!$pdo)_no_db(); kareta_require_api_capability($pdo,'requests.update',['client']); kareta_client_exchange_scale_republish($pdo,$body); break;
    case 'clientExchange.schedulePreview': kareta_require_api_capability($pdo,'requests.read',['client']); client_exchange_schedule_preview($pdo,$body); break;
    case 'clientExchange.acceptResponse': kareta_require_api_capability($pdo,'requests.update',['client']); client_exchange_accept_response($pdo,$body); break;
    case 'clientExchange.declineResponse': kareta_require_api_capability($pdo,'requests.update',['client']); client_exchange_decline_response($pdo,$body); break;
    case 'news.save': kareta_require_any_role(['master','admin','owner']); news_save($pdo,$body); break;
    case 'workPosts.publish': if (!$pdo) _no_db(); kareta_work_post_publish($pdo,$body); break;
    case 'workPosts.like': if (!$pdo) _no_db(); kareta_work_post_like($pdo,$body); break;
    case 'workPosts.save': if (!$pdo) _no_db(); kareta_work_post_save($pdo,$body); break;
    case 'workPosts.comment': kareta_idempotency_begin($pdo,$action,$body); kareta_work_post_comment_add($pdo,$body); break;
    case 'workPosts.commentDelete': kareta_work_post_comment_delete($pdo,$body); break;
    case 'masterSocialWall.save': if(!$pdo)_no_db(); kareta_master_social_wall_save($pdo,$body); break;
    case 'masterSocialWall.delete': if(!$pdo)_no_db(); kareta_master_social_wall_delete($pdo,$body); break;
    case 'masterSocialWall.like': if(!$pdo)_no_db(); kareta_master_social_wall_react($pdo,$body); break;
    case 'masterSocialWall.saveState': if(!$pdo)_no_db(); kareta_master_social_wall_save_state($pdo,$body); break;
    case 'masterSocialWall.comment': if(!$pdo)_no_db(); kareta_master_social_wall_comment_add($pdo,$body); break;
    case 'masterSocialWall.commentDelete': if(!$pdo)_no_db(); kareta_master_social_wall_comment_delete($pdo,$body); break;
    case 'communityPosts.save': if(!$pdo)_no_db(); kareta_community_post_save($pdo,$body); break;
    case 'communityGroups.join': if(!$pdo)_no_db(); kareta_community_group_membership_save($pdo,$body); break;
    case 'news.delete': kareta_require_any_role(['master','admin','owner']); news_delete($pdo,$body); break;
    case 'siteContent.save':  kareta_require_role('admin'); site_content_save($pdo,$body);  break;
    case 'siteContent.delete':kareta_require_role('admin'); site_content_delete($pdo,$body);break;
    case 'publicReviews.save':kareta_require_role('admin'); public_reviews_save($pdo,$body);break;
    case 'publicReviews.submit': kareta_require_api_session($pdo,['client','admin','owner']); kareta_idempotency_begin($pdo,$action,$body); public_reviews_save($pdo,$body); break;
    case 'publicReviews.delete': kareta_require_any_role(['admin','owner']); public_reviews_delete($pdo,$body);break;
    case 'partsCatalog.save': kareta_require_role('admin'); parts_catalog_save($pdo,$body); break;
    case 'partsCatalog.delete': kareta_require_role('admin'); parts_catalog_delete($pdo,$body); break;
    case 'partsCatalog.importSource': kareta_require_role('admin'); parts_catalog_import_source($pdo); break;
    case 'vehicles.recommendation.save': kareta_require_api_capability($pdo,'vehicles.update',['client','master','sto','admin','owner']); if (!$pdo) _no_db(); kareta_vehicle_recommendation_save($pdo,$body); break;
    case 'vehicles.issue.save': kareta_require_any_role(['client','master','sto','admin','owner']); if (!$pdo) _no_db(); kareta_vehicle_issue_save($pdo,$body); break;
    case 'vehicles.mileage.save': kareta_require_api_capability($pdo,'vehicles.update',['client','master','sto','admin','owner']); if (!$pdo) _no_db(); kareta_vehicle_mileage_save($pdo,$body); break;

    case 'orders.getAll':     kareta_require_any_role(['client','master','sto','seller','admin','owner']); orders_getAll($pdo,$body); break;
    case 'orders.get':        kareta_require_any_role(['client','master','sto','seller','admin','owner']); orders_get($pdo,$body); break;
    case 'orders.create':     kareta_require_any_role(['client','master','sto','seller','admin','owner']); kareta_idempotency_begin($pdo,$action,$body); orders_create($pdo,$body); break;
    case 'orders.claim':        kareta_require_any_role(['admin','owner']); orders_claim($pdo,$body);         break;
    case 'orders.releaseClaim': kareta_require_any_role(['admin','owner']); orders_release_claim($pdo,$body); break;
    // Биржа заявок: мастер сам берёт/возвращает заявки
    case 'orders.masterClaim':   kareta_require_role('master'); orders_master_claim($pdo,$body);   break;
    case 'orders.masterDecline': kareta_require_role('master'); orders_master_decline($pdo,$body); break;
    case 'orders.update':        kareta_require_role('client'); orders_update($pdo,$body);      break;
    case 'orders.cancelByClient':  kareta_require_role('client'); orders_cancel_by_client($pdo,$body); break;
    // Patch 9: специализированные действия (рекомендуемые)
    case 'orders.clientEdit':    kareta_require_role('client');  orders_client_edit($pdo,$body);   break;
    case 'orders.assignMaster':  kareta_require_any_role(['admin','owner']); orders_assign_master($pdo,$body); break;
    case 'orders.returnToAdmin': kareta_require_any_role(['admin','owner','master']); orders_return_to_admin($pdo,$body); break;
    case 'orders.defer':         kareta_require_any_role(['admin','owner']); orders_defer($pdo,$body); break;
    case 'orders.confirmHandover': kareta_require_role('client'); orders_confirm_handover($pdo,$body); break;
    case 'orders.setStatus':  kareta_require_any_role(['master','sto','admin','owner']); orders_setStatus($pdo,$body);   break;
    case 'orders.addStage':   kareta_require_any_role(['master','sto','admin','owner']); orders_addStage($pdo,$body);    break;
    case 'orders.complete':     kareta_require_role('master'); orders_complete_by_master($pdo,$body); break;
    case 'orders.confirmDone':  kareta_require_role('client'); orders_confirm_done_by_client($pdo,$body); break;
    case 'orders.dispute':      kareta_require_any_role(['client','master','sto']); orders_open_dispute($pdo,$body); break;
    case 'orders.proposeExtraQuote': kareta_require_role('master'); orders_propose_extra_quote($pdo,$body); break;
    case 'orders.acceptExtraQuote':  kareta_require_role('client'); orders_decide_extra_quote($pdo,$body,'accepted'); break;
    case 'orders.declineExtraQuote': kareta_require_role('client'); orders_decide_extra_quote($pdo,$body,'declined'); break;
    case 'disputes.getMine':   kareta_require_any_role(['client','master','sto','seller','admin','owner']); disputes_get_mine($pdo); break;
    case 'disputes.addMessage': kareta_require_any_role(['client','master','sto','seller','admin','owner']); disputes_add_message($pdo,$body); break;
    case 'disputes.resolve':    kareta_require_any_role(['admin','owner']); disputes_resolve($pdo,$body); break;
    case 'sto.reassignMaster':  kareta_require_any_role(['admin','owner','sto']); sto_reassign_master($pdo,$body); break;
    case 'sto.unassignMaster':  kareta_require_any_role(['admin','owner','sto']); sto_unassign_master($pdo,$body); break;
    case 'orders.addReport':  kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); orders_addReport($pdo,$body);   break;
    case 'orders.addPart':    kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); orders_addPart($pdo,$body);     break;
    case 'workOrders.checklist.toggle': kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); if(!$pdo)_no_db(); kareta_work_order_checklist_toggle($pdo,$body); break;
    case 'workOrders.media.save': kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); if(!$pdo)_no_db(); kareta_work_order_media_save($pdo,$body); break;
    case 'workOrders.publication.prepare': kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); if(!$pdo)_no_db(); kareta_work_order_publication_prepare($pdo,$body); break;
    case 'stoWorkflow.transition': kareta_require_api_capability($pdo,'work_orders.update_status',['master','sto','admin','owner']); if(!$pdo)_no_db(); kareta_sto_workflow_transition($pdo,$body); break;
    case 'stoWorkflow.approval': kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); if(!$pdo)_no_db(); kareta_sto_workflow_approval($pdo,$body); break;
    case 'masterOrder.accept': if(!$pdo)_no_db(); kareta_master_order_accept($pdo,$body); break;
    case 'masterOrder.diagnostics.save': if(!$pdo)_no_db(); kareta_master_order_diagnostics_save($pdo,$body); break;
    case 'masterOrder.extraWork.request': if(!$pdo)_no_db(); kareta_master_order_extra_request($pdo,$body); break;
    case 'masterOrder.estimate.skip': if(!$pdo)_no_db(); kareta_master_order_estimate_skip($pdo,$body); break;
    case 'clientOrder.extraWork.decide': if(!$pdo)_no_db(); kareta_client_order_extra_decide($pdo,$body); break;
    case 'masterOrder.parts.reserve': if(!$pdo)_no_db(); kareta_master_order_parts_reserve($pdo,$body); break;
    case 'masterOrder.parts.complete': if(!$pdo)_no_db(); kareta_master_order_parts_complete($pdo,$body); break;
    case 'masterOrder.work.complete': if(!$pdo)_no_db(); kareta_master_order_work_complete($pdo,$body); break;
    case 'masterOrder.quality.save': if(!$pdo)_no_db(); kareta_master_order_quality_save($pdo,$body); break;
    case 'masterOrder.warranty.configure': if(!$pdo)_no_db(); kareta_master_order_warranty_configure($pdo,$body); break;
    case 'masterOrder.handover.prepare': if(!$pdo)_no_db(); kareta_master_order_handover_prepare($pdo,$body); break;
    case 'clientOrder.publication.consent': if(!$pdo)_no_db(); kareta_client_order_publication_consent($pdo,$body); break;
    case 'clientOrder.handover.confirm': if(!$pdo)_no_db(); kareta_client_order_handover_confirm($pdo,$body); break;
    case 'masterOrder.inventory.reserve': if(!$pdo)_no_db(); kareta_master_aftercare_inventory_reserve($pdo,$body); break;
    case 'masterOrder.inventory.return': if(!$pdo)_no_db(); kareta_master_aftercare_inventory_return($pdo,$body); break;
    case 'masterOrder.finance.settings.save': if(!$pdo)_no_db(); kareta_master_aftercare_settings_save($pdo,$body); break;
    case 'masterOrder.cost.save': if(!$pdo)_no_db(); kareta_master_aftercare_cost_save($pdo,$body); break;
    case 'masterOrder.cost.delete': if(!$pdo)_no_db(); kareta_master_aftercare_cost_delete($pdo,$body); break;
    case 'clientOrder.warrantyClaim.submit': if(!$pdo)_no_db(); kareta_client_warranty_claim_submit($pdo,$body); break;
    case 'masterOrder.warrantyClaim.decide': if(!$pdo)_no_db(); kareta_master_warranty_claim_decide($pdo,$body); break;
    case 'masterOrder.warrantyClaim.inspect': if(!$pdo)_no_db(); kareta_master_warranty_claim_inspect($pdo,$body); break;
    case 'masterOrder.warrantyClaim.startRepair': if(!$pdo)_no_db(); kareta_master_warranty_claim_start_repair($pdo,$body); break;
    case 'masterOrder.warrantyClaim.completeRepair': if(!$pdo)_no_db(); kareta_master_warranty_claim_complete_repair($pdo,$body); break;
    case 'masterOrder.warrantyClaim.quality': if(!$pdo)_no_db(); kareta_master_warranty_claim_quality($pdo,$body); break;
    case 'clientOrder.warrantyClaim.confirm': if(!$pdo)_no_db(); kareta_client_warranty_claim_confirm($pdo,$body); break;
    case 'operationalFinance.orderPayment.record': if(!$pdo)_no_db(); kareta_operational_finance_order_payment($pdo,$body); break;
    case 'operationalFinance.expense.record': if(!$pdo)_no_db(); kareta_operational_finance_expense($pdo,$body); break;
    case 'operationalFinance.payrollRule.save': if(!$pdo)_no_db(); kareta_operational_finance_payroll_rule_save($pdo,$body); break;
    case 'operationalFinance.payroll.close': if(!$pdo)_no_db(); kareta_operational_finance_payroll_close($pdo,$body); break;
    case 'operationalFinance.payroll.pay': if(!$pdo)_no_db(); kareta_operational_finance_payroll_pay($pdo,$body); break;
    case 'operationalFinance.receivable.due': if(!$pdo)_no_db(); kareta_operational_finance_receivable_due($pdo,$body); break;
    case 'masterProfile.save': kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_owner_profile_save($pdo,$body); break;
    case 'masterWorkplace.availability.save': kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_availability_save($pdo,$body); break;
    case 'masterWorkplace.preferences.save': kareta_require_api_capability($pdo,'profile.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_workplace_preferences_save($pdo,$body); break;
    case 'tariffs.assign': if(!$pdo)_no_db(); kareta_tariff_assign($pdo,$body); break;
    case 'tariffs.updatePlan': if(!$pdo)_no_db(); kareta_tariff_update_plan($pdo,$body); break;
    case 'masterSchedule.preferences.save': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_preferences_save($pdo,$body); break;
    case 'masterSchedule.orderPlan.save': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_order_plan_save($pdo,$body); break;
    case 'masterSchedule.freeSlots': kareta_require_api_capability($pdo,'calendar.read',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_free_slots($pdo,$body); break;
    case 'masterSchedule.reschedule.propose': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_reschedule_propose($pdo,$body); break;
    case 'masterShift.weekly.save': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_weekly_shift_save($pdo,$body); break;
    case 'masterSchedule.block.save': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_block_save($pdo,$body); break;
    case 'masterSchedule.block.delete': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_block_delete($pdo,$body); break;
    case 'masterSchedule.arrival.set': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_arrival_set($pdo,$body); break;
    case 'masterSchedule.recovery.run': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_recovery_run($pdo,$body); break;
    case 'masterSchedule.recovery.preview': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_recovery_preview($pdo,$body); break;
    case 'masterSchedule.recovery.apply': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_recovery_apply($pdo,$body); break;
    case 'masterSchedule.recovery.protect': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_recovery_protect($pdo,$body); break;
    case 'masterSchedule.recovery.notifyResend': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_schedule_recovery_notify_resend($pdo,$body); break;
    case 'masterShift.extension.save': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_shift_extension_save($pdo,$body); break;
    case 'masterShift.extension.delete': kareta_require_api_capability($pdo,'calendar.manage',['master','admin','owner']); if(!$pdo)_no_db(); kareta_master_shift_extension_delete($pdo,$body); break;
    case 'clientSchedule.arrival.list': kareta_require_api_capability($pdo,'requests.read',['client']); if(!$pdo)_no_db(); kareta_client_arrival_list($pdo); break;
    case 'clientSchedule.arrival.set': kareta_require_api_capability($pdo,'requests.update',['client']); if(!$pdo)_no_db(); kareta_client_arrival_set($pdo,$body); break;
    case 'clientSchedule.reschedule.list': kareta_require_api_capability($pdo,'requests.read',['client']); if(!$pdo)_no_db(); kareta_client_schedule_reschedule_list($pdo); break;
    case 'clientSchedule.reschedule.respond': kareta_require_api_capability($pdo,'requests.update',['client']); if(!$pdo)_no_db(); kareta_client_schedule_reschedule_respond($pdo,$body); break;
    case 'stoBays.assign': kareta_require_any_role(['sto','admin','owner']); if(!$pdo)_no_db(); kareta_sto_bay_assign($pdo,$body); break;
    case 'stoBays.release': kareta_require_any_role(['sto','admin','owner']); if(!$pdo)_no_db(); kareta_sto_bay_release($pdo,$body); break;
    case 'workTimers.start': kareta_require_api_capability($pdo,'work_orders.update',['master','admin','owner']); if(!$pdo)_no_db(); kareta_work_timer_start($pdo,$body); break;
    case 'workTimers.stop': kareta_require_api_capability($pdo,'work_orders.update',['master','admin','owner']); if(!$pdo)_no_db(); kareta_work_timer_stop($pdo,$body); break;
    case 'orders.removePart': kareta_require_api_capability($pdo,'work_orders.update',['master','sto','admin','owner']); orders_removePart($pdo,$body);  break;
    case 'partsRequest.saveOffer': kareta_require_any_role(['master','sto','admin','owner']); parts_request_save_offer($pdo,$body); break;
    case 'orders.delete':     kareta_require_role('admin'); orders_delete($pdo,$body);      break;

    case 'clients.getAll':    kareta_require_any_role(['sto','admin','owner']); clients_getAll($pdo,$body);     break;
    case 'clients.upsert':    kareta_require_any_role(['sto','admin','owner']); clients_upsert($pdo,$body); break;
    case 'clients.update':    kareta_require_any_role(['admin','owner']); clients_update($pdo,$body);     break;
    case 'vehicles.getMine':   vehicles_get_mine($pdo,$body); break;
    case 'vehicles.upsert':    kareta_assert_vehicle_mutation_scope($pdo,$body); vehicles_upsert($pdo,$body); break;
    case 'vehicles.delete':    kareta_assert_vehicle_mutation_scope($pdo,$body,true); vehicles_delete($pdo,$body); break;
    case 'vehicles.restore':   kareta_assert_vehicle_mutation_scope($pdo,$body,true); vehicles_restore($pdo,$body); break;
    case 'vehicles.setDefault': kareta_assert_vehicle_mutation_scope($pdo,$body,true); vehicles_set_default($pdo,$body); break;

    case 'chats.getAll':      chats_getAll($pdo);             break;
    case 'chats.contacts':    chats_contacts($pdo);           break;
    case 'chats.openDirect':  kareta_idempotency_begin($pdo,$action,$body); chats_open_direct($pdo,$body); break;
    case 'chats.create':      kareta_require_any_role(['client','master','sto','admin','owner']); chats_create($pdo,$body); break;
    case 'chats.supportOpen': kareta_require_any_role(['client','master','sto','seller','admin','owner']); chats_support_open($pdo,$body); break;
    case 'chats.markRead':    chats_markRead($pdo,$body);     break;
    case 'chats.incUnread':   chats_incUnread($pdo,$body);    break;

    case 'messages.get':      messages_get($pdo,$body);       break;
    case 'messages.add':      kareta_idempotency_begin($pdo,$action,$body); messages_add($pdo,$body);       break;
    case 'messages.update':   messages_update($pdo,$body);    break;
    case 'messages.delete':   messages_delete($pdo,$body);    break;
    case 'notifications.getMine': notifications_get_mine($pdo);   break;
    case 'notifications.markRead': notifications_mark_read($pdo,$body); break;
    case 'notifications.markAllRead': notifications_mark_all_read($pdo); break;

    case 'shop.getAll':       shop_getAll($pdo);              break;
    case 'shop.create':       kareta_require_any_role(['admin','master','owner']); shop_create($pdo,$body);        break;
    case 'shop.update':       kareta_require_any_role(['admin','master','owner']); shop_update($pdo,$body);        break;
    case 'shop.addPart':      kareta_require_any_role(['admin','master','owner']); shop_addPart($pdo,$body);       break;
    case 'shop.updatePart':   kareta_require_any_role(['admin','master','owner']); shop_updatePart($pdo,$body);    break;
    case 'shop.deletePart':   kareta_require_any_role(['admin','master','owner']); shop_deletePart($pdo,$body);    break;
    case 'shop.sellPart':     kareta_require_any_role(['admin','master','owner']); shop_sellPart($pdo,$body);      break;

    case 'masterWall.getMine': kareta_require_any_role(['admin','owner','master']); master_wall_get_mine($pdo); break;
    case 'masterWall.save':    kareta_require_any_role(['admin','owner','master']); master_wall_save($pdo,$body); break;
    case 'masterWall.delete':  kareta_require_any_role(['admin','owner','master']); master_wall_delete($pdo,$body); break;

    // ── master_posts ──────────────────────────────────────────────────
    case 'masterPosts.getMine':  kareta_require_any_role(['admin','owner','master']); master_posts_get_mine($pdo); break;
    case 'masterPosts.save':     kareta_require_any_role(['admin','owner','master']); master_posts_save($pdo,$body); break;
    case 'masterPosts.delete':   kareta_require_any_role(['admin','owner','master']); master_posts_delete($pdo,$body); break;
    case 'masterPosts.getAll':   master_posts_get_all($pdo); break;

    // ── master_reviews ────────────────────────────────────────────────
    case 'masterReviews.getMine': kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']); master_reviews_get_mine($pdo); break;
    case 'masterReviews.reply':   kareta_require_api_capability($pdo,'profile.manage',['admin','owner','master']); master_reviews_reply($pdo,$body); break;

    // ── master_metrics ────────────────────────────────────────────────
    case 'masterMetrics.track':   master_metrics_track($pdo,$body); break;
    case 'masterMetrics.getMine': kareta_require_any_role(['admin','owner','master']); master_metrics_get_mine($pdo); break;

    // ── master profile (extended) ─────────────────────────────────────
    case 'master.saveProfile':   kareta_require_any_role(['admin','owner','master']); master_save_profile($pdo,$body); break;
    case 'master.saveGeo':       kareta_require_any_role(['admin','owner','master']); master_save_geo($pdo,$body); break;
    case 'sto.saveProfile':      kareta_require_any_role(['admin','owner','sto']); sto_save_profile($pdo,$body); break;
    case 'sto.inviteMaster':     kareta_require_any_role(['admin','owner','sto']); sto_invite_master($pdo,$body); break;
    case 'sto.assignMaster':     kareta_require_any_role(['admin','owner','sto']); sto_assign_master($pdo,$body); break;
    case 'sto.getLinks':         kareta_require_any_role(['admin','owner','sto','master']); sto_get_links($pdo,$body); break;
    case 'stoExchange.getLeads':    kareta_require_any_role(['admin','owner','sto']); sto_exchange_get_leads($pdo,$body); break;
    case 'stoExchange.acceptLead':  kareta_require_any_role(['admin','owner','sto']); sto_exchange_accept_lead($pdo,$body); break;
    case 'stoExchange.assignOrderMaster': kareta_require_any_role(['admin','owner','sto']); sto_exchange_assign_order_master($pdo,$body); break;
    case 'stoExchange.hideLead':   kareta_require_any_role(['admin','owner','sto']); sto_exchange_hide_lead($pdo,$body); break;
    case 'sto.acceptInvite':     kareta_require_any_role(['admin','owner','master']); sto_accept_invite($pdo,$body); break;

    case 'audit.log':         audit_write($pdo,$body);        break;
    case 'audit.get':         kareta_require_role('admin'); audit_read($pdo,$body);         break;
    case 'audit.clear':       kareta_require_role('owner'); audit_clear($pdo);              break;

    case 'news.getAll':       news_getAll($pdo,$body);        break;
    case 'news.view':         news_view($pdo,$body);          break;
    case 'news.seed':         kareta_require_any_role(['admin','owner']); news_seed_15($pdo); kareta_json(['ok'=>true]); break;
    case 'config.get':        kareta_require_role('owner'); kareta_json(['ok'=>true,'config'=>app_config_read()]); break;
    case 'config.save':       kareta_require_role('owner'); app_config_save($body); kareta_json(['ok'=>true]); break;
    case 'news.save':         kareta_require_any_role(['master','admin','owner']); news_save($pdo,$body);  break;
    case 'news.delete':       kareta_require_any_role(['master','admin','owner']); news_delete($pdo,$body); break;

    default: kareta_json(['ok'=>false,'error'=>'unknown_action: '.$action],400);
}


/* ══════════════════════════════════════════════════════════════════
   СИСТЕМА СОБЫТИЙ (ТЗ 2.8)
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   МАШИНА СОСТОЯНИЙ ЗАЯВКИ (ТЗ 2.1)
══════════════════════════════════════════════════════════════════ */
/* ── order_stages — отдельная таблица этапов (ТЗ 2.4) ── */
/* ── order_extra_quotes — допработы и запчасти (ТЗ 2.5) ── */
function kareta_ensure_extra_quotes_table(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_extra_quotes` (
            `id`          VARCHAR(64)  NOT NULL PRIMARY KEY,
            `order_id`    VARCHAR(64)  NOT NULL,
            `master_id`   VARCHAR(64)  DEFAULT NULL,
            `title`       VARCHAR(255) NOT NULL DEFAULT '',
            `labor_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `parts_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `total_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `items_json`  TEXT         DEFAULT NULL,
            `comment`     TEXT         DEFAULT NULL,
            `status`      VARCHAR(32)  NOT NULL DEFAULT 'pending',
            `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            `decided_at`  TIMESTAMP    NULL DEFAULT NULL,
            INDEX `idx_extra_quotes_order` (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (\Throwable $__e) {}
}


/* ── order_disputes — полноценный процесс споров (ТЗ 1.6) ── */
function kareta_ensure_disputes_table(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_disputes` (
            `id`           VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id`     VARCHAR(64) NOT NULL,
            `opened_by`    INT DEFAULT NULL,
            `opener_role`  VARCHAR(32) DEFAULT NULL,
            `text`         TEXT DEFAULT NULL,
            `status`       VARCHAR(32) NOT NULL DEFAULT 'open',
            `resolved_by`  INT DEFAULT NULL,
            `resolution`   TEXT DEFAULT NULL,
            `resolved_at`  TIMESTAMP NULL DEFAULT NULL,
            `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_disputes_order` (`order_id`),
            INDEX `idx_disputes_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_dispute_messages` (
            `id`           VARCHAR(64) NOT NULL PRIMARY KEY,
            `dispute_id`   VARCHAR(64) NOT NULL,
            `order_id`     VARCHAR(64) NOT NULL,
            `author_id`    INT DEFAULT NULL,
            `author_role`  VARCHAR(32) DEFAULT NULL,
            `text`         TEXT NOT NULL,
            `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_dispute_msgs_dispute` (`dispute_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (\Throwable $__e) {}
}


function kareta_ensure_order_stages_table(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_stages` (
            `id`          VARCHAR(64)  NOT NULL PRIMARY KEY,
            `order_id`    VARCHAR(64)  NOT NULL,
            `stage_key`   VARCHAR(64)  NOT NULL DEFAULT 'diagnostic',
            `stage_label` VARCHAR(160) NOT NULL DEFAULT '',
            `stage_icon`  VARCHAR(16)  NOT NULL DEFAULT '🔧',
            `status`      VARCHAR(32)  NOT NULL DEFAULT 'in_progress',
            `comment`     TEXT         DEFAULT NULL,
            `parts_json`  TEXT         DEFAULT NULL,
            `photos_json` TEXT         DEFAULT NULL,
            `created_by`  INT          DEFAULT NULL,
            `master_id`   VARCHAR(64)  DEFAULT NULL,
            `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_order_stages_order` (`order_id`),
            INDEX `idx_order_stages_key`   (`stage_key`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (\Throwable $__e) {}
}


/* ── kareta_repair_pipeline: единый источник этапов (ТЗ 4.1) ── */
function kareta_repair_pipeline(): array {
    return [
        ['id'=>'accepted',   'label'=>'Принят',               'icon'=>'✅', 'required'=>false],
        ['id'=>'diagnosed',  'label'=>'Диагностика',           'icon'=>'🔍', 'required'=>true ],
        ['id'=>'parts',      'label'=>'Запчасти',              'icon'=>'🔩', 'required'=>false],
        ['id'=>'started',    'label'=>'Ремонт начат',          'icon'=>'🔧', 'required'=>true ],
        ['id'=>'quality',    'label'=>'Проверка качества',     'icon'=>'✔️', 'required'=>true ],
        ['id'=>'done',       'label'=>'Работа завершена',      'icon'=>'🏁', 'required'=>true ],
        ['id'=>'delivered',  'label'=>'Передано клиенту',      'icon'=>'🤝', 'required'=>false],
    ];
}

function kareta_pipeline_next(string $currentKey): ?string {
    $pipeline = kareta_repair_pipeline();
    $found = false;
    foreach ($pipeline as $stage) {
        if ($found) return $stage['id'];
        if ($stage['id'] === $currentKey) $found = true;
    }
    return null;
}

function kareta_pipeline_stage(string $key): ?array {
    foreach (kareta_repair_pipeline() as $s) {
        if ($s['id'] === $key) return $s;
    }
    return null;
}


function kareta_order_status_transitions(): array {
    return [
        'new' => [
            'waiting_responses' => ['client','admin','owner','system'],
            'process'           => ['admin','owner','system'],
            'cancelled'         => ['client','admin','owner'],
        ],
        'waiting_responses' => [
            'process'           => ['master','sto','admin','owner','system'],
            'cancelled'         => ['client','admin','owner'],
        ],
        'process' => [
            'done_pending_client' => ['master','sto','admin','owner'],
            'cancelled'           => ['admin','owner'],
            'dispute'             => ['client','master','sto','seller','admin','owner'],
        ],
        'done_pending_client' => [
            'done'    => ['client','admin','owner','system'],
            'dispute' => ['client','admin','owner'],
        ],
        'done' => [],
        'cancelled' => [],
        'dispute' => [
            'process'   => ['admin','owner'],
            'done'      => ['admin','owner'],
            'cancelled' => ['admin','owner'],
        ],
    ];
}

function kareta_order_can_transition(string $from, string $toStatus, string $actorRole): array {
    if ($from === $toStatus) {
        return ['ok'=>true,'skipped'=>true,'from'=>$from,'to'=>$toStatus];
    }
    $allowed = kareta_order_status_transitions()[$from][$toStatus] ?? [];
    if (empty($allowed)) return ['ok'=>false,'error'=>'invalid_transition','from'=>$from,'to'=>$toStatus];
    if (!in_array($actorRole, $allowed, true)) return ['ok'=>false,'error'=>'role_not_allowed','role'=>$actorRole,'from'=>$from,'to'=>$toStatus];
    return ['ok'=>true,'from'=>$from,'to'=>$toStatus];
}

function kareta_order_transition(?PDO $pdo, string $orderId, string $toStatus, string $actorRole, array $ctx = []): array {
    if (!$pdo || !$orderId) return ['ok'=>false,'error'=>'invalid_params'];

    $st = $pdo->prepare("SELECT id, status FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $order = $st->fetch();
    if (!$order) return ['ok'=>false,'error'=>'order_not_found'];

    $from = (string)($order['status'] ?? 'new');
    $can = kareta_order_can_transition($from, $toStatus, $actorRole);
    if (empty($can['ok'])) return $can;
    if (!empty($can['skipped'])) return $can;

    $up = $pdo->prepare("UPDATE `orders` SET status=? WHERE id=? AND status=?");
    $up->execute([$toStatus, $orderId, $from]);
    if ($up->rowCount() === 0) {
        return ['ok'=>false,'error'=>'status_race_condition','from'=>$from,'to'=>$toStatus];
    }
    try { kareta_write_event($pdo, $orderId, 'status_changed', ['from'=>$from,'to'=>$toStatus,'role'=>$actorRole]); } catch(\Throwable $__e) {}
    return ['ok'=>true,'from'=>$from,'to'=>$toStatus];
}



function kareta_sync_order_relations(?PDO $pdo, string $orderId, string $status, array $ctx = []): void {
    if (!$pdo || $orderId === '') return;
    try {
        $pdo->prepare("UPDATE `chats` SET status=? WHERE order_id=?")->execute([$status, $orderId]);
    } catch (\Throwable $_e) {}

    if (in_array($status, ['done','cancelled'], true)) {
        try {
            $pdo->prepare("UPDATE `order_assignments` SET status=? WHERE order_id=? AND status='active'")
                ->execute([$status === 'done' ? 'completed' : 'cancelled', $orderId]);
        } catch (\Throwable $_e) {}
    }

    try {
        $eventId = 'm_status_' . substr(md5($orderId . ':' . $status), 0, 22);
        $labels = [
            'waiting_responses'=>'Заявка ожидает откликов.',
            'process'=>'Заявка переведена в работу.',
            'done_pending_client'=>'Работа завершена исполнителем и ожидает подтверждения клиента.',
            'done'=>'Заявка завершена.',
            'cancelled'=>'Заявка отменена.',
            'dispute'=>'По заявке открыт спор.',
        ];
        if (isset($labels[$status])) {
            $chat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
            $chat->execute([$orderId]);
            $chatId = (string)($chat->fetchColumn() ?: '');
            if ($chatId !== '') {
                $u = kareta_session_user() ?: [];
                $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                    ->execute([$eventId,$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event',$labels[$status],date('H:i'),date('Y-m-d H:i:s')]);
                $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_master=unread_master+1, unread_sto=unread_sto+1, unread_admin=unread_admin+1 WHERE id=?")
                    ->execute([$chatId]);
            }
        }
    } catch (\Throwable $_e) {}
}

function kareta_order_snapshot(?PDO $pdo, string $orderId): ?array {
    if (!$pdo || $orderId === '') return null;
    $st = $pdo->prepare("SELECT id,type,status,client_user_id,client_phone,master_id,master_user_id,master_name,sto_id,sto_name,started_at,completed_at,confirmed_at,cancelled_at,dispute_at,final_price,updated_at FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}

function kareta_ensure_order_events_table(?PDO $pdo): void {
    if (!$pdo) return;
    // DDL inside an active MySQL transaction causes an implicit commit.
    // Therefore schema auto-heal for order_events is allowed only outside transactions.
    if ($pdo->inTransaction()) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS `order_events` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `order_id` VARCHAR(64) NOT NULL,
        `event_type` VARCHAR(64) NOT NULL,
        `actor_id` INT DEFAULT NULL,
        `actor_role` VARCHAR(32) DEFAULT NULL,
        `meta` TEXT DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX `idx_order_events_order` (`order_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function kareta_write_event(?PDO $pdo, string $orderId, string $eventType, array $meta = []): void {
    if (!$pdo || !$orderId) return;
    try {
        if (!$pdo->inTransaction()) {
            kareta_ensure_order_events_table($pdo);
        } elseif (!kareta_table_exists($pdo, 'order_events')) {
            // Never run CREATE TABLE in the middle of a business transaction.
            return;
        }
        $u = kareta_session_user();
        $pdo->prepare("INSERT IGNORE INTO `order_events` (`id`,`order_id`,`event_type`,`actor_id`,`actor_role`,`meta`) VALUES (?,?,?,?,?,?)")
            ->execute(['ev_'.uniqid(), $orderId, $eventType, (int)($u['id']??0)?:null, (string)($u['role']??''), $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null]);
    } catch (\Throwable $__e) {}
}

function kareta_ensure_waiting_responses(?PDO $pdo, string $orderId): void {
    if (!$pdo) return;
    try { $pdo->prepare("UPDATE `orders` SET status='waiting_responses' WHERE id=? AND status='new'")->execute([$orderId]); }
    catch (\Throwable $__e) {}
}


function kareta_default_services_catalog(): array {
    // Compatibility loader: source catalog lives in protected storage/catalog/services.json.
    try {
        return kareta_service_catalog_legacy_rows();
    } catch (Throwable $e) {
        error_log('[KARETA] service.catalog.source.error: ' . $e->getMessage());
        return [];
    }
}

function kareta_default_parts_catalog(): array {
    // Compatibility loader: the 725 products are no longer embedded in this API file.
    // The protected JSON source is validated and imported into MySQL by migration 034.
    try {
        return kareta_product_catalog_legacy_rows();
    } catch (Throwable $e) {
        error_log('[KARETA] product.catalog.source.error: ' . $e->getMessage());
        return [];
    }
}


function kareta_default_public_content(): array {
    return [
        'services_faq' => [
            'title' => 'FAQ по услугам',
            'body' => [
                ['q'=>'Даёте ли гарантию?','a'=>'Да — 6 месяцев на все работы по электрике и 3 месяца на установку сигнализаций. Если проблема вернётся — переделаем бесплатно.'],
                ['q'=>'Можно ли привезти деталь самому?','a'=>'Да. Вы можете купить деталь сами, мы поставим её и дадим гарантию на работу.'],
                ['q'=>'Сколько ждать ремонта?','a'=>'Большинство работ занимают 1–4 часа. Капитальный ремонт генератора или стартера — 1 рабочий день.'],
                ['q'=>'Нужна ли предварительная запись?','a'=>'Желательна — тогда мастер будет свободен в нужное время. Но принимаем и без записи при наличии мест.'],
                ['q'=>'Работаете в субботу?','a'=>'Да, с 10:00 до 17:00. В воскресенье выходной.'],
            ],
        ],
        'about_intro' => [
            'title' => 'О компании',
            'body' => [
                'lead' => 'KARETA.KZ — специализированный автосервис в Усть-Каменогорске. Работаем с 2016 года, фокус — электрооборудование автомобилей: генераторы, стартеры, проводка, сигнализации.',
                'text' => 'Мы не занимаемся «всем подряд» — только электрикой. Это значит глубокую экспертизу, нужное оборудование и реальную экономию для клиента: 95% деталей восстанавливаем без замены агрегата.',
                'address' => '📍 ул. Гоголя 36А, Усть-Каменогорск · Пн–Пт 9:00–19:00 · Сб 10:00–17:00',
            ],
        ],
        'about_facts' => [
            'title' => 'Факты о KARETA',
            'body' => [
                ['n'=>'2016','l'=>'год основания'],
                ['n'=>'8+','l'=>'лет опыта'],
                ['n'=>'500+','l'=>'клиентов'],
                ['n'=>'95%','l'=>'деталей восстанавливаем'],
                ['n'=>'1 день','l'=>'среднее время ремонта'],
                ['n'=>'6 мес.','l'=>'гарантия на работы'],
            ],
        ],
        'about_values' => [
            'title' => 'Принципы работы',
            'body' => [
                ['e'=>'🔍','t'=>'Точная диагностика','d'=>'Сначала находим причину — потом ремонтируем. Никаких лишних работ.'],
                ['e'=>'💰','t'=>'Честная цена','d'=>'Называем итог до начала работ. Цена не меняется в процессе.'],
                ['e'=>'⚡','t'=>'Скорость','d'=>'Большинство работ — в день обращения. Предупреждаем заранее, если дольше.'],
                ['e'=>'🔧','t'=>'Восстановление','d'=>'95% деталей восстанавливаем. Это дешевле замены и экономит ваши деньги.'],
                ['e'=>'✅','t'=>'Гарантия','d'=>'6 месяцев на электрику, 3 месяца на сигнализации. Всё официально.'],
                ['e'=>'📞','t'=>'Обратная связь','d'=>'После ремонта звоним и уточняем — всё ли в порядке с автомобилем.'],
            ],
        ],
        'about_page' => [
            'title' => 'О нас',
            'body' => [
                'heroLabel' => 'Кто мы',
                'heroTitle' => 'О компании',
                'heroSubtitle' => 'Специализированный автосервис по автоэлектрике, генераторам, стартерам и сигнализациям.',
                'teamTitle' => 'Наши мастера',
                'vacancyTitle' => 'Вы можете быть здесь',
                'vacancyText' => 'Ищем мастера по электрике',
                'vacancyButton' => 'Позвонить',
            ],
        ],
        'faq_page' => [
            'title' => 'FAQ',
            'body' => [
                'heroLabel' => 'Частые вопросы',
                'heroTitle' => 'FAQ',
                'heroSubtitle' => 'Ответы на вопросы по диагностике, записи, срокам, запчастям и коммуникации с сервисом.',
                'ctaTitle' => 'Остался свой вопрос?',
                'ctaSubtitle' => 'Создайте заявку — сначала её примет администрация и поможет с маршрутизацией.',
                'ctaButton' => '📅 Создать заявку',
            ],
        ],
        'privacy_page' => [
            'title' => 'Политика конфиденциальности',
            'body' => [
                'heroLabel' => 'Правовая информация',
                'heroTitle' => 'Политика конфиденциальности',
                'heroSubtitle' => 'Как KARETA.KZ обрабатывает данные клиентов, заявки, чаты и файлы.',
                'updatedAt' => '2026-03-20',
                'sections' => [
                    ['title'=>'Какие данные мы получаем','text'=>'Мы можем обрабатывать имя, телефон, данные автомобиля, текст обращения, файлы и историю статусов заявки, если вы добровольно передаёте их через формы или чат.'],
                    ['title'=>'Для чего используются данные','text'=>'Данные используются для связи с клиентом, диагностики, маршрутизации заявки, назначения мастера, ведения истории обслуживания и уведомлений по статусам.'],
                    ['title'=>'Передача и хранение','text'=>'Доступ к данным имеют сотрудники с соответствующей ролью. Данные используются внутри сервиса и не публикуются без отдельного основания.'],
                ],
            ],
        ],
        'terms_page' => [
            'title' => 'Правила сервиса',
            'body' => [
                'heroLabel' => 'Правовая информация',
                'heroTitle' => 'Правила сервиса',
                'heroSubtitle' => 'Базовые условия записи, диагностики, согласования и выполнения работ в KARETA.KZ.',
                'updatedAt' => '2026-03-20',
                'sections' => [
                    ['title'=>'Запись и приём заявки','text'=>'Новая заявка сначала принимается администрацией. После уточнения деталей она назначается мастеру или остаётся в административном контуре до уточнений.'],
                    ['title'=>'Диагностика и согласование','text'=>'Стоимость работ и сроки уточняются после диагностики. Работы и запчасти согласуются до выполнения или установки.'],
                    ['title'=>'Коммуникация по заявке','text'=>'Ключевые изменения статусов, назначение мастера и отдельные этапы могут отражаться в чате и уведомлениях по заявке.'],
                ],
            ],
        ],
        'reviews_page' => [
            'title' => 'Отзывы',
            'body' => [
                'heroLabel' => 'Мнения клиентов',
                'heroTitle' => 'Отзывы',
                'heroSubtitle' => 'Живые отклики клиентов о ремонте, диагностике и качестве сервиса KARETA.',
                'statsLabel' => 'база отзывов KARETA',
                'ctaTitle' => 'Готовы записаться на ремонт?',
                'ctaSubtitle' => 'Оставьте заявку — сначала её примет администрация, затем назначит мастера.',
                'ctaButton' => '📅 Записаться на ремонт',
                'formTitle' => '✍️ Оставить отзыв',
                'formSubtitle' => 'Ваше мнение помогает другим клиентам',
            ],
        ],
        'contacts_page' => [
            'title' => 'Контакты KARETA',
            'body' => [
                'name' => 'KARETA.KZ — Автосервис',
                'phone' => '+77072980649',
                'phoneLabel' => '8 (707) 298 06 49',
                'address' => 'ул. Гоголя 36А, Усть-Каменогорск',
                'email' => 'admin@kareta.kz',
                'instagram' => 'https://instagram.com/kareta_kz',
                'instagramLabel' => '@kareta_kz',
                'mapHint' => 'Автосервис KARETA.KZ · ориентир — район центра города',
                'worktime' => [
                    ['d'=>'Понедельник','t'=>'9:00–19:00','w'=>1],
                    ['d'=>'Вторник','t'=>'9:00–19:00','w'=>2],
                    ['d'=>'Среда','t'=>'9:00–19:00','w'=>3],
                    ['d'=>'Четверг','t'=>'9:00–19:00','w'=>4],
                    ['d'=>'Пятница','t'=>'9:00–19:00','w'=>5],
                    ['d'=>'Суббота','t'=>'10:00–17:00','w'=>6],
                    ['d'=>'Воскресенье','t'=>'Выходной','w'=>0,'off'=>true],
                ],
            ],
        ],
        'about_team' => [
            'title' => 'Команда KARETA',
            'body' => [
                ['masterId'=>'ms_001','role'=>'Мастер · Генераторы и стартеры','exp'=>'8 лет'],
                ['masterId'=>'ms_002','role'=>'Мастер · Сигнализации и проводка','exp'=>'6 лет'],
            ],
        ],
        'home_page' => [
            'title' => 'Главная страница',
            'body' => [
                'locationBadge' => 'Усть-Каменогорск · Гоголя 36А',
                'titleHtml' => 'Диагностика<br>и <span class="acc">Ремонт</span>',
                'descHtml' => 'Профессиональный ремонт генераторов, стартеров, автопроводки и сигнализаций. <strong style="color:var(--text)">Гарантия на все работы.</strong>',
                'stats' => [
                    ['value'=>'8+','label'=>'Лет опыта'],
                    ['value'=>'500+','label'=>'Клиентов'],
                    ['value'=>'1 день','label'=>'Ср. ремонт'],
                    ['value'=>'✓','label'=>'Гарантия'],
                ],
                'teaserTitle' => 'Что мы ремонтируем',
                'ctaTitle' => 'Есть вопросы по ремонту?',
                'ctaSubtitle' => 'Позвоните или запишитесь — ответим в течение 30 минут',
                'ctaMeta' => ['⏰ Пн–Пт 9:00–19:00', '📅 Сб 10:00–17:00', '📍 Гоголя 36А, УКГ'],
            ],
        ],
        'nav_main' => [
            'title' => 'Главное меню сайта',
            'body' => [
                'items' => [
                    ['key'=>'home','label'=>'Главная','sort'=>10,'active'=>1],
                    ['key'=>'services','label'=>'Услуги','sort'=>20,'active'=>1],
                    ['key'=>'parts','label'=>'Запчасти','sort'=>40,'active'=>1],
                    ['key'=>'booking','label'=>'Запись','sort'=>50,'active'=>1],
                    ['key'=>'about','label'=>'О нас','sort'=>60,'active'=>1],
                    ['key'=>'reviews','label'=>'Отзывы','sort'=>70,'active'=>1],
                    ['key'=>'contacts','label'=>'Контакты','sort'=>80,'active'=>1],
                ],
            ],
        ],
        'footer_page' => [
            'title' => 'Footer сайта',
            'body' => [
                'brandHtml' => 'KARETA<em>.KZ</em> — Автосервис',
                'copyText' => '© 2026 KARETA.KZ',
                'note' => 'Ремонт генераторов, стартеров, проводки и сигнализаций',
            ],
        ],
        'page_meta' => [
            'title' => 'Page meta',
            'body' => [
                'siteName' => 'KARETA.KZ',
                'titleSuffix' => '— Автосервис',
                'defaultTitle' => 'KARETA.KZ — Автосервис',
                'defaultDescription' => 'KARETA.KZ — Автосервис в Усть-Каменогорске. Ремонт генераторов, стартеров, проводки и сигнализаций. 8 (707) 298 06 49',
                'pages' => [
                    'home' => ['title'=>'KARETA.KZ — Автосервис','description'=>'KARETA.KZ — Автосервис в Усть-Каменогорске. Ремонт генераторов, стартеров, проводки и сигнализаций. 8 (707) 298 06 49'],
                    'services' => ['title'=>'Услуги — KARETA.KZ','description'=>'Услуги KARETA.KZ: диагностика, ремонт генераторов, стартеров, проводки и сигнализаций.'],
                    'pricing' => ['title'=>'Услуги и цены — KARETA.KZ','description'=>'Маршрут совместимости: цены KARETA.KZ встроены в карточки услуг и раскрываются в модальных окнах.'],
                    'parts' => ['title'=>'Запчасти — KARETA.KZ','description'=>'Каталог запчастей и заявки на подбор деталей в KARETA.KZ.'],
                    'booking' => ['title'=>'Запись — KARETA.KZ','description'=>'Оставьте заявку на ремонт. Сначала обращение принимает администрация, затем назначается мастер.'],
                    'about' => ['title'=>'О нас — KARETA.KZ','description'=>'KARETA.KZ — специализированный автосервис по автоэлектрике, генераторам, стартерам и сигнализациям.'],
                    'reviews' => ['title'=>'Отзывы — KARETA.KZ','description'=>'Отзывы клиентов о ремонте, диагностике и качестве сервиса KARETA.KZ.'],
                    'contacts' => ['title'=>'Контакты — KARETA.KZ','description'=>'Контакты KARETA.KZ: телефон, адрес, график работы и социальные сети.'],
                ],
            ],
        ],
    ];
}

function kareta_default_public_reviews(): array {
    return [
        ['id'=>'rv_001','author_name'=>'Алексей К.','initials'=>'А','date_label'=>'Фев 2025','stars'=>5,'text'=>'Восстановили генератор за 1 день! Думал придётся менять — обошлись ремонтом. Сэкономил очень прилично.','sort'=>10],
        ['id'=>'rv_002','author_name'=>'Марина Д.','initials'=>'М','date_label'=>'Янв 2025','stars'=>5,'text'=>'Сигнализация установлена аккуратно, проводка спрятана полностью. Рекомендую!','sort'=>20],
        ['id'=>'rv_003','author_name'=>'Руслан Т.','initials'=>'Р','date_label'=>'Дек 2024','stars'=>5,'text'=>'Нашли утечку тока за час. Другой сервис две недели не мог. Теперь только сюда.','sort'=>30],
        ['id'=>'rv_004','author_name'=>'Дмитрий В.','initials'=>'Д','date_label'=>'Ноя 2024','stars'=>4,'text'=>'Стартер как новый. Цены честные, без лишних накруток. Отдельное спасибо за объяснение.','sort'=>40],
        ['id'=>'rv_005','author_name'=>'Светлана Ж.','initials'=>'С','date_label'=>'Окт 2024','stars'=>5,'text'=>'Объяснили всё понятно, ничего лишнего не навязали. Приеду снова при необходимости.','sort'=>50],
        ['id'=>'rv_006','author_name'=>'Нурлан А.','initials'=>'Н','date_label'=>'Сен 2024','stars'=>5,'text'=>'Привёз утром — забрал вечером исправную машину. Профессионально и по делу!','sort'=>60],
    ];
}

function kareta_ensure_public_content(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `site_content`(
            `content_key` VARCHAR(100) NOT NULL PRIMARY KEY,
            `title` VARCHAR(255) NOT NULL DEFAULT '',
            `body_json` LONGTEXT NULL,
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `reviews_public`(
            `id` VARCHAR(40) NOT NULL PRIMARY KEY,
            `author_name` VARCHAR(120) NOT NULL DEFAULT '',
            `initials` VARCHAR(12) NOT NULL DEFAULT '',
            `date_label` VARCHAR(40) NOT NULL DEFAULT '',
            `stars` TINYINT UNSIGNED NOT NULL DEFAULT 5,
            `text` TEXT NOT NULL,
            `source_label` VARCHAR(80) NOT NULL DEFAULT 'KARETA',
            `active` TINYINT(1) NOT NULL DEFAULT 1,
            `sort` INT NOT NULL DEFAULT 100,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY `idx_reviews_public_active_sort` (`active`,`sort`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $st = $pdo->prepare("INSERT INTO `site_content`(`content_key`,`title`,`body_json`,`active`) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE `title` = IF(TRIM(COALESCE(`title`,''))='', VALUES(`title`), `title`), `body_json` = IF(`body_json` IS NULL OR TRIM(COALESCE(`body_json`,''))='', VALUES(`body_json`), `body_json`)");
        foreach (kareta_default_public_content() as $key => $row) {
            $st->execute([$key, (string)$row['title'], json_encode($row['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
        }

        $rst = $pdo->prepare("INSERT INTO `reviews_public`(`id`,`author_name`,`initials`,`date_label`,`stars`,`text`,`source_label`,`active`,`sort`) VALUES(?,?,?,?,?,?, 'KARETA',1,?) ON DUPLICATE KEY UPDATE `author_name` = IF(TRIM(COALESCE(`author_name`,''))='', VALUES(`author_name`), `author_name`), `text` = IF(TRIM(COALESCE(`text`,''))='', VALUES(`text`), `text`)");
        foreach (kareta_default_public_reviews() as $r) {
            $rst->execute([$r['id'],$r['author_name'],$r['initials'],$r['date_label'],$r['stars'],$r['text'],$r['sort']]);
        }
    } catch (Throwable $e) {
        error_log('[KARETA] public_content.ensure.error: ' . $e->getMessage());
    }
}

function kareta_ensure_catalog_content(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        // Normalized service catalog imports only when absent; no 109-row write loop on every pull.
        kareta_service_catalog_ensure_available($pdo);

        $mastersCount = (int)$pdo->query("SELECT COUNT(*) FROM `masters`")->fetchColumn();
        if ($mastersCount === 0) {
            $st = $pdo->prepare("INSERT INTO `masters`(id,user_id,user_phone,name,phone,initials,color,spec,active) VALUES(?,?,?,?,?,?,?,?,?)");
            foreach (kareta_default_masters_catalog() as $row) {
                $st->execute([$row[0], null, '', kareta_clean_text($row[1], 191), kareta_normalize_phone($row[2]), kareta_clean_text($row[3], 16), $row[4], kareta_clean_text($row[5], 191), (int)$row[6]]);
            }
        }

        $partsTable = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parts_catalog'")->fetchColumn();
        if ($partsTable > 0) {
            $partCount = (int)$pdo->query("SELECT COUNT(*) FROM `parts_catalog`")->fetchColumn();
            if ($partCount === 0) {
                try { kareta_ensure_parts_catalog_fitment($pdo); } catch (Throwable $_) {}
                $st = $pdo->prepare("INSERT INTO `parts_catalog`(id,cat,name,sku,brand,price_label,stock,note,sort,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,1,?)");
                foreach (kareta_default_parts_catalog() as $row) {
                    $isAssoc = is_array($row) && array_key_exists('id', $row);
                    $rowId = (string)($isAssoc ? ($row['id'] ?? '') : ($row[0] ?? ''));
                    // не сидируем demo/placeholder товары, только предоставленную базу GlobalTuning.
                    if (preg_match('/^(pc_|demo_)/i', $rowId)) { continue; }
                    $st->execute([
                        $isAssoc ? $row['id'] : $row[0],
                        $isAssoc ? $row['cat'] : $row[1],
                        $isAssoc ? $row['name'] : $row[2],
                        $isAssoc ? $row['sku'] : $row[3],
                        $isAssoc ? ($row['brand'] ?? '') : ($row[8] ?? ''),
                        $isAssoc ? $row['price_label'] : $row[4],
                        $isAssoc ? (int)$row['stock'] : (int)$row[5],
                        $isAssoc ? ($row['note'] ?? '') : ($row[6] ?? ''),
                        $isAssoc ? (int)$row['sort'] : (int)$row[7],
                        date('Y-m-d')
                    ]);
                }
            }
        }
    } catch (Throwable $e) {
        error_log('[KARETA] catalog.ensure.error: ' . $e->getMessage());
    }
}

/* ═══════════════════════════════════════════════════════════
   PULL — полная выгрузка (заменяет localStorage seed)
   ═══════════════════════════════════════════════════════════ */

function kareta_try_query_all(PDO $pdo, string $sql, array $params = [], array $fallback = [], string $channel = "DB_PULL_QUERY"): array
{
    try {
        $st = $pdo->prepare($sql);
        $st->execute($params);
        return $st->fetchAll() ?: [];
    } catch (Throwable $e) {
        kareta_log_error($channel, $e->getMessage() . ' | SQL=' . preg_replace('/\s+/', ' ', trim($sql)));
        return $fallback;
    }
}

function kareta_try_query_value(PDO $pdo, string $sql, array $params = [], mixed $fallback = null, string $channel = "DB_PULL_QUERY"): mixed
{
    try {
        $st = $pdo->prepare($sql);
        $st->execute($params);
        $v = $st->fetchColumn();
        return $v === false ? $fallback : $v;
    } catch (Throwable $e) {
        kareta_log_error($channel, $e->getMessage() . ' | SQL=' . preg_replace('/\s+/', ' ', trim($sql)));
        return $fallback;
    }
}

function db_pull_empty_payload(): array
{
    return [
        '_nextNum'=>43,
        'orders'=>[], 'clients'=>[], 'masters'=>[], 'services'=>[], 'partsCatalog'=>[],
        'siteContent'=>[], 'publicReviews'=>[], 'shops'=>[], 'shopSales'=>[], 'stoProfiles'=>[],
        'chats'=>[], 'messages'=>[], 'notifications'=>[], 'vehicles'=>[], 'masterSchedules'=>[],
        'masterWallPosts'=>[], 'masterPosts'=>[], 'masterReviews'=>[],
        'masterExchangeState'=>function_exists('kareta_master_exchange_default_state') ? kareta_master_exchange_default_state() : [],
        'clientExchangeState'=>function_exists('client_exchange_default_state') ? client_exchange_default_state() : [],
        'orderEvents'=>[], 'news'=>[],
    ];
}

function db_pull_recovery(?PDO $pdo, Throwable $sourceError): void
{
    $payload = db_pull_empty_payload();
    $users = [];
    $debug = ['mode'=>'pull_recovery','type'=>get_class($sourceError),'role'=>function_exists('_actor_role')?_actor_role():'guest'];

    if (!$pdo instanceof PDO) {
        $response=[
            'ok'=>true,
            'code'=>'DEGRADED_SNAPSHOT',
            'message'=>'Сервер данных временно недоступен. Загружен безопасный пустой снимок.',
            'degraded'=>true,
            'data'=>$payload,
            'users'=>$users,
        ];
        if(kareta_diagnostics_authorized())$response['_debug']=$debug;
        kareta_json($response,200);
    }

    try {
        $resolvedActor = $pdo instanceof PDO ? kareta_resolve_api_actor($pdo) : [];
        $role = (string)($resolvedActor['role'] ?? (function_exists('_actor_role') ? _actor_role() : 'guest'));
        $phone = (string)($resolvedActor['phone'] ?? (function_exists('_actor_phone') ? _actor_phone() : ''));
        $actor = $resolvedActor ?: (function_exists('kareta_session_user') ? (kareta_session_user() ?: []) : []);
        $actorUserId = (int)($resolvedActor['id'] ?? $actor['id'] ?? 0);
        $currentStoId = '';
        if ($role === 'sto' && $phone !== '' && function_exists('kareta_sto_id_by_phone')) {
            try { $currentStoId = (string)(kareta_sto_id_by_phone($pdo, $phone) ?: ''); } catch (Throwable $_) { $currentStoId = ''; }
        }
        if ($role === 'sto') $debug['stoId'] = $currentStoId;

        if (function_exists('kareta_ensure_schema_columns')) {
            try { kareta_ensure_schema_columns($pdo); } catch (Throwable $e) { kareta_log_error('DB_PULL_RECOVERY_SCHEMA', $e->getMessage()); }
        }

        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'orders')) {
            $where = '1=0';
            $params = [];
            if (function_exists('kareta_has_role') && kareta_has_role('admin')) {
                $where = '1=1';
            } elseif ($role === 'client') {
                $where = '(client_user_id=? OR client_phone=?)';
                $params = [$actorUserId ?: -1, $phone];
            } elseif ($role === 'master') {
                $where = '(master_user_id=?)';
                $params = [$actorUserId ?: -1];
            } elseif ($role === 'sto') {
                if ($currentStoId !== '') {
                    $where = "COALESCE(sto_id,'')=?";
                    $params = [$currentStoId];
                } else {
                    $where = '1=0';
                }
            }
            $rows = kareta_try_query_all($pdo, "SELECT * FROM `orders` WHERE {$where} ORDER BY created_at DESC LIMIT 200", $params, [], 'DB_PULL_RECOVERY_ORDERS');
            $payload['orders'] = function_exists('_fmt_order') ? array_map('_fmt_order', $rows) : $rows;
            $payload['_nextNum'] = (int)(kareta_try_query_value($pdo, "SELECT COALESCE(MAX(num),42)+1 FROM `orders`", [], 43, 'DB_PULL_RECOVERY_NEXTNUM') ?: 43);
        }

        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'masters')) {
            $payload['masters'] = kareta_try_query_all($pdo, "SELECT id, user_id AS userId, user_phone AS userPhone, name, phone, initials, color, spec, active FROM `masters` WHERE COALESCE(active,1) != 0 ORDER BY name LIMIT 200", [], [], 'DB_PULL_RECOVERY_MASTERS');
            foreach ($payload['masters'] as &$m) { $m['active'] = (bool)($m['active'] ?? 1); } unset($m);
        }

        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'clients')) {
            if ($role === 'client' && $phone !== '') {
                $payload['clients'] = kareta_try_query_all($pdo, "SELECT id, user_id AS userId, user_phone AS userPhone, name, phone, car, notes, orders_count AS ordersCount, total_spent AS totalSpent, created_at AS createdAt, 1 AS active FROM `clients` WHERE user_id=? OR user_phone=? OR phone=? LIMIT 50", [$actorUserId ?: 0, $phone, $phone], [], 'DB_PULL_RECOVERY_CLIENTS');
            } elseif ($role === 'sto' && $currentStoId !== '') {
                if (function_exists('kareta_ensure_sto_client_links')) {
                    try { kareta_ensure_sto_client_links($pdo); } catch (Throwable $e) { kareta_log_error('DB_PULL_RECOVERY_STO_CLIENT_LINKS', $e->getMessage()); }
                }
                $payload['clients'] = kareta_try_query_all($pdo, "SELECT c.id, c.user_id AS userId, c.user_phone AS userPhone, c.name, c.phone, c.car, c.notes, c.orders_count AS ordersCount, c.total_spent AS totalSpent, c.created_at AS createdAt, 1 AS active FROM `clients` c WHERE (EXISTS (SELECT 1 FROM `orders` o WHERE o.sto_id=? AND (o.client_id=c.id OR o.client_phone=c.phone OR o.client_phone=c.user_phone)) OR EXISTS (SELECT 1 FROM `sto_client_links` scl WHERE scl.sto_id=? AND scl.client_id=c.id)) ORDER BY c.created_at DESC LIMIT 200", [$currentStoId, $currentStoId], [], 'DB_PULL_RECOVERY_CLIENTS_STO');
                foreach ($payload['clients'] as &$c) { $c['scope'] = 'sto'; } unset($c);
            } elseif (function_exists('kareta_has_role') && kareta_has_role('admin')) {
                $payload['clients'] = kareta_try_query_all($pdo, "SELECT id, user_id AS userId, user_phone AS userPhone, name, phone, car, notes, orders_count AS ordersCount, total_spent AS totalSpent, created_at AS createdAt, 1 AS active FROM `clients` ORDER BY created_at DESC LIMIT 200", [], [], 'DB_PULL_RECOVERY_CLIENTS_ADMIN');
            }
            foreach ($payload['clients'] as &$c) { $c['active'] = (bool)($c['active'] ?? 1); } unset($c);
        }

        if (function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'chats')) {
            $chatWhere = '1=0';
            $chatParams = [];
            if (function_exists('kareta_has_role') && kareta_has_role('admin')) {
                $chatWhere = '1=1';
            } elseif ($role === 'client') {
                $chatWhere = '(client_user_id=? OR client_phone=?)';
                $chatParams = [$actorUserId ?: -1, $phone];
            } elseif ($role === 'master') {
                $chatWhere = '(master_user_id=?)';
                $chatParams = [$actorUserId ?: -1];
            } elseif ($role === 'sto' && $currentStoId !== '') {
                $chatWhere = "(sto_id=? OR EXISTS (SELECT 1 FROM `orders` o WHERE o.id=`chats`.order_id AND o.sto_id=?))";
                $chatParams = [$currentStoId, $currentStoId];
            }
            $chatRows = kareta_try_query_all($pdo, "SELECT * FROM `chats` WHERE {$chatWhere} ORDER BY updated_at DESC, id DESC LIMIT 200", $chatParams, [], 'DB_PULL_RECOVERY_CHATS');
            $payload['chats'] = function_exists('_fmt_chat') ? array_map('_fmt_chat', $chatRows) : $chatRows;
            $chatIds = array_values(array_filter(array_map(static fn($c) => $c['id'] ?? null, $payload['chats'])));
            if ($chatIds && function_exists('kareta_table_exists') && kareta_table_exists($pdo, 'messages')) {
                $ph = implode(',', array_fill(0, count($chatIds), '?'));
                $messages = [];
                foreach (kareta_try_query_all($pdo, "SELECT * FROM `messages` WHERE chat_id IN ($ph) ORDER BY created_at LIMIT 1000", $chatIds, [], 'DB_PULL_RECOVERY_MESSAGES') as $m) {
                    $cid = $m['chat_id'] ?? '';
                    if ($cid === '') continue;
                    $row = ['id'=>$m['id'] ?? '', 'from'=>$m['from_role'] ?? '', 'type'=>$m['type'] ?? 'text', 'text'=>$m['text'] ?? '', 'time'=>$m['time'] ?? ($m['created_at'] ?? '')];
                    if (!empty($m['file_name'])) { $row['fileName']=$m['file_name']; $row['fileType']=$m['file_type'] ?? ''; }
                    if (!empty($m['file_url'])) $row['fileUrl']=kareta_message_public_file_url((string)$m['file_url'],(string)($m['id']??''),(string)$cid); elseif (!empty($m['file_data'])) $row['fileData'] = $m['file_data'];
                    if (!empty($m['meta'])) { foreach (kareta_message_public_meta($m['meta']) as $k=>$v) $row[$k]=$v; }
                    $messages[$cid][] = $row;
                }
                $payload['messages'] = $messages;
            }
        }

        try {
            $catalogRecovery = kareta_service_catalog_public_payload($pdo);
            $payload['services'] = $catalogRecovery['services'] ?? [];
            $payload['serviceCategories'] = $catalogRecovery['serviceCategories'] ?? [];
            $payload['serviceSource'] = (string)($catalogRecovery['meta']['source'] ?? 'recovery');
        } catch (Throwable $catalogError) {
            kareta_log_error('DB_PULL_RECOVERY_SERVICE_CATALOG', $catalogError->getMessage());
        }

        if (function_exists('notifications_fetch_mine')) {
            try { $payload['notifications'] = notifications_fetch_mine($pdo); } catch (Throwable $_) {}
        }
        if (function_exists('app_config_read')) {
            $appConfig = app_config_read();
        } else {
            $appConfig = [];
        }
    } catch (Throwable $recoveryError) {
        $debug['recoveryErrorType'] = get_class($recoveryError);
        $appConfig = function_exists('app_config_read') ? app_config_read() : [];
    }

    // Восстановительный ответ намеренно ok=true: фронт получает минимум данных и не падает в старый local cache.
    $response=['ok'=>true,'appConfig'=>$appConfig??[],'data'=>$payload,'users'=>$users];
    if(kareta_diagnostics_authorized())$response['_debug']=$debug;
    kareta_json($response);
}

function db_pull(?PDO $pdo): void
{
    if (!$pdo) {
        db_pull_recovery(null, new RuntimeException('db_unavailable'));
        return;
    }
    kareta_ensure_catalog_content($pdo);
    kareta_ensure_public_content($pdo);
    try { kareta_ensure_schema_columns($pdo); } catch (Throwable $e) { kareta_log_error('DB_PULL_SCHEMA_ENSURE', $e->getMessage()); }
    try {
        kareta_ensure_column($pdo, 'orders', 'sto_id', "ALTER TABLE `orders` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `master_name`");
        kareta_ensure_column($pdo, 'orders', 'sto_name', "ALTER TABLE `orders` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `sto_id`");
        kareta_ensure_column($pdo, 'chats', 'sto_id', "ALTER TABLE `chats` ADD COLUMN `sto_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`");
        kareta_ensure_column($pdo, 'chats', 'sto_user_id', "ALTER TABLE `chats` ADD COLUMN `sto_user_id` INT NULL DEFAULT NULL AFTER `sto_id`");
        kareta_ensure_column($pdo, 'chats', 'unread_sto', "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0");
        kareta_ensure_index($pdo, 'orders', 'idx_sto_status_created', "ALTER TABLE `orders` ADD INDEX `idx_sto_status_created` (`sto_id`, `status`, `created_at`)");
        kareta_ensure_index($pdo, 'chats', 'idx_chat_sto_order', "ALTER TABLE `chats` ADD INDEX `idx_chat_sto_order` (`sto_id`, `order_id`)");
    } catch (Throwable $e) { kareta_log_error('DB_PULL_STO_SCHEMA_ENSURE', $e->getMessage()); }

    $resolvedActor = kareta_resolve_api_actor($pdo);
    $role = (string)($resolvedActor['role'] ?? 'client');
    $phone = (string)($resolvedActor['phone'] ?? '');
    $actorUserId = (int)($resolvedActor['id'] ?? 0);
    $currentStoId = '';
    if ($role === 'sto' && $phone !== '') {
        try { $currentStoId = (string)(kareta_sto_id_by_phone($pdo, $phone) ?: ''); } catch (Throwable $_) { $currentStoId = ''; }
    }
    $nextNum = (int)(kareta_try_query_value($pdo, "SELECT COALESCE(MAX(num),42)+1 FROM `orders`", [], 43, 'DB_PULL_NEXTNUM') ?: 43);

    $orderSql = "SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id, (SELECT COUNT(*) FROM `master_exchange_responses` r WHERE r.request_id=o.id AND r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn')) AS responses_count FROM `orders` o";
    $orderParams = [];
    if (!kareta_has_role('admin')) {
        if ($role === 'master') {
            $mst = null;
            if ($actorUserId > 0) {
                $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1");
                $stm->execute([$actorUserId]);
                $mst = $stm->fetchColumn();
            }
            if (!$mst) {
                $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
                $stm->execute([$phone, $phone]);
                $mst = $stm->fetchColumn();
            }
            $masterId = (string)($mst ?: '');
            // ── Авто-создание записи мастера если её нет ──────────────────
            if ($masterId === '' && ($actorUserId > 0 || $phone !== '')) {
                $actorUser = $resolvedActor ?: (kareta_session_user() ?? []);
                $newMasterId = 'ms_' . bin2hex(random_bytes(4));
                $mName = kareta_clean_text((string)($actorUser['name'] ?? 'Мастер'), 191);
                $words = array_filter(explode(' ', $mName));
                $mInit = mb_strtoupper(implode('', array_map(fn($w) => mb_substr($w, 0, 1, 'UTF-8'), $words)), 'UTF-8');
                $mInit = mb_substr($mInit, 0, 2, 'UTF-8') ?: 'М';
                try {
                    try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `resume` JSON NULL DEFAULT NULL"); } catch(Throwable $_){}
                    try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `address` VARCHAR(255) NULL DEFAULT NULL"); } catch(Throwable $_){}
                    try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `org_name` VARCHAR(255) NULL DEFAULT NULL"); } catch(Throwable $_){}
                    try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `business_type` VARCHAR(16) NULL DEFAULT NULL"); } catch(Throwable $_){}
                    $pdo->prepare("INSERT IGNORE INTO `masters`(id, user_id, user_phone, name, phone, initials, color, spec, active) VALUES(?,?,?,?,?,?,?,?,1)")
                        ->execute([$newMasterId, $actorUserId ?: null, $phone, $mName, $phone, $mInit, '#34d399', '']);
                    if ($actorUserId > 0) {
                        $pdo->prepare("UPDATE `masters` SET user_id=? WHERE (user_phone=? OR phone=?) AND (user_id IS NULL OR user_id=0) LIMIT 1")
                            ->execute([$actorUserId, $phone, $phone]);
                    }
                    $stm2 = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? OR user_phone=? OR phone=? LIMIT 1");
                    $stm2->execute([$actorUserId ?: -1, $phone, $phone]);
                    $masterId = (string)($stm2->fetchColumn() ?: $newMasterId);
                } catch(Throwable $_) {}
            }
            // Мастер видит: свои заявки + открытую биржу (master_id='0', статус ТОЛЬКО new)
            $orderSql .= " WHERE (o.master_user_id=? OR o.master_id=? OR (COALESCE(o.master_id,'0')='0' AND o.status IN ('new','waiting_responses')))";
            $orderParams[] = $actorUserId ?: -1;
            $orderParams[] = $masterId;
        } elseif ($role === 'client') {
            $orderSql .= " WHERE (o.client_user_id=? OR o.client_phone=?)";
            $orderParams[] = $actorUserId ?: -1;
            $orderParams[] = $phone;
        } elseif ($role === 'sto') {
            if ($currentStoId !== '') {
                $orderSql .= " WHERE o.sto_id=?";
                $orderParams[] = $currentStoId;
            } else {
                $orderSql .= " WHERE 1=0";
            }
        } else {
            $orderSql .= " WHERE 1=0";
        }
    }
    $orderSql .= " ORDER BY created_at DESC";
    $stOrders = $pdo->prepare($orderSql);
    $stOrders->execute($orderParams);
    $orderRows = $stOrders->fetchAll();
    if (in_array($role, ['admin','owner'], true)) {
        // Администратор видит всё — диспетчеризации больше нет
        foreach ($orderRows as &$orow) { $orow['dispatchLocked'] = false; }
        unset($orow);
    } elseif ($role === 'master') {
        // Для заявок из открытой биржи (masterId='0') скрываем персональные данные до взятия
        foreach ($orderRows as &$orow) {
            if ((string)($orow['master_id'] ?? '0') === '0') {
                $orow['client_phone'] = '';
                $orow['client_name']  = 'Клиент #' . substr(md5($orow['id']), 0, 4);
                $orow['_queue_item']  = 1;
            }
        }
        unset($orow);
    }
    $orders = array_map('_fmt_order', $orderRows);
    foreach ($orders as &$orderItem) {
        $orderItem['dispatchLocked'] = !empty($orderItem['_queue_item']);
    }
    unset($orderItem);
    // STO-ASSIGN: в основной pull добавляем историю назначений мастеров
    // к каждой видимой заявке. Фильтрация уже выполнена выше по роли/sto_id.
    kareta_attach_order_assignment_history($pdo, $orders);

    // История этапов и событий по видимым заявкам: клиент и мастер видят одинаковую ленту прогресса.
    $orderEvents = [];
    try {
        if (!empty($orders) && kareta_table_exists($pdo, 'order_events')) {
            $orderIds = array_values(array_filter(array_map(fn($o) => (string)($o['id'] ?? ''), $orders)));
            if (!empty($orderIds)) {
                $ph = implode(',', array_fill(0, count($orderIds), '?'));
                $stEv = $pdo->prepare("SELECT id, order_id AS orderId, event_type AS eventType, actor_id AS actorId, actor_role AS actorRole, meta, created_at AS createdAt FROM `order_events` WHERE order_id IN ($ph) ORDER BY created_at ASC, id ASC");
                $stEv->execute($orderIds);
                $orderEvents = $stEv->fetchAll(PDO::FETCH_ASSOC) ?: [];
                foreach ($orderEvents as &$ev) {
                    $ev['actorId'] = isset($ev['actorId']) ? ((int)$ev['actorId'] ?: null) : null;
                    $ev['meta'] = json_decode((string)($ev['meta'] ?? '{}'), true) ?: [];
                }
                unset($ev);
            }
        }
    } catch (Throwable $_ev) { $orderEvents = []; }

    $clients = [];
    if (kareta_has_role('admin')) {
        $clients = $pdo->query("SELECT c.id, c.user_id AS userId, c.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), c.name) AS name, COALESCE(NULLIF(u.phone,''), c.phone) AS phone, COALESCE(NULLIF(u.car,''), c.car) AS car, c.notes, c.orders_count AS ordersCount, c.total_spent AS totalSpent, c.created_at AS createdAt, COALESCE(u.active,1) AS active FROM `clients` c LEFT JOIN `users` u ON u.id = c.user_id")->fetchAll();
    } elseif ($role === 'client' && $phone !== '') {
        $stClients = $pdo->prepare("SELECT c.id, c.user_id AS userId, c.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), c.name) AS name, COALESCE(NULLIF(u.phone,''), c.phone) AS phone, COALESCE(NULLIF(u.car,''), c.car) AS car, c.notes, c.orders_count AS ordersCount, c.total_spent AS totalSpent, c.created_at AS createdAt, COALESCE(u.active,1) AS active FROM `clients` c LEFT JOIN `users` u ON u.id = c.user_id WHERE c.user_id=? OR c.user_phone=? OR c.phone=?");
        $stClients->execute([$actorUserId ?: 0, $phone, $phone]);
        $clients = $stClients->fetchAll();
    } elseif ($role === 'sto' && $currentStoId !== '') {
        try { kareta_ensure_sto_client_links($pdo); } catch (Throwable $_) {}
        $stClients = $pdo->prepare("SELECT c.id, c.user_id AS userId, c.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), c.name) AS name, COALESCE(NULLIF(u.phone,''), c.phone) AS phone, COALESCE(NULLIF(u.car,''), c.car) AS car, c.notes, c.orders_count AS ordersCount, c.total_spent AS totalSpent, c.created_at AS createdAt, COALESCE(u.active,1) AS active FROM `clients` c LEFT JOIN `users` u ON u.id = c.user_id WHERE (EXISTS (SELECT 1 FROM `orders` o WHERE o.sto_id=? AND (o.client_id=c.id OR o.client_phone=c.phone OR o.client_phone=c.user_phone)) OR EXISTS (SELECT 1 FROM `sto_client_links` scl WHERE scl.sto_id=? AND scl.client_id=c.id)) ORDER BY c.orders_count DESC, c.created_at DESC");
        $stClients->execute([$currentStoId, $currentStoId]);
        $clients = $stClients->fetchAll();
    }
    foreach ($clients as &$c) { $c['active'] = (bool)($c['active'] ?? 1); if ($role === 'sto') $c['scope'] = 'sto'; } unset($c);

    // Ensure masters table exists + seed if empty
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `masters` (id VARCHAR(64) PRIMARY KEY, user_id INT NULL, user_phone VARCHAR(32) DEFAULT '', name VARCHAR(191) DEFAULT 'Мастер', phone VARCHAR(32) DEFAULT '', initials VARCHAR(16) DEFAULT '', color VARCHAR(16) DEFAULT '#34d399', spec VARCHAR(191) DEFAULT '', active TINYINT DEFAULT 1, resume JSON NULL)");
        // Добавляем колонки если отсутствуют (таблица могла существовать до их добавления)
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `resume` JSON NULL DEFAULT NULL"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `address` VARCHAR(255) NULL DEFAULT NULL"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `org_name` VARCHAR(255) NULL DEFAULT NULL"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `business_type` VARCHAR(16) NULL DEFAULT NULL"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT ''"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT ''"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `rating` DECIMAL(3,2) NOT NULL DEFAULT 0"); } catch(Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `reviews_count` INT NOT NULL DEFAULT 0"); } catch(Throwable $_) {}
        $__mc = (int)($pdo->query("SELECT COUNT(*) FROM `masters`")->fetchColumn());
        if ($__mc === 0) {
            $__st = $pdo->prepare("INSERT IGNORE INTO `masters`(id,user_id,user_phone,name,phone,initials,color,spec,active) VALUES(?,NULL,'',?,?,?,?,?,?)");
            foreach (kareta_default_masters_catalog() as $row) {
                $__st->execute([$row[0], $row[1], $row[2], $row[3], $row[4], $row[5], (int)$row[6]]);
            }
        }
    } catch(Throwable $__e) {
        error_log('[KARETA_DEBUG] masters ensure error: ' . $__e->getMessage());
    }
    // Admin видит ВСЕХ мастеров (в т.ч. неактивных) для управления; остальные только активных
    $mastersSqlError = null;
    // Для публичного просмотра активность определяется только m.active (не u.active через JOIN)
    $mastersResumeSelect = kareta_column_exists($pdo, 'masters', 'resume') ? 'm.resume' : 'NULL AS resume';
    $mastersSql = kareta_has_role('admin')
        ? "SELECT m.id, m.user_id AS userId, m.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), m.name) AS name, COALESCE(NULLIF(u.phone,''), m.phone) AS phone, COALESCE(NULLIF(u.initials,''), m.initials) AS initials, m.color, COALESCE(NULLIF(u.spec,''), m.spec) AS spec, COALESCE(m.rating,0) AS rating, COALESCE(m.reviews_count,0) AS reviewsCount, COALESCE(u.active, m.active, 1) AS active, COALESCE(m.sto_id,'') AS stoId, COALESCE(NULLIF(sp.name,''), NULLIF(m.sto_name,''), '') AS stoName, {$mastersResumeSelect} FROM `masters` m LEFT JOIN `users` u ON u.id = m.user_id LEFT JOIN `sto_profiles` sp ON sp.id = m.sto_id ORDER BY name"
        : "SELECT m.id, m.user_id AS userId, m.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), m.name) AS name, COALESCE(NULLIF(u.phone,''), m.phone) AS phone, COALESCE(NULLIF(u.initials,''), m.initials) AS initials, m.color, COALESCE(NULLIF(u.spec,''), m.spec) AS spec, COALESCE(m.rating,0) AS rating, COALESCE(m.reviews_count,0) AS reviewsCount, COALESCE(m.active, 1) AS active, COALESCE(m.sto_id,'') AS stoId, COALESCE(NULLIF(sp.name,''), NULLIF(m.sto_name,''), '') AS stoName, {$mastersResumeSelect} FROM `masters` m LEFT JOIN `users` u ON u.id = m.user_id LEFT JOIN `sto_profiles` sp ON sp.id = m.sto_id WHERE COALESCE(m.active, 1) != 0 ORDER BY name";
    try {
        $st = $pdo->prepare($mastersSql);
        $st->execute([]);
        $masters = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch(Throwable $__me) {
        $mastersSqlError = $__me->getMessage();
        error_log('[KARETA_DEBUG] masters SQL error: ' . $mastersSqlError);
        $masters = [];
    }
    // Фоллбек: если активных нет — вернуть всех
    if (empty($masters) && !kareta_has_role('admin')) {
        $mastersAllSql = "SELECT m.id, m.user_id AS userId, m.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), m.name) AS name, COALESCE(NULLIF(u.phone,''), m.phone) AS phone, COALESCE(NULLIF(u.initials,''), m.initials) AS initials, m.color, COALESCE(NULLIF(u.spec,''), m.spec) AS spec, COALESCE(m.rating,0) AS rating, COALESCE(m.reviews_count,0) AS reviewsCount, COALESCE(m.active, 1) AS active, COALESCE(m.sto_id,'') AS stoId, COALESCE(NULLIF(sp.name,''), NULLIF(m.sto_name,''), '') AS stoName, {$mastersResumeSelect} FROM `masters` m LEFT JOIN `users` u ON u.id = m.user_id LEFT JOIN `sto_profiles` sp ON sp.id = m.sto_id ORDER BY name";
        try {
            $st2 = $pdo->prepare($mastersAllSql);
            $st2->execute([]);
            $masters = $st2->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch(Throwable $__me2) {
            $mastersSqlError = ($mastersSqlError ? $mastersSqlError . ' | fallback: ' : 'fallback: ') . $__me2->getMessage();
            error_log('[KARETA_DEBUG] masters fallback SQL error: ' . $__me2->getMessage());
            $masters = [];
        }
        error_log('[KARETA_DEBUG] masters fallback used, returned: ' . count($masters));
    }
    foreach ($masters as &$m) {
        $m['active'] = (bool)($m['active'] ?? 1);
        $m['resume'] = isset($m['resume']) && $m['resume'] !== null
            ? (json_decode((string)$m['resume'], true) ?: [])
            : [];
    } unset($m);

    try { kareta_service_catalog_ensure_available($pdo); } catch (Throwable $e) { kareta_log_error('SERVICE_CATALOG_ENSURE', $e->getMessage()); }
    $serviceTable = kareta_table_exists($pdo, 'service_catalog') ? 'service_catalog' : 'services';
    $servicesSql = $serviceTable === 'service_catalog'
        ? "SELECT id,icon,name,category_key AS cat,base_price AS basePrice,avg_time AS avgTime,price_label AS priceLabel,time_label AS timeLabel,short_desc AS shortDesc,why_text AS whyText,steps_json AS stepsJson,variants_json AS listJson,sort,active FROM `service_catalog` WHERE active=1 ORDER BY sort"
        : "SELECT id,icon,name,cat,base_price AS basePrice,avg_time AS avgTime,price_label AS priceLabel,time_label AS timeLabel,short_desc AS shortDesc,why_text AS whyText,steps_json AS stepsJson,list_json AS listJson,sort,active FROM `services` WHERE active=1 ORDER BY sort";
    $services = kareta_try_query_all($pdo, $servicesSql, [], [], 'DB_PULL_SERVICES');
    $serviceCategories = kareta_table_exists($pdo, 'service_categories')
        ? kareta_try_query_all($pdo, "SELECT category_key AS `key`,name,icon,sort,active FROM `service_categories` WHERE active=1 ORDER BY sort,name", [], [], 'DB_PULL_SERVICE_CATEGORIES')
        : [];

    // Последняя защита выдачи: если MySQL-каталог повреждён или миграция на сервере
    // не завершилась, пользователь всё равно получает проверенный source-каталог.
    // Следующий запрос повторит self-heal через ensure_available().
    if (!$services || !$serviceCategories) {
        try {
            $fallbackSource = kareta_service_catalog_load_source();
            $fallbackMeta = is_array($fallbackSource['source'] ?? null) ? $fallbackSource['source'] : [];
            if (!$services) $services = kareta_service_catalog_legacy_rows();
            if (!$serviceCategories) {
                foreach (is_array($fallbackSource['categories'] ?? null) ? $fallbackSource['categories'] : [] as $category) {
                    if (!is_array($category) || empty($category['active'])) continue;
                    $serviceCategories[] = [
                        'key'=>(string)($category['key'] ?? 'other'),
                        'name'=>(string)($category['name'] ?? 'Другое'),
                        'icon'=>(string)($category['icon'] ?? '🔧'),
                        'sort'=>(int)($category['sort'] ?? 0),
                        'active'=>true,
                    ];
                }
            }
            kareta_log_error('SERVICE_CATALOG_FALLBACK', 'Source fallback used: ' . (string)($fallbackMeta['key'] ?? 'services_json'));
        } catch (Throwable $fallbackError) {
            kareta_log_error('SERVICE_CATALOG_FALLBACK_FAILED', $fallbackError->getMessage());
        }
    }
    foreach ($services as &$s) {
        $s['basePrice']=(int)$s['basePrice'];
        $s['active']=(bool)$s['active'];
        $s['steps']=json_decode((string)($s['stepsJson'] ?? '[]'), true) ?: [];
        $s['list']=json_decode((string)($s['listJson'] ?? '[]'), true) ?: [];
        unset($s['stepsJson'],$s['listJson']);
    } unset($s);
    $serviceOffers = [];
    try {
        $serviceOffers = kareta_service_offers_public($pdo);
        $offerMap = [];
        foreach ($serviceOffers as $offer) {
            $sid = (string)($offer['serviceId'] ?? '');
            if ($sid === '') continue;
            if (!isset($offerMap[$sid])) $offerMap[$sid] = ['count'=>0,'minPrice'=>0,'owners'=>[]];
            $offerMap[$sid]['count']++;
            $price = (float)($offer['price'] ?? 0);
            if ($price > 0 && ($offerMap[$sid]['minPrice'] <= 0 || $price < $offerMap[$sid]['minPrice'])) $offerMap[$sid]['minPrice'] = $price;
            $owner = trim((string)($offer['ownerName'] ?? ''));
            if ($owner !== '' && !in_array($owner, $offerMap[$sid]['owners'], true)) $offerMap[$sid]['owners'][] = $owner;
        }
        foreach ($services as &$service) {
            $summary = $offerMap[(string)$service['id']] ?? ['count'=>0,'minPrice'=>0,'owners'=>[]];
            $service['offerCount'] = (int)$summary['count'];
            $service['minOfferPrice'] = (float)$summary['minPrice'];
            $service['offerOwners'] = array_slice($summary['owners'],0,5);
        }
        unset($service);
    } catch (Throwable $e) {
        kareta_log_error('SERVICE_OFFERS_PULL', $e->getMessage());
    }

    try { kareta_ensure_parts_catalog_fitment($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_crosses($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_suppliers($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_fitments($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_request_flow($pdo); } catch (Throwable $_) {}
    $partsCatalog = kareta_try_query_all($pdo, "SELECT id,cat,name,sku,brand,manufacturer_type AS manufacturerType,oem,analogs_json AS analogs,crosses_json AS crosses,suppliers_json AS suppliers,compatibility,vehicle_make AS vehicleMake,vehicle_model AS vehicleModel,vehicle_generation AS vehicleGeneration,year_from AS yearFrom,year_to AS yearTo,engine,body,vin_prefixes AS vinPrefixes,fitments_json AS fitments,fitments_json AS fitmentsText,price_label AS priceLabel,price,wholesale_price AS wholesalePrice,stock,stock_qty AS stockQty,image_url AS imageUrl,source_key AS sourceKey,note,sort,active,created_at AS createdAt FROM `parts_catalog` WHERE active=1 ORDER BY sort,name", [], [], 'DB_PULL_PARTS');
    foreach ($partsCatalog as &$pc) { $pc['price']=(float)($pc['price'] ?? 0); $pc['wholesalePrice']=(float)($pc['wholesalePrice'] ?? 0); $pc['stockQty']=(int)($pc['stockQty'] ?? 0); $pc['stock']=$pc['stockQty'] > 0; $pc['active']=(bool)($pc['active'] ?? 1); } unset($pc);

    $siteContent = [];
    $siteRows = kareta_try_query_all($pdo, "SELECT content_key AS contentKey, title, body_json AS bodyJson, active, updated_at AS updatedAt FROM `site_content` WHERE active=1 ORDER BY content_key", [], [], 'DB_PULL_SITE_CONTENT');
    foreach ($siteRows as $row) {
        $siteContent[(string)$row['contentKey']] = [
            'title' => (string)($row['title'] ?? ''),
            'body' => json_decode((string)($row['bodyJson'] ?? '{}'), true) ?: [],
            'updatedAt' => $row['updatedAt'] ?? null,
        ];
    }

    // Добавляем masterId и masterName — нужны для фильтрации отзывов по мастеру в панелях
    // Добавляем колонки если их нет (идемпотентно)
    try {
        kareta_ensure_column($pdo, 'reviews_public', 'master_id',   "ALTER TABLE `reviews_public` ADD COLUMN `master_id`   VARCHAR(64)  NULL DEFAULT NULL AFTER `text`");
        kareta_ensure_column($pdo, 'reviews_public', 'master_name', "ALTER TABLE `reviews_public` ADD COLUMN `master_name` VARCHAR(160) NULL DEFAULT NULL AFTER `master_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'review_type', "ALTER TABLE `reviews_public` ADD COLUMN `review_type` VARCHAR(24) NULL DEFAULT 'service' AFTER `master_name`");
        kareta_ensure_column($pdo, 'reviews_public', 'order_id',    "ALTER TABLE `reviews_public` ADD COLUMN `order_id` VARCHAR(64) NULL DEFAULT NULL AFTER `review_type`");
        kareta_ensure_column($pdo, 'reviews_public', 'product_id',  "ALTER TABLE `reviews_public` ADD COLUMN `product_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'product_name',"ALTER TABLE `reviews_public` ADD COLUMN `product_name` VARCHAR(191) NULL DEFAULT NULL AFTER `product_id`");
        kareta_ensure_column($pdo, 'reviews_public', 'client_id',   "ALTER TABLE `reviews_public` ADD COLUMN `client_id` VARCHAR(64) NULL DEFAULT NULL AFTER `product_name`");
        $publicReviews = kareta_try_query_all($pdo,
            "SELECT id, author_name AS name, initials, date_label AS dateLabel, stars, text,
                    source_label AS sourceLabel, sort, created_at AS createdAt,
                    COALESCE(master_id,'') AS masterId, COALESCE(master_name,'') AS masterName,
                    COALESCE(review_type,'service') AS reviewType, COALESCE(order_id,'') AS orderId,
                    COALESCE(product_id,'') AS productId, COALESCE(product_name,'') AS productName,
                    COALESCE(client_id,'') AS clientId
             FROM `reviews_public` WHERE active=1 ORDER BY sort, created_at DESC", [], [], 'DB_PULL_REVIEWS');
    } catch (\Throwable $e) {
        kareta_log_error('DB_PULL_REVIEWS', $e->getMessage());
        $publicReviews = kareta_try_query_all($pdo,
            "SELECT id, author_name AS name, initials, date_label AS dateLabel, stars, text,
                    source_label AS sourceLabel, sort, created_at AS createdAt,
                    '' AS masterId, '' AS masterName, 'service' AS reviewType, '' AS orderId,
                    '' AS productId, '' AS productName, '' AS clientId
             FROM `reviews_public` WHERE active=1 ORDER BY sort, created_at DESC", [], [], 'DB_PULL_REVIEWS_FALLBACK');
    }
    foreach ($publicReviews as &$rv) { $rv['stars'] = (int)($rv['stars'] ?? 0); } unset($rv);

    $stoProfiles = kareta_try_query_all($pdo, "SELECT id, user_id AS userId, user_phone AS userPhone, name, contact_phone AS contactPhone, country_code AS countryCode, city, address, work_hours AS workHours, active, created_at AS createdAt, updated_at AS updatedAt FROM `sto_profiles` WHERE active=1 ORDER BY name", [], [], 'DB_PULL_STO_PROFILES');

    try { kareta_ensure_shop_parts_enrichment($pdo); } catch (Throwable $_) {}
    $shopsRaw = kareta_try_query_all($pdo, "SELECT * FROM `shops` WHERE active=1", [], [], 'DB_PULL_SHOPS');
    $partsRaw = kareta_try_query_all($pdo, "SELECT * FROM `shop_parts` ORDER BY created_at", [], [], 'DB_PULL_SHOP_PARTS');
    $salesRaw = kareta_table_exists($pdo, 'shop_sales') ? kareta_try_query_all($pdo, "SELECT * FROM `shop_sales` ORDER BY created_at DESC, id DESC", [], [], 'DB_PULL_SHOP_SALES') : [];
    if (!in_array($role, ['admin','owner'], true)) {
        $visibleOrderIds = array_fill_keys(array_map(static fn(array $order): string => (string)($order['id'] ?? ''), $orderRows), true);
        $visibleMasterId = isset($masterId) ? (string)$masterId : '';
        $salesRaw = array_values(array_filter($salesRaw, static function(array $sale) use ($role,$visibleOrderIds,$visibleMasterId): bool {
            if ($role === 'master') return $visibleMasterId !== '' && hash_equals($visibleMasterId, (string)($sale['master_id'] ?? ''));
            if (in_array($role, ['client','sto'], true)) return isset($visibleOrderIds[(string)($sale['order_id'] ?? '')]);
            return false;
        }));
    }
    $shops = [];
    foreach ($shopsRaw as $sh) {
        $sh['masterId']   = $sh['master_id'];
        $sh['masterName'] = $sh['master_name'];
        unset($sh['master_id'], $sh['master_name'], $sh['active']);
        $sh['parts'] = [];
        foreach ($partsRaw as $p) {
            if ($p['shop_id'] !== $sh['id']) continue;
            $p['stock']      = (bool)$p['stock'];
            $p['stockQty']   = (int)$p['stock_qty'];
            $p['masterId']   = $p['master_id'];
            $p['shopName']   = $sh['name'];
            $p['masterName'] = $sh['masterName'];
            $p['brand'] = (string)($p['brand'] ?? '');
            $p['manufacturer'] = (string)($p['brand'] ?? '');
            $p['manufacturerType'] = (string)($p['manufacturer_type'] ?? '');
            $p['oem'] = (string)($p['oem'] ?? '');
            $p['analogs'] = (string)($p['analogs_json'] ?? '');
            $p['crosses'] = (string)($p['crosses_json'] ?? '');
            $p['compatibility'] = (string)($p['compatibility'] ?? '');
            $p['description'] = (string)($p['description'] ?? '');
            $p['image'] = (string)($p['image'] ?? '');
            unset($p['stock_qty'],$p['shop_id'],$p['master_id'],$p['manufacturer_type'],$p['analogs_json'],$p['crosses_json']);
            $sh['parts'][] = $p;
        }
        $shops[] = $sh;
    }

    $chatWhere = '';
    $chatParams = [];
    if (!kareta_has_role('admin')) {
        if ($role === 'master') {
            $mst = null;
            if ($actorUserId > 0) {
                $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1");
                $stm->execute([$actorUserId]);
                $mst = $stm->fetchColumn();
            }
            if (!$mst) {
                $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
                $stm->execute([$phone, $phone]);
                $mst = $stm->fetchColumn();
            }
            $masterId = (string)($mst ?: '');
            $chatWhere = ' WHERE (c.master_user_id=? OR c.master_id=?)';
            $chatParams[] = $actorUserId ?: -1;
            $chatParams[] = $masterId;
        } elseif ($role === 'client') {
            $chatWhere = ' WHERE (c.client_user_id=? OR c.client_phone=?)';
            $chatParams[] = $actorUserId ?: -1;
            $chatParams[] = $phone;
        } elseif ($role === 'sto') {
            if ($currentStoId !== '') {
                $chatWhere = ' WHERE (c.sto_id=? OR EXISTS (SELECT 1 FROM `orders` o WHERE o.id=c.order_id AND o.sto_id=?))';
                $chatParams[] = $currentStoId;
                $chatParams[] = $currentStoId;
            } else {
                $chatWhere = ' WHERE 1=0';
            }
        } else {
            $chatWhere = ' WHERE 1=0';
        }
    }
    $chatsRaw = kareta_try_query_all($pdo, "SELECT * FROM `chats` c" . $chatWhere, $chatParams, [], 'DB_PULL_CHATS');
    if (in_array($role, ['admin','owner'], true)) {
        foreach ($chatsRaw as &$crow) {
            if (!kareta_admin_can_view_claimed_personal_data($crow, $actorUserId, $role)) $crow = kareta_mask_chat_for_dispatch($crow);
        }
        unset($crow);
    }
    $chats = array_map('_fmt_chat', $chatsRaw);
    // Обогащаем чаты данными из заявок (авто, последнее сообщение, статус)
    if (!empty($chats)) {
        $chatOrderIds = array_values(array_unique(array_filter(array_map(fn($c)=>(string)($c['orderId']??''), $chats))));
        $orderDataMap = [];
        if (!empty($chatOrderIds)) {
            $ph = implode(',', array_fill(0, count($chatOrderIds), '?'));
            foreach (kareta_try_query_all($pdo, "SELECT id, client_car, status, service_names, service_ids, notes, category FROM `orders` WHERE id IN ($ph)", $chatOrderIds, [], 'CHAT_ENRICH') as $ord) {
                $orderDataMap[(string)$ord['id']] = $ord;
            }
        }
        // Последнее сообщение
        $chatIds2 = array_values(array_filter(array_map(fn($c)=>$c['id']??null, $chats)));
        $lastMsgMap = [];
        if (!empty($chatIds2)) {
            $phm = implode(',', array_fill(0, count($chatIds2), '?'));
            foreach (kareta_try_query_all($pdo, "SELECT chat_id, text, type, time FROM `messages` WHERE chat_id IN ($phm) AND type NOT IN ('event','system') ORDER BY created_at DESC", $chatIds2, [], 'CHAT_LAST_MSG') as $msg) {
                if (!isset($lastMsgMap[$msg['chat_id']])) $lastMsgMap[$msg['chat_id']] = $msg;
            }
        }
        foreach ($chats as &$chatItem) {
            $oid = (string)($chatItem['orderId'] ?? '');
            if ($oid && isset($orderDataMap[$oid])) {
                $ord = $orderDataMap[$oid];
                $chatItem['car']         = (string)($ord['client_car'] ?? '');
                $chatItem['status']      = (string)($ord['status'] ?? 'new');
                $chatItem['category']    = (string)($ord['category'] ?? '');
                $chatItem['serviceIds']  = json_decode($ord['service_ids'] ?? '[]', true) ?: [];
                $chatItem['orderTitle']  = $chatItem['orderTitle'] ?: ((string)($ord['service_names'] ?? $ord['notes'] ?? ''));
            }
            $cid = $chatItem['id'] ?? '';
            if ($cid && isset($lastMsgMap[$cid])) {
                $lm = $lastMsgMap[$cid];
                $chatItem['lastMessage'] = (string)($lm['type']==='file' ? '📎 Файл' : ($lm['text'] ?? ''));
                $chatItem['lastTime']    = (string)($lm['time'] ?? '');
            }
        }
        unset($chatItem);
    }
    foreach ($chats as &$chatItem) {
        $chatItem['dispatchLocked'] = !kareta_admin_can_view_claimed_personal_data($chatItem, $actorUserId, $role);
    }
    unset($chatItem);
    $chatIds = array_values(array_filter(array_map(static fn($c) => $c['id'] ?? null, $chats)));

    $messages = [];
    if ($chatIds) {
        $msgSql = "SELECT * FROM `messages` WHERE chat_id IN (" . implode(',', array_fill(0, count($chatIds), '?')) . ") ORDER BY created_at";
        foreach (kareta_try_query_all($pdo, $msgSql, $chatIds, [], 'DB_PULL_MESSAGES') as $m) {
            $cid = $m['chat_id'];
            $row = ['id'=>$m['id'],'from'=>$m['from_role'],'type'=>$m['type'],'text'=>$m['text'],'time'=>$m['time']];
            if ($m['file_name']) { $row['fileName']=$m['file_name']; $row['fileType']=$m['file_type']; }
            if (!empty($m['file_url'])) $row['fileUrl']=kareta_message_public_file_url((string)$m['file_url'],(string)$m['id'],(string)$cid); elseif ($m['file_data']) $row['fileData']  = $m['file_data'];
            if ($m['meta'])   { foreach (kareta_message_public_meta($m['meta']) as $k=>$v) $row[$k]=$v; }
            $messages[$cid][] = $row;
        }
    }

    $users = [];
    if (kareta_has_role('admin')) {
        $users = kareta_try_query_all($pdo, "SELECT phone,name,role,initials,car,spec,email,active FROM `users`", [], [], 'DB_PULL_USERS');
        foreach ($users as &$u) $u['active']=(bool)$u['active']; unset($u);
    }

    $vehicles = [];
    if ($phone !== '') {
        $stVehicles = $pdo->prepare("SELECT * FROM `client_vehicles` WHERE active=1 AND (user_id=? OR user_phone=? OR client_id IN (SELECT id FROM `clients` WHERE user_phone=? OR phone=?)) ORDER BY is_default DESC, updated_at DESC, created_at DESC");
        $stVehicles->execute([$actorUserId ?: 0, $phone, $phone, $phone]);
        $vehicles = array_map('kareta_fmt_vehicle', $stVehicles->fetchAll());
    }

    $notifications = notifications_fetch_mine($pdo);

    $wallPosts = [];
    if (kareta_table_exists($pdo, 'master_wall_posts')) {
        if (kareta_has_role('admin') || kareta_has_role('owner')) {
            $wallPosts = kareta_try_query_all($pdo, "SELECT * FROM `master_wall_posts` WHERE active=1 ORDER BY created_at DESC", [], [], 'DB_PULL_MASTER_WALL');
        } elseif ($role === 'master') {
            $masterWallId = '';
            if ($actorUserId > 0) { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1"); $stm->execute([$actorUserId]); $masterWallId = (string)($stm->fetchColumn() ?: ''); }
            if ($masterWallId === '' && $phone !== '') { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1"); $stm->execute([$phone,$phone]); $masterWallId = (string)($stm->fetchColumn() ?: ''); }
            // Мастер видит все публичные посты + свои
            $wallPosts = kareta_try_query_all($pdo, "SELECT * FROM `master_wall_posts` WHERE active=1 ORDER BY created_at DESC LIMIT 200", [], [], 'DB_PULL_MASTER_WALL_ALL');
        } else {
            // Клиенты и гости — все публичные истории ремонтов (для страницы мастеров)
            $wallPosts = kareta_try_query_all($pdo, "SELECT * FROM `master_wall_posts` WHERE active=1 AND title IS NOT NULL AND title != '' ORDER BY created_at DESC LIMIT 100", [], [], 'DB_PULL_MASTER_WALL_PUBLIC');
        }
    }
    $wallPosts = array_map('kareta_fmt_master_wall_post', $wallPosts);

    // ── master_posts (публичные) ──────────────────────────────────────────────
    $masterPostsData = [];
    if (kareta_table_exists($pdo, 'master_posts')) {
        $masterPostsData = kareta_try_query_all($pdo,
            "SELECT id,master_id,type,title,preview,body,photos_json,tags,status,published_at,created_at FROM `master_posts` WHERE status='published' ORDER BY published_at DESC LIMIT 300",
            [], [], 'DB_PULL_MASTER_POSTS');
        foreach ($masterPostsData as &$mp) {
            $mp['photos'] = !empty($mp['photos_json']) ? json_decode($mp['photos_json'], true) : [];
            $mp['masterId'] = $mp['master_id'];
            $mp['createdAt'] = $mp['created_at'];
            $mp['publishedAt'] = $mp['published_at'];
            unset($mp['photos_json'],$mp['created_at'],$mp['published_at']);
        }
        unset($mp);
    }

    // ── master_reviews (публичные) ────────────────────────────────────────────
    $masterReviewsData = [];
    if (kareta_table_exists($pdo, 'master_reviews')) {
        $masterReviewsData = kareta_try_query_all($pdo,
            "SELECT id,master_id,order_id,author_name,rating,quality_rating,timing_rating,neatness_rating,communication_rating,text,master_reply,created_at FROM `master_reviews` WHERE status='published' ORDER BY created_at DESC LIMIT 500",
            [], [], 'DB_PULL_MASTER_REVIEWS');
        foreach ($masterReviewsData as &$mr) {
            $mr['masterId']   = $mr['master_id'];
            $mr['orderId']    = $mr['order_id'];
            $mr['authorName'] = $mr['author_name'];
            $mr['createdAt']  = $mr['created_at'];
            $mr['clientName'] = $mr['author_name'];
            unset($mr['master_id'],$mr['order_id'],$mr['author_name'],$mr['created_at']);
        }
        unset($mr);
    }


    $schedules = [];
    if (kareta_table_exists($pdo, 'master_schedules')) {
        if (kareta_has_role('admin')) {
            $schedules = kareta_try_query_all($pdo, "SELECT * FROM `master_schedules` ORDER BY work_date, start_time", [], [], 'DB_PULL_MASTER_SCHEDULES');
        } elseif ($role === 'master') {
            $masterIdForSchedule = '';
            if ($actorUserId > 0) { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1"); $stm->execute([$actorUserId]); $masterIdForSchedule = (string)($stm->fetchColumn() ?: ''); }
            if ($masterIdForSchedule === '' && $phone !== '') { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1"); $stm->execute([$phone,$phone]); $masterIdForSchedule = (string)($stm->fetchColumn() ?: ''); }
            if ($masterIdForSchedule !== '') { $schedules = kareta_try_query_all($pdo, "SELECT * FROM `master_schedules` WHERE master_id=? ORDER BY work_date, start_time", [$masterIdForSchedule], [], 'DB_PULL_MASTER_SCHEDULES_OWN'); }
        }
    }
    $schedules = array_map('kareta_fmt_master_schedule', $schedules);

    // ── Fix uq_user_phone collision: make user_phone nullable in clients/masters ──
    static $__phone_null_fixed = false;
    if (!$__phone_null_fixed) {
        $__phone_null_fixed = true;
        foreach ([
            "ALTER TABLE `clients` MODIFY COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL",
            "ALTER TABLE `masters` MODIFY COLUMN `user_phone` VARCHAR(20) NULL DEFAULT NULL",
            "UPDATE `clients` SET `user_phone`=NULL WHERE TRIM(COALESCE(`user_phone`,''))=''",
            "UPDATE `masters` SET `user_phone`=NULL WHERE TRIM(COALESCE(`user_phone`,''))=''",
        ] as $_sql) {
            try { $pdo->exec($_sql); } catch (Throwable $_e) { /* уже изменено или не нужно */ }
        }
    }
    // ── News articles ──────────────────────────────────────────────────────────
    $news = [];
    try {
        news_ensure_table($pdo); // создаём таблицу если не существует
        $news = kareta_try_query_all($pdo,
            "SELECT id,slug,title,intro,body,cover_url,category,tags,author_name,author_role,author_user_id,published_at,reading_time,views_count,is_featured,active,sort,created_at FROM `news_articles` WHERE active=1 ORDER BY sort ASC, published_at DESC LIMIT 100",
            [], [], 'DB_PULL_NEWS');
    } catch (Throwable $_ne) { $news = []; }
    // ────────────────────────────────────────────────────────────────────────────

    // ── App config (debug settings) ──────────────────────────────────────────
    $appConfig = app_config_read();
    $masterExchangeState = kareta_master_exchange_default_state();
    if ($role === 'master') {
        try {
            $ctx = kareta_master_exchange_context($pdo);
            $masterExchangeState = kareta_master_exchange_fetch_state($pdo, $ctx['masterId'], $ctx['actorUserId']);
        } catch (Throwable $_mxe) {
            kareta_log_error('DB_PULL_MASTER_EXCHANGE', $_mxe->getMessage());
        }
    }
    $clientExchangeState = client_exchange_default_state();
    if ($role === 'client') {
        try {
            $clientExchangeState = client_exchange_fetch_state($pdo);
        } catch (Throwable $_cxe) {
            kareta_log_error('DB_PULL_CLIENT_EXCHANGE', $_cxe->getMessage());
        }
    }

    $response=['ok'=>true,
        'appConfig' => $appConfig,
        'data'  => ['_nextNum'=>$nextNum,'orders'=>$orders,'clients'=>array_values($clients),
                    'masters'=>array_values($masters),'services'=>array_values($services),'serviceCategories'=>array_values($serviceCategories),'serviceOffers'=>array_values($serviceOffers),'partsCatalog'=>array_values($partsCatalog),
                    'siteContent'=>$siteContent,'publicReviews'=>array_values($publicReviews),
                    'shops'=>array_values($shops),'shopSales'=>array_values($salesRaw),'stoProfiles'=>array_values($stoProfiles),'chats'=>array_values($chats),'messages'=>$messages,'notifications'=>$notifications,'vehicles'=>array_values($vehicles),'masterSchedules'=>array_values($schedules),'masterWallPosts'=>array_values($wallPosts),'masterPosts'=>array_values($masterPostsData),'masterReviews'=>array_values($masterReviewsData),'masterExchangeState'=>$masterExchangeState,'clientExchangeState'=>$clientExchangeState,'orderEvents'=>array_values($orderEvents),'news'=>array_values($news)],
        'users' => array_values($users),
    ];
    if(kareta_diagnostics_authorized())$response['_debug']=['mastersSqlCount'=>count($masters),'mastersSqlErrorType'=>$mastersSqlError!==null?'query_failed':null];
    kareta_json($response);
}

function kareta_health_count(PDO $pdo, string $table, string $where = ''): int
{
    if (!kareta_table_exists($pdo, $table)) return 0;
    $sql = "SELECT COUNT(*) FROM `{$table}`" . ($where !== '' ? " WHERE {$where}" : '');
    try { return (int)$pdo->query($sql)->fetchColumn(); } catch (Throwable $_e) { return 0; }
}

function kareta_health_scalar(PDO $pdo, string $sql): int
{
    try { return (int)$pdo->query($sql)->fetchColumn(); } catch (Throwable $_e) { return 0; }
}

function db_health(?PDO $pdo): void
{
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $mig = kareta_table_exists($pdo, 'db_migrations')
        ? (int)($pdo->query("SELECT COALESCE(MAX(version),0) FROM `db_migrations`")->fetchColumn() ?: 0)
        : 0;
    $applied = kareta_table_exists($pdo, 'db_migrations')
        ? $pdo->query("SELECT version, note, applied_at AS appliedAt FROM `db_migrations` ORDER BY version DESC LIMIT 15")->fetchAll()
        : [];

    $expectedTables = ['users','clients','masters','orders','chats','messages','audit_log','system_logs','user_stats','site_content','reviews_public','master_exchange_responses','master_exchange_saved','master_exchange_hidden','sto_profiles','sto_master_links','sto_client_links','order_assignments','client_vehicles','parts_catalog','parts_request_offers','seller_profiles','seller_products','seller_orders','seller_order_items','service_categories','service_catalog','service_offers'];
    $tableStatus = [];
    foreach ($expectedTables as $t) $tableStatus[$t] = kareta_table_exists($pdo, $t);
    $missingTables = array_values(array_filter($expectedTables, static fn($t) => empty($tableStatus[$t])));

    $expectedColumns = [
        'orders' => ['id','num','type','category','source','status','client_user_id','client_vehicle_id','vehicle_title','vehicle_vin','vehicle_plate','client_name','client_phone','client_car','service_ids','service_names','notes','created_at'],
        'client_vehicles' => ['id','user_id','user_phone','title','brand','model','plate','vin','year','color','note','active','created_at'],
        'chats' => ['id','order_id','client_user_id','master_user_id','sto_id','unread_client','unread_master','unread_admin'],
        'messages' => ['id','chat_id','order_id','from_role','author_user_id','body','created_at'],
    ];
    $columnStatus = [];
    $missingColumns = [];
    foreach ($expectedColumns as $table => $columns) {
        $columnStatus[$table] = [];
        if (empty($tableStatus[$table])) {
            foreach ($columns as $column) {
                $columnStatus[$table][$column] = false;
                $missingColumns[] = $table . '.' . $column;
            }
            continue;
        }
        foreach ($columns as $column) {
            $exists = function_exists('kareta_column_exists') ? kareta_column_exists($pdo, $table, $column) : false;
            $columnStatus[$table][$column] = $exists;
            if (!$exists) $missingColumns[] = $table . '.' . $column;
        }
    }

    $orphanCounts = [
        'ordersWithoutClientUser' => $tableStatus['orders'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` WHERE client_id IS NOT NULL AND client_user_id IS NULL") : 0,
        'ordersWithoutMasterUser' => $tableStatus['orders'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` WHERE master_id IS NOT NULL AND master_id<>'' AND master_id<>'0' AND master_user_id IS NULL") : 0,
        'ordersBrokenClientRef' => ($tableStatus['orders'] && $tableStatus['clients']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o LEFT JOIN `clients` c ON c.id=o.client_id WHERE o.client_id IS NOT NULL AND o.client_id<>'' AND c.id IS NULL") : 0,
        'ordersBrokenMasterRef' => ($tableStatus['orders'] && $tableStatus['masters']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o LEFT JOIN `masters` m ON m.id=o.master_id WHERE o.master_id IS NOT NULL AND o.master_id<>'' AND o.master_id<>'0' AND m.id IS NULL") : 0,
        'chatsWithoutOrder' => ($tableStatus['chats'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `chats` c LEFT JOIN `orders` o ON o.id=c.order_id WHERE c.order_id IS NOT NULL AND c.order_id<>'' AND o.id IS NULL") : 0,
        'chatsBrokenClientRef' => ($tableStatus['chats'] && $tableStatus['clients']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `chats` c LEFT JOIN `clients` cl ON cl.id=c.client_id WHERE c.client_id IS NOT NULL AND c.client_id<>'' AND cl.id IS NULL") : 0,
        'chatsBrokenMasterRef' => ($tableStatus['chats'] && $tableStatus['masters']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `chats` c LEFT JOIN `masters` m ON m.id=c.master_id WHERE c.master_id IS NOT NULL AND c.master_id<>'' AND c.master_id<>'0' AND m.id IS NULL") : 0,
        'messagesWithoutAuthor' => $tableStatus['messages'] ? kareta_health_count($pdo, 'messages', 'author_user_id IS NULL') : 0,
        'auditWithoutActor' => $tableStatus['audit_log'] ? kareta_health_count($pdo, 'audit_log', 'actor_user_id IS NULL') : 0,
        'systemLogsWithoutActor' => $tableStatus['system_logs'] ? kareta_health_count($pdo, 'system_logs', 'actor_user_id IS NULL') : 0,
        'servicesInvalidStepsJson' => kareta_table_exists($pdo, 'services') ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `services` WHERE steps_json IS NOT NULL AND JSON_VALID(steps_json)=0") : 0,
        'servicesInvalidListJson' => kareta_table_exists($pdo, 'services') ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `services` WHERE list_json IS NOT NULL AND JSON_VALID(list_json)=0") : 0,
    ];

    $exchangeIssues = [
        'exchangeResponsesWithoutMaster' => ($tableStatus['master_exchange_responses'] && $tableStatus['masters']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `master_exchange_responses` r LEFT JOIN `masters` m ON m.id=r.master_id WHERE r.active=1 AND r.master_id<>'' AND m.id IS NULL") : 0,
        'exchangeResponsesWithoutRequestId' => $tableStatus['master_exchange_responses'] ? kareta_health_count($pdo, 'master_exchange_responses', "active=1 AND TRIM(request_id)=''") : 0,
        'exchangeAcceptedNotInProcess' => ($tableStatus['master_exchange_responses'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `master_exchange_responses` r LEFT JOIN `orders` o ON o.id=r.request_id WHERE r.active=1 AND r.response_status='accepted' AND (o.id IS NULL OR o.status NOT IN ('process','in_progress','accepted'))") : 0,
        'processOrdersWithoutAcceptedResponse' => ($tableStatus['master_exchange_responses'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o LEFT JOIN `master_exchange_responses` r ON r.request_id=o.id AND r.response_status='accepted' AND r.active=1 WHERE o.status='process' AND COALESCE(o.master_id,'')<>'' AND r.id IS NULL") : 0,
        'processOrdersWithoutChat' => ($tableStatus['orders'] && $tableStatus['chats']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o LEFT JOIN `chats` c ON c.order_id=o.id WHERE o.status='process' AND c.id IS NULL") : 0,
        'stoProcessOrdersWithoutMaster' => $tableStatus['orders'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` WHERE status='process' AND COALESCE(sto_id,'')<>'' AND (COALESCE(master_id,'')='' OR master_id='0')") : 0,
        'exchangeResponsesForDemoRequests' => $tableStatus['master_exchange_responses'] ? kareta_health_count($pdo, 'master_exchange_responses', "request_id LIKE 'mx_demo_%' OR request_id LIKE 'MXP-DEMO-%'") : 0,
        'stoLinksBrokenStoRef' => ($tableStatus['sto_master_links'] && $tableStatus['sto_profiles']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `sto_master_links` l LEFT JOIN `sto_profiles` s ON s.id=l.sto_id WHERE l.sto_id<>'' AND s.id IS NULL") : 0,
        'stoLinksBrokenMasterRef' => ($tableStatus['sto_master_links'] && $tableStatus['masters']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `sto_master_links` l LEFT JOIN `masters` m ON m.id=l.master_id WHERE l.master_id<>'' AND m.id IS NULL") : 0,
        'stoLinksActiveDuplicateMasters' => $tableStatus['sto_master_links'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM (SELECT master_id FROM `sto_master_links` WHERE status='active' GROUP BY master_id HAVING COUNT(*)>1) x") : 0,
        'vehiclesWithoutUser' => ($tableStatus['client_vehicles'] && $tableStatus['users']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `client_vehicles` v LEFT JOIN `users` u ON u.id=v.user_id WHERE v.user_id IS NOT NULL AND u.id IS NULL") : 0,
    ];

    $stoScopedIssues = [
        'stoOrdersWithoutChat' => ($tableStatus['orders'] && $tableStatus['chats']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o LEFT JOIN `chats` c ON c.order_id=o.id WHERE COALESCE(o.sto_id,'')<>'' AND c.id IS NULL") : 0,
        'stoChatsWithoutOrder' => ($tableStatus['chats'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `chats` c LEFT JOIN `orders` o ON o.id=c.order_id WHERE COALESCE(c.sto_id,'')<>'' AND c.order_id<>'' AND o.id IS NULL") : 0,
        'stoOrdersWithoutClientLink' => ($tableStatus['orders'] && $tableStatus['sto_client_links']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `orders` o WHERE COALESCE(o.sto_id,'')<>'' AND COALESCE(o.client_id,'')<>'' AND NOT EXISTS (SELECT 1 FROM `sto_client_links` l WHERE l.sto_id=o.sto_id AND l.client_id=o.client_id)") : 0,
        'stoAssignmentsWithoutOrder' => ($tableStatus['order_assignments'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `order_assignments` a LEFT JOIN `orders` o ON o.id=a.order_id WHERE a.status='active' AND o.id IS NULL") : 0,
        'stoAssignmentsWithoutStoId' => $tableStatus['order_assignments'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `order_assignments` WHERE status='active' AND COALESCE(sto_id,'')=''") : 0,
        'stoAssignmentsMasterMismatch' => ($tableStatus['order_assignments'] && $tableStatus['orders']) ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `order_assignments` a JOIN `orders` o ON o.id=a.order_id WHERE a.status='active' AND COALESCE(a.master_id,'')<>COALESCE(o.master_id,'')") : 0,
    ];

    $foreignKeys = [];
    try {
        $foreignKeys = $pdo->query("SELECT TABLE_NAME AS tableName, CONSTRAINT_NAME AS constraintName, REFERENCED_TABLE_NAME AS referencedTableName FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() ORDER BY TABLE_NAME, CONSTRAINT_NAME")->fetchAll();
    } catch (Throwable $_e) { $foreignKeys = []; }

        // ── Бизнес-проверки (ТЗ 9) ──
    try {
        $processWithoutChat = (int)$pdo->query("SELECT COUNT(*) FROM `orders` o LEFT JOIN `chats` c ON c.order_id=o.id WHERE o.status='process' AND c.id IS NULL")->fetchColumn();
        $processWithoutMaster = (int)$pdo->query("SELECT COUNT(*) FROM `orders` WHERE status='process' AND (master_id IS NULL OR master_id='0' OR master_id='')")->fetchColumn();
        $doneWithoutReview = (int)$pdo->query("SELECT COUNT(*) FROM `orders` o WHERE o.status='done' AND NOT EXISTS (SELECT 1 FROM `reviews_public` r WHERE r.order_id=o.id AND r.active=1)")->fetchColumn();
        $reviewsBeforeDone = (int)$pdo->query("SELECT COUNT(*) FROM `reviews_public` r JOIN `orders` o ON o.id=r.order_id WHERE r.active=1 AND o.status<>'done'")->fetchColumn();
        $cancelledWithActiveResponses = (int)$pdo->query("SELECT COUNT(*) FROM `orders` o JOIN `master_exchange_responses` r ON r.request_id=o.id AND r.active=1 AND r.response_status IN ('pending','viewed') WHERE o.status='cancelled'")->fetchColumn();
        $assignmentsWithoutStoId = 0; try { $assignmentsWithoutStoId = (int)$pdo->query("SELECT COUNT(*) FROM `order_assignments` WHERE status='active' AND (sto_id IS NULL OR sto_id='')")->fetchColumn(); } catch(\Throwable $__e) {}
        $chatMasterMismatch = 0; try { $chatMasterMismatch = (int)$pdo->query("SELECT COUNT(*) FROM `orders` o JOIN `chats` c ON c.order_id=o.id WHERE COALESCE(o.master_id,'')<>COALESCE(c.master_id,'') AND o.status IN ('process','done_pending_client')")->fetchColumn(); } catch(\Throwable $__e) {}
        $fieldOrdersWithoutGeo = 0; try { $fieldOrdersWithoutGeo = (int)$pdo->query("SELECT COUNT(*) FROM `orders` WHERE field_service=1 AND (lat IS NULL OR lng IS NULL)")->fetchColumn(); } catch(\Throwable $__e) {}
        $disputeWithoutRecord = 0;
        try { $disputeWithoutRecord = (int)$pdo->query("SELECT COUNT(*) FROM `orders` o WHERE o.status='dispute' AND NOT EXISTS (SELECT 1 FROM `order_disputes` d WHERE d.order_id=o.id)")->fetchColumn(); } catch(\Throwable $__e) {}
        $donePendingOld = (int)$pdo->query("SELECT COUNT(*) FROM `orders` WHERE status='done_pending_client' AND dispute_at IS NULL AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)")->fetchColumn();
    } catch (\Throwable $__bhe) {
        $processWithoutChat=$processWithoutMaster=$doneWithoutReview=$reviewsBeforeDone=$cancelledWithActiveResponses=$assignmentsWithoutStoId=$chatMasterMismatch=$fieldOrdersWithoutGeo=$disputeWithoutRecord=$donePendingOld=0;
    }

    kareta_json(['ok'=>true,'schemaVersion'=>$mig,'tables'=>$tableStatus,'missingTables'=>$missingTables,'missingColumns'=>$missingColumns,'columns'=>$columnStatus,'counts'=>[
        'users'=>kareta_health_count($pdo,'users'),
        'clients'=>kareta_health_count($pdo,'clients'),
        'masters'=>kareta_health_count($pdo,'masters'),
        'orders'=>kareta_health_count($pdo,'orders'),
        'chats'=>kareta_health_count($pdo,'chats'),
        'messages'=>kareta_health_count($pdo,'messages'),
        'audit'=>kareta_health_count($pdo,'audit_log'),
        'systemLogs'=>kareta_health_count($pdo,'system_logs'),
        'userStats'=>kareta_health_count($pdo,'user_stats'),
        'siteContent'=>kareta_health_count($pdo,'site_content'),
        'publicReviews'=>kareta_health_count($pdo,'reviews_public'),
        'masterExchangeResponses'=>kareta_health_count($pdo,'master_exchange_responses'),
        'masterExchangeSaved'=>kareta_health_count($pdo,'master_exchange_saved'),
        'masterExchangeHidden'=>kareta_health_count($pdo,'master_exchange_hidden'),
        'stoProfiles'=>kareta_health_count($pdo,'sto_profiles'),
        'stoMasterLinks'=>kareta_health_count($pdo,'sto_master_links'),
        'stoClientLinks'=>kareta_health_count($pdo,'sto_client_links'),
        'clientVehicles'=>kareta_health_count($pdo,'client_vehicles'),
        'partsCatalog'=>kareta_health_count($pdo,'parts_catalog'),
        'services'=>kareta_health_count($pdo,'services'),
        'serviceCategories'=>kareta_health_count($pdo,'service_categories'),
        'serviceCatalog'=>kareta_health_count($pdo,'service_catalog'),
        'serviceOffers'=>kareta_health_count($pdo,'service_offers'),
        'sellerProfiles'=>kareta_health_count($pdo,'seller_profiles'),
        'sellerProducts'=>kareta_health_count($pdo,'seller_products'),
        'sellerOrders'=>kareta_health_count($pdo,'seller_orders'),
        'partsRequestOffers'=>kareta_health_count($pdo,'parts_request_offers'),
        'orderAssignments'=>kareta_health_count($pdo,'order_assignments'),
        'foreignKeys'=>count($foreignKeys),
    ], 'orphans'=>array_merge($orphanCounts, [
        'siteContentInvalidJson'=>$tableStatus['site_content'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `site_content` WHERE body_json IS NOT NULL AND JSON_VALID(body_json)=0") : 0,
        'siteContentMissingCore'=>$tableStatus['site_content'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM (SELECT 'services_faq' AS k UNION ALL SELECT 'faq_page' UNION ALL SELECT 'privacy_page' UNION ALL SELECT 'terms_page' UNION ALL SELECT 'about_intro' UNION ALL SELECT 'about_facts' UNION ALL SELECT 'about_values' UNION ALL SELECT 'contacts_page' UNION ALL SELECT 'about_team' UNION ALL SELECT 'footer_page' UNION ALL SELECT 'page_meta') req LEFT JOIN `site_content` sc ON sc.content_key=req.k WHERE sc.content_key IS NULL") : 11,
        'reviewsWithoutText'=>$tableStatus['reviews_public'] ? kareta_health_scalar($pdo, "SELECT COUNT(*) FROM `reviews_public` WHERE active=1 AND TRIM(text)=''") : 0,
    ], $exchangeIssues, $stoScopedIssues), 'stoScopedIssues'=>$stoScopedIssues, 'foreignKeys'=>$foreignKeys, 'migrations'=>$applied,
        'liveSmoke'=>['assetVersion'=>(defined('KARETA_ASSET_VERSION') ? KARETA_ASSET_VERSION : ''), 'serverTime'=>date('c'), 'pullRecoveryStoAware'=>true],
        'businessHealth'=>[
            'processWithoutChat'=>$processWithoutChat,
            'processWithoutMaster'=>$processWithoutMaster,
            'processWithoutAcceptedResponse'=>$processWithoutAcceptedResp ?? 0,
            'donePendingWithoutFinalStage'=>$donePendingWithoutFinalStage ?? 0,
            'doneWithoutReview'=>$doneWithoutReview,
            'reviewsBeforeDone'=>$reviewsBeforeDone,
            'cancelledWithActiveResponses'=>$cancelledWithActiveResponses,
            'assignmentsWithoutStoId'=>$assignmentsWithoutStoId,
            'chatMasterMismatch'=>$chatMasterMismatch,
            'fieldOrdersWithoutGeo'=>$fieldOrdersWithoutGeo,
            'disputeWithoutRecord'=>$disputeWithoutRecord,
            'donePendingClientOldDays'=>$donePendingOld,
        ],
    ]);
}

/* ── Форматирование строк ─────────────────────────────────────────── */
function _fmt_order(array $o): array {
    $o['serviceIds']   = json_decode($o['service_ids'] ?? '[]', true) ?: [];
    $o['serviceNames'] = $o['service_names'];
    $o['stages']       = json_decode($o['stages']  ?? '[]', true) ?: [];
    $o['reports']      = json_decode($o['reports'] ?? '[]', true) ?: [];
    $o['finalPrice']   = !empty($o['final_price']) ? (float)$o['final_price'] : null;
    $o['laborPrice']   = !empty($o['labor_price']) ? (float)$o['labor_price'] : null;
    $o['partsPrice']   = !empty($o['parts_price']) ? (float)$o['parts_price'] : null;
    $o['paymentStatus']= (string)($o['payment_status'] ?? 'not_required');
    $o['responsesCount'] = (int)($o['responses_count'] ?? 0);
    $o['orderParts']   = json_decode($o['order_parts'] ?? 'null', true) ?: [];
    $o['partsRequest'] = json_decode($o['parts_request_json'] ?? 'null', true) ?: null;
    $o['partsRequestStatus'] = (string)($o['parts_request_status'] ?? '');
    $o['partsOffer'] = json_decode($o['parts_offer_json'] ?? 'null', true) ?: null;
    $o['partsOfferStatus'] = (string)($o['parts_offer_status'] ?? '');
    $o['partsOfferTotal'] = (int)($o['parts_offer_total'] ?? 0);
    $o['partsOfferNote'] = (string)($o['parts_offer_note'] ?? '');
    $o['partsVin'] = (string)($o['parts_vin'] ?? '');
    $o['partsOem'] = (string)($o['parts_oem'] ?? '');
    $o['partsRequestedName'] = (string)($o['parts_requested_name'] ?? '');
    $o['partsMakerPreference'] = (string)($o['parts_maker_preference'] ?? '');
    $o['partsQty'] = (int)($o['parts_qty'] ?? 1);
    $o['partsUrgency'] = (string)($o['parts_urgency'] ?? '');
    $o['clientId']     = $o['client_id'];   $o['clientName']  = $o['client_name'];
    $o['clientPhone']  = $o['client_phone'];$o['clientCar']   = $o['client_car'];
    $o['clientVehicleId'] = $o['client_vehicle_id'] ?? null; $o['vehicleTitle'] = $o['vehicle_title'] ?? ($o['client_car'] ?? '');
    $o['vehicleVin'] = (string)($o['vehicle_vin'] ?? ''); $o['vehiclePlate'] = (string)($o['vehicle_plate'] ?? '');
    $o['category'] = (string)($o['category'] ?? ''); $o['source'] = (string)($o['source'] ?? '');
    $o['masterId']     = (($o['master_id'] ?? null) === null || (string)($o['master_id'] ?? '') === '') ? '0' : (string)$o['master_id'];   $o['masterName']  = $o['master_name'];
    $o['masterUserId'] = isset($o['master_user_id']) ? ((int)$o['master_user_id'] ?: null) : null;
    $o['stoId']        = $o['sto_id'] ?? ''; $o['stoName'] = $o['sto_name'] ?? '';
    $o['dateLabel']    = trim((string)($o['date_label'] ?? ($o['date'] ?? '')));
    $o['chatId']       = trim((string)($o['chat_id'] ?? ''));
    $o['geo']          = ['address'=>(string)($o['address'] ?? ''),'district'=>(string)($o['district'] ?? ''),'lat'=>isset($o['lat']) ? ($o['lat'] === null ? null : (float)$o['lat']) : null,'lng'=>isset($o['lng']) ? ($o['lng'] === null ? null : (float)$o['lng']) : null,'distanceKm'=>isset($o['distance_km']) ? ($o['distance_km'] === null ? null : (float)$o['distance_km']) : null,'routeUrl'=>(string)($o['route_url'] ?? ''),'mapProvider'=>(string)($o['map_provider'] ?? '')];
    $o['fieldService'] = !empty($o['field_service']);
    $o['assignedAdminUserId'] = isset($o['assigned_admin_user_id']) ? ((int)$o['assigned_admin_user_id'] ?: null) : null;
    $o['carHandoverPending']   = isset($o['car_handover_pending'])   ? (bool)$o['car_handover_pending']   : false;
    $o['carHandoverConfirmed'] = isset($o['car_handover_confirmed'])
        ? ($o['car_handover_confirmed'] === null ? null : (bool)$o['car_handover_confirmed'])
        : null;
    $o['createdAt']    = $o['created_at'];  $o['completedAt'] = $o['completed_at'];
    foreach (['service_ids','service_names','client_id','client_name','client_phone',
              'client_car','client_vehicle_id','vehicle_title','vehicle_vin','vehicle_plate','master_id','master_user_id','master_name','sto_id','sto_name','created_at','completed_at','assigned_admin_user_id','date_label','chat_id',
              'car_handover_pending','car_handover_confirmed','order_parts','parts_request_json','parts_request_status','parts_offer_json','parts_offer_status','parts_offer_total','parts_offer_note','parts_vin','parts_oem','parts_requested_name','parts_maker_preference','parts_qty','parts_urgency','address','district','lat','lng','distance_km','route_url','map_provider','field_service'] as $k) unset($o[$k]);
    return $o;
}

function _fmt_chat(array $c): array {
    $c['orderId']     = $c['order_id'];   $c['clientId']   = $c['client_id'];
    $c['clientName']  = $c['client_name'];$c['clientPhone']= $c['client_phone'];
    $c['clientUserId']= isset($c['client_user_id']) ? ((int)$c['client_user_id'] ?: 0) : 0;
    $c['clientInit']  = $c['client_init'];$c['masterId']   = (($c['master_id'] ?? null) === null || (string)($c['master_id'] ?? '') === '') ? '0' : (string)$c['master_id'];
    $c['masterUserId']= isset($c['master_user_id']) ? ((int)$c['master_user_id'] ?: 0) : 0;
    $c['masterName']  = $c['master_name'];$c['masterInit'] = $c['master_init'];
    $c['stoId']       = $c['sto_id'] ?? ''; $c['stoUserId'] = isset($c['sto_user_id']) ? ((int)$c['sto_user_id'] ?: null) : null;
    $c['assignedAdminUserId'] = isset($c['assigned_admin_user_id']) ? ((int)$c['assigned_admin_user_id'] ?: null) : null;
    $c['orderTitle']  = $c['order_title'];
    $c['lastMessage'] = $c['last_message'] ?? '';
    $c['lastTime']    = $c['last_time']    ?? $c['updated_at'] ?? '';
    $c['car']         = $c['client_car']   ?? $c['car'] ?? '';
    $c['status']      = $c['order_status'] ?? $c['status'] ?? 'new';
    $c['chatType']    = $c['chat_type'] ?? 'order';
    $c['title']       = $c['title'] ?? '';
    $c['peerUserId']  = isset($c['peer_user_id']) ? (int)$c['peer_user_id'] : 0;
    $c['peerName']    = $c['peer_name'] ?? '';
    $c['peerRole']    = $c['peer_role'] ?? '';
    $c['peerInitials']= $c['peer_initials'] ?? '';
    $c['unread'] = ['client'=>(int)$c['unread_client'],'master'=>(int)$c['unread_master'],'admin'=>(int)$c['unread_admin'],'sto'=>(int)($c['unread_sto'] ?? 0),'seller'=>(int)($c['unread_seller'] ?? 0)];
    if (isset($c['participant_unread'])) $c['participantUnread']=(int)$c['participant_unread'];
    foreach (['order_id','client_id','client_name','client_phone','client_user_id','client_init',
              'master_id','master_user_id','master_name','master_init','order_title',
              'sto_id','sto_user_id','unread_client','unread_master','unread_admin','unread_sto','unread_seller',
              'assigned_admin_user_id','last_message','last_time','client_car','order_status','chat_type','peer_user_id','peer_name','peer_role','peer_initials','participant_unread'] as $k) unset($c[$k]);
    return $c;
}

function kareta_admin_can_view_claimed_personal_data(array $row, int $actorUserId, string $role): bool {
    if ($role === 'owner') return true;
    if (!in_array($role, ['admin','owner'], true)) return true;
    $masterId = (string)($row['master_id'] ?? $row['masterId'] ?? '');
    if ($masterId !== '' && $masterId !== '0') return true;
    $assigned = (int)($row['assigned_admin_user_id'] ?? $row['assignedAdminUserId'] ?? 0);
    return $assigned > 0 && $actorUserId > 0 && $assigned === $actorUserId;
}

function kareta_mask_order_for_dispatch(array $row): array {
    $row['client_name'] = 'Клиент скрыт';
    $row['client_phone'] = '';
    $row['client_car'] = 'Данные скрыты до взятия в обработку';
    $row['vehicle_title'] = $row['client_car'];
    $row['dispatch_locked'] = 1;
    return $row;
}

function kareta_mask_chat_for_dispatch(array $row): array {
    $row['client_name'] = 'Клиент скрыт';
    $row['client_phone'] = '';
    $row['client_init'] = 'К';
    $row['dispatch_locked'] = 1;
    return $row;
}

function _no_db(): void { kareta_json(['ok'=>false,'error'=>'db_unavailable'],503); }
function _actor_role(): string { $u = kareta_current_user(); return kareta_normalize_role((string)($u['role'] ?? 'guest')); }
function _actor_phone(): string { return kareta_normalize_phone((string)(($_SESSION['kareta_user']['phone'] ?? ''))); }

function kareta_master_exchange_context(PDO $pdo): array {
    $actorUserId = (int)(kareta_session_user()['id'] ?? 0);
    $phone = _actor_phone();
    $masterId = '';

    // The selected Identity profile is authoritative. A single account may own
    // several master contexts, so user_id/phone alone must not pick the first row.
    if (function_exists('kareta_master_workplace_profile')) {
        $profile = kareta_master_workplace_profile($pdo);
        $masterId = trim((string)($profile['id'] ?? ''));
        if ($actorUserId <= 0) $actorUserId = (int)($profile['user_id'] ?? 0);
        if ($phone === '') $phone = kareta_normalize_phone((string)($profile['user_phone'] ?? $profile['phone'] ?? ''));
    }

    if ($masterId === '' && $actorUserId > 0) {
        $st = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1");
        $st->execute([$actorUserId]);
        $masterId = (string)($st->fetchColumn() ?: '');
    }
    if ($masterId === '' && $phone !== '') {
        $st = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
        $st->execute([$phone, $phone]);
        $masterId = (string)($st->fetchColumn() ?: '');
    }
    if ($masterId === '' && ($actorUserId > 0 || $phone !== '')) {
        kareta_safe_sync_user_entity($pdo, $phone);
        if ($actorUserId > 0) {
            $st = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1");
            $st->execute([$actorUserId]);
            $masterId = (string)($st->fetchColumn() ?: '');
        }
        if ($masterId === '' && $phone !== '') {
            $st = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
            $st->execute([$phone, $phone]);
            $masterId = (string)($st->fetchColumn() ?: '');
        }
    }
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
    return ['masterId'=>$masterId, 'actorUserId'=>$actorUserId ?: null, 'phone'=>$phone];
}

function kareta_master_exchange_default_state(): array {
    return ['saved'=>[], 'hidden'=>[], 'responses'=>[], 'complaints'=>[]];
}

function kareta_master_exchange_fetch_state(PDO $pdo, string $masterId, ?int $actorUserId = null): array {
    $state = kareta_master_exchange_default_state();
    if (!kareta_table_exists($pdo, 'master_exchange_saved') || !kareta_table_exists($pdo, 'master_exchange_hidden') || !kareta_table_exists($pdo, 'master_exchange_responses')) {
        return $state;
    }
    $params = [$masterId];
    $userFilter = '';
    if (($actorUserId ?? 0) > 0 && kareta_column_exists($pdo, 'master_exchange_saved', 'master_user_id')) {
        $userFilter = " OR (COALESCE(master_id,'')='' AND master_user_id=?)";
        $params[] = $actorUserId;
    }
    $state['saved'] = array_values(array_filter(array_map('strval', array_map(static fn($r) => $r['request_id'] ?? '', kareta_try_query_all($pdo, "SELECT request_id FROM `master_exchange_saved` WHERE active=1 AND (master_id=?{$userFilter}) ORDER BY updated_at DESC", $params, [], 'MASTER_EXCHANGE_SAVED')))));

    $params = [$masterId];
    $userFilter = '';
    if (($actorUserId ?? 0) > 0 && kareta_column_exists($pdo, 'master_exchange_hidden', 'master_user_id')) {
        $userFilter = " OR (COALESCE(master_id,'')='' AND master_user_id=?)";
        $params[] = $actorUserId;
    }
    $state['hidden'] = array_values(array_filter(array_map('strval', array_map(static fn($r) => $r['request_id'] ?? '', kareta_try_query_all($pdo, "SELECT request_id FROM `master_exchange_hidden` WHERE active=1 AND (master_id=?{$userFilter}) ORDER BY updated_at DESC", $params, [], 'MASTER_EXCHANGE_HIDDEN')))));

    $params = [$masterId];
    $userFilter = '';
    if (($actorUserId ?? 0) > 0 && kareta_column_exists($pdo, 'master_exchange_responses', 'master_user_id')) {
        $userFilter = " OR (COALESCE(master_id,'')='' AND master_user_id=?)";
        $params[] = $actorUserId;
    }
    $rows = kareta_try_query_all($pdo, "SELECT * FROM `master_exchange_responses` WHERE active=1 AND (master_id=?{$userFilter}) ORDER BY updated_at DESC", $params, [], 'MASTER_EXCHANGE_RESPONSES');
    $state['responses'] = array_map(static function(array $r): array {
        return [
            'id' => (string)($r['id'] ?? ''),
            'request_id' => (string)($r['request_id'] ?? ''),
            'request_title' => (string)($r['request_title'] ?? ''),
            'master_id' => (string)($r['master_id'] ?? ''),
            'master_user_id' => (int)($r['master_user_id'] ?? 0),
            'priceType' => (string)($r['price_type'] ?? 'fixed'),
            'price_from' => (int)($r['price_from'] ?? 0),
            'price_to' => (int)($r['price_to'] ?? 0),
            'start_time' => (string)($r['start_time'] ?? ''),
            'work_format' => (string)($r['work_format'] ?? ''),
            'includes' => (string)($r['includes_text'] ?? ''),
            'extra_costs' => (string)($r['extra_costs'] ?? ''),
            'need_diagnostics' => (string)($r['need_diagnostics'] ?? 'no'),
            'duration_text' => (string)($r['duration_text'] ?? ''),
            'warranty_text' => (string)($r['warranty_text'] ?? ''),
            'arrival_time' => (string)($r['arrival_time'] ?? ''),
            'field_service_price' => (int)($r['field_service_price'] ?? 0),
            'need_tow' => (string)($r['need_tow'] ?? 'no'),
            'can_fix_on_site' => (string)($r['can_fix_on_site'] ?? 'yes'),
            'comment' => (string)($r['comment'] ?? ''),
            'response_status' => (string)($r['response_status'] ?? 'pending'),
            'accepted_at' => (string)($r['accepted_at'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    return $state;
}


function master_exchange_feed(?PDO $pdo): void {
    if (!$pdo) _no_db();
    $ctx = kareta_master_exchange_context($pdo);
    $q = trim((string)($_GET['q'] ?? ''));
    $city = trim((string)($_GET['city'] ?? ''));
    $category = trim((string)($_GET['category'] ?? ''));
    $urgent = (int)($_GET['urgent'] ?? 0) === 1;
    $sort = trim((string)($_GET['sort'] ?? 'new'));
    $limit = max(1,min(100,(int)($_GET['limit'] ?? 60)));
    $where = ["COALESCE(o.master_id,'0')='0'", "o.status IN ('new','waiting_responses')", "o.type IN ('service_order','request','service')", "COALESCE(o.exchange_status,'open')='open'", "(o.exchange_deadline_at IS NULL OR o.exchange_deadline_at>NOW())"];
    $params = [];
    if ($q !== '') { $where[] = "(o.service_names LIKE ? OR o.client_car LIKE ? OR o.notes LIKE ? OR o.vehicle_title LIKE ?)"; $like='%'.$q.'%'; array_push($params,$like,$like,$like,$like); }
    if ($city !== '' && kareta_column_exists($pdo,'orders','city')) { $where[]='o.city=?'; $params[]=$city; }
    if ($category !== '') { $where[]='o.category=?'; $params[]=$category; }
    if ($urgent) { $where[]="o.priority IN ('urgent','high')"; }
    $orderBy = $sort==='price_desc' ? 'o.price DESC,o.created_at DESC' : ($sort==='price_asc' ? 'o.price ASC,o.created_at DESC' : ($sort==='responses' ? 'responses_count ASC,o.created_at DESC' : 'o.created_at DESC'));
    $sql = "SELECT o.*, (SELECT COUNT(*) FROM master_exchange_responses r WHERE r.request_id=o.id AND r.active=1 AND r.response_status NOT IN ('declined','cancelled','withdrawn')) responses_count FROM orders o WHERE ".implode(' AND ',$where)." ORDER BY {$orderBy} LIMIT {$limit}";
    $rows = kareta_try_query_all($pdo,$sql,$params,[],'MASTER_EXCHANGE_FEED');
    $offerIds = [];
    if (kareta_table_exists($pdo,'service_offers')) {
        $offerRows = kareta_try_query_all($pdo, "SELECT service_id FROM service_offers WHERE owner_type='master' AND owner_entity_id=? AND active=1 AND booking_enabled=1 AND availability_status<>'paused'", [$ctx['masterId']], [], 'MASTER_EXCHANGE_OFFER_IDS');
        $offerIds = array_values(array_filter(array_map(static fn($r)=>(string)($r['service_id']??''),$offerRows)));
    }
    if ($offerIds) {
        $rows = array_values(array_filter($rows, static function(array $row) use ($offerIds): bool {
            $ids = json_decode((string)($row['service_ids']??'[]'), true);
            if (is_array($ids) && array_intersect($offerIds,array_map('strval',$ids))) return true;
            return trim((string)($row['service_ids']??'')) === '';
        }));
    }
    $state = kareta_master_exchange_fetch_state($pdo,$ctx['masterId'],$ctx['actorUserId']);
    $saved=array_flip(array_map('strval',$state['saved']??[])); $hidden=array_flip(array_map('strval',$state['hidden']??[]));
    $responseMap=[]; foreach(($state['responses']??[]) as $r){$responseMap[(string)($r['request_id']??'')]=$r;}
    $items=[];
    foreach($rows as $row){
        $id=(string)($row['id']??''); if(isset($hidden[$id])) continue;
        $item=_fmt_order($row);
        $item['saved']=isset($saved[$id]);
        $item['myResponse']=$responseMap[$id]??null;
        $item['responsesCount']=(int)($row['responses_count']??0);
        $item['clientName']='Клиент'; $item['clientPhone']='';
        $item['matchReason']='Подходит по вашей специализации';
        $items[]=$item;
    }
    $responses=array_values($state['responses']??[]);
    $won=count(array_filter($responses,fn($r)=>in_array((string)($r['response_status']??''),['accepted','won'],true)));
    $pending=count(array_filter($responses,fn($r)=>in_array((string)($r['response_status']??''),['pending','viewed'],true)));
    kareta_json(['ok'=>true,'data'=>['items'=>$items,'kpi'=>['available'=>count($items),'responses'=>count($responses),'pending'=>$pending,'won'=>$won,'winRate'=>count($responses)?round($won*100/count($responses)):0],'state'=>$state]]);
}

function master_exchange_get_mine(?PDO $pdo): void {
    if (!$pdo) _no_db();
    $ctx = kareta_master_exchange_context($pdo);
    kareta_json(['ok'=>true, 'state'=>kareta_master_exchange_fetch_state($pdo, $ctx['masterId'], $ctx['actorUserId'])]);
}

function master_exchange_save_response(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $ctx = kareta_master_exchange_context($pdo);
    kareta_ensure_schema_columns($pdo);
    $row = is_array($b['response'] ?? null) ? $b['response'] : $b;
    $requestId = trim((string)($row['request_id'] ?? $row['requestId'] ?? ''));
    if ($requestId === '') kareta_json(['ok'=>false,'error'=>'request_id_required'],422);
    $payload = [
        'request_title'=>kareta_clean_text($row['request_title'] ?? $row['requestTitle'] ?? '',191),
        'price_type'=>kareta_clean_text($row['priceType'] ?? $row['price_type'] ?? 'fixed',16) ?: 'fixed',
        'price_from'=>max(0,(int)($row['price_from'] ?? $row['priceFrom'] ?? 0)),
        'price_to'=>max(0,(int)($row['price_to'] ?? $row['priceTo'] ?? $row['price_from'] ?? $row['priceFrom'] ?? 0)),
        'start_time'=>kareta_clean_text($row['start_time'] ?? $row['startTime'] ?? '',64),
        'work_format'=>kareta_clean_text($row['work_format'] ?? 'service',120) ?: 'service',
        'includes_text'=>kareta_clean_text($row['includes'] ?? $row['includes_text'] ?? '',4000),
        'extra_costs'=>kareta_clean_text($row['extra_costs'] ?? '',4000),
        'need_diagnostics'=>kareta_clean_text($row['need_diagnostics'] ?? 'no',8) ?: 'no',
        'duration_text'=>kareta_clean_text($row['duration_text'] ?? $row['durationText'] ?? '',120),
        'warranty_text'=>kareta_clean_text($row['warranty_text'] ?? '',120),
        'arrival_time'=>kareta_clean_text($row['arrival_time'] ?? '',64),
        'field_service_price'=>max(0,(int)($row['field_service_price'] ?? 0)),
        'need_tow'=>kareta_clean_text($row['need_tow'] ?? 'no',8) ?: 'no',
        'can_fix_on_site'=>kareta_clean_text($row['can_fix_on_site'] ?? 'yes',8) ?: 'yes',
        'comment'=>kareta_clean_text($row['comment'] ?? '',4000),
    ];
    if($payload['price_from']<=0)kareta_json(['ok'=>false,'error'=>'price_required','message'=>'Укажите стоимость работ'],422);
    if($payload['start_time']==='')kareta_json(['ok'=>false,'error'=>'start_time_required','message'=>'Укажите время начала'],422);
    $payloadHash=hash('sha256',json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    $id = trim((string)($row['id'] ?? '')) ?: ('mxr_' . substr(md5($ctx['masterId'] . ':' . $requestId), 0, 16));
    $eventType='response_sent';
    try{
        $pdo->beginTransaction();
        $stRequest=$pdo->prepare("SELECT status,COALESCE(exchange_status,'open') exchange_status,exchange_deadline_at,COALESCE(exchange_max_responses,20) exchange_max_responses FROM orders WHERE id=? LIMIT 1 FOR UPDATE");
        $stRequest->execute([$requestId]);$exchangeOrder=$stRequest->fetch(PDO::FETCH_ASSOC);
        if(!$exchangeOrder || !in_array((string)$exchangeOrder['status'],['new','waiting_responses'],true) || (string)$exchangeOrder['exchange_status']!=='open'){ $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'exchange_closed'],409); }
        if(!empty($exchangeOrder['exchange_deadline_at']) && strtotime((string)$exchangeOrder['exchange_deadline_at'])<=time()){ $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'exchange_deadline_passed'],409); }
        $stExisting=$pdo->prepare("SELECT id,response_status,payload_hash FROM `master_exchange_responses` WHERE request_id=? AND master_id=? AND active=1 LIMIT 1 FOR UPDATE");
        $stExisting->execute([$requestId,$ctx['masterId']]);$existing=$stExisting->fetch(PDO::FETCH_ASSOC)?:[];
        $existingStatus=(string)($existing['response_status']??'');
        if($existingStatus==='accepted'){ $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'response_already_accepted','message'=>'Принятый клиентом отклик изменить нельзя'],409); }
        if($existing && hash_equals((string)($existing['payload_hash']??''),$payloadHash) && in_array($existingStatus,['pending','viewed'],true)){
            $pdo->commit();
            kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'duplicate_response','state'=>kareta_master_exchange_fetch_state($pdo,$ctx['masterId'],$ctx['actorUserId'])]);
        }
        $stCapacity=$pdo->prepare("SELECT COUNT(*) FROM master_exchange_responses WHERE request_id=? AND active=1 AND response_status NOT IN ('declined','cancelled','withdrawn')");$stCapacity->execute([$requestId]);$responseCount=(int)$stCapacity->fetchColumn();
        if($responseCount>=max(1,(int)$exchangeOrder['exchange_max_responses'])&&!$existing){ $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'exchange_response_limit_reached'],409); }
        $eventType=$existingStatus===''?'response_sent':(in_array($existingStatus,['cancelled','declined','rejected','expired'],true)?'response_resent':'response_updated');
        $sql="INSERT INTO `master_exchange_responses` (`id`,`request_id`,`master_id`,`master_user_id`,`request_title`,`price_type`,`price_from`,`price_to`,`start_time`,`work_format`,`includes_text`,`extra_costs`,`need_diagnostics`,`duration_text`,`warranty_text`,`arrival_time`,`field_service_price`,`need_tow`,`can_fix_on_site`,`comment`,`response_status`,`payload_hash`,`active`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ,?,1) ON DUPLICATE KEY UPDATE `request_title`=VALUES(`request_title`),`master_user_id`=VALUES(`master_user_id`),`price_type`=VALUES(`price_type`),`price_from`=VALUES(`price_from`),`price_to`=VALUES(`price_to`),`start_time`=VALUES(`start_time`),`work_format`=VALUES(`work_format`),`includes_text`=VALUES(`includes_text`),`extra_costs`=VALUES(`extra_costs`),`need_diagnostics`=VALUES(`need_diagnostics`),`duration_text`=VALUES(`duration_text`),`warranty_text`=VALUES(`warranty_text`),`arrival_time`=VALUES(`arrival_time`),`field_service_price`=VALUES(`field_service_price`),`need_tow`=VALUES(`need_tow`),`can_fix_on_site`=VALUES(`can_fix_on_site`),`comment`=VALUES(`comment`),`response_status`='pending',`payload_hash`=VALUES(`payload_hash`),`active`=1,`updated_at`=CURRENT_TIMESTAMP";
        $pdo->prepare($sql)->execute([$id,$requestId,$ctx['masterId'],$ctx['actorUserId'],$payload['request_title'],$payload['price_type'],$payload['price_from'],$payload['price_to'],$payload['start_time'],$payload['work_format'],$payload['includes_text'],$payload['extra_costs'],$payload['need_diagnostics'],$payload['duration_text'],$payload['warranty_text'],$payload['arrival_time'],$payload['field_service_price'],$payload['need_tow'],$payload['can_fix_on_site'],$payload['comment'],'pending',$payloadHash]);
        kareta_ensure_waiting_responses($pdo,$requestId);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();kareta_log_error('masterExchange.saveResponse',$e->getMessage());kareta_json(['ok'=>false,'error'=>'exchange_response_save_failed'],500);}
    try{kareta_write_event($pdo,$requestId,$eventType,['masterId'=>$ctx['masterId'],'responseId'=>$id]);}catch(Throwable $_e){}
    try{$ost=$pdo->prepare("SELECT client_phone,client_user_id FROM `orders` WHERE id=? LIMIT 1");$ost->execute([$requestId]);$orow=$ost->fetch(PDO::FETCH_ASSOC)?:[];kareta_notification_insert($pdo,['recipientUserId'=>(int)($orow['client_user_id']??0)?:null,'recipientPhone'=>(string)($orow['client_phone']??''),'recipientRole'=>'client','eventType'=>$eventType==='response_updated'?'exchange.response.updated':'exchange.response.sent','entityType'=>'order','entityId'=>$requestId,'title'=>$eventType==='response_updated'?'Мастер изменил отклик':'Новый отклик мастера','body'=>$eventType==='response_updated'?'Мастер обновил предложение по вашей заявке.':'По вашей заявке появился новый отклик.','actionUrl'=>'#myorders','meta'=>['orderId'=>$requestId,'responseId'=>$id]]);}catch(Throwable $_e){}
    kareta_log_audit($pdo,'masterExchange.saveResponse',['requestId'=>$requestId,'masterId'=>$ctx['masterId'],'event'=>$eventType,'payloadHash'=>$payloadHash]);
    kareta_json(['ok'=>true,'state'=>kareta_master_exchange_fetch_state($pdo,$ctx['masterId'],$ctx['actorUserId'])]);
}

function master_exchange_toggle_saved(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $ctx = kareta_master_exchange_context($pdo);
    kareta_ensure_schema_columns($pdo);
    $requestId = trim((string)($b['request_id'] ?? $b['id'] ?? ''));
    if ($requestId === '') kareta_json(['ok'=>false,'error'=>'request_id_required'],422);
    $active = !empty($b['active']);
    $payload = [$requestId, $ctx['masterId'], $ctx['actorUserId']];
    $pdo->prepare("INSERT INTO `master_exchange_saved` (`request_id`,`master_id`,`master_user_id`,`active`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `master_user_id`=VALUES(`master_user_id`), `active`=VALUES(`active`), `updated_at`=CURRENT_TIMESTAMP")->execute([$requestId, $ctx['masterId'], $ctx['actorUserId'], $active ? 1 : 0]);
    kareta_log_audit($pdo, 'masterExchange.toggleSaved', ['requestId'=>$requestId,'masterId'=>$ctx['masterId'],'active'=>$active]);
    kareta_json(['ok'=>true, 'active'=>$active, 'state'=>kareta_master_exchange_fetch_state($pdo, $ctx['masterId'], $ctx['actorUserId'])]);
}

function master_exchange_toggle_hidden(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $ctx = kareta_master_exchange_context($pdo);
    kareta_ensure_schema_columns($pdo);
    $requestId = trim((string)($b['request_id'] ?? $b['id'] ?? ''));
    if ($requestId === '') kareta_json(['ok'=>false,'error'=>'request_id_required'],422);
    $active = !empty($b['active']);
    $pdo->prepare("INSERT INTO `master_exchange_hidden` (`request_id`,`master_id`,`master_user_id`,`active`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE `master_user_id`=VALUES(`master_user_id`), `active`=VALUES(`active`), `updated_at`=CURRENT_TIMESTAMP")->execute([$requestId, $ctx['masterId'], $ctx['actorUserId'], $active ? 1 : 0]);
    kareta_log_audit($pdo, 'masterExchange.toggleHidden', ['requestId'=>$requestId,'masterId'=>$ctx['masterId'],'active'=>$active]);
    kareta_json(['ok'=>true, 'active'=>$active, 'state'=>kareta_master_exchange_fetch_state($pdo, $ctx['masterId'], $ctx['actorUserId'])]);
}

function kareta_clean_text(mixed $value, int $max = 255): string {
    $text = trim((string)$value);
    if ($text === '') return '';
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return mb_substr($text, 0, $max);
}

function kareta_clean_json_list(mixed $value, int $maxItems = 100, int $maxLen = 255): array {
    $items = is_array($value) ? $value : [];
    $out = [];
    foreach ($items as $item) {
        $clean = kareta_clean_text($item, $maxLen);
        if ($clean !== '') $out[] = $clean;
        if (count($out) >= $maxItems) break;
    }
    return array_values($out);
}


function client_exchange_default_state(): array {
    return ['responses'=>[]];
}

function client_exchange_fetch_state(PDO $pdo): array {
    kareta_ensure_schema_columns($pdo);
    $actor = kareta_session_user() ?? [];
    $actorUserId = (int)($actor['id'] ?? 0);
    $phone = _actor_phone();
    if ($actorUserId <= 0 && $phone === '') return client_exchange_default_state();
    $orderWhere = [];
    $orderParams = [];
    if ($actorUserId > 0) { $orderWhere[] = 'client_user_id=?'; $orderParams[] = $actorUserId; }
    if ($phone !== '') { $orderWhere[] = 'client_phone=?'; $orderParams[] = $phone; }
    if (!$orderWhere) return client_exchange_default_state();
    $stOrders = $pdo->prepare("SELECT id FROM `orders` WHERE (" . implode(' OR ', $orderWhere) . ") ORDER BY created_at DESC LIMIT 200");
    $stOrders->execute($orderParams);
    $orderIds = array_values(array_filter(array_map('strval', $stOrders->fetchAll(PDO::FETCH_COLUMN) ?: [])));
    if (!$orderIds) return client_exchange_default_state();
    $ph = implode(',', array_fill(0, count($orderIds), '?'));
    $sql = "SELECT r.*, COALESCE(NULLIF(m.name,''), NULLIF(u.name,''), 'Мастер') AS master_name, COALESCE(NULLIF(m.spec,''), NULLIF(u.spec,''), '') AS master_spec, COALESCE(m.initials, u.initials, 'М') AS master_initials, COALESCE(m.color, '#34d399') AS master_color
            FROM `master_exchange_responses` r
            LEFT JOIN `masters` m ON m.id = r.master_id
            LEFT JOIN `users` u ON u.id = r.master_user_id
            WHERE r.active=1 AND r.request_id IN ($ph)
            ORDER BY FIELD(r.response_status,'accepted','pending','declined'), r.updated_at DESC, r.created_at DESC";
    $rows = kareta_try_query_all($pdo, $sql, $orderIds, [], 'CLIENT_EXCHANGE_RESPONSES');
    $responses = array_map(static function(array $r): array {
        return [
            'id' => (string)($r['id'] ?? ''),
            'request_id' => (string)($r['request_id'] ?? ''),
            'orderId' => (string)($r['request_id'] ?? ''),
            'request_title' => (string)($r['request_title'] ?? ''),
            'master_id' => (string)($r['master_id'] ?? ''),
            'masterId' => (string)($r['master_id'] ?? ''),
            'master_user_id' => (int)($r['master_user_id'] ?? 0),
            'masterUserId' => (int)($r['master_user_id'] ?? 0),
            'masterName' => (string)($r['master_name'] ?? 'Мастер'),
            'masterSpec' => (string)($r['master_spec'] ?? ''),
            'masterInitials' => (string)($r['master_initials'] ?? 'М'),
            'masterColor' => (string)($r['master_color'] ?? '#34d399'),
            'priceType' => (string)($r['price_type'] ?? 'fixed'),
            'price_from' => (int)($r['price_from'] ?? 0),
            'price_to' => (int)($r['price_to'] ?? 0),
            'start_time' => (string)($r['start_time'] ?? ''),
            'work_format' => (string)($r['work_format'] ?? ''),
            'duration_text' => (string)($r['duration_text'] ?? ''),
            'warranty_text' => (string)($r['warranty_text'] ?? ''),
            'arrival_time' => (string)($r['arrival_time'] ?? ''),
            'field_service_price' => (int)($r['field_service_price'] ?? 0),
            'comment' => (string)($r['comment'] ?? ''),
            'response_status' => (string)($r['response_status'] ?? 'pending'),
            'status' => (string)($r['response_status'] ?? 'pending'),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    return ['responses'=>$responses];
}

function client_exchange_get_responses(?PDO $pdo): void {
    if (!$pdo) _no_db();
    kareta_json(['ok'=>true, 'state'=>client_exchange_fetch_state($pdo)]);
}

function client_exchange_resolve_owned_order(PDO $pdo, string $orderId): array {
    $actor = kareta_session_user() ?? [];
    $actorUserId = (int)($actor['id'] ?? 0);
    $phone = _actor_phone();
    $st = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
    $st->execute([$orderId]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $owned = ($actorUserId > 0 && (int)($order['client_user_id'] ?? 0) === $actorUserId)
        || ($phone !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $phone);
    if (!$owned) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    return $order;
}

function client_exchange_schedule_preview(?PDO $pdo,array $b): void {
    if(!$pdo)_no_db();kareta_ensure_schema_columns($pdo);
    $orderId=trim((string)($b['orderId']??$b['request_id']??''));$responseId=trim((string)($b['responseId']??$b['response_id']??''));if($orderId===''||$responseId==='')kareta_json(['ok'=>false,'error'=>'order_and_response_required'],422);
    $order=client_exchange_resolve_owned_order($pdo,$orderId);
    $q=$pdo->prepare("SELECT * FROM master_exchange_responses WHERE BINARY id=BINARY ? AND BINARY request_id=BINARY ? AND active=1 LIMIT 1");$q->execute([$responseId,$orderId]);$response=$q->fetch(PDO::FETCH_ASSOC);if(!$response)kareta_json(['ok'=>false,'error'=>'response_not_found'],404);
    $preview=function_exists('kareta_master_schedule_exchange_preview')?kareta_master_schedule_exchange_preview($pdo,$order,$response,false):['schedulable'=>false,'hasConflict'=>false,'conflicts'=>[]];
    kareta_json(['ok'=>true,'preview'=>$preview]);
}

function client_exchange_accept_response(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_schema_columns($pdo);
    $orderId = trim((string)($b['orderId'] ?? $b['request_id'] ?? $b['id'] ?? ''));
    $responseId = trim((string)($b['responseId'] ?? $b['response_id'] ?? ''));
    $masterId = trim((string)($b['masterId'] ?? $b['master_id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    if ($responseId === '' && $masterId === '') kareta_json(['ok'=>false,'error'=>'response_or_master_required'],422);
    $actorId = (int)(kareta_session_user()['id'] ?? 0);
    try {
        $pdo->beginTransaction();
        $order = client_exchange_resolve_owned_order($pdo, $orderId);
        if (!in_array((string)($order['status'] ?? 'new'), ['new','pending','waiting_responses'], true)) {
            $retryMasterId = $masterId;
            if ($retryMasterId === '' && $responseId !== '') {
                $stRetry = $pdo->prepare("SELECT master_id FROM `master_exchange_responses` WHERE id=? AND request_id=? LIMIT 1");
                $stRetry->execute([$responseId, $orderId]);
                $retryMasterId = (string)($stRetry->fetchColumn() ?: '');
            }
            if ((string)($order['status'] ?? '') === 'process' && $retryMasterId !== '' && (string)($order['master_id'] ?? '') === $retryMasterId) {
                $pdo->rollBack();
                $stOrder = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
                $stOrder->execute([$orderId]);
                $stChat = $pdo->prepare("SELECT * FROM `chats` WHERE order_id=? LIMIT 1");
                $stChat->execute([$orderId]);
                kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'already_accepted','order'=>_fmt_order($stOrder->fetch()),'chat'=>_fmt_chat($stChat->fetch()),'state'=>client_exchange_fetch_state($pdo)]);
            }
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_not_open','message'=>'Заявка уже не находится в ожидании отклика'],409);
        }
        $params = [$orderId];
        $where = "r.request_id=? AND r.active=1";
        if ($responseId !== '') { $where .= " AND r.id=?"; $params[] = $responseId; }
        else { $where .= " AND r.master_id=?"; $params[] = $masterId; }
        $stResp = $pdo->prepare("SELECT r.*, COALESCE(NULLIF(m.name,''), NULLIF(u.name,''), 'Мастер') AS master_name, COALESCE(m.initials, u.initials, 'М') AS master_initials
            FROM `master_exchange_responses` r
            LEFT JOIN `masters` m ON m.id=r.master_id
            LEFT JOIN `users` u ON u.id=r.master_user_id
            WHERE {$where} LIMIT 1 FOR UPDATE");
        $stResp->execute($params);
        $resp = $stResp->fetch();
        if (!$resp) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'response_not_found'],404); }
        if ((string)($resp['response_status'] ?? 'pending') === 'declined') { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'response_already_declined'],409); }
        $selMasterId = (string)($resp['master_id'] ?? '');
        $selMasterUserId = (int)($resp['master_user_id'] ?? 0);
        $selMasterName = (string)($resp['master_name'] ?? 'Мастер');
        if ($selMasterId === '') { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'master_not_found'],409); }
        $forceScheduleConflict=!empty($b['confirmScheduleConflict']);
        $schedulePreview=function_exists('kareta_master_schedule_exchange_preview')?kareta_master_schedule_exchange_preview($pdo,$order,$resp,true):['schedulable'=>false,'hasConflict'=>false,'conflicts'=>[]];
        if(!empty($schedulePreview['hasConflict'])&&!$forceScheduleConflict){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'schedule_conflict','message'=>'У Мастера есть пересечение в выбранное время. Проверьте предупреждение и подтвердите выбор повторно.','schedulePreview'=>$schedulePreview],409);}
        $quotaDate=preg_match('/^\d{4}-\d{2}-\d{2}/',(string)($schedulePreview['plannedStart']??''))?substr((string)$schedulePreview['plannedStart'],0,10):(preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d'));
        kareta_tariff_master_guard($pdo,$selMasterId,$quotaDate,$orderId,true);
        $scheduleResult=function_exists('kareta_master_schedule_apply_exchange_plan')?kareta_master_schedule_apply_exchange_plan($pdo,$order,$resp,$forceScheduleConflict,'exchange_accept'):['ok'=>true,'scheduled'=>false,'preview'=>$schedulePreview];
        if(empty($scheduleResult['ok'])){$pdo->rollBack();kareta_json(array_merge(['ok'=>false],$scheduleResult),409);}
        $pdo->prepare("UPDATE `master_exchange_responses` SET response_status=CASE WHEN id=? THEN 'accepted' ELSE 'declined' END, accepted_at=CASE WHEN id=? THEN COALESCE(accepted_at,NOW()) ELSE accepted_at END, updated_at=CURRENT_TIMESTAMP WHERE request_id=? AND active=1")
            ->execute([(string)$resp['id'],(string)$resp['id'], $orderId]);
        $pdo->prepare("UPDATE `orders` SET status='process', master_id=?, master_user_id=?, master_name=?, accepted_at=COALESCE(accepted_at,NOW()), assigned_admin_user_id=NULL WHERE id=?")
            ->execute([$selMasterId, $selMasterUserId ?: null, $selMasterName, $orderId]);
        kareta_tariff_record_master_acceptance($pdo,$selMasterId,$orderId,date('Y-m-d'),'client_exchange_accept');
        $chatId = 'ch_' . strtolower(str_replace('-', '', $orderId));
        $clientInit = 'К';
        $nameParts = preg_split('/\s+/u', trim((string)($order['client_name'] ?? ''))) ?: [];
        if ($nameParts) {
            $letters=[]; foreach($nameParts as $part){ $part=trim((string)$part); if($part==='') continue; $letters[]=mb_strtoupper(mb_substr($part,0,1,'UTF-8'),'UTF-8'); if(count($letters)>=2) break; }
            if($letters) $clientInit=implode('', $letters);
        }
        $masterInit = (string)($resp['master_initials'] ?? 'М') ?: 'М';
        $orderTitle = (string)($order['service_names'] ?? 'Заявка');
        $pdo->prepare("INSERT INTO `chats` (id,order_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE master_id=VALUES(master_id), master_user_id=VALUES(master_user_id), master_name=VALUES(master_name), master_init=VALUES(master_init), assigned_admin_user_id=NULL, status='process', unread_master=unread_master+1")
            ->execute([$chatId,$orderId,(string)($order['client_id'] ?? ''),(int)($order['client_user_id'] ?? 0) ?: null,(string)($order['client_name'] ?? ''),(string)($order['client_phone'] ?? ''),$clientInit,$selMasterId,$selMasterUserId ?: null,null,$selMasterName,$masterInit,$orderTitle,(string)($order['client_car'] ?? ''),'process',1,1,0]);
        if(!empty($scheduleResult['scheduled'])&&function_exists('kareta_master_schedule_write_system_message')){$plan=$scheduleResult['plan']??[];try{$human=(new DateTimeImmutable((string)($plan['plannedStart']??'')))->format('d.m.Y H:i');$duration=(int)($plan['durationMin']??0);kareta_master_schedule_write_system_message($pdo,$orderId,$chatId,'Согласовано время записи: '.$human.($duration>0?', плановая длительность '.$duration.' мин.':''),(string)($plan['plannedStart']??'').'|'.$duration);}catch(Throwable $_){}}
        $pdo->prepare("INSERT INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_acc_'.substr(md5($orderId.':'.$selMasterId),0,18),$chatId,$orderId,'system',$actorId ?: null,'event','Клиент принял отклик мастера '.$selMasterName.'. Заявка переведена в работу.',date('H:i'),date('Y-m-d H:i:s')]);
        kareta_notification_insert($pdo, [
            'recipientUserId' => $selMasterUserId ?: null,
            'recipientPhone' => '',
            'recipientRole' => 'master',
            'eventType' => 'exchange.response.accepted',
            'entityType' => 'order',
            'entityId' => $orderId,
            'title' => 'Клиент принял ваш отклик',
            'body' => !empty($scheduleResult['scheduled'])?'Заявка '.$orderId.' принята. Время записи перенесено в календарь.':'Заявка '.$orderId.' перешла в работу.',
            'actionUrl' => '#/orders/item/'.rawurlencode($orderId),
            'meta' => ['orderId'=>$orderId,'responseId'=>(string)$resp['id'],'chatId'=>$chatId,'orderUrl'=>'#/orders/item/'.rawurlencode($orderId),'schedule'=>$scheduleResult['plan']??null],
        ]);
        if(function_exists('kareta_dispatch_plan_order')){
            $resolvedSto=trim((string)($order['sto_id']??''));
            if($resolvedSto===''){ $stMs=$pdo->prepare("SELECT sto_id FROM masters WHERE BINARY id=BINARY ? LIMIT 1"); $stMs->execute([$selMasterId]); $resolvedSto=trim((string)($stMs->fetchColumn()?:'')); }
            if($resolvedSto!==''){
                if(trim((string)($order['sto_id']??''))===''){ $stStoName=$pdo->prepare("SELECT name FROM sto_profiles WHERE BINARY id=BINARY ? LIMIT 1"); $stStoName->execute([$resolvedSto]); $pdo->prepare("UPDATE orders SET sto_id=?,sto_name=? WHERE id=? AND COALESCE(sto_id,'')=''")->execute([$resolvedSto,(string)($stStoName->fetchColumn()?:''),$orderId]); }
                kareta_dispatch_plan_order($pdo,$resolvedSto,$orderId,$selMasterId);
            }
        }
        kareta_log_audit($pdo, 'clientExchange.acceptResponse', ['orderId'=>$orderId,'responseId'=>(string)$resp['id'],'masterId'=>$selMasterId]);
        $pdo->commit();
        // События пишем ПОСЛЕ commit в try/catch — чтобы ошибка в events не откатила транзакцию (ТЗ 3.1)
        try { kareta_write_event($pdo, $orderId, 'response_accepted', ['masterId'=>$selMasterId, 'responseId'=>(string)$resp['id']]); } catch(\Throwable $__e) {}
        try { kareta_write_event($pdo, $orderId, 'executor_assigned', ['masterId'=>$selMasterId, 'masterName'=>$selMasterName]); } catch(\Throwable $__e) {}
        $stOrder = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
        $stOrder->execute([$orderId]);
        $stChat = $pdo->prepare("SELECT * FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat->execute([$orderId]);
        $acceptedOrder=_fmt_order($stOrder->fetch());$acceptedChat=_fmt_chat($stChat->fetch());kareta_json(['ok'=>true,'order'=>$acceptedOrder,'chat'=>$acceptedChat,'nextAction'=>['type'=>'order_chat','orderUrl'=>'#/orders/item/'.rawurlencode($orderId),'chatUrl'=>'#/chats','chatId'=>(string)($acceptedChat['id']??''),'schedule'=>$scheduleResult['plan']??null],'schedule'=>$scheduleResult,'state'=>client_exchange_fetch_state($pdo)]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('clientExchange.acceptResponse', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'client_exchange_accept_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

function client_exchange_decline_response(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_schema_columns($pdo);
    $orderId = trim((string)($b['orderId'] ?? $b['request_id'] ?? $b['id'] ?? ''));
    $responseId = trim((string)($b['responseId'] ?? $b['response_id'] ?? ''));
    $masterId = trim((string)($b['masterId'] ?? $b['master_id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    if ($responseId === '' && $masterId === '') kareta_json(['ok'=>false,'error'=>'response_or_master_required'],422);
    try {
        $pdo->beginTransaction();
        client_exchange_resolve_owned_order($pdo, $orderId);
        $params = [$orderId];
        $where = "request_id=? AND active=1";
        if ($responseId !== '') { $where .= " AND id=?"; $params[] = $responseId; }
        else { $where .= " AND master_id=?"; $params[] = $masterId; }
        $stResp = $pdo->prepare("SELECT id, master_user_id FROM `master_exchange_responses` WHERE {$where} LIMIT 1 FOR UPDATE");
        $stResp->execute($params);
        $resp = $stResp->fetch();
        if (!$resp) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'response_not_found'],404); }
        $pdo->prepare("UPDATE `master_exchange_responses` SET response_status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([(string)$resp['id']]);
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($resp['master_user_id'] ?? 0) ?: null,
            'recipientRole' => 'master',
            'eventType' => 'exchange.response.declined',
            'entityType' => 'order',
            'entityId' => $orderId,
            'title' => 'Отклик отклонён',
            'body' => 'Клиент отклонил отклик по заявке '.$orderId.'.',
            'actionUrl' => '#master:work:queue',
            'meta' => ['orderId'=>$orderId,'responseId'=>(string)$resp['id']],
        ]);
        kareta_log_audit($pdo, 'clientExchange.declineResponse', ['orderId'=>$orderId,'responseId'=>(string)$resp['id']]);
        $pdo->commit();
        kareta_write_event($pdo, $orderId, 'response_declined', ['responseId'=>(string)$resp['id']]);
        kareta_json(['ok'=>true,'state'=>client_exchange_fetch_state($pdo)]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('clientExchange.declineResponse', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'client_exchange_decline_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

function kareta_require_chat_access(PDO $pdo, string $chatId): array {
    $st = $pdo->prepare("SELECT * FROM `chats` WHERE id=? LIMIT 1");
    $st->execute([$chatId]);
    $chat = $st->fetch();
    if (!$chat) kareta_json(['ok'=>false,'error'=>'chat_not_found'],404);

    $actor = kareta_chat_actor($pdo);
    $actorId = (int)$actor['userId'];
    $role = (string)$actor['role'];
    try {
        $participantRole=$role==='owner'?'admin':$role;
        $pst=$pdo->prepare("SELECT 1 FROM `chat_participants` WHERE chat_id=? AND user_id=? AND role=? AND left_at IS NULL LIMIT 1");
        $pst->execute([$chatId,$actorId,$participantRole]);
        if ($actorId > 0 && $pst->fetchColumn()) return $chat;
    } catch (Throwable $_) {}

    if (in_array($role, ['admin','owner'], true)) return $chat;


    $actorPhone = (string)$actor['phone'];
    $allowed = false;
    if ($role === 'client') {
        $allowed = ((int)($chat['client_user_id'] ?? 0) > 0 && (int)$chat['client_user_id'] === $actorId)
            || ($actorPhone !== '' && kareta_normalize_phone((string)($chat['client_phone'] ?? '')) === $actorPhone);
    } elseif ($role === 'master') {
        $allowed = ((int)($chat['master_user_id'] ?? 0) > 0 && (int)$chat['master_user_id'] === $actorId);
        if (!$allowed && $actorPhone !== '') {
            $mst = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? OR user_phone=? OR phone=? LIMIT 1");
            $mst->execute([$actorId ?: -1, $actorPhone, $actorPhone]);
            $masterId = (string)($mst->fetchColumn() ?: '');
            $allowed = $masterId !== '' && (string)($chat['master_id'] ?? '') === $masterId;
        }
    } elseif ($role === 'sto') {
        // СТО: доступ если заявка принадлежит СТО через orders.sto_id
        if ($actorId > 0 || $actorPhone !== '') {
            $stSto = $pdo->prepare("SELECT sp.id FROM `orders` o JOIN `sto_profiles` sp ON sp.id=o.sto_id WHERE o.id=? AND (sp.user_id=? OR sp.manager_phone=?) LIMIT 1");
            $stSto->execute([(string)($chat['order_id']??''), $actorId ?: -1, $actorPhone]);
            $allowed = (bool)$stSto->fetch();
            // Также проверяем через chat.sto_id
            if (!$allowed && !empty($chat['sto_id'])) {
                $stSto2 = $pdo->prepare("SELECT id FROM `sto_profiles` WHERE id=? AND (user_id=? OR manager_phone=?) LIMIT 1");
                $stSto2->execute([(string)$chat['sto_id'], $actorId ?: -1, $actorPhone]);
                $allowed = (bool)$stSto2->fetch();
            }
        }
    } elseif ($role === 'seller') {
        $allowed = $actorId > 0 && ((int)($chat['seller_user_id'] ?? 0) === $actorId);
    }

    if (!$allowed) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    return $chat;
}

/* ── AUTH OTP (Patch 8) ────────────────────────────────────────── */
// Legacy aliases use the same challenge service as the canonical Identity endpoint.
function auth_send_otp(?PDO $pdo, array $b): void {
    if (!$pdo instanceof PDO) _no_db();
    $phone = kareta_normalize_phone((string)($b['phone'] ?? ''));
    if ($phone === '') kareta_json(['ok'=>false,'error'=>'phone_required'],400);
    try{$challenge=(new KaretaChallengeService($pdo))->create($phone,'login');}
    catch(DomainException $error){kareta_json(kareta_challenge_error_payload($error),$error->getMessage()==='challenge_rate_limited'?429:503);}
    $_SESSION['legacy_otp_challenge_key']=(string)$challenge['challengeKey'];
    $_SESSION['legacy_otp_phone']=$phone;
    $response=[
        'ok'=>true,'sent'=>true,'expiresIn'=>(int)$challenge['expiresIn'],
        'resendAfter'=>(int)($challenge['resendAfter']??60),
        'deliveryMode'=>(string)($challenge['deliveryMode']??'webhook'),
        'codeLength'=>(int)($challenge['codeLength']??6),
        'testMode'=>(bool)($challenge['testMode']??false),
    ];
    if(isset($challenge['testCode']))$response['testCode']=(string)$challenge['testCode'];
    if(isset($challenge['devCode']))$response['devCode']=(string)$challenge['devCode'];
    kareta_json($response);
}

function auth_verify_otp(?PDO $pdo, array $b): void {
    if (!$pdo instanceof PDO) _no_db();
    $phone = kareta_normalize_phone((string)($b['phone'] ?? ''));
    $code  = preg_replace('/\D/', '', (string)($b['code'] ?? ''));
    if ($phone === '' || !hash_equals((string)($_SESSION['legacy_otp_phone']??''),$phone)) kareta_json(['ok'=>false,'error'=>'verification_required'],409);
    try{(new KaretaChallengeService($pdo))->verify((string)($_SESSION['legacy_otp_challenge_key']??''),$code);}
    catch(DomainException|InvalidArgumentException $error){kareta_log_audit($pdo,'auth.otp_failed',['phone'=>$phone]);kareta_json(['ok'=>false,'error'=>$error->getMessage()],$error->getMessage()==='challenge_attempts_exceeded'?429:422);}
    session_regenerate_id(true);
    unset($_SESSION['legacy_otp_challenge_key'],$_SESSION['legacy_otp_phone']);
    // Код верный — входим
    $user = kareta_upsert_profile($pdo, ['phone'=>$phone]);
    if((int)($user['active']??1)!==1){
        unset($_SESSION['kareta_user']);
        kareta_log_audit($pdo,'auth.blocked_login',['phone'=>$phone,'method'=>'otp']);
        kareta_json(['ok'=>false,'error'=>'account_blocked'],403);
    }
    if (!empty($user['phone'])) {
        kareta_sync_user_entity($pdo, (string)$user['phone']);
    }
    $_SESSION['kareta_user'] = $user;
    try{(new KaretaOnboardingIdentityBridge($pdo))->establish($user);}catch(Throwable $error){kareta_log_error('LEGACY_IDENTITY_SESSION',$error->getMessage());}
    kareta_log_audit($pdo, 'auth.login', ['phone'=>$phone,'method'=>'otp']);
    kareta_json(['ok'=>true,'user'=>$user]);
}

/* ── USERS ────────────────────────────────────────────────────────── */
function users_getAll(?PDO $pdo): void {
    if (!$pdo) _no_db();
    $rows = $pdo->query("SELECT u.id,u.phone,u.name,u.role,u.initials,u.car,u.spec,u.email,u.active, COALESCE(us.orders_created,0) AS ordersCreated, COALESCE(us.orders_assigned,0) AS ordersAssigned, COALESCE(us.orders_completed,0) AS ordersCompleted, COALESCE(us.chats_total,0) AS chatsTotal, COALESCE(us.messages_sent,0) AS messagesSent, COALESCE(us.audit_events,0) AS auditEvents FROM `users` u LEFT JOIN `user_stats` us ON us.user_id=u.id ORDER BY FIELD(u.role,'owner','admin','master','sto','seller','client','guest')")->fetchAll();
    foreach ($rows as &$r) $r['active']=(bool)$r['active']; unset($r);
    kareta_json(['ok'=>true,'users'=>$rows]);
}
function users_setRole(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $phone = kareta_normalize_phone((string)($b['phone']??''));
    $role=(string)($b['role']??'');
    if (!$phone||!$role) kareta_json(['ok'=>false,'error'=>'phone and role required'],422);
    if (!in_array($role, ['client','master','sto','seller','admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'invalid_role'],422);
    $actor = kareta_session_user() ?? [];
    $target = kareta_profile_by_phone($pdo, $phone);
    if (!$target) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    $actorLevel = kareta_role_level((string)($actor['role'] ?? 'guest'));
    $targetLevel = kareta_role_level((string)($target['role'] ?? 'guest'));
    $newLevel = kareta_role_level($role);
    if ($targetLevel >= $actorLevel) kareta_json(['ok'=>false,'error'=>'cannot_change_peer'],403);
    if ($newLevel >= $actorLevel) kareta_json(['ok'=>false,'error'=>'cannot_assign_equal_or_higher'],403);
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE `users` SET role=?,entry_role=? WHERE phone=?")->execute([$role,$role,$phone]);
        $targetId=(int)($target['id']??0);
        if(in_array($role,['master','sto','seller'],true)){
            $pdo->prepare("INSERT INTO role_applications(user_id,requested_role,status,payload_json,reviewed_by_user_id,reviewed_at)
                VALUES(?,?,'approved',JSON_OBJECT('source','users.setRole'),?,NOW())
                ON DUPLICATE KEY UPDATE reviewed_by_user_id=VALUES(reviewed_by_user_id),reviewed_at=VALUES(reviewed_at),payload_json=VALUES(payload_json)")
                ->execute([$targetId,$role,(int)($actor['id']??0)?:null]);
            $pdo->prepare("DELETE FROM role_applications WHERE user_id=? AND requested_role=? AND status='pending'")->execute([$targetId,$role]);
        }elseif($role==='client'){
            $pdo->prepare("DELETE FROM role_applications WHERE user_id=? AND status='pending'")->execute([$targetId]);
            $pdo->prepare("DELETE FROM role_applications WHERE user_id=? AND status='cancelled'")->execute([$targetId]);
            $pdo->prepare("UPDATE role_applications SET status='cancelled',reviewed_by_user_id=?,reviewed_at=NOW() WHERE user_id=? AND status='approved'")
                ->execute([(int)($actor['id']??0)?:null,$targetId]);
            $pdo->prepare("UPDATE person_profiles pp JOIN persons p ON p.id=pp.person_id JOIN accounts a ON a.id=p.account_id SET pp.status='suspended' WHERE a.phone=? AND pp.profile_type IN ('master','seller')")->execute([$phone]);
            $pdo->prepare("UPDATE contexts c JOIN person_profiles pp ON pp.id=c.profile_id JOIN persons p ON p.id=pp.person_id JOIN accounts a ON a.id=p.account_id SET c.status='suspended' WHERE a.phone=? AND c.context_type='profile'")->execute([$phone]);
        }
        $pdo->commit();
    } catch(Throwable $error) {
        if($pdo->inTransaction())$pdo->rollBack();
        throw $error;
    }
    kareta_sync_user_entity($pdo, $phone);
    kareta_log_audit($pdo, 'users.setRole', ['phone'=>$phone,'from'=>$target['role']??'','to'=>$role]);
    kareta_log_audit($pdo, 'security.role_changed', ['phone'=>$phone,'from'=>$target['role']??'','to'=>$role,'actorId'=>(int)($actor['id']??0)]);
    kareta_json(['ok'=>true]);
}

function users_setActive(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $phone  = kareta_normalize_phone((string)($b['phone']??''));
    $active = (int)(bool)($b['active']??true);
    $actor = kareta_session_user() ?? [];
    $target = kareta_profile_by_phone($pdo, $phone);
    if (!$target) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    if (kareta_role_level((string)($target['role'] ?? 'guest')) >= kareta_role_level((string)($actor['role'] ?? 'guest'))) {
        kareta_json(['ok'=>false,'error'=>'cannot_change_peer'],403);
    }
    $pdo->prepare("UPDATE `users` SET active=? WHERE phone=?")->execute([$active,$phone]);
    try {
        $pdo->prepare("UPDATE accounts SET status=? WHERE phone=? AND status<>'deleted'")->execute([$active?'active':'blocked',$phone]);
        if(!$active)$pdo->prepare("UPDATE auth_sessions s JOIN accounts a ON a.id=s.account_id SET s.revoked_at=COALESCE(s.revoked_at,NOW()),s.rotation_grace_until=NULL WHERE a.phone=? AND s.revoked_at IS NULL")->execute([$phone]);
    } catch(Throwable $error) { kareta_log_error('USER_ACTIVE_IDENTITY_SYNC',$error->getMessage()); }
    kareta_sync_user_entity($pdo, $phone);
    kareta_log_audit($pdo, 'users.setActive', ['phone'=>$phone,'active'=>$active]);
    kareta_json(['ok'=>true]);
}

// Patch 2: безопасное обновление только своего профиля (без изменения роли)
function profile_update_mine(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $actor = kareta_session_user();
    if (!$actor || empty($actor['phone'])) kareta_json(['ok'=>false,'error'=>'unauthenticated'],401);
    $phone = (string)$actor['phone'];
    kareta_ensure_column($pdo, 'users', 'avatar_url', "ALTER TABLE `users` ADD COLUMN `avatar_url` MEDIUMTEXT NULL AFTER `initials`");
    kareta_ensure_column($pdo, 'users', 'bio', "ALTER TABLE `users` ADD COLUMN `bio` TEXT NULL AFTER `avatar_url`");
    $allowed = ['name','initials','car','spec','email','city','bio','avatarUrl'];
    $sets = []; $vals = [];
    foreach ($allowed as $field) {
        if (!array_key_exists($field, $b)) continue;
        $column = $field === 'avatarUrl' ? 'avatar_url' : $field;
        $limit = $field === 'bio' ? 1000 : ($field === 'avatarUrl' ? 2100000 : 191);
        $value = (string)($b[$field]??'');
        if ($field === 'avatarUrl' && $value !== '' && !preg_match('~^data:image/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$~', $value)) {
            kareta_json(['ok'=>false,'error'=>'avatar_invalid','message'=>'Недопустимый формат аватара'],422);
        }
        $sets[] = "`{$column}`=?";
        $vals[] = kareta_clean_text($value, $limit);
    }
    if (empty($sets)) kareta_json(['ok'=>false,'error'=>'nothing_to_update'],400);
    $vals[] = $phone;
    $pdo->prepare("UPDATE `users` SET ".implode(',',$sets)." WHERE phone=?")->execute($vals);
    kareta_log_audit($pdo, 'profile.updateMine', array_intersect_key($b, array_flip($allowed)));
    kareta_json(['ok'=>true,'user'=>kareta_profile_by_phone($pdo,$phone)]);
}



/* ── SERVICES / PARTS CATALOG ───────────────────────────────────── */
function services_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $service = is_array($b['service'] ?? null) ? $b['service'] : $b;
    $id = trim((string)($service['id'] ?? ''));
    if ($id === '') $id = 'svc_' . bin2hex(random_bytes(4));
    if (trim((string)($service['name'] ?? '')) === '') {
        kareta_json(['ok'=>false,'error'=>'service_name_required'],422);
    }
    kareta_service_catalog_save_manual($pdo, $service, $id);
    kareta_log_audit($pdo, 'services.save', ['id'=>$id,'name'=>(string)($service['name'] ?? ''),'manualOverride'=>true]);
    kareta_json(['ok'=>true,'id'=>$id]);
}

function services_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = trim((string)($b['id'] ?? ''));
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    kareta_service_catalog_delete_manual($pdo, $id);
    kareta_log_audit($pdo, 'services.delete', ['id'=>$id,'mode'=>'soft','manualOverride'=>true]);
    kareta_json(['ok'=>true]);
}

function services_import_source(?PDO $pdo): void {
    if (!$pdo) _no_db();
    try {
        $result = kareta_service_catalog_import($pdo);
        kareta_log_audit($pdo, 'services.importSource', $result);
        kareta_json(['ok'=>true,'result'=>$result]);
    } catch (Throwable $e) {
        kareta_log_error('SERVICES_IMPORT', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'service_catalog_import_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}


/* ══════════════════════════════════════════════════════════════════
   OWNERSHIP HELPERS — централизованные проверки владения
   ══════════════════════════════════════════════════════════════════ */

// Patch 4: мастер может редактировать только свою карточку
function kareta_assert_master_owns_profile(?PDO $pdo, string $masterId): void {
    $actor = kareta_session_user() ?? [];
    if (in_array($actor['role'] ?? '', ['admin','owner'], true)) return;
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);

    // In Identity mode ownership means the concrete selected master context,
    // not any profile sharing the same account phone.
    if (function_exists('kareta_master_workplace_profile')) {
        $selected = kareta_master_workplace_profile($pdo);
        if ((string)($selected['id'] ?? '') === $masterId) return;
        kareta_log_audit($pdo, 'security.ownership_denied', ['action'=>'master_profile_context','masterId'=>$masterId,'selectedMasterId'=>(string)($selected['id'] ?? ''),'actorId'=>(int)($actor['id'] ?? 0)]);
        kareta_json(['ok'=>false,'error'=>'not_current_master_profile','message'=>'Выберите нужный профиль Мастера перед изменением данных'],403);
    }

    $st = $pdo->prepare("SELECT user_id, user_phone, phone FROM `masters` WHERE id=? LIMIT 1");
    $st->execute([$masterId]);
    $row = $st->fetch();
    if (!$row) kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
    $actorId=(int)($actor['id'] ?? 0);$actorPhone=kareta_normalize_phone((string)($actor['phone'] ?? ''));
    $ownsById=$actorId>0&&(int)($row['user_id']??0)===$actorId;
    $ownsByPhone=$actorPhone!==''&&(kareta_normalize_phone((string)($row['user_phone']??''))===$actorPhone||kareta_normalize_phone((string)($row['phone']??''))===$actorPhone);
    if(!$ownsById&&!$ownsByPhone)kareta_json(['ok'=>false,'error'=>'not_your_profile','message'=>'Вы можете редактировать только свою карточку'],403);
}

// Patch 5: мастер может изменять только назначенный ему заказ
function kareta_assert_master_owns_order(?PDO $pdo, string $orderId): void {
    $actor = kareta_session_user() ?? [];
    if (in_array($actor['role'] ?? '', ['admin','owner'], true)) return;
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $st=$pdo->prepare("SELECT master_user_id,master_id FROM `orders` WHERE id=? LIMIT 1");$st->execute([$orderId]);$row=$st->fetch(PDO::FETCH_ASSOC);
    if(!$row)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $selectedMasterId='';
    if(function_exists('kareta_master_workplace_profile')){$selected=kareta_master_workplace_profile($pdo);$selectedMasterId=(string)($selected['id']??'');}
    $assignedMasterId=trim((string)($row['master_id']??''));
    if($selectedMasterId!==''&&$assignedMasterId!==''&&hash_equals($selectedMasterId,$assignedMasterId))return;
    if($assignedMasterId===''&&(int)($row['master_user_id']??0)===(int)($actor['id']??0))return;
    kareta_log_audit($pdo,'security.ownership_denied',['action'=>'order_context','orderId'=>$orderId,'masterId'=>$assignedMasterId,'selectedMasterId'=>$selectedMasterId,'actorId'=>(int)($actor['id']??0)]);
    kareta_json(['ok'=>false,'error'=>'not_your_order','message'=>'Заказ назначен другому профилю Мастера'],403);
}


function kareta_assert_work_actor_can_mutate_order(PDO $pdo, string $orderId, ?array $body = null): array {
    $actor = kareta_session_user() ?? [];
    $role = function_exists('kareta_work_order_effective_role') ? kareta_work_order_effective_role($pdo) : (string)($actor['role'] ?? 'guest');
    $actorId = (int)($actor['id'] ?? 0);
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);

    if (in_array($role, ['admin','owner'], true)) {
        return ['role'=>$role, 'actorRole'=>$role, 'authorRole'=>$role, 'authorUserId'=>$actorId ?: null, 'stoId'=>'', 'label'=>$role === 'owner' ? 'Владелец' : 'Администратор'];
    }

    if ($role === 'master') {
        kareta_assert_master_owns_order($pdo, $orderId);
        return ['role'=>'master', 'actorRole'=>'master', 'authorRole'=>'master', 'authorUserId'=>$actorId ?: null, 'stoId'=>'', 'label'=>'Мастер'];
    }

    if ($role === 'sto') {
        try { kareta_ensure_column($pdo, 'orders', 'sto_id', "ALTER TABLE `orders` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `master_name`"); } catch (Throwable $_) {}
        $sto = kareta_resolve_current_sto($pdo, $actor, $body ?: []);
        $stoId = (string)($sto['id'] ?? '');
        $st = $pdo->prepare("SELECT id, sto_id FROM `orders` WHERE id=? LIMIT 1");
        $st->execute([$orderId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
        if ((string)($row['sto_id'] ?? '') !== $stoId) {
            kareta_log_audit($pdo, 'security.ownership_denied', ['action'=>'sto_order_work','orderId'=>$orderId,'stoId'=>$stoId,'actorId'=>$actorId]);
            kareta_json(['ok'=>false,'error'=>'foreign_sto_order','message'=>'СТО может вести этапы и отчёты только по своим заявкам'],403);
        }
        return ['role'=>'sto', 'actorRole'=>'sto', 'authorRole'=>'sto', 'authorUserId'=>$actorId ?: null, 'stoId'=>$stoId, 'label'=>(string)($sto['name'] ?? 'СТО') ?: 'СТО'];
    }

    kareta_json(['ok'=>false,'error'=>'forbidden'],403);
}

// Patch 7: мастер может управлять только своим магазином
function kareta_assert_master_owns_shop(?PDO $pdo, string $masterId): void {
    $actor = kareta_session_user() ?? [];
    if (in_array($actor['role'] ?? '', ['admin','owner'], true)) return;
    $actorId    = (int)($actor['id'] ?? 0);
    $actorPhone = (string)($actor['phone'] ?? '');
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    if (function_exists('kareta_master_workplace_profile')) {
        $selected = kareta_master_workplace_profile($pdo);
        if ((string)($selected['id'] ?? '') === $masterId) return;
        kareta_json(['ok'=>false,'error'=>'not_current_master_profile','message'=>'Магазин относится к другому профилю Мастера'],403);
    }
    $st = $pdo->prepare("SELECT user_id, user_phone, phone FROM `masters` WHERE id=? LIMIT 1");
    $st->execute([$masterId]);
    $row = $st->fetch();
    if (!$row) kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
    $ownsById   = $actorId > 0 && (int)($row['user_id'] ?? 0) === $actorId;
    $ownsByPhone= $actorPhone !== '' && (
        kareta_normalize_phone((string)($row['user_phone'] ?? '')) === $actorPhone ||
        kareta_normalize_phone((string)($row['phone'] ?? '')) === $actorPhone
    );
    if (!$ownsById && !$ownsByPhone) {
        kareta_log_audit($pdo, 'security.ownership_denied', ['action'=>'shop','masterId'=>$masterId,'actorId'=>$actorId]);
        kareta_json(['ok'=>false,'error'=>'not_your_shop','message'=>'Магазин принадлежит другому мастеру'],403);
    }
}

// Patch 7 helper: получить masterId по partId в shop_parts
function kareta_get_shop_part_master(?PDO $pdo, string $partId): string {
    if (!$pdo) return '';
    $st = $pdo->prepare("SELECT master_id FROM `shop_parts` WHERE id=? LIMIT 1");
    $st->execute([$partId]);
    $row = $st->fetch();
    return (string)($row['master_id'] ?? '');
}

function masters_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $m = $b['master'] ?? $b;
    // Patch 4: жёсткая ownership-проверка через централизованную функцию
    $actor = kareta_session_user() ?? [];
    $id = (string)($m['id'] ?? ('ms_' . bin2hex(random_bytes(4))));
    // Для существующих записей — проверяем владение
    if (!str_starts_with($id, 'ms_') || strlen($id) > 8) {
        $existing = $pdo->prepare("SELECT id FROM `masters` WHERE id=? LIMIT 1");
        $existing->execute([$id]);
        if ($existing->fetch()) {
            kareta_assert_master_owns_profile($pdo, $id);
        }
    }
    // Lazy add columns
    try { $pdo->exec("ALTER TABLE `masters` ADD COLUMN `resume` JSON NULL DEFAULT NULL"); } catch(Throwable $_){}
    $phone = kareta_normalize_phone((string)($m['phone'] ?? ($m['userPhone'] ?? '')));
    $name = kareta_clean_text($m['name'] ?? 'Мастер', 191);
    $userId = isset($m['userId']) ? max(0, (int)$m['userId']) : 0;
    if ($userId <= 0 && $phone !== '') $userId = kareta_user_id_by_phone($pdo, $phone);
    $resumeJson = isset($m['resume']) && is_array($m['resume']) ? json_encode($m['resume'], JSON_UNESCAPED_UNICODE) : null;
    $stoId = kareta_clean_text($m['stoId'] ?? ($m['sto_id'] ?? ''), 64);
    $stoName = kareta_clean_text($m['stoName'] ?? ($m['sto_name'] ?? ''), 191);
    if ($stoId !== '' && $stoName === '') {
        $stSto = $pdo->prepare("SELECT name FROM `sto_profiles` WHERE id=? LIMIT 1");
        $stSto->execute([$stoId]);
        $stoName = (string)($stSto->fetchColumn() ?: '');
    }
    $pdo->prepare("INSERT INTO `masters`(id,user_id,user_phone,name,phone,initials,color,spec,active,resume,sto_id,sto_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), user_phone=VALUES(user_phone), name=VALUES(name), phone=VALUES(phone), initials=VALUES(initials), color=VALUES(color), spec=VALUES(spec), active=VALUES(active), sto_id=VALUES(sto_id), sto_name=VALUES(sto_name)" . ($resumeJson !== null ? ", resume=VALUES(resume)" : ""))
        ->execute([
            $id,
            $userId > 0 ? $userId : null,
            $phone,
            $name,
            $phone,
            kareta_clean_text($m['initials'] ?? '', 16),
            kareta_clean_text($m['color'] ?? '#34d399', 16),
            kareta_clean_text($m['spec'] ?? '', 191),
            (int)(bool)($m['active'] ?? true),
            $resumeJson,
            $stoId,
            $stoName,
        ]);
    if ($phone !== '') {
        $pdo->prepare("INSERT INTO `users`(`phone`,`name`,`role`,`initials`,`spec`,`active`) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `role`='master', `initials`=VALUES(`initials`), `spec`=VALUES(`spec`), `active`=VALUES(`active`)")
            ->execute([$phone, $name, 'master', kareta_clean_text($m['initials'] ?? '', 16), kareta_clean_text($m['spec'] ?? '', 191), (int)(bool)($m['active'] ?? true)]);
        kareta_sync_user_entity($pdo, $phone);
    }
    kareta_log_audit($pdo, 'masters.save', ['id'=>$id,'phone'=>$phone]);
    kareta_json(['ok'=>true,'id'=>$id]);
}

function masters_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $st = $pdo->prepare("SELECT user_phone, name FROM `masters` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $masterRow = $st->fetch() ?: [];
    $phone = (string)($masterRow['user_phone'] ?? '');
    $pdo->prepare("UPDATE `masters` SET active=0 WHERE id=?")->execute([$id]);
    if ($phone !== '') {
        $pdo->prepare("UPDATE `users` SET `role`='client' WHERE phone=? AND `role`='master'")->execute([$phone]);
        kareta_sync_user_entity($pdo, $phone);
        // Patch 10: отдельный аудит смены роли
        kareta_log_audit($pdo, 'security.role_changed', ['phone'=>$phone,'from'=>'master','to'=>'client','reason'=>'masters.delete','masterId'=>$id]);
    }
    kareta_log_audit($pdo, 'masters.delete', ['id'=>$id,'name'=>$masterRow['name']??'','phone'=>$phone,'mode'=>'soft']);
    kareta_json(['ok'=>true]);
}

function site_content_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $row = $b['row'] ?? $b['content'] ?? $b;
    $key = (string)($row['contentKey'] ?? $row['key'] ?? '');
    if ($key === '') kareta_json(['ok'=>false,'error'=>'content_key_required'],422);
    $title = kareta_clean_text($row['title'] ?? '', 255);
    $body = $row['body'] ?? [];
    $pdo->prepare("INSERT INTO `site_content`(`content_key`,`title`,`body_json`,`active`) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE `title`=VALUES(`title`), `body_json`=VALUES(`body_json`), `active`=VALUES(`active`)")
        ->execute([$key, $title, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), (int)(bool)($row['active'] ?? true)]);
    kareta_log_audit($pdo, 'siteContent.save', ['key'=>$key]);
    kareta_json(['ok'=>true,'contentKey'=>$key]);
}

function site_content_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $key = (string)($b['contentKey'] ?? $b['key'] ?? '');
    if ($key === '') kareta_json(['ok'=>false,'error'=>'content_key_required'],422);
    $pdo->prepare("UPDATE `site_content` SET active=0 WHERE content_key=?")->execute([$key]);
    kareta_log_audit($pdo, 'siteContent.delete', ['key'=>$key,'mode'=>'soft']);
    kareta_json(['ok'=>true]);
}

function kareta_ensure_verified_review_schema(PDO $pdo): void {
    if(kareta_table_exists($pdo,'reviews_public')){
        foreach(['quality_rating'=>"TINYINT NULL AFTER `stars`",'timing_rating'=>"TINYINT NULL AFTER `quality_rating`",'neatness_rating'=>"TINYINT NULL AFTER `timing_rating`",'communication_rating'=>"TINYINT NULL AFTER `neatness_rating`",'master_reply'=>"TEXT NULL AFTER `text`",'master_reply_at'=>"DATETIME NULL AFTER `master_reply`"] as $c=>$d){try{kareta_ensure_column($pdo,'reviews_public',$c,"ALTER TABLE `reviews_public` ADD COLUMN `{$c}` {$d}");}catch(Throwable $_){}}
    }
    if(kareta_table_exists($pdo,'master_reviews')){
        foreach(['client_user_id'=>"INT NULL AFTER `author_phone`",'source_review_id'=>"VARCHAR(64) NULL AFTER `client_user_id`",'master_reply_at'=>"DATETIME NULL AFTER `master_reply`",'updated_at'=>"DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`"] as $c=>$d){try{kareta_ensure_column($pdo,'master_reviews',$c,"ALTER TABLE `master_reviews` ADD COLUMN `{$c}` {$d}");}catch(Throwable $_){}}
    }
}

function kareta_sync_verified_master_review(PDO $pdo, array $review, array $order = []): void {
    kareta_ensure_verified_review_schema($pdo);
    $masterId = kareta_clean_text($review['masterId'] ?? $review['master_id'] ?? '', 64);
    $orderId = kareta_clean_text($review['orderId'] ?? $review['order_id'] ?? '', 64);
    if ($masterId === '' || $orderId === '' || !kareta_table_exists($pdo,'master_reviews')) return;
    $sourceId = kareta_clean_text($review['id'] ?? '',64);
    $name = kareta_clean_text($review['name'] ?? $review['author_name'] ?? 'Клиент',160);
    $phone = kareta_clean_text($review['authorPhone'] ?? $review['author_phone'] ?? '',32);
    $clientUserId = (int)($review['clientUserId'] ?? $review['client_user_id'] ?? $order['client_user_id'] ?? 0) ?: null;
    $rating = max(1,min(5,(int)($review['stars'] ?? $review['rating'] ?? 5)));
    $dimension = static fn($a,$b=null): ?int => (($v=(int)($review[$a] ?? ($b!==null?($review[$b]??0):0)))>0)?max(1,min(5,$v)):null;
    $quality=$dimension('qualityRating','quality_rating');
    $timing=$dimension('timingRating','timing_rating');
    $neatness=$dimension('neatnessRating','neatness_rating');
    $communication=$dimension('communicationRating','communication_rating');
    $text=kareta_clean_text($review['text'] ?? '',4000);
    $existing=$pdo->prepare("SELECT id FROM master_reviews WHERE master_id=? AND order_id=? LIMIT 1");
    $existing->execute([$masterId,$orderId]);
    $id=(string)($existing->fetchColumn() ?: ('mr_'.substr(hash('sha256',$masterId.'|'.$orderId),0,24)));
    $sql="INSERT INTO master_reviews(id,master_id,order_id,author_name,author_phone,client_user_id,source_review_id,rating,quality_rating,timing_rating,neatness_rating,communication_rating,text,status,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'published',CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE author_name=VALUES(author_name),author_phone=VALUES(author_phone),client_user_id=VALUES(client_user_id),source_review_id=VALUES(source_review_id),rating=VALUES(rating),quality_rating=VALUES(quality_rating),timing_rating=VALUES(timing_rating),neatness_rating=VALUES(neatness_rating),communication_rating=VALUES(communication_rating),text=VALUES(text),status='published'";
    $pdo->prepare($sql)->execute([$id,$masterId,$orderId,$name,$phone,$clientUserId,$sourceId ?: null,$rating,$quality,$timing,$neatness,$communication,$text]);
}

function public_reviews_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_verified_review_schema($pdo);
    $row = $b['review'] ?? $b;
    $orderId = kareta_clean_text($row['orderId'] ?? $row['order_id'] ?? '', 64);
    $verifiedOrder = [];
    // Verified service review: only the real client of a completed order can create it.
    if ($orderId !== '') {
        $actor = kareta_require_api_session($pdo,['client','admin','owner']);
        $actorPhone = kareta_normalize_phone((string)($actor['phone'] ?? ''));
        $actorId = (int)($actor['id'] ?? 0);
        $stOrd = $pdo->prepare("SELECT id,status,client_phone,client_user_id,master_id,sto_id,master_name FROM `orders` WHERE id=? LIMIT 1");
        $stOrd->execute([$orderId]);
        $order = $stOrd->fetch(PDO::FETCH_ASSOC) ?: [];
        if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
        if ((string)($order['status']??'') !== 'done') kareta_json(['ok'=>false,'error'=>'order_not_done','message'=>'Отзыв доступен только после завершения работы'],422);
        $isOwner = ($actorPhone !== '' && kareta_normalize_phone((string)($order['client_phone']??'')) === $actorPhone)
            || ($actorId > 0 && (int)($order['client_user_id']??0) === $actorId)
            || in_array((string)($actor['role']??''),['admin','owner'],true);
        if (!$isOwner) kareta_json(['ok'=>false,'error'=>'not_owner','message'=>'Вы не владелец этой заявки'],403);
        $stEx = $pdo->prepare("SELECT id FROM `reviews_public` WHERE order_id=? AND active=1 AND review_type='service' LIMIT 1");
        $stEx->execute([$orderId]);
        $existingId = (string)($stEx->fetchColumn() ?: '');
        $newId = (string)($row['id'] ?? '');
        if ($existingId && $existingId !== $newId) kareta_json(['ok'=>false,'error'=>'review_exists','message'=>'По этой заявке уже есть отзыв'],409);
        $row['masterId'] = $row['master_id'] = (string)($order['master_id'] ?? '');
        $row['stoId'] = $row['sto_id'] = (string)($order['sto_id'] ?? '');
        $row['clientUserId'] = (int)($order['client_user_id'] ?? 0);
        $row['authorPhone'] = (string)($order['client_phone'] ?? '');
        if (!empty($order['master_name'])) $row['masterName'] = $order['master_name'];
        $verifiedOrder=$order;
    }
    $id = (string)($row['id'] ?? ('rv_' . bin2hex(random_bytes(4))));
    $name = kareta_clean_text($row['name'] ?? $row['author_name'] ?? 'Клиент', 120);
    $initials = kareta_clean_text($row['initials'] ?? mb_substr($name, 0, 1), 12);
    $dateLabel = kareta_clean_text($row['dateLabel'] ?? $row['date_label'] ?? '', 40);
    $stars = max(1, min(5, (int)($row['stars'] ?? 5)));
    $dim = static function(array $row,string $camel,string $snake): ?int { $v=(int)($row[$camel]??$row[$snake]??0); return $v>0?max(1,min(5,$v)):null; };
    $quality=$dim($row,'qualityRating','quality_rating');$timing=$dim($row,'timingRating','timing_rating');$neatness=$dim($row,'neatnessRating','neatness_rating');$communication=$dim($row,'communicationRating','communication_rating');
    $text = kareta_clean_text($row['text'] ?? '', 4000);
    if ($orderId !== '' && $text === '') kareta_json(['ok'=>false,'error'=>'review_text_required','message'=>'Добавьте комментарий к оценке'],422);
    $source = kareta_clean_text($row['sourceLabel'] ?? $row['source_label'] ?? 'KARETA', 80);
    $sort = max(0, (int)($row['sort'] ?? 100));
    $active = (int)(bool)($row['active'] ?? true);
    $masterId   = kareta_clean_text($row['masterId']   ?? $row['master_id']   ?? '', 64);
    $masterName = kareta_clean_text($row['masterName'] ?? $row['master_name'] ?? '', 160);
    $reviewType = kareta_clean_text($row['reviewType'] ?? $row['review_type'] ?? 'service', 24) ?: 'service';
    $productId  = kareta_clean_text($row['productId']  ?? $row['product_id']  ?? '', 64);
    $productName= kareta_clean_text($row['productName']?? $row['product_name']?? '', 191);
    $clientId   = kareta_clean_text($row['clientId']   ?? $row['client_id']   ?? '', 64);
    foreach([
        'master_id'=>"VARCHAR(64) NULL DEFAULT NULL AFTER `text`",'master_name'=>"VARCHAR(160) NULL DEFAULT NULL AFTER `master_id`",'review_type'=>"VARCHAR(24) NULL DEFAULT 'service' AFTER `master_name`",'order_id'=>"VARCHAR(64) NULL DEFAULT NULL AFTER `review_type`",'product_id'=>"VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`",'product_name'=>"VARCHAR(191) NULL DEFAULT NULL AFTER `product_id`",'client_id'=>"VARCHAR(64) NULL DEFAULT NULL AFTER `product_name`",
        'quality_rating'=>"TINYINT NULL AFTER `stars`",'timing_rating'=>"TINYINT NULL AFTER `quality_rating`",'neatness_rating'=>"TINYINT NULL AFTER `timing_rating`",'communication_rating'=>"TINYINT NULL AFTER `neatness_rating`",'master_reply'=>"TEXT NULL AFTER `text`",'master_reply_at'=>"DATETIME NULL AFTER `master_reply`"
    ] as $column=>$definition){try{kareta_ensure_column($pdo,'reviews_public',$column,"ALTER TABLE `reviews_public` ADD COLUMN `{$column}` {$definition}");}catch(Throwable $_){}}
    $sql="INSERT INTO reviews_public(id,author_name,initials,date_label,stars,quality_rating,timing_rating,neatness_rating,communication_rating,text,source_label,active,sort,master_id,master_name,review_type,order_id,product_id,product_name,client_id)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON DUPLICATE KEY UPDATE author_name=VALUES(author_name),initials=VALUES(initials),date_label=VALUES(date_label),stars=VALUES(stars),quality_rating=VALUES(quality_rating),timing_rating=VALUES(timing_rating),neatness_rating=VALUES(neatness_rating),communication_rating=VALUES(communication_rating),text=VALUES(text),source_label=VALUES(source_label),active=VALUES(active),sort=VALUES(sort),master_id=VALUES(master_id),master_name=VALUES(master_name),review_type=VALUES(review_type),order_id=VALUES(order_id),product_id=VALUES(product_id),product_name=VALUES(product_name),client_id=VALUES(client_id)";
    $pdo->prepare($sql)->execute([$id,$name,$initials,$dateLabel,$stars,$quality,$timing,$neatness,$communication,$text,$source,$active,$sort,$masterId,$masterName ?: null,$reviewType,$orderId ?: null,$productId ?: null,$productName ?: null,$clientId ?: null]);
    $row['id']=$id;$row['stars']=$stars;$row['qualityRating']=$quality;$row['timingRating']=$timing;$row['neatnessRating']=$neatness;$row['communicationRating']=$communication;$row['text']=$text;
    if ($orderId !== '') { kareta_sync_verified_master_review($pdo,$row,$verifiedOrder); kareta_write_event($pdo,$orderId,'review_created',['reviewId'=>$id,'stars'=>$stars,'masterId'=>$masterId,'verified'=>true]); }
    if ($masterId !== '') {
        try {$avgSt=$pdo->prepare("SELECT AVG(stars) avg_rating,COUNT(*) cnt FROM reviews_public WHERE active=1 AND review_type='service' AND master_id=? AND stars BETWEEN 1 AND 5");$avgSt->execute([$masterId]);$avg=$avgSt->fetch(PDO::FETCH_ASSOC)?:[];$pdo->prepare("UPDATE masters SET rating=?,reviews_count=? WHERE id=?")->execute([round((float)($avg['avg_rating']??0),2),(int)($avg['cnt']??0),$masterId]);}catch(Throwable $_e){}
    }
    kareta_log_audit($pdo,'publicReviews.save',['id'=>$id,'masterId'=>$masterId,'reviewType'=>$reviewType,'orderId'=>$orderId,'verified'=>$orderId!=='']);
    kareta_json(['ok'=>true,'id'=>$id,'verified'=>$orderId!=='']);
}

function public_reviews_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    // Patch 10: сохраняем что было до удаления
    $st = $pdo->prepare("SELECT author_name, text, stars FROM `reviews_public` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $snapshot = $st->fetch() ?: [];
    $pdo->prepare("UPDATE `reviews_public` SET active=0 WHERE id=?")->execute([$id]);
    kareta_log_audit($pdo, 'publicReviews.delete', ['id'=>$id,'mode'=>'soft','snapshot'=>$snapshot]);
    kareta_json(['ok'=>true]);
}

function parts_catalog_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    try { kareta_product_catalog_ensure_schema($pdo); } catch (Throwable $e) { kareta_log_error('PARTS_SCHEMA', $e->getMessage()); }
    try { kareta_ensure_parts_catalog_fitment($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_crosses($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_suppliers($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_fitments($pdo); } catch (Throwable $_) {}

    $part = $b['part'] ?? $b;
    $id = (string)($part['id'] ?? ('part_' . bin2hex(random_bytes(4))));
    $priceLabel = kareta_clean_text($part['priceLabel'] ?? ($part['price_label'] ?? ''), 96);
    $price = max(0, (float)($part['price'] ?? 0));
    if ($price <= 0 && function_exists('seller_price_from_label')) $price = seller_price_from_label($priceLabel);
    if ($priceLabel === '' && $price > 0) $priceLabel = number_format($price, 0, '.', ' ') . ' ₸';
    $wholesalePrice = max(0, (float)($part['wholesalePrice'] ?? ($part['wholesale_price'] ?? 0)));
    $stockQty = array_key_exists('stockQty', $part) || array_key_exists('stock_qty', $part)
        ? max(0, (int)($part['stockQty'] ?? $part['stock_qty'] ?? 0))
        : ((int)(bool)($part['stock'] ?? true));
    $stock = $stockQty > 0 ? 1 : 0;

    $pdo->prepare("INSERT INTO `parts_catalog`
        (id,cat,name,sku,brand,manufacturer_type,oem,analogs_json,crosses_json,suppliers_json,compatibility,vehicle_make,vehicle_model,vehicle_generation,year_from,year_to,engine,body,vin_prefixes,fitments_json,price_label,price,wholesale_price,stock,stock_qty,note,image_url,sort,active,source_key,source_hash,source_updated_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',NOW(),?)
        ON DUPLICATE KEY UPDATE
            cat=VALUES(cat),name=VALUES(name),sku=VALUES(sku),brand=VALUES(brand),manufacturer_type=VALUES(manufacturer_type),
            oem=VALUES(oem),analogs_json=VALUES(analogs_json),crosses_json=VALUES(crosses_json),suppliers_json=VALUES(suppliers_json),
            compatibility=VALUES(compatibility),vehicle_make=VALUES(vehicle_make),vehicle_model=VALUES(vehicle_model),
            vehicle_generation=VALUES(vehicle_generation),year_from=VALUES(year_from),year_to=VALUES(year_to),engine=VALUES(engine),
            body=VALUES(body),vin_prefixes=VALUES(vin_prefixes),fitments_json=VALUES(fitments_json),price_label=VALUES(price_label),
            price=VALUES(price),wholesale_price=VALUES(wholesale_price),stock=VALUES(stock),stock_qty=VALUES(stock_qty),
            note=VALUES(note),image_url=VALUES(image_url),sort=VALUES(sort),active=VALUES(active)")
        ->execute([
            $id,
            kareta_clean_text($part['cat'] ?? 'other', 64),
            kareta_clean_text($part['name'] ?? '', 180),
            kareta_clean_text($part['sku'] ?? '', 80),
            kareta_clean_text($part['brand'] ?? ($part['manufacturer'] ?? ''), 120),
            kareta_clean_text($part['manufacturerType'] ?? ($part['manufacturer_type'] ?? ''), 32),
            kareta_clean_text($part['oem'] ?? '', 120),
            is_array($part['analogs'] ?? null) ? json_encode($part['analogs'], JSON_UNESCAPED_UNICODE) : kareta_clean_text($part['analogs'] ?? ($part['analogsText'] ?? ''), 2000),
            is_array($part['crosses'] ?? null) ? json_encode($part['crosses'], JSON_UNESCAPED_UNICODE) : kareta_clean_text($part['crosses'] ?? ($part['crossesText'] ?? ''), 4000),
            is_array($part['suppliers'] ?? null) ? json_encode($part['suppliers'], JSON_UNESCAPED_UNICODE) : kareta_clean_text($part['suppliers'] ?? ($part['suppliersText'] ?? ''), 4000),
            kareta_clean_text($part['compatibility'] ?? '', 2000),
            kareta_clean_text($part['vehicleMake'] ?? ($part['vehicle_make'] ?? ''), 80),
            kareta_clean_text($part['vehicleModel'] ?? ($part['vehicle_model'] ?? ''), 120),
            kareta_clean_text($part['vehicleGeneration'] ?? ($part['vehicle_generation'] ?? ''), 80),
            ($part['yearFrom'] ?? ($part['year_from'] ?? null)) ?: null,
            ($part['yearTo'] ?? ($part['year_to'] ?? null)) ?: null,
            kareta_clean_text($part['engine'] ?? '', 120),
            kareta_clean_text($part['body'] ?? '', 120),
            is_array($part['vinPrefixes'] ?? null) ? implode(' · ', $part['vinPrefixes']) : kareta_clean_text($part['vinPrefixes'] ?? ($part['vin_prefixes'] ?? ''), 1000),
            is_array($part['fitments'] ?? null) ? json_encode($part['fitments'], JSON_UNESCAPED_UNICODE) : kareta_clean_text($part['fitments'] ?? ($part['fitmentsText'] ?? ($part['fitments_json'] ?? '')), 6000),
            $priceLabel,
            $price,
            $wholesalePrice,
            $stock,
            $stockQty,
            kareta_clean_text($part['note'] ?? '', 4000),
            kareta_clean_text($part['imageUrl'] ?? ($part['image_url'] ?? ($part['image'] ?? '')), 500),
            max(0, (int)($part['sort'] ?? 0)),
            (int)(bool)($part['active'] ?? true),
            kareta_clean_text($part['sourceKey'] ?? ($part['source_key'] ?? 'manual'), 64),
            (string)($part['createdAt'] ?? date('Y-m-d')),
        ]);

    try { kareta_sync_parts_crosses($pdo, 'parts_catalog', $id, $part['crosses'] ?? ($part['crossesText'] ?? ($part['analogs'] ?? '')), (string)($part['oem'] ?? ''), (string)($part['brand'] ?? ($part['manufacturer'] ?? ''))); } catch (Throwable $_) {}
    try { kareta_sync_parts_suppliers($pdo, 'parts_catalog', $id, $part['suppliers'] ?? ($part['suppliersText'] ?? '')); } catch (Throwable $_) {}
    try { kareta_sync_parts_fitments($pdo, 'parts_catalog', $id, $part['fitments'] ?? ($part['fitmentsText'] ?? ($part['fitments_json'] ?? '')), $part); } catch (Throwable $_) {}
    try { seller_sync_catalog_product($pdo, array_merge($part, ['id'=>$id,'price'=>$price,'priceLabel'=>$priceLabel,'stock_qty'=>$stockQty])); } catch (Throwable $e) { kareta_log_error('PARTS_SHOP_SYNC', $e->getMessage()); }
    kareta_log_audit($pdo, 'partsCatalog.save', ['id'=>$id,'sku'=>(string)($part['sku'] ?? ''),'price'=>$price,'stockQty'=>$stockQty,'fitment'=>($part['vehicleMake'] ?? '').' '.($part['vehicleModel'] ?? ''),'fitments'=>!empty($part['fitments']) || !empty($part['fitmentsText'])]);
    kareta_json(['ok'=>true,'id'=>$id]);
}

function parts_catalog_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $pdo->prepare("UPDATE `parts_catalog` SET active=0 WHERE id=?")->execute([$id]);
    try { seller_archive_catalog_product($pdo, $id); } catch (Throwable $e) { kareta_log_error('PARTS_SHOP_ARCHIVE', $e->getMessage()); }
    kareta_log_audit($pdo, 'partsCatalog.delete', ['id'=>$id,'mode'=>'soft']);
    kareta_json(['ok'=>true]);
}

function parts_catalog_import_source(?PDO $pdo): void {
    if (!$pdo) _no_db();
    try {
        $result = kareta_product_catalog_import($pdo, true);
        kareta_log_audit($pdo, 'partsCatalog.importSource', $result);
        kareta_json(['ok'=>true,'import'=>$result]);
    } catch (Throwable $e) {
        kareta_log_error('PARTS_IMPORT_SOURCE', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'product_catalog_import_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

/* ── ORDERS ───────────────────────────────────────────────────────── */
function orders_getAll(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $scope = kareta_order_scope($pdo);
    $role = $scope['role'];
    $where=[]; $params=[];

    // Ownership filters are server-owned. Client input can never widen them.
    if ($role === 'master') {
        $where[]='BINARY o.master_id=BINARY ?'; $params[]=$scope['masterId'];
    } elseif ($role === 'sto') {
        $where[]='BINARY o.sto_id=BINARY ?'; $params[]=$scope['stoId'];
    } elseif ($role === 'client') {
        if ($scope['userId'] > 0 && $scope['phone'] !== '') {
            $where[]='(o.client_user_id=? OR o.client_phone=?)'; $params[]=$scope['userId']; $params[]=$scope['phone'];
        } elseif ($scope['userId'] > 0) {
            $where[]='o.client_user_id=?'; $params[]=$scope['userId'];
        } else {
            $where[]='o.client_phone=?'; $params[]=$scope['phone'];
        }
    } elseif (in_array($role, ['admin','owner'], true)) {
        if (!empty($b['masterId'])) { $where[]='BINARY o.master_id=BINARY ?'; $params[]=(string)$b['masterId']; }
        if (!empty($b['stoId'])) { $where[]='BINARY o.sto_id=BINARY ?'; $params[]=(string)$b['stoId']; }
        if (!empty($b['clientId'])) { $where[]='o.client_id=?'; $params[]=(string)$b['clientId']; }
    } else {
        kareta_json(['ok'=>false,'error'=>'forbidden_order_list'],403);
    }

    if (!empty($b['status'])&&$b['status']!=='all'){ $where[]='o.status=?'; $params[]=$b['status']; }
    if (!empty($b['q'])) {
        $q='%'.$b['q'].'%';
        $where[]='(o.client_name LIKE ? OR o.service_names LIKE ? OR o.id LIKE ? OR o.client_phone LIKE ?)';
        array_push($params,$q,$q,$q,$q);
    }
    $sql = "SELECT o.*, (SELECT c.id FROM `chats` c WHERE BINARY c.order_id=BINARY o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o".($where?' WHERE '.implode(' AND ',$where):'')." ORDER BY o.created_at DESC";
    $st=$pdo->prepare($sql); $st->execute($params);
    kareta_json(['ok'=>true,'orders'=>array_map('_fmt_order',$st->fetchAll())]);
}

function orders_get(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $st=$pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1"); $st->execute([$b['id']??'']);
    $row=$st->fetch(); if(!$row) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    kareta_assert_order_access($pdo, $row, false);
    kareta_json(['ok'=>true,'order'=>_fmt_order($row)]);
}

function kareta_ensure_parts_request_flow(PDO $pdo): void {
    try { kareta_ensure_column($pdo, 'orders', 'parts_request_json', "ALTER TABLE `orders` ADD COLUMN `parts_request_json` TEXT NULL AFTER `notes`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_request_status', "ALTER TABLE `orders` ADD COLUMN `parts_request_status` VARCHAR(32) NOT NULL DEFAULT '' AFTER `parts_request_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_offer_json', "ALTER TABLE `orders` ADD COLUMN `parts_offer_json` TEXT NULL AFTER `parts_request_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_offer_status', "ALTER TABLE `orders` ADD COLUMN `parts_offer_status` VARCHAR(32) NOT NULL DEFAULT '' AFTER `parts_offer_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_offer_total', "ALTER TABLE `orders` ADD COLUMN `parts_offer_total` INT NOT NULL DEFAULT 0 AFTER `parts_offer_status`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_offer_note', "ALTER TABLE `orders` ADD COLUMN `parts_offer_note` TEXT NULL AFTER `parts_offer_total`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_vin', "ALTER TABLE `orders` ADD COLUMN `parts_vin` VARCHAR(32) NOT NULL DEFAULT '' AFTER `parts_request_status`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_oem', "ALTER TABLE `orders` ADD COLUMN `parts_oem` VARCHAR(120) NOT NULL DEFAULT '' AFTER `parts_vin`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_requested_name', "ALTER TABLE `orders` ADD COLUMN `parts_requested_name` VARCHAR(255) NOT NULL DEFAULT '' AFTER `parts_oem`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_maker_preference', "ALTER TABLE `orders` ADD COLUMN `parts_maker_preference` VARCHAR(32) NOT NULL DEFAULT '' AFTER `parts_requested_name`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_qty', "ALTER TABLE `orders` ADD COLUMN `parts_qty` INT NOT NULL DEFAULT 1 AFTER `parts_maker_preference`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'parts_urgency', "ALTER TABLE `orders` ADD COLUMN `parts_urgency` VARCHAR(32) NOT NULL DEFAULT '' AFTER `parts_qty`"); } catch (Throwable $_) {}
    $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_request_offers` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `order_id` VARCHAR(64) NOT NULL,
        `source_part_id` VARCHAR(64) NULL DEFAULT NULL,
        `sku` VARCHAR(120) NULL DEFAULT NULL,
        `oem` VARCHAR(120) NULL DEFAULT NULL,
        `name` VARCHAR(255) NULL DEFAULT NULL,
        `brand` VARCHAR(120) NULL DEFAULT NULL,
        `price_label` VARCHAR(120) NULL DEFAULT NULL,
        `supplier_label` VARCHAR(255) NULL DEFAULT NULL,
        `score` INT NOT NULL DEFAULT 0,
        `status` VARCHAR(32) NOT NULL DEFAULT 'draft',
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY `idx_parts_request_offers_order` (`order_id`),
        KEY `idx_parts_request_offers_oem` (`oem`),
        KEY `idx_parts_request_offers_sku` (`sku`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_clean_parts_request_payload(array $o): array {
    $raw = $o['partsRequest'] ?? $o['parts_request'] ?? [];
    $req = is_array($raw) ? $raw : [];
    $vin = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string)($o['partsVin'] ?? $o['vin'] ?? ($req['vin'] ?? ''))));
    $vin = substr(str_replace(['I','O','Q'], '', $vin), 0, 17);
    $maker = preg_replace('/[^a-z0-9_\-]/i', '', (string)($o['partsMakerPreference'] ?? ($req['makerPreference'] ?? 'any')));
    if ($maker === '') $maker = 'any';
    $qty = max(1, min(99, (int)($o['partsQty'] ?? ($req['qty'] ?? 1))));
    $urgency = preg_replace('/[^a-z0-9_\-]/i', '', (string)($o['partsUrgency'] ?? ($req['urgency'] ?? 'normal')));
    if ($urgency === '') $urgency = 'normal';
    $out = [
        'flow' => 'vin_oem_analogs_suppliers_offer',
        'status' => kareta_clean_text($o['partsRequestStatus'] ?? ($req['status'] ?? 'intake'), 32),
        'requestedPart' => kareta_clean_text($o['partsRequestedName'] ?? ($req['requestedPart'] ?? ''), 255),
        'vin' => $vin,
        'car' => kareta_clean_text($o['clientCar'] ?? ($req['car'] ?? ''), 160),
        'oemKnown' => kareta_clean_text($o['partsOem'] ?? ($req['oemKnown'] ?? ''), 120),
        'makerPreference' => kareta_clean_text($maker, 32),
        'makerLabel' => kareta_clean_text($req['makerLabel'] ?? '', 120),
        'qty' => $qty,
        'urgency' => kareta_clean_text($urgency, 32),
        'localOffers' => []
    ];
    $offers = $req['localOffers'] ?? [];
    if (is_array($offers)) {
        foreach (array_slice($offers, 0, 12) as $offer) {
            if (!is_array($offer)) continue;
            $out['localOffers'][] = [
                'id' => kareta_clean_text($offer['id'] ?? '', 64),
                'sku' => kareta_clean_text($offer['sku'] ?? '', 120),
                'oem' => kareta_clean_text($offer['oem'] ?? '', 120),
                'name' => kareta_clean_text($offer['name'] ?? '', 255),
                'brand' => kareta_clean_text($offer['brand'] ?? '', 120),
                'price' => kareta_clean_text($offer['price'] ?? '', 120),
                'supplier' => kareta_clean_text($offer['supplier'] ?? '', 255),
                'score' => (int)($offer['score'] ?? 0),
            ];
        }
    }
    return $out;
}

function kareta_sync_parts_request_offers(PDO $pdo, string $orderId, array $req): void {
    kareta_ensure_parts_request_flow($pdo);
    $pdo->prepare("DELETE FROM `parts_request_offers` WHERE order_id=? AND status='draft'")->execute([$orderId]);
    $offers = $req['localOffers'] ?? [];
    if (!is_array($offers) || !$offers) return;
    $st = $pdo->prepare("INSERT INTO `parts_request_offers`(id,order_id,source_part_id,sku,oem,name,brand,price_label,supplier_label,score,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW())");
    foreach (array_slice($offers, 0, 12) as $idx => $offer) {
        if (!is_array($offer)) continue;
        $id = 'pro_' . substr(md5($orderId . '|' . ($offer['id'] ?? '') . '|' . ($offer['sku'] ?? '') . '|' . $idx), 0, 20);
        $st->execute([
            $id, $orderId,
            kareta_clean_text($offer['id'] ?? '', 64),
            kareta_clean_text($offer['sku'] ?? '', 120),
            kareta_clean_text($offer['oem'] ?? '', 120),
            kareta_clean_text($offer['name'] ?? '', 255),
            kareta_clean_text($offer['brand'] ?? '', 120),
            kareta_clean_text($offer['price'] ?? '', 120),
            kareta_clean_text($offer['supplier'] ?? '', 255),
            (int)($offer['score'] ?? 0),
            'draft'
        ]);
    }
}


function kareta_clean_parts_offer_payload(array $b): array {
    $raw = $b['offer'] ?? $b['partsOffer'] ?? [];
    if (!is_array($raw)) $raw = [];
    $itemsRaw = $raw['items'] ?? $b['items'] ?? [];
    if (!is_array($itemsRaw)) $itemsRaw = [];
    $items = [];
    $total = 0;
    foreach ($itemsRaw as $idx => $it) {
        if (!is_array($it)) continue;
        $name = kareta_clean_text($it['name'] ?? $it['part'] ?? '', 255);
        if ($name === '') continue;
        $qty = max(1, (int)($it['qty'] ?? 1));
        $price = max(0, (int)preg_replace('/\D+/', '', (string)($it['price'] ?? $it['priceValue'] ?? 0)));
        $lineTotal = $qty * $price;
        $total += $lineTotal;
        $items[] = [
            'name' => $name,
            'oem' => kareta_clean_text($it['oem'] ?? '', 120),
            'sku' => kareta_clean_text($it['sku'] ?? '', 120),
            'brand' => kareta_clean_text($it['brand'] ?? $it['manufacturer'] ?? '', 120),
            'tier' => kareta_clean_text($it['tier'] ?? 'analog', 32),
            'supplier' => kareta_clean_text($it['supplier'] ?? '', 120),
            'deliveryEta' => kareta_clean_text($it['deliveryEta'] ?? $it['eta'] ?? '', 80),
            'stock' => kareta_clean_text($it['stock'] ?? '', 80),
            'qty' => $qty,
            'price' => $price,
            'priceLabel' => $price > 0 ? number_format($price, 0, '.', ' ') . ' ₸' : kareta_clean_text($it['priceLabel'] ?? 'цена по запросу', 80),
            'lineTotal' => $lineTotal,
            'sourcePartId' => kareta_clean_text($it['sourcePartId'] ?? $it['source_part_id'] ?? '', 64),
        ];
    }
    $status = kareta_clean_text($raw['status'] ?? $b['status'] ?? 'draft', 32);
    if (!in_array($status, ['draft','sent','accepted','declined','expired'], true)) $status = 'draft';
    $confirmedOem = kareta_clean_text($raw['confirmedOem'] ?? $b['confirmedOem'] ?? '', 120);
    $note = kareta_clean_text($raw['note'] ?? $b['note'] ?? '', 2000);
    $payload = [
        'status' => $status,
        'confirmedOem' => $confirmedOem,
        'items' => $items,
        'totalPrice' => (int)$total,
        'totalLabel' => $total > 0 ? number_format($total, 0, '.', ' ') . ' ₸' : '',
        'note' => $note,
        'updatedAt' => date('Y-m-d H:i:s'),
    ];
    return $payload;
}

function parts_request_save_offer(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_parts_request_flow($pdo);
    $id = (string)($b['orderId'] ?? $b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'order_id_required'], 400);
    $actor = kareta_session_user() ?? [];
    $role = (string)($actor['role'] ?? 'guest');
    $st = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'], 404);
    if ((string)($order['type'] ?? '') !== 'parts_request') kareta_json(['ok'=>false,'error'=>'not_parts_request'], 400);
    if (!in_array($role, ['admin','owner'], true)) {
        kareta_assert_work_actor_can_mutate_order($pdo, $id, $b);
    }
    $offer = kareta_clean_parts_offer_payload($b);
    if (($offer['status'] ?? 'draft') !== 'draft' && empty($offer['items'])) {
        kareta_json(['ok'=>false,'error'=>'offer_items_required'], 400);
    }
    $offerJson = json_encode($offer, JSON_UNESCAPED_UNICODE);
    $status = (string)($offer['status'] ?? 'draft');
    $nextOrderStatus = $status === 'sent' ? 'done_pending_client' : ((string)($order['status'] ?? '') === 'new' ? 'process' : (string)($order['status'] ?? 'process'));
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE `orders` SET parts_offer_json=?, parts_offer_status=?, parts_offer_total=?, parts_offer_note=?, parts_request_status=?, status=?, updated_at=NOW() WHERE id=?")
            ->execute([$offerJson,$status,(int)($offer['totalPrice'] ?? 0),(string)($offer['note'] ?? ''),$status === 'sent' ? 'proposal_sent' : 'proposal_draft',$nextOrderStatus,$id]);
        $offerId = 'proffer_' . $id . '_' . substr(sha1($offerJson), 0, 16);
        $pdo->prepare("INSERT INTO `parts_request_client_offers`(id,order_id,offer_json,offer_status,total_price,created_by_role,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE offer_json=VALUES(offer_json),offer_status=VALUES(offer_status),total_price=VALUES(total_price),updated_at=NOW()")
            ->execute([$offerId,$id,$offerJson,$status,(int)($offer['totalPrice'] ?? 0),$role,(int)($actor['id'] ?? 0) ?: null,date('Y-m-d H:i:s')]);
        $chatSt = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
        $chatSt->execute([$id]);
        $chatId = (string)($chatSt->fetchColumn() ?: '');
        if ($chatId !== '') {
            $msgText = $status === 'sent'
                ? 'Сформировано предложение по запчастям: ' . (($offer['totalLabel'] ?? '') ?: 'стоимость уточняется')
                : 'Черновик предложения по запчастям обновлён.';
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,NOW())")
                ->execute(['msg_parts_offer_'.substr(sha1($id.$offerJson),0,18),$chatId,$id,'system',(int)($actor['id'] ?? 0) ?: null,'event',$msgText,date('H:i')]);
            if ($status === 'sent') {
                $pdo->prepare("UPDATE `chats` SET status=?, unread_client=unread_client+1 WHERE id=?")->execute([$nextOrderStatus,$chatId]);
            }
        }
        if ($status === 'sent') {
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)($order['client_user_id'] ?? 0) ?: null,
                'recipientPhone' => (string)($order['client_phone'] ?? ''),
                'recipientRole' => 'client',
                'eventType' => 'parts.offer.sent',
                'entityType' => 'order',
                'entityId' => $id,
                'title' => 'Готово предложение по запчастям ' . $id,
                'body' => 'Откройте заявку, чтобы посмотреть варианты, цену и срок поставки.',
                'actionUrl' => '#myorders',
                'meta' => ['orderId'=>$id,'orderType'=>'parts_request','total'=>(int)($offer['totalPrice'] ?? 0)],
            ]);
        }
        kareta_write_event($pdo, $id, 'parts.offer.' . $status, ['total'=>(int)($offer['totalPrice'] ?? 0),'items'=>count($offer['items'] ?? []),'role'=>$role]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('partsRequest.saveOffer', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'parts_offer_save_failed','requestId'=>KARETA_REQUEST_ID], 500);
    }
    $st2 = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1");
    $st2->execute([$id]);
    $row = $st2->fetch() ?: [];
    kareta_json(['ok'=>true,'order'=>_fmt_order($row),'offer'=>$offer]);
}

function orders_create(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $o = $b['order'] ?? $b;
    $actorUser = kareta_session_user() ?: [];
    $createScope = kareta_order_scope($pdo);
    $actorRole = kareta_normalize_role((string)($createScope['role'] ?? $actorUser['role'] ?? 'guest'));
    if ($actorRole === 'master') {
        // A master creates a client order only for himself. Browser payload cannot reassign it.
        $o['masterId'] = $createScope['masterId'];
        $o['source'] = $o['source'] ?? 'master_client_booking';
        if ($createScope['stoId'] !== '') $o['stoId'] = $createScope['stoId'];
    }
    if ($actorRole === 'client') {
        $o['clientPhone'] = (string)($actorUser['phone'] ?? '');
        $o['clientName'] = (string)($actorUser['name'] ?? '');
    }
    $clientPhone = kareta_normalize_phone((string)($o['clientPhone'] ?? ''));
    $clientName = kareta_clean_text($o['clientName'] ?? '', 160);
    if ($clientPhone === '' || $clientName === '') kareta_json(['ok'=>false,'error'=>'client_account_name_and_phone_required'],422);

    try { kareta_ensure_column($pdo, 'orders', 'service_ids', "ALTER TABLE `orders` ADD COLUMN `service_ids` VARCHAR(500) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'category', "ALTER TABLE `orders` ADD COLUMN `category` VARCHAR(64) NOT NULL DEFAULT 'service' AFTER `priority`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'source', "ALTER TABLE `orders` ADD COLUMN `source` VARCHAR(64) NOT NULL DEFAULT '' AFTER `category`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'vehicle_vin', "ALTER TABLE `orders` ADD COLUMN `vehicle_vin` VARCHAR(64) NOT NULL DEFAULT '' AFTER `vehicle_title`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'vehicle_plate', "ALTER TABLE `orders` ADD COLUMN `vehicle_plate` VARCHAR(64) NOT NULL DEFAULT '' AFTER `vehicle_vin`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'address', "ALTER TABLE `orders` ADD COLUMN `address` VARCHAR(255) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'district', "ALTER TABLE `orders` ADD COLUMN `district` VARCHAR(120) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'lat', "ALTER TABLE `orders` ADD COLUMN `lat` DECIMAL(10,7) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'lng', "ALTER TABLE `orders` ADD COLUMN `lng` DECIMAL(10,7) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'field_service', "ALTER TABLE `orders` ADD COLUMN `field_service` TINYINT(1) NOT NULL DEFAULT 0"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'route_url', "ALTER TABLE `orders` ADD COLUMN `route_url` VARCHAR(500) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'map_provider', "ALTER TABLE `orders` ADD COLUMN `map_provider` VARCHAR(32) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'distance_km', "ALTER TABLE `orders` ADD COLUMN `distance_km` DECIMAL(8,2) NULL DEFAULT NULL"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'sto_id', "ALTER TABLE `orders` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `master_name`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'sto_name', "ALTER TABLE `orders` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `sto_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'service_offer_id', "ALTER TABLE `orders` ADD COLUMN `service_offer_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `service_names`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'service_offer_price', "ALTER TABLE `orders` ADD COLUMN `service_offer_price` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `service_offer_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'orders', 'service_offer_price_type', "ALTER TABLE `orders` ADD COLUMN `service_offer_price_type` VARCHAR(24) NOT NULL DEFAULT '' AFTER `service_offer_price`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'chats', 'sto_id', "ALTER TABLE `chats` ADD COLUMN `sto_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'chats', 'sto_user_id', "ALTER TABLE `chats` ADD COLUMN `sto_user_id` INT NULL DEFAULT NULL AFTER `sto_id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'chats', 'unread_sto', "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0"); } catch (Throwable $_) {}
    try { kareta_ensure_parts_request_flow($pdo); } catch (Throwable $_) {}

    $stoOrderId = '';
    $stoOrderName = '';
    $stoOrderUserId = null;
    $requestedStoId = trim((string)($b['stoId'] ?? $o['stoId'] ?? $o['sto_id'] ?? ''));
    if ($actorRole === 'master' && $createScope['stoId'] !== '') {
        $stStoOrder = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE BINARY id=BINARY ? AND active=1 LIMIT 1");
        $stStoOrder->execute([$createScope['stoId']]);
        $stoOrder = $stStoOrder->fetch(PDO::FETCH_ASSOC) ?: [];
        $stoOrderId = (string)($stoOrder['id'] ?? '');
        $stoOrderName = (string)($stoOrder['name'] ?? 'СТО');
        $stoOrderUserId = ((int)($stoOrder['user_id'] ?? 0) ?: null);
    } elseif ($actorRole === 'sto') {
        $stoOrder = kareta_resolve_current_sto($pdo, $actorUser, $b);
        $stoOrderId = (string)($stoOrder['id'] ?? '');
        $stoOrderName = (string)($stoOrder['name'] ?? 'СТО');
        $stoOrderUserId = ((int)($stoOrder['user_id'] ?? ($actorUser['id'] ?? 0)) ?: null);
    } elseif ($actorRole === 'client' && $requestedStoId !== '') {
        $stStoOrder = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE BINARY id=BINARY ? AND active=1 LIMIT 1");
        $stStoOrder->execute([$requestedStoId]);
        $stoOrder = $stStoOrder->fetch(PDO::FETCH_ASSOC) ?: [];
        if (!$stoOrder) kareta_json(['ok'=>false,'error'=>'sto_not_found','message'=>'Выбранное СТО недоступно'],404);
        $stoOrderId = (string)($stoOrder['id'] ?? '');
        $stoOrderName = (string)($stoOrder['name'] ?? 'СТО');
        $stoOrderUserId = ((int)($stoOrder['user_id'] ?? 0) ?: null);
    } elseif (in_array($actorRole, ['admin','owner'], true) && $requestedStoId !== '') {
        $stStoOrder = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE id=? AND active=1 LIMIT 1");
        $stStoOrder->execute([$requestedStoId]);
        $stoOrder = $stStoOrder->fetch(PDO::FETCH_ASSOC) ?: [];
        if (!$stoOrder) kareta_json(['ok'=>false,'error'=>'sto_not_found'],404);
        $stoOrderId = (string)($stoOrder['id'] ?? '');
        $stoOrderName = (string)($stoOrder['name'] ?? 'СТО');
        $stoOrderUserId = ((int)($stoOrder['user_id'] ?? 0) ?: null);
    }
    if ($stoOrderId !== '') {
        $o['stoId'] = $stoOrderId;
        $o['stoName'] = $stoOrderName;
        if (empty($o['status']) || in_array((string)$o['status'], ['new','waiting_responses'], true)) $o['status'] = 'process';
        if (empty($o['source'])) $o['source'] = 'sto_client_card';
    }
    // ── Защита от дубликатов: проверяем активные заявки этого клиента ─────────
    // Не создаём новую заявку если у клиента есть незавершённая (new/process)
    // за последние 30 минут с тем же телефоном. Предотвращает двойной сабмит.
    // Умная проверка дублей (vehicle + category + type)
    $vehicleId = trim((string)($o['vehicleId'] ?? $o['vehicle_id'] ?? $o['clientVehicleId'] ?? $o['client_vehicle_id'] ?? ''));
    $type      = trim((string)($o['type']       ?? 'service_order'));
    $serviceSig = '';
    if (isset($o['serviceIds']) && is_array($o['serviceIds'])) {
        $ids = array_values(array_filter(array_map('strval', $o['serviceIds']))); sort($ids); $serviceSig = $ids ? json_encode($ids, JSON_UNESCAPED_UNICODE) : '';
        if ($serviceSig === '' && trim((string)($o['serviceNames'] ?? '')) !== '') $serviceSig = mb_substr(trim((string)$o['serviceNames']),0,191,'UTF-8');
    } elseif (isset($o['service_ids'])) { $serviceSig = trim((string)$o['service_ids']);
    } elseif (isset($o['cartItems']) && is_array($o['cartItems'])) { $serviceSig = substr(md5(json_encode($o['cartItems'], JSON_UNESCAPED_UNICODE)),0,16);
    } elseif (isset($o['cart_items']) && is_array($o['cart_items'])) { $serviceSig = substr(md5(json_encode($o['cart_items'], JSON_UNESCAPED_UNICODE)),0,16); }
    $dupParams = [$clientPhone];
    $dupWhere  = "client_phone=? AND status IN ('new','waiting_responses','process') AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)";
    if ($stoOrderId !== '') { $dupWhere .= " AND COALESCE(sto_id,'')=?"; $dupParams[] = $stoOrderId; }
    if ($vehicleId) { $dupWhere .= " AND (client_vehicle_id=? OR client_vehicle_id='' OR client_vehicle_id IS NULL)"; $dupParams[] = $vehicleId; }
    if ($type)      { $dupWhere .= " AND type=?"; $dupParams[] = $type; }
    if ($serviceSig !== '') { $dupWhere .= " AND (service_ids=? OR service_names LIKE ?)"; $dupParams[] = $serviceSig; $dupParams[] = '%'.$serviceSig.'%'; }
    $stDup = $pdo->prepare("SELECT id FROM `orders` WHERE {$dupWhere} ORDER BY created_at DESC LIMIT 1");
    $stDup->execute($dupParams);
    $dupId = $stDup->fetchColumn();
    if ($dupId && empty($b['force'])) {
        // Возвращаем существующую заявку — не создаём новую
        $stExist = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
        $stExist->execute([$dupId]);
        $existOrder = $stExist->fetch();
        kareta_json(['ok'=>true,'order'=>_fmt_order($existOrder),'duplicate'=>true,'message'=>'Активная заявка уже существует'], 200);
    }

    // ── Resolve / create user account BEFORE the transaction ─────────────────
    // kareta_upsert_profile использует ON DUPLICATE KEY UPDATE, но при race condition
    // PDO может бросить SQLSTATE 23000 внутри транзакции, «отравив» её. Вынесение
    // resolve-логики ДО beginTransaction() устраняет эту проблему полностью.
    $requestedClientId = trim((string)($o['clientId'] ?? ''));
    $clientId = '';
    $clientUserId = kareta_user_id_by_phone($pdo, $clientPhone);
    if ($clientUserId <= 0) {
        try {
            $profile = kareta_upsert_profile($pdo, ['phone'=>$clientPhone,'name'=>$clientName,'car'=>$o['clientCar'] ?? '']);
            $clientUserId = (int)($profile['id'] ?? 0);
        } catch (PDOException $dupEx) {
            if ((int)$dupEx->getCode() === 23000 || strpos($dupEx->getMessage(), '1062') !== false) {
                $clientUserId = kareta_user_id_by_phone($pdo, $clientPhone);
                if ($clientUserId <= 0) kareta_json(['ok'=>false,'error'=>'client_resolve_failed','requestId'=>KARETA_REQUEST_ID],500);
            } else {
                throw $dupEx;
            }
        }
    }
    // Never trust clientId from the browser. Resolve the canonical client card
    // from the selected person's account/phone before any upsert can touch it.
    $knownClientId = '';
    $stKnownClient = $pdo->prepare("SELECT id FROM `clients` WHERE (user_id=? AND ?>0) OR (?<>'' AND user_phone=?) OR (?<>'' AND phone=?) ORDER BY (user_id=? AND ?>0) DESC LIMIT 1");
    $stKnownClient->execute([$clientUserId,$clientUserId,$clientPhone,$clientPhone,$clientPhone,$clientPhone,$clientUserId,$clientUserId]);
    $knownClientId = (string)($stKnownClient->fetchColumn() ?: '');
    if ($actorRole === 'client') {
        $clientId = $knownClientId !== '' ? $knownClientId : ('cl_' . substr(md5($clientPhone), 0, 12));
    } elseif ($requestedClientId !== '') {
        $stRequestedClient = $pdo->prepare("SELECT id,user_id,user_phone,phone FROM `clients` WHERE BINARY id=BINARY ? LIMIT 1");
        $stRequestedClient->execute([$requestedClientId]);
        $requestedClient = $stRequestedClient->fetch(PDO::FETCH_ASSOC) ?: null;
        if ($requestedClient) {
            $requestedUserId = (int)($requestedClient['user_id'] ?? 0);
            $requestedUserPhone = kareta_normalize_phone((string)($requestedClient['user_phone'] ?? ''));
            $requestedPhone = kareta_normalize_phone((string)($requestedClient['phone'] ?? ''));
            $sameClient = ($clientUserId > 0 && $requestedUserId === $clientUserId)
                || ($clientPhone !== '' && ($requestedUserPhone === $clientPhone || $requestedPhone === $clientPhone));
            if (!$sameClient) kareta_json(['ok'=>false,'error'=>'client_scope_mismatch','message'=>'Карточка клиента не соответствует указанному номеру телефона'],403);
            $clientId = $requestedClientId;
        } else {
            $clientId = $knownClientId !== '' ? $knownClientId : ('cl_' . substr(md5($clientPhone), 0, 12));
        }
    } else {
        $clientId = $knownClientId !== '' ? $knownClientId : ('cl_' . substr(md5($clientPhone), 0, 12));
    }
    $o['clientId'] = $clientId;
    // ─────────────────────────────────────────────────────────────────────────

    try { kareta_ensure_order_events_table($pdo); } catch (Throwable $_) {}

    $pdo->beginTransaction();
    try {
        if($actorRole==='client')kareta_tariff_client_guard($pdo,'activeRequests',$clientUserId,$clientPhone,true);
        $num = (int)$pdo->query("SELECT COALESCE(MAX(num),42)+1 FROM `orders`")->fetchColumn();
        $id  = 'ORD-'.str_pad((string)$num, 3, '0', STR_PAD_LEFT);
    $clientVehicleId = trim((string)($o['clientVehicleId'] ?? $o['vehicleId'] ?? ''));
    $vehicleTitle = kareta_clean_text($o['vehicleTitle'] ?? '', 191);
        if ($clientVehicleId !== '') {
            // A browser supplied vehicle ID is valid only inside this client's scope.
            $stVehicle = $pdo->prepare("SELECT * FROM `client_vehicles` WHERE BINARY id=BINARY ? AND active=1 AND ((user_id=? AND ?>0) OR (?<>'' AND user_phone=?) OR (?<>'' AND client_id=?)) LIMIT 1");
            $stVehicle->execute([$clientVehicleId,$clientUserId,$clientUserId,$clientPhone,$clientPhone,$clientId,$clientId]);
            $vehicleRow = $stVehicle->fetch(PDO::FETCH_ASSOC) ?: null;
            if (!$vehicleRow) { if($pdo->inTransaction())$pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'client_vehicle_forbidden','message'=>'Выбранный автомобиль не принадлежит клиенту'],403); }
            $vehicleTitle = trim((string)($vehicleRow['title'] ?? '')) ?: trim((string)($o['clientCar'] ?? ''));
            $o['clientCar'] = $vehicleTitle;
        }
        $clientCarValue = kareta_clean_text($o['clientCar'] ?? $vehicleTitle, 160);
        $orderAddress = kareta_clean_text($o['address'] ?? '', 255);
        $orderDistrict = kareta_clean_text($o['district'] ?? $o['area'] ?? '', 120);
        $orderLat = isset($o['lat']) && $o['lat'] !== '' ? round((float)$o['lat'], 7) : null;
        $orderLng = isset($o['lng']) && $o['lng'] !== '' ? round((float)$o['lng'], 7) : null;
        $fieldService = !empty($o['fieldService']) || !empty($o['field_service']) || (($o['workFormat'] ?? $o['work_format'] ?? '') === 'field') ? 1 : 0;
        $routeUrl = kareta_clean_text($o['routeUrl'] ?? $o['route_url'] ?? '', 500);
        $mapProvider = kareta_clean_text($o['mapProvider'] ?? $o['map_provider'] ?? '', 32);
        $distanceKm = isset($o['distanceKm']) && $o['distanceKm'] !== '' ? round((float)$o['distanceKm'], 2) : null;

        // user_phone: храним NULL если пустая строка — UNIQUE KEY не конфликтует по NULL
        $clientUserPhone = $clientPhone !== '' ? $clientPhone : null;
        $pdo->prepare("INSERT INTO `clients`(id,user_id,user_phone,name,phone,car,notes,created_at) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=COALESCE(VALUES(user_id),user_id), user_phone=COALESCE(VALUES(user_phone),user_phone), name=VALUES(name), phone=VALUES(phone), car=VALUES(car), notes=VALUES(notes)")
            ->execute([$clientId, $clientUserId ?: null, $clientUserPhone, $clientName, $clientPhone, $clientCarValue, kareta_clean_text($o['notes'] ?? '', 1000), date('Y-m-d')]);

        $masterIdRaw = (string)($o['masterId'] ?? '');
        if ($actorRole === 'master') $masterIdRaw = (string)$createScope['masterId'];
        if ($actorRole === 'sto' && $masterIdRaw !== '' && $masterIdRaw !== '0') {
            $stAllowedMaster = $pdo->prepare("SELECT 1 FROM `sto_master_links` WHERE BINARY sto_id=BINARY ? AND BINARY master_id=BINARY ? AND status='active' LIMIT 1");
            $stAllowedMaster->execute([$stoOrderId, $masterIdRaw]);
            if (!$stAllowedMaster->fetchColumn()) kareta_json(['ok'=>false,'error'=>'master_not_linked_to_sto'],403);
        }
        $assignedAdminUserId = (int)(kareta_session_user()['id'] ?? 0) ?: null;
        $masterId = ($masterIdRaw === '' || $masterIdRaw === '0') ? '0' : $masterIdRaw;
        $masterDbId = null;
        $masterUserId = 0;
        $masterName = 'Администрация';
        if ($masterId !== '0') {
            $stMaster = $pdo->prepare("SELECT m.id,m.name,COALESCE(m.user_id,u.id) AS user_id FROM `masters` m LEFT JOIN `users` u ON u.id=m.user_id OR u.phone=m.user_phone WHERE BINARY m.id=BINARY ? AND COALESCE(m.active,1)=1 LIMIT 1");
            $stMaster->execute([$masterId]);
            $masterRow = $stMaster->fetch(PDO::FETCH_ASSOC) ?: [];
            if (!$masterRow) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                kareta_json(['ok'=>false,'error'=>'master_not_available','message'=>'Выбранный мастер больше недоступен. Выберите другого мастера или отправьте заявку на Биржу.'],422);
            }
            $masterDbId = (string)$masterRow['id'];
            $masterUserId = (int)($masterRow['user_id'] ?? 0);
            $masterName = (string)($masterRow['name'] ?? ($o['masterName'] ?? '—'));
        }
        $status = in_array((string)($o['status'] ?? 'new'), ['new','waiting_responses','process','done_pending_client','done','cancelled','dispute'], true) ? (string)($o['status'] ?? 'new') : 'new';
        $type = in_array((string)($o['type'] ?? 'service_order'), ['service_order','parts_request'], true) ? (string)($o['type'] ?? 'service_order') : 'service_order';
        $deferred = !empty($o['deferred']) ? 1 : 0;
        $serviceIds = array_values(array_unique(array_filter(array_map(static fn($v) => trim((string)$v), (array)($o['serviceIds'] ?? [])), static fn($v) => $v !== '')));
        $verifiedOfferId = null;
        $verifiedOfferPrice = 0.0;
        $verifiedOfferPriceType = '';
        $requestedOfferId = (int)($o['offerId'] ?? $o['offer_id'] ?? 0);
        if ($actorRole === 'client' && $requestedOfferId > 0) {
            $stSelectedOffer = $pdo->prepare("SELECT id,service_id,owner_type,owner_entity_id,price,price_type,price_max FROM `service_offers` WHERE id=? AND active=1 AND booking_enabled=1 AND availability_status<>'paused' AND moderation_status='approved' LIMIT 1");
            $stSelectedOffer->execute([$requestedOfferId]);
            $selectedOffer = $stSelectedOffer->fetch(PDO::FETCH_ASSOC) ?: [];
            if (!$selectedOffer) kareta_json(['ok'=>false,'error'=>'service_offer_unavailable','message'=>'Выбранное предложение больше недоступно'],422);
            $offerServiceId = trim((string)($selectedOffer['service_id'] ?? ''));
            if ($offerServiceId === '' || !in_array($offerServiceId,$serviceIds,true)) kareta_json(['ok'=>false,'error'=>'service_offer_service_mismatch','message'=>'Предложение не соответствует выбранной услуге'],422);
            $offerOwnerType = strtolower(trim((string)($selectedOffer['owner_type'] ?? '')));
            $offerOwnerId = trim((string)($selectedOffer['owner_entity_id'] ?? ''));
            if ($offerOwnerType === 'sto') {
                if ($stoOrderId === '' || $offerOwnerId !== $stoOrderId) kareta_json(['ok'=>false,'error'=>'service_offer_provider_mismatch','message'=>'Предложение не принадлежит выбранному СТО'],422);
            } elseif ($offerOwnerType === 'master') {
                if ($masterId === '0' || $offerOwnerId !== $masterId) kareta_json(['ok'=>false,'error'=>'service_offer_provider_mismatch','message'=>'Предложение не принадлежит выбранному мастеру'],422);
            } else {
                kareta_json(['ok'=>false,'error'=>'service_offer_provider_invalid','message'=>'Для прямой записи нужен offer СТО или мастера'],422);
            }
            $verifiedOfferId = (int)$selectedOffer['id'];
            $verifiedOfferPrice = max(0,(float)($selectedOffer['price'] ?? 0));
            $verifiedOfferPriceType = trim((string)($selectedOffer['price_type'] ?? 'fixed'));
        }
        $dateValue = trim((string)($o['date'] ?? ''));
        $timeValue = trim((string)($o['time'] ?? ''));
        $timeMode = (string)($o['timeMode'] ?? 'exact');
        if (!in_array($timeMode, ['exact','nearest','call_me'], true)) $timeMode = 'exact';
        $serviceNames = trim((string)($o['serviceNames'] ?? ''));
        if ($serviceNames === '' && $serviceIds) {
            try {
                $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
                $stServices = $pdo->prepare("SELECT id, name FROM `service_catalog` WHERE id IN ($placeholders)");
                $stServices->execute($serviceIds);
                $serviceMap = [];
                foreach (($stServices->fetchAll() ?: []) as $serviceRow) {
                    $serviceMap[(string)($serviceRow['id'] ?? '')] = trim((string)($serviceRow['name'] ?? ''));
                }
                $resolvedNames = [];
                foreach ($serviceIds as $sid) {
                    $name = trim((string)($serviceMap[$sid] ?? ''));
                    if ($name !== '') $resolvedNames[] = $name;
                }
                if ($resolvedNames) $serviceNames = implode(', ', $resolvedNames);
            } catch (Throwable $_e) {
            }
        }
        $resolvedOrderPrice = max(0, (int)($o['price'] ?? 0));
        if ($type === 'service_order' && $serviceIds) {
            $placeholders = implode(',', array_fill(0, count($serviceIds), '?'));
            $serviceCatalogRows = [];
            try {
                $stCatalog = $pdo->prepare("SELECT id,name,base_price FROM `service_catalog` WHERE active=1 AND id IN ($placeholders)");
                $stCatalog->execute($serviceIds);
                foreach (($stCatalog->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
                    $serviceCatalogRows[(string)$row['id']] = $row;
                }
            } catch (Throwable $_e) {}
            if (count($serviceCatalogRows) !== count($serviceIds)) {
                kareta_json(['ok'=>false,'error'=>'invalid_service_ids','message'=>'Одна или несколько услуг отсутствуют в каталоге'], 422);
            }

            $resolvedNames = [];
            foreach ($serviceIds as $sid) $resolvedNames[] = trim((string)($serviceCatalogRows[$sid]['name'] ?? $sid));
            $submittedNames = array_values(array_filter(array_map('trim', explode(',', trim((string)($o['serviceNames'] ?? ''))))));
            foreach ($submittedNames as $submittedName) if ($submittedName !== '' && !in_array($submittedName,$resolvedNames,true)) $resolvedNames[] = $submittedName;
            $serviceNames = implode(', ', array_filter($resolvedNames));

            if (in_array($actorRole, ['master','sto'], true)) {
                $ownerType = $actorRole;
                $ownerEntityId = $actorRole === 'master' ? (string)($createScope['masterId'] ?? '') : (string)$stoOrderId;
                if ($ownerEntityId === '') kareta_json(['ok'=>false,'error'=>'role_profile_missing','message'=>'Не найден профиль исполнителя'], 409);
                $params = array_merge([$ownerType,$ownerEntityId],$serviceIds);
                $stOffers = $pdo->prepare("SELECT service_id,price,duration_min,warranty_days FROM `service_offers` WHERE owner_type=? AND BINARY owner_entity_id=BINARY ? AND active=1 AND booking_enabled=1 AND availability_status<>'paused' AND moderation_status='approved' AND service_id IN ($placeholders)");
                $stOffers->execute($params);
                $offerRows = $stOffers->fetchAll(PDO::FETCH_ASSOC) ?: [];
                if (count($offerRows) !== count($serviceIds)) {
                    kareta_json(['ok'=>false,'error'=>'service_offer_unavailable','message'=>'Выберите только активные услуги из вашего списка'], 422);
                }
                $resolvedOrderPrice = 0;
                foreach ($offerRows as $offerRow) $resolvedOrderPrice += max(0, (int)($offerRow['price'] ?? 0));
            } elseif ($actorRole === 'client') {
                if ($verifiedOfferId !== null) {
                    // Прямая запись клиента: цена берётся только из проверенного server-side offer.
                    $resolvedOrderPrice = in_array($verifiedOfferPriceType,['agreement'],true) ? 0 : (int)round($verifiedOfferPrice);
                } else {
                    // Без выбранного исполнителя цена каталога остаётся ориентиром.
                    $resolvedOrderPrice = 0;
                    foreach ($serviceIds as $sid) $resolvedOrderPrice += max(0, (int)($serviceCatalogRows[$sid]['base_price'] ?? 0));
                }
            }
        }
        if ($type === 'parts_request') {
            $dateValue = '';
            $timeValue = '';
        }
        $requiresSchedule = $type === 'service_order' && (
            !empty($o['appointmentRequired']) ||
            !empty($o['scheduleRequired']) ||
            !empty($o['bookingRequired']) ||
            (string)($o['mode'] ?? '') === 'appointment' ||
            (string)($o['source'] ?? '') === 'booking_wizard'
        );
        if ($clientName === '') kareta_json(['ok'=>false,'error'=>'client_name_required','message'=>'Укажите имя клиента'], 400);
        if ($clientPhone === '' || strlen(preg_replace('/\D+/', '', $clientPhone)) < 10) kareta_json(['ok'=>false,'error'=>'client_phone_required','message'=>'Укажите корректный телефон'], 400);
        $customServiceNames = trim((string)($o['serviceNames'] ?? ''));
        if ($type === 'service_order' && !$serviceIds && $customServiceNames === '') kareta_json(['ok'=>false,'error'=>'service_required','message'=>'Выберите или опишите хотя бы одну услугу'], 400);
        if ($requiresSchedule && $dateValue === '') kareta_json(['ok'=>false,'error'=>'date_required','message'=>'Укажите дату записи'], 400);
        if ($requiresSchedule && $timeMode === 'exact' && $timeValue === '') kareta_json(['ok'=>false,'error'=>'time_required','message'=>'Укажите время записи'], 400);
        if ($type === 'service_order' && $timeMode !== 'exact') $timeValue = '';
        $orderCategory = kareta_clean_text($o['category'] ?? ($type === 'parts_request' ? 'parts' : 'service'), 64);
        if ($orderCategory === '') $orderCategory = $type === 'parts_request' ? 'parts' : 'service';
        $orderSource = kareta_clean_text($o['source'] ?? '', 64);
        if($masterId!=='0'){
            $quotaDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',$dateValue)?$dateValue:date('Y-m-d');
            kareta_tariff_master_guard($pdo,$masterId,$quotaDate,'',true);
        }

        $vehicleTitleResolved = trim((string)$vehicleTitle);
        if ($vehicleTitleResolved === '' && $clientVehicleId !== '') {
            try {
                $stVehicle = $pdo->prepare("SELECT title, brand, model FROM `client_vehicles` WHERE id=? LIMIT 1");
                $stVehicle->execute([$clientVehicleId]);
                $vehicleRow = $stVehicle->fetch() ?: [];
                $vehicleTitleResolved = trim((string)($vehicleRow['title'] ?? ''));
                if ($vehicleTitleResolved === '') {
                    $vehicleTitleResolved = trim(implode(' ', array_filter([
                        trim((string)($vehicleRow['brand'] ?? '')),
                        trim((string)($vehicleRow['model'] ?? ''))
                    ])));
                }
            } catch (Throwable $_e) {
            }
        }
        if ($vehicleTitleResolved === '') $vehicleTitleResolved = $clientCarValue;
        if ($serviceNames === '') $serviceNames = trim((string)($o['notes'] ?? ''));
        $partsRequestPayload = $type === 'parts_request' ? kareta_clean_parts_request_payload($o) : [];
        if ($type === 'parts_request' && $partsRequestPayload['requestedPart'] === '') $partsRequestPayload['requestedPart'] = kareta_clean_text($serviceNames ?: ($o['notes'] ?? ''), 255);
        $partsRequestJson = $type === 'parts_request' ? json_encode($partsRequestPayload, JSON_UNESCAPED_UNICODE) : null;

        $pdo->prepare("INSERT INTO `orders`
            (id,num,type,status,priority,category,source,deferred,client_id,client_user_id,client_vehicle_id,vehicle_title,vehicle_vin,vehicle_plate,client_name,client_phone,client_car,address,district,lat,lng,field_service,route_url,map_provider,distance_km,
             master_id,master_user_id,assigned_admin_user_id,master_name,sto_id,sto_name,service_ids,service_names,price,date,time,time_mode,notes,parts_request_json,parts_request_status,parts_vin,parts_oem,parts_requested_name,parts_maker_preference,parts_qty,parts_urgency,stages,reports,created_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([
                $id,
                $num,
                $type,
                $status,
                in_array((string)($o['priority'] ?? 'normal'), ['low','normal','high','urgent'], true) ? (string)($o['priority'] ?? 'normal') : 'normal',
                $orderCategory,
                $orderSource,
                $deferred,
                $clientId,
                $clientUserId ?: null,
                $clientVehicleId ?: null,
                $vehicleTitleResolved,
                kareta_clean_text($o['vehicleVin'] ?? $o['vehicle_vin'] ?? '', 64),
                kareta_clean_text($o['vehiclePlate'] ?? $o['vehicle_plate'] ?? '', 64),
                $clientName,
                $clientPhone,
                kareta_clean_text($vehicleTitleResolved, 160),
                $orderAddress ?: null,
                $orderDistrict ?: null,
                $orderLat,
                $orderLng,
                $fieldService,
                $routeUrl ?: null,
                $mapProvider ?: null,
                $distanceKm,
                $masterDbId,
                $masterUserId ?: null,
                $assignedAdminUserId,
                kareta_clean_text($masterName, 160),
                $stoOrderId,
                kareta_clean_text($stoOrderName, 191),
                json_encode($serviceIds, JSON_UNESCAPED_UNICODE),
                kareta_clean_text($serviceNames, 500),
                $resolvedOrderPrice,
                kareta_clean_text($o['date'] ?? '', 32),
                $timeMode === 'exact' ? kareta_clean_text($o['time'] ?? '', 32) : '',
                $timeMode,
                kareta_clean_text((string)($o['notes'] ?? ''), 2000),
                $partsRequestJson,
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['status'] ?? 'intake', 32) : '',
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['vin'] ?? '', 32) : '',
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['oemKnown'] ?? '', 120) : '',
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['requestedPart'] ?? '', 255) : '',
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['makerPreference'] ?? 'any', 32) : '',
                $type === 'parts_request' ? (int)($partsRequestPayload['qty'] ?? 1) : 1,
                $type === 'parts_request' ? kareta_clean_text($partsRequestPayload['urgency'] ?? 'normal', 32) : '',
                '[]','[]',
                kareta_normalize_datetime_value($o['createdAt'] ?? '', 'now')
            ]);
        if ($verifiedOfferId !== null) {
            $pdo->prepare("UPDATE `orders` SET service_offer_id=?,service_offer_price=?,service_offer_price_type=?,price=? WHERE BINARY id=BINARY ?")
                ->execute([$verifiedOfferId,$verifiedOfferPrice,$verifiedOfferPriceType,$resolvedOrderPrice,$id]);
        }
        if($masterId!=='0'){
            $pdo->prepare("UPDATE orders SET accepted_at=COALESCE(accepted_at,NOW()) WHERE BINARY id=BINARY ?")->execute([$id]);
            kareta_tariff_record_master_acceptance($pdo,$masterId,$id,date('Y-m-d'),'order_create_assigned');
        }
        if ($status === 'waiting_responses' && kareta_column_exists($pdo,'orders','exchange_published_at')) {
            $budgetFrom=max(0,(float)($o['budgetFrom'] ?? $o['budget_from'] ?? 0));
            $budgetTo=max($budgetFrom,(float)($o['budgetTo'] ?? $o['budget_to'] ?? $resolvedOrderPrice ?? 0));
            $pdo->prepare("UPDATE `orders` SET exchange_status='open',exchange_round=1,exchange_published_at=NOW(),exchange_deadline_at=DATE_ADD(NOW(),INTERVAL 3 DAY),exchange_max_responses=20,exchange_budget_from=?,exchange_budget_to=? WHERE id=?")->execute([$budgetFrom,$budgetTo,$id]);
        }
        $pdo->prepare("UPDATE `clients` SET orders_count=orders_count+1 WHERE id=?")->execute([$clientId]);
        if ($stoOrderId !== '') {
            try { kareta_link_sto_client($pdo, $stoOrderId, $clientId, $clientPhone, 'order_create'); } catch (Throwable $_e) {}
        }
        if ($type === 'parts_request') {
            try { kareta_sync_parts_request_offers($pdo, $id, $partsRequestPayload); } catch (Throwable $_e) {}
        }

        $clientInit = 'К';
        $nameParts = preg_split('/\s+/u', trim($clientName)) ?: [];
        if ($nameParts) {
            $letters = [];
            foreach ($nameParts as $part) {
                $part = trim((string)$part);
                if ($part === '') continue;
                $letters[] = mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8');
                if (count($letters) >= 2) break;
            }
            if ($letters) $clientInit = implode('', $letters);
        }

        $masterLabel = $masterId !== '0' ? kareta_clean_text($masterName, 160) : 'Администрация';
        $masterInit = $masterId !== '0' ? 'М' : 'А';
        if ($masterId !== '0') {
            $masterParts = preg_split('/\s+/u', trim((string)$masterName)) ?: [];
            $letters = [];
            foreach ($masterParts as $part) {
                $part = trim((string)$part);
                if ($part === '') continue;
                $letters[] = mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8');
                if (count($letters) >= 2) break;
            }
            if ($letters) $masterInit = implode('', $letters);
        }

        $chatId = 'ch_'.strtolower(str_replace('-', '', $id));
        $orderTitle = kareta_clean_text((string)($o['serviceNames'] ?? ''), 500);
        if ($orderTitle === '') {
            $orderTitle = $type === 'parts_request' ? 'Запрос запчастей' : 'Заявка';
        }

        $pdo->prepare("INSERT IGNORE INTO `chats`
            (id,order_id,sto_id,sto_user_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,unread_sto)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
            ->execute([$chatId,$id,($stoOrderId !== '' ? $stoOrderId : null),$stoOrderUserId,$clientId,$clientUserId ?: null,$clientName,$clientPhone,$clientInit,$masterDbId,$masterUserId ?: null,$assignedAdminUserId,$masterLabel,$masterInit,$orderTitle,kareta_clean_text($o['clientCar'] ?? '', 160),$status,0,1,1,($stoOrderId !== '' ? 1 : 0)]);

        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_init_'.$chatId,$chatId,$id,'system',null,'event','Заявка '.$id.' создана',date('H:i'),date('Y-m-d H:i:s')]);
        try { kareta_write_event($pdo, $id, $status === 'waiting_responses' ? 'order_published_to_exchange' : 'order_created', ['source'=>(string)($o['source'] ?? 'services_cart'),'status'=>$status,'serviceIds'=>$serviceIds,'stoId'=>$stoOrderId,'partsRequest'=>($type==='parts_request'?$partsRequestPayload:null)]); } catch (Throwable $_e) {}

        if ($pdo->inTransaction()) $pdo->commit();
        $orderLabel = $type === 'parts_request' ? 'Запрос запчастей' : 'Заявка';
        kareta_notification_insert($pdo, [
            'recipientUserId' => $clientUserId ?: null,
            'recipientPhone' => $clientPhone,
            'recipientRole' => 'client',
            'eventType' => $type === 'parts_request' ? 'parts.created' : 'order.created',
            'entityType' => 'order',
            'entityId' => $id,
            'title' => $orderLabel . ' ' . $id . ' принята',
            'body' => $type === 'parts_request'
                ? 'Ваш запрос на запчасти зарегистрирован. Сначала его ведёт администрация, затем запрос передадут в подбор.'
                : 'Ваша заявка зарегистрирована. Сначала её ведёт администрация, затем заявка будет передана мастеру после назначения.',
            'actionUrl' => '#myorders',
            'meta' => ['orderId'=>$id,'orderType'=>$type],
        ]);
        kareta_notify_role($pdo, 'admin', [
            'eventType' => $type === 'parts_request' ? 'parts.created' : 'order.created',
            'entityType' => 'order',
            'entityId' => $id,
            'title' => $type === 'parts_request' ? 'Новый запрос запчастей ' . $id : 'Новая заявка ' . $id,
            'body' => $clientName . ' · ' . ($type === 'parts_request' ? 'требуется обработка подбора' : ('создана запись: ' . ($orderTitle ?: 'без уточнения услуги'))),
            'actionUrl' => '#admin',
            'meta' => ['orderId'=>$id,'orderType'=>$type,'clientName'=>$clientName],
        ]);
        if ($masterUserId > 0 || $masterId !== '0') {
            kareta_notification_insert($pdo, [
                'recipientUserId' => $masterUserId ?: null,
                'recipientRole' => 'master',
                'eventType' => 'order.assigned',
                'entityType' => 'order',
                'entityId' => $id,
                'title' => 'Назначена заявка ' . $id,
                'body' => $clientName . ' · ' . ($orderTitle ?: 'Новая работа ожидает подтверждения'),
                'actionUrl' => '#master',
                'meta' => ['orderId'=>$id,'orderType'=>$type,'clientName'=>$clientName],
            ]);
        }
        kareta_rebuild_user_stats($pdo);
        kareta_log_audit($pdo, 'orders.create', ['id'=>$id,'clientPhone'=>$clientPhone,'stoId'=>$stoOrderId]);
        $st=$pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1"); $st->execute([$id]);
        $orderRow = $st->fetch();
        $stChat=$pdo->prepare("SELECT * FROM `chats` WHERE id=? LIMIT 1"); $stChat->execute([$chatId]);
        kareta_json(['ok'=>true,'order'=>_fmt_order($orderRow),'chat'=>_fmt_chat($stChat->fetch()),'id'=>$id]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.create', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'orders_create_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}


function orders_claim(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],400);
    $actor = kareta_session_user() ?? [];
    $actorId = (int)($actor['id'] ?? 0);
    $role = (string)($actor['role'] ?? 'guest');
    if ($actorId <= 0 || !in_array($role, ['admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);

    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT id,master_id,master_user_id,assigned_admin_user_id,status,client_user_id,client_phone,client_name,type FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $before = $st->fetch();
        if (!$before) { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }
        if ((string)($before['master_id'] ?? '0') !== '0') { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_already_assigned_to_master','message'=>'Заявка уже передана мастеру'],409); }
        $prevAdminId = (int)($before['assigned_admin_user_id'] ?? 0);
        if ($prevAdminId > 0 && $prevAdminId !== $actorId && $role !== 'owner') {
            if ($pdo->inTransaction()) $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_claimed_by_other_admin','message'=>'Заявка уже взята другим администратором'],409);
        }
        if ($prevAdminId !== $actorId) {
            $pdo->prepare("UPDATE `orders` SET assigned_admin_user_id=? WHERE id=? AND COALESCE(master_id,'0')='0' AND (assigned_admin_user_id IS NULL OR assigned_admin_user_id=0)")->execute([$actorId,$id]);
            if ($role !== 'owner' && $pdo->query('SELECT ROW_COUNT()')->fetchColumn() == 0) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                kareta_json(['ok'=>false,'error'=>'order_claim_conflict','message'=>'Заявку уже успел взять другой администратор'],409);
            }
            $pdo->prepare("UPDATE `chats` SET assigned_admin_user_id=? WHERE order_id=?")->execute([$actorId,$id]);
            $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
            $stChat->execute([$id]);
            $chatId = (string)($stChat->fetchColumn() ?: '');
            if ($chatId !== '') {
                $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                    ->execute(['m_claim_'.time().'_'.rand(100,999),$chatId,$id,'system',$actorId,'event','Администратор взял заявку в обработку.',date('H:i'),date('Y-m-d H:i:s')]);
                kareta_notification_insert($pdo, [
                    'recipientUserId' => $actorId,
                    'recipientRole' => 'admin',
                    'eventType' => 'order.claimed',
                    'entityType' => 'chat',
                    'entityId' => $chatId,
                    'title' => 'Заявка ' . $id . ' взята в обработку',
                    'body' => 'Данные клиента и чат доступны вам до назначения мастера.',
                    'actionUrl' => '#admin',
                    'meta' => ['chatId'=>$chatId,'orderId'=>$id,'pane'=>'orders','queue'=>'queue_admin_claimed'],
                ]);
            }
            kareta_log_order_event($pdo, [
                'orderId' => $id,
                'eventType' => 'order.claimed',
                'actorUserId' => $actorId,
                'actorRole' => $role,
                'title' => 'Заявка взята в обработку',
                'body' => 'Администратор закрепил заявку за собой.',
                'meta' => ['assignedAdminUserId'=>$actorId],
            ]);
            kareta_log_audit($pdo, 'orders.claim', ['id'=>$id,'assignedAdminUserId'=>$actorId]);
        }
        $pdo->commit();
        $stOrder = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
        $stOrder->execute([$id]);
        $orderRow = $stOrder->fetch() ?: [];
        $stChat = $pdo->prepare("SELECT * FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat->execute([$id]);
        kareta_json(['ok'=>true,'order'=>_fmt_order($orderRow),'chat'=>_fmt_chat($stChat->fetch())]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.claim', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'orders_claim_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

function orders_release_claim(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],400);
    $actor = kareta_session_user() ?? [];
    $actorId = (int)($actor['id'] ?? 0);
    $role = (string)($actor['role'] ?? 'guest');
    if ($actorId <= 0 || !in_array($role, ['admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);

    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT id,master_id,assigned_admin_user_id FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $before = $st->fetch();
        if (!$before) { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }
        if ((string)($before['master_id'] ?? '0') !== '0') { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_has_master','message'=>'Нельзя вернуть в общую очередь уже назначенную мастеру заявку'],409); }
        $prevAdminId = (int)($before['assigned_admin_user_id'] ?? 0);
        if ($prevAdminId <= 0) { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>true]); }
        if ($role !== 'owner' && $prevAdminId !== $actorId) { if ($pdo->inTransaction()) $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_claimed_by_other_admin','message'=>'Эту заявку ведёт другой администратор'],409); }

        $pdo->prepare("UPDATE `orders` SET assigned_admin_user_id=NULL, master_id=NULL, master_name='Администрация', master_user_id=NULL WHERE id=?")->execute([$id]);
        $pdo->prepare("UPDATE `chats` SET assigned_admin_user_id=NULL, master_id=NULL, master_name='Администрация', master_user_id=NULL, master_init='А' WHERE order_id=?")->execute([$id]);
        $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat->execute([$id]);
        $chatId = (string)($stChat->fetchColumn() ?: '');
        if ($chatId !== '') {
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_release_'.time().'_'.rand(100,999),$chatId,$id,'system',$actorId,'event','Заявка возвращена в общую административную очередь.',date('H:i'),date('Y-m-d H:i:s')]);
        }
        kareta_log_order_event($pdo, [
            'orderId' => $id,
            'eventType' => 'order.released',
            'actorUserId' => $actorId,
            'actorRole' => $role,
            'title' => 'Заявка возвращена в очередь',
            'body' => 'Административное закрепление снято.',
            'meta' => ['releasedByUserId'=>$actorId],
        ]);
        kareta_log_audit($pdo, 'orders.releaseClaim', ['id'=>$id,'releasedByUserId'=>$actorId]);
        $pdo->commit();
        $stOrder = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
        $stOrder->execute([$id]);
        $orderRow = $stOrder->fetch() ?: [];
        $stChat2 = $pdo->prepare("SELECT * FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat2->execute([$id]);
        kareta_json(['ok'=>true,'order'=>_fmt_order($orderRow),'chat'=>_fmt_chat($stChat2->fetch())]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.releaseClaim', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'orders_release_claim_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

/* ── PATCH 9: специализированные действия над заказом ────────────── */

// Клиент редактирует только допустимые поля до принятия мастером
function orders_client_edit(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    $patch = $b['patch'] ?? [];
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    // Проверяем что это заказ текущего клиента
    $actor = kareta_session_user() ?? [];
    $st = $pdo->prepare("SELECT id, status, client_user_id, client_phone FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    $myId    = (int)($actor['id'] ?? 0);
    $myPhone = (string)($actor['phone'] ?? '');
    $isOwner = ($myId > 0 && (int)($order['client_user_id']??0) === $myId)
            || ($myPhone !== '' && kareta_normalize_phone((string)($order['client_phone']??'')) === $myPhone);
    if (!$isOwner && !kareta_has_role('admin')) kareta_json(['ok'=>false,'error'=>'not_your_order'],403);
    // Клиент может менять только эти поля пока заказ не в работе
    if (!in_array($order['status']??'new', ['new','pending','waiting_responses'], true) && !kareta_has_role('admin')) {
        kareta_json(['ok'=>false,'error'=>'order_already_in_progress','message'=>'Заказ уже принят в работу'],409);
    }
    $allowed = ['description','clientCar','clientVehicleId','urgency','address'];
    $sets=[]; $vals=[];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $patch)) { $sets[] = "`{$f}`=?"; $vals[] = $patch[$f]; }
    }
    if (empty($sets)) kareta_json(['ok'=>false,'error'=>'nothing_to_update'],400);
    $vals[] = $id;
    $pdo->prepare("UPDATE `orders` SET ".implode(',',$sets)." WHERE id=?")->execute($vals);
    kareta_log_audit($pdo, 'orders.clientEdit', ['id'=>$id,'fields'=>array_keys($patch)]);
    kareta_json(['ok'=>true]);
}

// Назначить/переназначить мастера (только admin/owner)
function orders_assign_master(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id       = (string)($b['id'] ?? '');
    $masterId = (string)($b['masterId'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_id_required'],400);

    $actor = kareta_session_user() ?? [];
    $actorRole = (string)($actor['role'] ?? 'admin');

    try {
        $pdo->beginTransaction();

        $ms = $pdo->prepare("SELECT id, user_id, name FROM `masters` WHERE id=? AND COALESCE(active,1)=1 LIMIT 1");
        $ms->execute([$masterId]);
        $msRow = $ms->fetch();
        if (!$msRow) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
        }
        $masterUserId = ((int)($msRow['user_id']??0) ?: null);
        $masterName   = (string)($msRow['name'] ?? '');

        $st = $pdo->prepare("SELECT id, status, master_id, master_user_id, `date` FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $order = $st->fetch();
        if (!$order) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'not_found'],404);
        }

        $currentStatus = (string)($order['status'] ?? 'new');
        if (in_array($currentStatus, ['done','cancelled'], true)) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'terminal_order','message'=>'Нельзя назначить мастера на закрытую или отменённую заявку','status'=>$currentStatus],409);
        }

        if ((string)($order['master_id'] ?? '') === $masterId && (int)($order['master_user_id'] ?? 0) === (int)($masterUserId ?? 0)) {
            $pdo->commit();
            kareta_json(['ok'=>true,'skipped'=>true,'status'=>$currentStatus,'masterId'=>$masterId]);
        }
        $targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');
        kareta_tariff_master_guard($pdo,$masterId,$targetDate,$id,true);

        $newStatus = $currentStatus;
        if (in_array($currentStatus, ['new','waiting_responses'], true)) {
            $can = kareta_order_can_transition($currentStatus, 'process', in_array($actorRole, ['owner','admin'], true) ? $actorRole : 'admin');
            if (empty($can['ok'])) {
                $pdo->rollBack();
                kareta_json($can,409);
            }
            $newStatus = 'process';
        }

        $up = $pdo->prepare("UPDATE `orders`
            SET master_id=?, master_user_id=?, master_name=?, status=?, accepted_at=COALESCE(accepted_at,NOW())
            WHERE id=? AND status=?");
        $up->execute([$masterId, $masterUserId, $masterName ?: null, $newStatus, $id, $currentStatus]);
        if ($up->rowCount() === 0) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'status_race_condition','message'=>'Заявка была изменена параллельным запросом'],409);
        }
        kareta_tariff_record_master_acceptance($pdo,$masterId,$id,date('Y-m-d'),'admin_assign_master');

        $pdo->prepare("UPDATE `chats` SET master_id=?, master_user_id=?, master_name=?, status=? WHERE order_id=?")
            ->execute([$masterId, $masterUserId, $masterName ?: null, $newStatus, $id]);
        try { kareta_write_event($pdo, $id, 'master_assigned', ['masterId'=>$masterId,'masterUserId'=>$masterUserId,'fromStatus'=>$currentStatus,'toStatus'=>$newStatus]); } catch (Throwable $__e) {}
        kareta_log_audit($pdo, 'orders.assignMaster', ['id'=>$id,'masterId'=>$masterId,'from'=>$currentStatus,'to'=>$newStatus]);
        $pdo->commit();
        kareta_json(['ok'=>true,'status'=>$newStatus,'masterId'=>$masterId]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.assignMaster', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'assign_master_failed','requestId'=>KARETA_REQUEST_ID],500);
    }
}

// Вернуть заказ в очередь (снять мастера)
function orders_return_to_admin(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id     = (string)($b['id'] ?? '');
    $reason = kareta_clean_text($b['reason'] ?? '', 500);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    kareta_assert_master_owns_order($pdo, $id);
    $pdo->prepare("UPDATE `orders` SET master_id=NULL, master_user_id=NULL, status='new' WHERE id=?")->execute([$id]);
    kareta_log_audit($pdo, 'orders.returnToAdmin', ['id'=>$id,'reason'=>$reason]);
    kareta_json(['ok'=>true]);
}

// Отложить заказ (admin/owner)
function orders_defer(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id        = (string)($b['id'] ?? '');
    $deferUntil= (string)($b['deferUntil'] ?? '');
    $note      = kareta_clean_text($b['note'] ?? '', 500);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    $pdo->prepare("UPDATE `orders` SET status='deferred', defer_until=?, admin_note=? WHERE id=?")
        ->execute([$deferUntil ?: null, $note, $id]);
    kareta_log_audit($pdo, 'orders.defer', ['id'=>$id,'until'=>$deferUntil]);
    kareta_json(['ok'=>true]);
}

// Клиент подтверждает получение (финальный шаг)
function orders_confirm_handover(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    if(function_exists('kareta_client_order_handover_confirm')&&kareta_table_exists($pdo,'work_order_handovers')){
        $handover=$pdo->prepare("SELECT status FROM work_order_handovers WHERE order_id=? LIMIT 1");$handover->execute([$id]);
        if(in_array((string)($handover->fetchColumn()?:''),['ready','accepted'],true))kareta_client_order_handover_confirm($pdo,['orderId'=>$id]);
    }
    $actor   = kareta_session_user() ?? [];
    $myId    = (int)($actor['id'] ?? 0);
    $myPhone = (string)($actor['phone'] ?? '');
    $st = $pdo->prepare("SELECT client_user_id, client_phone, status FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    $isOwner = ($myId > 0 && (int)($order['client_user_id']??0) === $myId)
            || ($myPhone !== '' && kareta_normalize_phone((string)($order['client_phone']??'')) === $myPhone);
    if (!$isOwner) kareta_json(['ok'=>false,'error'=>'not_your_order'],403);
    if ($order['status'] !== 'done') kareta_json(['ok'=>false,'error'=>'order_not_done'],409);
    $pdo->prepare("UPDATE `orders` SET status='closed', closed_at=NOW() WHERE id=?")->execute([$id]);
    kareta_log_audit($pdo, 'orders.confirmHandover', ['id'=>$id]);
    kareta_json(['ok'=>true]);
}

function orders_update(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=$b['id']??''; $patch=$b['patch']??[];

    // Клиент может обновлять только поля подтверждения приёмки своего заказа
    $actor = kareta_session_user() ?? [];
    $actorRole = (string)($actor['role'] ?? '');
    $clientOnlyFields = ['carHandoverConfirmed','carHandoverPending'];
    $isClientUpdate = $actorRole === 'client' && !empty(array_intersect(array_keys($patch), $clientOnlyFields)) && count($patch) <= 2;
    if ($actorRole !== 'admin' && $actorRole !== 'owner' && $actorRole !== 'master' && !$isClientUpdate) {
        kareta_json(['ok'=>false,'error'=>'forbidden'], 403);
    }
    $stBefore = $pdo->prepare("SELECT id,type,status,client_user_id,client_phone,client_name,master_id,master_user_id,master_name,assigned_admin_user_id FROM `orders` WHERE id=? LIMIT 1");
    $stBefore->execute([$id]);
    $before = $stBefore->fetch() ?: [];
    if (!$before) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    if ($isClientUpdate) {
        $actorId=(int)($actor['id']??0);$actorPhone=kareta_normalize_phone((string)($actor['phone']??''));
        $owns=($actorId>0&&(int)($before['client_user_id']??0)===$actorId)
            ||($actorPhone!==''&&hash_equals($actorPhone,kareta_normalize_phone((string)($before['client_phone']??''))));
        if(!$owns)kareta_json(['ok'=>false,'error'=>'not_your_order'],403);
    }
    $stBeforeChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
    $stBeforeChat->execute([$id]);
    $chatId = (string)($stBeforeChat->fetchColumn() ?: '');
    if (array_key_exists('masterId', $patch)) {
        $masterId = (string)$patch['masterId'];
        if ($masterId === '' || $masterId === '0') {
            $patch['masterId'] = '0';
            $patch['masterName'] = 'Администрация';
            $patch['masterUserId'] = null;
            $patch['assignedAdminUserId'] = (int)(kareta_session_user()['id'] ?? 0) ?: null;
        }
        else {
            $st = $pdo->prepare("SELECT m.name, u.id AS user_id FROM `masters` m LEFT JOIN `users` u ON u.phone=m.user_phone WHERE m.id=? LIMIT 1");
            $st->execute([$masterId]);
            $row = $st->fetch() ?: [];
            $patch['masterName'] = (string)($row['name'] ?? '—');
            $patch['masterUserId'] = (int)($row['user_id'] ?? 0) ?: null;
            $patch['assignedAdminUserId'] = (int)(kareta_session_user()['id'] ?? 0) ?: null;
        }
    }
    $sets=[]; $vals=[];
    $map=['status'=>'status','priority'=>'priority','date'=>'date','time'=>'time','notes'=>'notes','price'=>'price','deferred'=>'deferred','masterId'=>'master_id','masterName'=>'master_name','assignedAdminUserId'=>'assigned_admin_user_id','carHandoverPending'=>'car_handover_pending','carHandoverConfirmed'=>'car_handover_confirmed'];
    foreach ($map as $js=>$col) {
        if (array_key_exists($js,$patch)) { $sets[]=$col.'=?'; $vals[]=$patch[$js]; }
    }
    if (array_key_exists('masterUserId',$patch)) { $sets[]='master_user_id=?'; $vals[]=$patch['masterUserId']; }
    if (!$sets) kareta_json(['ok'=>true]);
    $vals[]=$id;
    $stmtUpdate = $pdo->prepare("UPDATE `orders` SET ".implode(',',$sets)." WHERE id=?");
    $stmtUpdate->execute($vals);
    if ($stmtUpdate->rowCount() === 0) {
        kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'no_effective_change']);
    }
    if (array_key_exists('masterId',$patch) || array_key_exists('status',$patch) || array_key_exists('assignedAdminUserId',$patch)) {
        $pdo->prepare("UPDATE `chats` SET master_id=(SELECT master_id FROM `orders` WHERE id=? LIMIT 1), master_user_id=(SELECT master_user_id FROM `orders` WHERE id=? LIMIT 1), assigned_admin_user_id=(SELECT assigned_admin_user_id FROM `orders` WHERE id=? LIMIT 1), master_name=(SELECT master_name FROM `orders` WHERE id=? LIMIT 1), master_init=(CASE WHEN (SELECT master_id FROM `orders` WHERE id=? LIMIT 1)='0' THEN 'А' ELSE COALESCE((SELECT initials FROM `masters` WHERE id=(SELECT master_id FROM `orders` WHERE id=? LIMIT 1) LIMIT 1),'М') END), status=(SELECT status FROM `orders` WHERE id=? LIMIT 1) WHERE order_id=?")
            ->execute([$id,$id,$id,$id,$id,$id,$id,$id]);
    }
    $stNotify = $pdo->prepare("SELECT id,type,status,client_user_id,client_phone,client_name,master_id,master_user_id,master_name,assigned_admin_user_id FROM `orders` WHERE id=? LIMIT 1");
    $stNotify->execute([$id]);
    $ord = $stNotify->fetch() ?: [];
    $actorUser = kareta_session_user() ?? [];
    if (array_key_exists('assignedAdminUserId', $patch) && (string)($patch['masterId'] ?? ($before['master_id'] ?? '0')) === '0') {
        $nextAdminId = (int)($patch['assignedAdminUserId'] ?? 0);
        $prevAdminId = (int)($before['assigned_admin_user_id'] ?? 0);
        if ($nextAdminId > 0 && $nextAdminId !== $prevAdminId) {
            kareta_notification_insert($pdo, [
                'recipientUserId' => $nextAdminId,
                'recipientRole' => 'admin',
                'eventType' => 'order.claimed',
                'entityType' => $chatId !== '' ? 'chat' : 'order',
                'entityId' => $chatId !== '' ? $chatId : $id,
                'title' => 'Заявка ' . $id . ' взята в обработку',
                'body' => 'Теперь данные клиента доступны вам до назначения мастера.',
                'actionUrl' => '#admin',
                'meta' => ['chatId'=>$chatId,'orderId'=>$id,'pane'=>'orders','queue'=>'admin_claimed'],
            ]);
            if ($chatId !== '') {
                $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                    ->execute(['m_claim_'.time().'_'.rand(100,999),$chatId,$id,'system',(int)($actorUser['id'] ?? 0) ?: null,'event','Администратор взял заявку в обработку.',date('H:i'),date('Y-m-d H:i:s')]);
            }
        }
    }

    if (array_key_exists('masterId', $patch) && !empty($patch['masterId']) && (string)$patch['masterId'] !== '0') {
        if ($chatId !== '') {
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_owner_'.time().'_'.rand(100,999),$chatId,$id,'system',null,'event','Чат по заявке передан мастеру '.trim((string)($ord['master_name'] ?? 'Исполнитель')).'.',date('H:i'),date('Y-m-d H:i:s')]);
            $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_master=unread_master+1, unread_admin=unread_admin+1 WHERE id=?")->execute([$chatId]);
        }
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($ord['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($ord['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'order.assigned',
            'entityType' => $chatId !== '' ? 'chat' : 'order',
            'entityId' => $chatId !== '' ? $chatId : $id,
            'title' => 'На заявку ' . $id . ' назначен мастер',
            'body' => trim((string)($ord['master_name'] ?? '')) !== '' ? ('Мастер: ' . $ord['master_name']) : 'Исполнитель назначен',
            'actionUrl' => '#messages',
            'meta' => ['chatId'=>$chatId,'orderId'=>$id,'orderType'=>(string)($ord['type'] ?? 'service_order'),'tab'=>'work'],
        ]);
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($ord['master_user_id'] ?? 0) ?: null,
            'recipientRole' => 'master',
            'eventType' => 'order.assigned',
            'entityType' => $chatId !== '' ? 'chat' : 'order',
            'entityId' => $chatId !== '' ? $chatId : $id,
            'title' => 'Назначена заявка ' . $id,
            'body' => (string)($ord['client_name'] ?? 'Клиент') . ' ожидает связь по заявке',
            'actionUrl' => '#master',
            'meta' => ['chatId'=>$chatId,'orderId'=>$id,'orderType'=>(string)($ord['type'] ?? 'service_order'),'tab'=>'work'],
        ]);
        kareta_notify_role($pdo, 'admin', [
            'eventType' => 'order.assigned',
            'entityType' => $chatId !== '' ? 'chat' : 'order',
            'entityId' => $chatId !== '' ? $chatId : $id,
            'title' => 'Заявка ' . $id . ' передана мастеру',
            'body' => trim((string)($ord['master_name'] ?? '')) !== '' ? ('Исполнитель: ' . $ord['master_name']) : 'Исполнитель назначен',
            'actionUrl' => '#admin',
            'meta' => ['chatId'=>$chatId,'orderId'=>$id,'orderType'=>(string)($ord['type'] ?? 'service_order'),'pane'=>'orders'],
        ]);
    }
    if (array_key_exists('masterId', $patch) && (string)($patch['masterId'] ?? '') === '0') {
        if ($chatId !== '') {
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_owner_'.time().'_'.rand(100,999),$chatId,$id,'system',null,'event','Чат по заявке возвращён администрации.',date('H:i'),date('Y-m-d H:i:s')]);
            $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_admin=unread_admin+1 WHERE id=?")->execute([$chatId]);
        }
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($ord['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($ord['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'order.assigned_admin',
            'entityType' => $chatId !== '' ? 'chat' : 'order',
            'entityId' => $chatId !== '' ? $chatId : $id,
            'title' => 'Заявка ' . $id . ' снова у администрации',
            'body' => 'До повторного назначения вопросы по заявке принимает администрация.',
            'actionUrl' => '#messages',
            'meta' => ['chatId'=>$chatId,'orderId'=>$id,'orderType'=>(string)($ord['type'] ?? 'service_order'),'tab'=>'work'],
        ]);
        kareta_notify_role($pdo, 'admin', [
            'eventType' => 'order.returned_admin',
            'entityType' => $chatId !== '' ? 'chat' : 'order',
            'entityId' => $chatId !== '' ? $chatId : $id,
            'title' => 'Заявка ' . $id . ' возвращена администрации',
            'body' => (string)($ord['client_name'] ?? 'Клиент') . ' снова ожидает административное ведение',
            'actionUrl' => '#admin',
            'meta' => ['chatId'=>$chatId,'orderId'=>$id,'orderType'=>(string)($ord['type'] ?? 'service_order'),'pane'=>'orders'],
        ]);
    }
    if (array_key_exists('deferred', $patch) && !empty($patch['deferred']) && (string)($ord['type'] ?? '') === 'parts_request') {
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($ord['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($ord['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'parts.deferred',
            'entityType' => 'order',
            'entityId' => $id,
            'title' => 'Запрос запчастей ' . $id . ' отложен',
            'body' => 'Подбор временно отложен. Мы вернёмся к запросу после уточнения или поступления детали.',
            'actionUrl' => '#myorders',
            'meta' => ['orderId'=>$id,'orderType'=>'parts_request'],
        ]);
    }
    kareta_rebuild_user_stats($pdo);
    kareta_log_audit($pdo, 'orders.update', ['id'=>$id,'patch'=>$patch]);
    kareta_json(['ok'=>true]);
}

function orders_setStatus(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    $status = (string)($b['status'] ?? '');
    $fromStatus = (string)($b['fromStatus'] ?? '');
    if ($id === '' || $status === '') kareta_json(['ok'=>false,'error'=>'id_status_required'], 400);

    $actor = kareta_session_user() ?? [];
    $actorRole = kareta_normalize_role((string)($actor['role'] ?? 'master'));
    $stOwned = $pdo->prepare("SELECT * FROM `orders` WHERE BINARY id=BINARY ? LIMIT 1");
    $stOwned->execute([$id]);
    $ownedOrder = $stOwned->fetch(PDO::FETCH_ASSOC);
    if (!$ownedOrder) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    kareta_assert_order_access($pdo, $ownedOrder, true);

    if (kareta_table_exists($pdo,'sto_workflows') && in_array($status,['done_pending_client','done'],true)) {
        $wf=$pdo->prepare("SELECT current_stage FROM sto_workflows WHERE order_id=? LIMIT 1");$wf->execute([$id]);$workflowStage=(string)($wf->fetchColumn()?:'');
        $allowedLegacy=$status==='done_pending_client'?['delivery']:['warranty','completed'];
        if($workflowStage!==''&&!in_array($workflowStage,$allowedLegacy,true))kareta_json(['ok'=>false,'error'=>'master_order_lifecycle_required','message'=>'Завершение выполняется через контроль качества и акт выдачи','workflowStage'=>$workflowStage],409);
    }

    // Legacy endpoint remains only as a guarded compatibility wrapper.
    // It must not bypass the safe lifecycle introduced in r300/r308.
    if ($actorRole === 'master') {
        kareta_assert_master_owns_order($pdo, $id);
    }

    if ($fromStatus !== '') {
        $st0 = $pdo->prepare("SELECT status FROM `orders` WHERE id=? LIMIT 1");
        $st0->execute([$id]);
        $current = (string)($st0->fetchColumn() ?: '');
        if ($current !== '' && $current !== $fromStatus) {
            kareta_json(['ok'=>false,'error'=>'status_race_condition','from'=>$fromStatus,'current'=>$current,'to'=>$status], 409);
        }
    }

    $tx = kareta_order_transition($pdo, $id, $status, $actorRole, ['legacy'=>'orders.setStatus']);
    if (empty($tx['ok'])) {
        $code = ($tx['error'] ?? '') === 'order_not_found' ? 404 : 409;
        kareta_json(['ok'=>false,'error'=>$tx['error'] ?? 'invalid_transition','from'=>$tx['from'] ?? null,'to'=>$tx['to'] ?? $status,'role'=>$actorRole], $code);
    }
    if (!empty($tx['skipped'])) {
        kareta_json(['ok'=>true,'skipped'=>true,'status'=>$status]);
    }

    $comp = $status === 'done' ? date('Y-m-d H:i:s') : null;
    $started = $status === 'process' ? date('Y-m-d H:i:s') : null;
    if ($status === 'process') {
        $pdo->prepare("UPDATE `orders` SET started_at=COALESCE(started_at,?) WHERE id=?")->execute([$started,$id]);
    } elseif ($status === 'done') {
        $pdo->prepare("UPDATE `orders` SET completed_at=COALESCE(completed_at,?) WHERE id=?")->execute([$comp,$id]);
    }
    kareta_sync_order_relations($pdo, $id, $status, ['source'=>'orders.setStatus']);

    $st=$pdo->prepare("SELECT client_id,client_user_id,client_phone,type,client_name,price,master_user_id FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$id]);
    $row=$st->fetch();

    if ($row && $status === 'done' && !empty($row['client_id'])) {
        // Reached only after a real transition to done, so spend is not applied on skipped/retry.
        $pdo->prepare("UPDATE `clients` SET total_spent=total_spent+? WHERE id=?")->execute([(int)$row['price'], $row['client_id']]);
    }

    if ($row) {
        $labels = [
            'service_order' => [
                'new'=>'Новая заявка',
                'waiting_responses'=>'Заявка ждёт откликов',
                'process'=>'Заявка в работе',
                'done_pending_client'=>'Работы ждут подтверждения клиента',
                'done'=>'Работы завершены',
                'cancelled'=>'Заявка отменена',
                'dispute'=>'Открыт спор',
            ],
            'parts_request' => [
                'new'=>'Новый запрос',
                'waiting_responses'=>'Запрос ждёт предложений',
                'process'=>'Запрос в подборе',
                'done_pending_client'=>'Запрос ждёт подтверждения клиента',
                'done'=>'Запрос обработан',
                'cancelled'=>'Запрос отменён',
                'dispute'=>'Открыт спор',
            ],
        ];
        $type = (string)($row['type'] ?? 'service_order');
        $label = $labels[$type][$status] ?? $status;
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($row['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($row['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'order.status',
            'entityType' => 'order',
            'entityId' => $id,
            'title' => $id . ': ' . $label,
            'body' => $type === 'parts_request'
                ? 'По вашему запросу обновлён статус. Откройте заявку, чтобы посмотреть детали.'
                : 'По вашей заявке обновлён статус. Откройте карточку, чтобы посмотреть детали.',
            'actionUrl' => '#myorders',
            'meta' => ['orderId'=>$id,'orderType'=>$type,'status'=>$status],
        ]);
        if (!empty($row['master_user_id'])) {
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)$row['master_user_id'],
                'recipientRole' => 'master',
                'eventType' => 'order.status.master',
                'entityType' => 'order',
                'entityId' => $id,
                'title' => 'Статус по заявке ' . $id . ': ' . $label,
                'body' => 'Откройте раздел «Работа», чтобы продолжить ведение заявки.',
                'actionUrl' => '#master',
                'meta' => ['orderId'=>$id,'orderType'=>$type,'status'=>$status,'tab'=>'work'],
            ]);
        }
    }
    kareta_rebuild_user_stats($pdo);
    kareta_json(['ok'=>true,'status'=>$status,'from'=>$tx['from'] ?? null,'to'=>$tx['to'] ?? $status]);
}
function orders_addStage(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id    = (string)($b['id']    ?? '');
    $stage = $b['stage'] ?? [];
    $stageId = (string)($stage['id'] ?? '');
    if ($id === '' || $stageId === '') kareta_json(['ok'=>false,'error'=>'id_required'], 400);

    // STO-POLICY: этапы может вести назначенный мастер или СТО-владелец заявки.
    $workActor = kareta_assert_work_actor_can_mutate_order($pdo, $id, $b);

    $PIPELINE = [
        'accepted'  => ['pos'=>0, 'icon'=>'📝', 'label'=>'Заявка принята',       'client'=>'Мастер принял заявку в работу'],
        'diagnosed' => ['pos'=>1, 'icon'=>'🔍', 'label'=>'Диагностика',          'client'=>'Мастер провёл диагностику'],
        'parts'     => ['pos'=>2, 'icon'=>'🛒', 'label'=>'Запчасти',             'client'=>'Мастер уточнил запчасти и материалы'],
        'started'   => ['pos'=>3, 'icon'=>'🔧', 'label'=>'Ремонт начат',         'client'=>'Ремонт начат'],
        'quality'   => ['pos'=>4, 'icon'=>'🔬', 'label'=>'Контроль качества',    'client'=>'Мастер проверяет качество работы'],
        'done'      => ['pos'=>5, 'icon'=>'✅', 'label'=>'Работа завершена',     'client'=>'Мастер отметил работу как завершённую'],
        'delivered' => ['pos'=>6, 'icon'=>'🚗', 'label'=>'Авто выдано клиенту', 'client'=>'Автомобиль готов к выдаче/выдан'],
    ];
    if (!isset($PIPELINE[$stageId])) {
        kareta_json(['ok'=>false,'error'=>'unknown_stage','message'=>'Неизвестный этап: '.$stageId], 400);
    }

    try { kareta_ensure_order_stages_table($pdo); } catch (Throwable $__e) {}

    try {
        $pdo->beginTransaction();

        $st = $pdo->prepare("SELECT id, stages, status, client_user_id, client_phone, client_name, sto_id, sto_name, master_user_id, master_name FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'not_found'], 404);
        }

        $stages = json_decode($row['stages'] ?? '[]', true) ?: [];
        $doneIds = array_values(array_filter(array_map(fn($x) => (string)($x['id'] ?? ''), $stages)));

        // Идемпотентность: если этап уже есть, не добавляем дубль и не отправляем повторные уведомления.
        if (in_array($stageId, $doneIds, true)) {
            $pdo->commit();
            kareta_json(['ok'=>true,'skipped'=>true,'status'=>(string)($row['status'] ?? 'process'),'stageId'=>$stageId]);
        }

        $orderStatus = (string)($row['status'] ?? '');
        if (!in_array($orderStatus, ['process'], true)) {
            $isAcceptedStage = ($stageId === 'accepted') && in_array($orderStatus, ['new','waiting_responses'], true);
            if (!$isAcceptedStage) {
                $pdo->rollBack();
                kareta_json(['ok'=>false,'error'=>'order_not_in_process',
                    'message'=>'Этапы можно менять только пока заявка в работе (process)',
                    'status'=>$orderStatus], 409);
            }
        }

        $incomingPos = $PIPELINE[$stageId]['pos'];
        foreach ($doneIds as $doneId) {
            if (isset($PIPELINE[$doneId]) && $PIPELINE[$doneId]['pos'] > $incomingPos) {
                $pdo->rollBack();
                kareta_json(['ok'=>false,'error'=>'stage_order_violation',
                    'message'=>'Нельзя вернуться назад: этап «'.$PIPELINE[$doneId]['label'].'» уже выполнен'], 409);
            }
        }

        $lastDonePos = -1;
        foreach ($doneIds as $doneId) {
            if (isset($PIPELINE[$doneId])) $lastDonePos = max($lastDonePos, $PIPELINE[$doneId]['pos']);
        }
        if ($incomingPos > $lastDonePos + 1) {
            $expected = array_values(array_filter($PIPELINE, fn($s) => $s['pos'] === $lastDonePos + 1))[0] ?? null;
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'stage_skip_not_allowed',
                'message'=>'Нельзя пропускать этапы. Ожидается: «'.($expected['label'] ?? 'следующий этап').'»'], 409);
        }

        $comment = trim((string)($stage['comment'] ?? ''));
        if ($comment === '') {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'comment_required','message'=>'Комментарий к этапу обязателен'], 422);
        }

        // DB guard: один stage_key на order_id. Повтор после retry не доходит до side effects.
        try {
            $stageGuardId = 'stg_'.substr(sha1($id.'|'.$stageId), 0, 24);
            $ins = $pdo->prepare("INSERT IGNORE INTO `order_stages` (`id`,`order_id`,`stage_key`,`stage_label`,`stage_icon`,`comment`,`created_at`) VALUES (?,?,?,?,?,?,NOW())");
            $ins->execute([$stageGuardId, $id, $stageId, $PIPELINE[$stageId]['label'], $PIPELINE[$stageId]['icon'], $comment]);
            if ($ins->rowCount() === 0) {
                $pdo->commit();
                kareta_json(['ok'=>true,'skipped'=>true,'status'=>$orderStatus,'stageId'=>$stageId]);
            }
        } catch (Throwable $__stageGuard) {
            // Если отдельная таблица этапов недоступна, JSON-проверка выше остаётся рабочим fallback.
        }

        $stageMeta = $PIPELINE[$stageId];
        $stage['id']      = $stageId;
        $stage['icon']    = (string)($stage['icon'] ?? $stageMeta['icon']);
        $stage['label']   = (string)($stage['label'] ?? $stageMeta['label']);
        $stage['doneAt']  = date('Y-m-d\TH:i:s');
        $stage['comment'] = $comment;
        $stage['photos']  = is_array($stage['photos'] ?? null) ? $stage['photos'] : [];
        $stage['parts']   = is_array($stage['parts']  ?? null) ? $stage['parts']  : [];
        $stage['steps']   = is_array($stage['steps']  ?? null) ? $stage['steps']  : [];
        $stages[] = $stage;

        $newStatus = $orderStatus ?: 'process';
        if (in_array($stageId, ['accepted','diagnosed','parts','started','quality'], true)) {
            $newStatus = 'process';
        } elseif (in_array($stageId, ['done','delivered'], true)) {
            $can = kareta_order_can_transition($orderStatus, 'done_pending_client', (string)($workActor['actorRole'] ?? 'master')); // STO-POLICY
            if (empty($can['ok']) && empty($can['skipped'])) {
                $pdo->rollBack();
                kareta_json($can, 409);
            }
            $newStatus = 'done_pending_client';
        }

        $estimatedHours = isset($stage['estimatedHours']) ? (float)$stage['estimatedHours'] : null;
        $scheduledStart = isset($stage['scheduledStart']) ? (string)$stage['scheduledStart'] : null;
        $scheduledEnd   = isset($stage['scheduledEnd'])   ? (string)$stage['scheduledEnd']   : null;
        $startedAt = ($stageId === 'accepted') ? date('Y-m-d H:i:s') : null;
        $completedAt = in_array($stageId, ['done','delivered'], true) ? date('Y-m-d H:i:s') : null;

        $up = $pdo->prepare("UPDATE `orders` SET stages=?,status=?,completed_at=COALESCE(?, completed_at),
            started_at=COALESCE(CASE WHEN ? IS NOT NULL THEN ? ELSE NULL END, started_at),
            estimated_hours=COALESCE(?,estimated_hours),
            scheduled_start=COALESCE(?,scheduled_start),
            scheduled_end=COALESCE(?,scheduled_end)
            WHERE id=? AND status=?");
        $up->execute([
            json_encode($stages, JSON_UNESCAPED_UNICODE), $newStatus, $completedAt,
            $startedAt, $startedAt,
            $estimatedHours, $scheduledStart, $scheduledEnd,
            $id, $orderStatus
        ]);
        if ($up->rowCount() === 0) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'stage_race_condition','message'=>'Статус заявки изменился параллельным запросом'], 409);
        }
        $pdo->prepare("UPDATE `chats` SET status=? WHERE order_id=?")->execute([$newStatus, $id]);

        kareta_write_event($pdo, $id, 'stage_changed', [
            'stageId'=>$stageId,
            'stageLabel'=>$stage['label'],
            'stageIcon'=>$stage['icon'],
            'comment'=>$comment,
            'status'=>$newStatus,
            'actorRole'=>(string)($workActor['actorRole'] ?? 'master'),
            'actorLabel'=>(string)($workActor['label'] ?? 'Мастер'),
        ]);
        if (in_array($stageId, ['done','delivered'], true)) {
            kareta_write_event($pdo, $id, 'order_completed_by_master', ['stageId'=>$stageId, 'status'=>$newStatus]);
        }

        $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat->execute([$id]);
        $chatId = (string)($stChat->fetchColumn() ?: '');
        if ($chatId !== '') {
            $msgText = $stage['icon'].' Этап «'.$stage['label'].'»: '.$comment;
            $stageMsgId = 'msg_stg_'.substr(sha1($id.'|'.$stageId), 0, 24);
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,type,text,time,created_at,meta,client_message_id) VALUES(?,?,?,?,?,?,?,?,?,?)")
                ->execute([
                    $stageMsgId, $chatId, $id, 'system', 'stage',
                    $msgText, date('H:i'), date('Y-m-d H:i:s'),
                    json_encode(['stageId'=>$stageId,'stageLabel'=>$stage['label'],'stageIco'=>$stage['icon']], JSON_UNESCAPED_UNICODE),
                    'stage:'.$id.':'.$stageId
                ]);
        }

        if (($row['client_user_id'] ?? null) || ($row['client_phone'] ?? '')) {
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)($row['client_user_id'] ?? 0) ?: null,
                'recipientPhone'  => (string)($row['client_phone'] ?? ''),
                'recipientRole'   => 'client',
                'eventType'       => 'order.stage',
                'entityType'      => 'order',
                'entityId'        => $id,
                'title'           => $stage['icon'].' '.$stage['label'].' — заявка '.$id,
                'body'            => str_replace('Мастер', (string)($workActor['actorRole'] ?? '') === 'sto' ? 'СТО' : 'Мастер', ($stageMeta['client'] ?? $stage['label'])).'. '.$comment,
                'actionUrl'       => '#myorders',
                'meta'            => ['orderId'=>$id, 'stageId'=>$stageId, 'stageLabel'=>$stage['label'], 'status'=>$newStatus],
            ]);
        }

        $pdo->commit();
        kareta_rebuild_user_stats($pdo);
        kareta_json(['ok'=>true,'status'=>$newStatus,'stageId'=>$stageId,'stage'=>$stage]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.addStage', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'stage_update_failed','requestId'=>KARETA_REQUEST_ID], 500);
    }
}
function orders_addReport(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=(string)($b['id']??''); $report=$b['report']??[];
    // STO-POLICY: отчёты может вести назначенный мастер или СТО-владелец заявки.
    $workActor = kareta_assert_work_actor_can_mutate_order($pdo, $id, $b);
    // Статус: только process (ТЗ 5.2)
    $stStatusChk = $pdo->prepare("SELECT status FROM `orders` WHERE id=? LIMIT 1");
    $stStatusChk->execute([$id]);
    $orderStatus = (string)($stStatusChk->fetchColumn() ?: '');
    if (!in_array($orderStatus, ['process'], true)) {
        kareta_json(['ok'=>false,'error'=>'order_not_in_process',
            'message'=>'Отчёт можно добавить только пока заявка в работе (process)'], 422);
    }
    // Добавляем stageId к отчёту
    if (empty($report['stageId'])) $report['stageId'] = $b['stageId'] ?? '';
    $st=$pdo->prepare("SELECT reports, type, client_user_id, client_phone, client_name, master_user_id, master_name, assigned_admin_user_id, sto_id, sto_name FROM `orders` WHERE id=? LIMIT 1"); $st->execute([$id]);
    $row=$st->fetch();
    $reports=json_decode($row['reports']??'[]',true)?:[];
    $report['id']='r'.time(); $report['createdAt']=date('Y-m-d\TH:i:s');
    $report['actorRole'] = (string)($workActor['actorRole'] ?? 'master');
    $report['actorLabel'] = (string)($workActor['label'] ?? ($report['masterName'] ?? 'Мастер'));
    if (($workActor['actorRole'] ?? '') === 'sto') { $report['stoName'] = (string)($workActor['label'] ?? 'СТО'); }
    $reports[]=$report;
    $pdo->prepare("UPDATE `orders` SET reports=? WHERE id=?")->execute([json_encode($reports,JSON_UNESCAPED_UNICODE),$id]);
    kareta_notification_insert($pdo, [
        'recipientUserId' => (int)($row['client_user_id'] ?? 0) ?: null,
        'recipientPhone' => (string)($row['client_phone'] ?? ''),
        'recipientRole' => 'client',
        'eventType' => 'order.report',
        'entityType' => 'order',
        'entityId' => $id,
        'title' => 'Добавлен отчёт по заявке ' . $id,
        'body' => trim((string)($report['text'] ?? $report['body'] ?? '')) !== '' ? mb_substr(trim((string)($report['text'] ?? $report['body'] ?? '')),0,140) : (((string)($workActor['actorRole'] ?? '') === 'sto' ? 'СТО' : 'Мастер') . ' обновил ход работ по вашей заявке.'),
        'actionUrl' => '#myorders',
        'meta' => ['orderId'=>$id,'orderType'=>(string)($row['type'] ?? 'service_order'),'tab'=>'myorders'],
    ]);
    kareta_notify_role($pdo, 'admin', [
        'eventType' => 'order.report',
        'entityType' => 'order',
        'entityId' => $id,
        'title' => 'Новый отчёт по заявке ' . $id,
        'body' => (string)($row['client_name'] ?? 'Клиент') . ' · ' . mb_substr(trim((string)($report['text'] ?? $report['body'] ?? '')),0,120),
        'actionUrl' => '#admin',
        'meta' => ['orderId'=>$id,'orderType'=>(string)($row['type'] ?? 'service_order'),'pane'=>'orders'],
    ]);
    if (!empty($row['master_user_id'])) {
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)$row['master_user_id'],
            'recipientRole' => 'master',
            'eventType' => 'order.report.saved',
            'entityType' => 'order',
            'entityId' => $id,
            'title' => 'Отчёт сохранён по заявке ' . $id,
            'body' => 'Откройте раздел «Отчёты», чтобы продолжить ведение истории работ.',
            'actionUrl' => '#master',
            'meta' => ['orderId'=>$id,'orderType'=>(string)($row['type'] ?? 'service_order'),'tab'=>'reports'],
        ]);
    }
    kareta_rebuild_user_stats($pdo);
    try { kareta_write_event($pdo, $id, 'report_added', ['reportId'=>$report['id']??'', 'stageId'=>$report['stageId']??'']); } catch(\Throwable $__re) {}
    try {
        $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
        $stChat->execute([$id]);
        $chatId = (string)($stChat->fetchColumn() ?: '');
        if ($chatId !== '') {
            $txt = trim((string)($report['text'] ?? $report['body'] ?? ''));
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at,meta) VALUES(?,?,?,?,?,?,?,?,?,?)")
                ->execute(['msg_rep_'.time().'_'.rand(100,999),$chatId,$id,(string)($workActor['authorRole'] ?? 'master'),(int)($workActor['authorUserId'] ?? 0) ?: null,'report','📝 Отчёт '.(((string)($workActor['actorRole'] ?? '') === 'sto') ? 'СТО' : 'мастера').': '.mb_substr($txt !== '' ? $txt : 'добавлен отчёт',0,220),date('H:i'),date('Y-m-d H:i:s'),json_encode(['reportId'=>$report['id']??'','stageId'=>$report['stageId']??'','actorRole'=>(string)($workActor['actorRole'] ?? 'master')],JSON_UNESCAPED_UNICODE)]);
            $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$chatId]);
        }
    } catch(\Throwable $__chatReport) {}
    kareta_json(['ok'=>true,'report'=>$report]);
}

function orders_addPart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id   = (string)($b['id'] ?? '');
    $part = $b['part'] ?? [];
    if (!$id || empty($part['name'])) { kareta_json(['ok'=>false,'error'=>'missing_fields'], 400); }

    // STO-PARTS: запчасти/расходники ведёт тот же work-actor, что этапы и отчёты.
    // master — только назначенная заявка; sto — только своя scoped-заявка; admin/owner — служебно.
    $workActor = kareta_assert_work_actor_can_mutate_order($pdo, $id, $b);

    // Убедимся что колонки существуют (lazy migration)
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `order_parts` JSON NULL DEFAULT NULL"); } catch(Throwable $_){}

    $st = $pdo->prepare("SELECT order_parts FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
    $pdo->beginTransaction();
    try {
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }
        $parts = json_decode((string)($row['order_parts'] ?? 'null'), true) ?: [];
        if (!is_array($parts)) $parts = [];

        $partId = (string)($part['id'] ?? ('op_'.time().'_'.rand(100,999)));
        foreach ($parts as $existing) {
            if ((string)($existing['id'] ?? '') === $partId) {
                $pdo->commit();
                kareta_json(['ok'=>true,'part'=>$existing,'skipped'=>true]);
            }
        }

        $item = [
            'id'           => $partId,
            'name'         => kareta_clean_text($part['name'] ?? '', 200),
            'sku'          => kareta_clean_text($part['sku'] ?? '', 80),
            'type'         => in_array($part['type']??'', ['part','consumable','fluid','work'], true) ? $part['type'] : 'part',
            'qty'          => max(1, (int)($part['qty'] ?? 1)),
            'price'        => max(0, (float)($part['price'] ?? 0)),
            'catalogPartId'=> (string)($part['catalogPartId'] ?? ''),
            'addedAt'      => date('Y-m-d\TH:i:s'),
            'actorRole'    => (string)($workActor['actorRole'] ?? $workActor['role'] ?? 'master'),
            'actorLabel'   => (string)($workActor['label'] ?? ''),
            'stoId'        => (string)($workActor['stoId'] ?? ''),
            'addedByUserId'=> (int)($workActor['authorUserId'] ?? 0) ?: null,
        ];
        $parts[] = $item;
        $pdo->prepare("UPDATE `orders` SET order_parts=? WHERE id=?")->execute([json_encode($parts, JSON_UNESCAPED_UNICODE), $id]);

        try {
            $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
            $stChat->execute([$id]);
            $chatId = (string)($stChat->fetchColumn() ?: '');
            if ($chatId !== '') {
                $actorText = ((string)($workActor['actorRole'] ?? '') === 'sto') ? 'СТО' : (((string)($workActor['actorRole'] ?? '') === 'master') ? 'Мастер' : 'Администратор');
                $txt = '🔩 '.$actorText.' добавил позицию: '.$item['name'].' × '.$item['qty'];
                $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at,meta) VALUES(?,?,?,?,?,?,?,?,?,?)")
                    ->execute(['msg_part_'.md5($id.'|'.$item['id']),$chatId,$id,(string)($workActor['authorRole'] ?? 'master'),(int)($workActor['authorUserId'] ?? 0) ?: null,'system',$txt,date('H:i'),date('Y-m-d H:i:s'),json_encode(['partId'=>$item['id'],'actorRole'=>(string)($workActor['actorRole'] ?? '')],JSON_UNESCAPED_UNICODE)]);
                $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$chatId]);
            }
        } catch(Throwable $_chat) {}
        try { kareta_write_event($pdo, $id, 'parts.added', ['partId'=>$item['id'], 'name'=>$item['name'], 'actorRole'=>$item['actorRole']]); } catch(Throwable $_ev) {}
        try { kareta_log_audit($pdo, 'orders.addPart', ['orderId'=>$id,'partId'=>$item['id'],'actorRole'=>$item['actorRole'],'stoId'=>$item['stoId']]); } catch(Throwable $_au) {}
        $pdo->commit();
        kareta_json(['ok'=>true,'part'=>$item]);
    } catch(Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function orders_removePart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id         = (string)($b['id'] ?? '');
    $partItemId = (string)($b['partItemId'] ?? '');
    if (!$id || !$partItemId) { kareta_json(['ok'=>false,'error'=>'missing_fields'], 400); }

    // STO-PARTS: remove использует тот же scoped guard, что add/stage/report.
    $workActor = kareta_assert_work_actor_can_mutate_order($pdo, $id, $b);

    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `order_parts` JSON NULL DEFAULT NULL"); } catch(Throwable $_){}
    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare("SELECT order_parts FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }
        $parts = json_decode((string)($row['order_parts'] ?? 'null'), true) ?: [];
        if (!is_array($parts)) $parts = [];
        $removed = null;
        $next = [];
        foreach ($parts as $p) {
            if ((string)($p['id'] ?? '') === $partItemId) { $removed = $p; continue; }
            $next[] = $p;
        }
        $pdo->prepare("UPDATE `orders` SET order_parts=? WHERE id=?")->execute([json_encode(array_values($next), JSON_UNESCAPED_UNICODE), $id]);
        if ($removed) {
            try {
                $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1");
                $stChat->execute([$id]);
                $chatId = (string)($stChat->fetchColumn() ?: '');
                if ($chatId !== '') {
                    $actorText = ((string)($workActor['actorRole'] ?? '') === 'sto') ? 'СТО' : (((string)($workActor['actorRole'] ?? '') === 'master') ? 'Мастер' : 'Администратор');
                    $txt = '🔩 '.$actorText.' удалил позицию: '.kareta_clean_text((string)($removed['name'] ?? $partItemId), 160);
                    $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at,meta) VALUES(?,?,?,?,?,?,?,?,?,?)")
                        ->execute(['msg_part_rm_'.md5($id.'|'.$partItemId),$chatId,$id,(string)($workActor['authorRole'] ?? 'master'),(int)($workActor['authorUserId'] ?? 0) ?: null,'system',$txt,date('H:i'),date('Y-m-d H:i:s'),json_encode(['partId'=>$partItemId,'actorRole'=>(string)($workActor['actorRole'] ?? '')],JSON_UNESCAPED_UNICODE)]);
                    $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, updated_at=CURRENT_TIMESTAMP WHERE id=?")->execute([$chatId]);
                }
            } catch(Throwable $_chat) {}
            try { kareta_write_event($pdo, $id, 'parts.removed', ['partId'=>$partItemId, 'actorRole'=>(string)($workActor['actorRole'] ?? '')]); } catch(Throwable $_ev) {}
            try { kareta_log_audit($pdo, 'orders.removePart', ['orderId'=>$id,'partId'=>$partItemId,'actorRole'=>(string)($workActor['actorRole'] ?? ''),'stoId'=>(string)($workActor['stoId'] ?? '')]); } catch(Throwable $_au) {}
        }
        $pdo->commit();
        kareta_json(['ok'=>true,'skipped'=>!$removed]);
    } catch(Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function orders_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    // Patch 10: soft delete — сохраняем историю
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `deleted_by` INT NULL DEFAULT NULL"); } catch(Throwable $_){}
    // Поля таймера и планирования работ
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `started_at` DATETIME NULL DEFAULT NULL COMMENT 'Когда мастер начал работу (этап accepted)'"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `estimated_hours` DECIMAL(5,1) NULL DEFAULT NULL COMMENT 'Оценка мастером: сколько часов займёт ремонт'"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `scheduled_start` DATE NULL DEFAULT NULL COMMENT 'Запланированная дата начала работ'"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `orders` ADD COLUMN `scheduled_end` DATE NULL DEFAULT NULL COMMENT 'Запланированная дата завершения'"); } catch(Throwable $_){}
    $actor = kareta_session_user() ?? [];
    $actorId = (int)($actor['id'] ?? 0) ?: null;
    // Снимаем с активных чатов, сам заказ помечаем удалённым
    $pdo->prepare("UPDATE `orders` SET deleted_at=NOW(), deleted_by=?, status='deleted' WHERE id=?")->execute([$actorId, $id]);
    $pdo->prepare("UPDATE `chats` SET status='deleted' WHERE order_id=?")->execute([$id]);
    kareta_rebuild_user_stats($pdo);
    kareta_log_audit($pdo, 'orders.delete', ['id'=>$id,'mode'=>'soft','actorId'=>$actorId]);
    kareta_json(['ok'=>true]);
}


/* ── CLIENTS ──────────────────────────────────────────────────────── */
function kareta_ensure_sto_client_links(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_client_links` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `sto_id` VARCHAR(64) NOT NULL,
        `client_id` VARCHAR(64) NOT NULL,
        `client_phone` VARCHAR(32) DEFAULT NULL,
        `source` VARCHAR(32) NOT NULL DEFAULT 'manual',
        `created_by` INT DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_sto_client_link` (`sto_id`,`client_id`),
        KEY `idx_sto_client_links_sto` (`sto_id`),
        KEY `idx_sto_client_links_client` (`client_id`),
        KEY `idx_sto_client_links_phone` (`client_phone`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_link_sto_client(PDO $pdo, string $stoId, string $clientId, string $clientPhone, string $source='manual'): void {
    if ($stoId === '' || $clientId === '') return;
    kareta_ensure_sto_client_links($pdo);
    $actorId = (int)(kareta_session_user()['id'] ?? 0) ?: null;
    $linkId = 'scl_'.substr(md5($stoId.'|'.$clientId), 0, 18);
    $st = $pdo->prepare("INSERT INTO `sto_client_links`(id,sto_id,client_id,client_phone,source,created_by)
        VALUES(?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE client_phone=VALUES(client_phone), source=VALUES(source), updated_at=NOW()");
    $st->execute([$linkId,$stoId,$clientId,$clientPhone ?: null,$source,$actorId]);
}

function clients_getAll(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $u = kareta_session_user() ?: [];
    $role = (string)($u['role'] ?? 'guest');
    $params=[];
    $where=[];
    $sql="SELECT c.id, c.user_phone AS userPhone, COALESCE(NULLIF(u.name,''), c.name) AS name, COALESCE(NULLIF(u.phone,''), c.phone) AS phone, COALESCE(NULLIF(u.car,''), c.car) AS car, c.notes, c.orders_count AS ordersCount, c.total_spent AS totalSpent, c.created_at AS createdAt, COALESCE(u.active,1) AS active FROM `clients` c LEFT JOIN `users` u ON u.id = c.user_id";
    if ($role === 'sto') {
        $sto = kareta_resolve_current_sto($pdo, $u, $b);
        $stoId = (string)($sto['id'] ?? '');
        kareta_ensure_sto_client_links($pdo);
        $where[] = "(EXISTS (SELECT 1 FROM `orders` o WHERE o.sto_id=? AND (o.client_id=c.id OR o.client_phone=c.phone OR o.client_phone=c.user_phone)) OR EXISTS (SELECT 1 FROM `sto_client_links` scl WHERE scl.sto_id=? AND scl.client_id=c.id))";
        array_push($params, $stoId, $stoId);
    }
    if (!empty($b['q'])) {
        $q='%'.$b['q'].'%';
        $where[]="(COALESCE(NULLIF(u.name,''), c.name) LIKE ? OR COALESCE(NULLIF(u.phone,''), c.phone) LIKE ? OR COALESCE(NULLIF(u.car,''), c.car) LIKE ?)";
        array_push($params,$q,$q,$q);
    }
    if ($where) $sql .= " WHERE " . implode(' AND ', $where);
    $sql.=" ORDER BY c.orders_count DESC, c.created_at DESC";
    $st=$pdo->prepare($sql); $st->execute($params);
    $rows=$st->fetchAll();
    foreach ($rows as &$row) {
        $row['active']=(bool)($row['active']??1);
        if ($role === 'sto') $row['scope'] = 'sto';
    }
    unset($row);
    kareta_json(['ok'=>true,'clients'=>$rows]);
}
function clients_upsert(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $u = kareta_session_user() ?: [];
    $role = (string)($u['role'] ?? 'guest');
    $c=$b['client']??$b;
    $phone=kareta_normalize_phone((string)($c['phone']??''));
    if ($phone === '') kareta_json(['ok'=>false,'error'=>'phone_required','message'=>'Phone required'],422);
    $stoId='';
    if ($role === 'sto') {
        $sto = kareta_resolve_current_sto($pdo, $u, $b);
        $stoId = (string)($sto['id'] ?? '');
        if ($stoId === '') kareta_json(['ok'=>false,'error'=>'sto_scope_required'],403);
        // A service station owns only its scoped CRM card and never mutates the
        // global account profile for an arbitrary phone number.
        $id='cl_sto_'.substr(hash('sha256',$stoId.'|'.$phone),0,20);
    } else {
        $id=trim((string)($c['id']??'')) ?: ('cl_'.substr(hash('sha256',$phone),0,20));
        try {
            kareta_upsert_profile($pdo, ['phone'=>$phone,'name'=>$c['name']??'','car'=>$c['car']??'']);
        } catch (PDOException $dupE) {
            if ((int)$dupE->getCode() !== 23000 && strpos($dupE->getMessage(),'1062')===false) throw $dupE;
        }
    }
    $userPhone = $phone !== '' ? $phone : null;
    $pdo->beginTransaction();
    try {
        $pdo->prepare("INSERT INTO `clients`(id,user_id,user_phone,name,phone,car,notes,created_at)
                       VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE user_id=COALESCE(VALUES(user_id),user_id), user_phone=COALESCE(VALUES(user_phone),user_phone), name=VALUES(name), phone=VALUES(phone), car=VALUES(car), notes=VALUES(notes)")
            ->execute([$id,(kareta_user_id_by_phone($pdo,$phone) ?: null),$userPhone,kareta_clean_text($c['name']??'',160),$phone,kareta_clean_text($c['car']??'',160),kareta_clean_text($c['notes']??'',1000),date('Y-m-d')]);
        if ($role === 'sto') {
            kareta_link_sto_client($pdo, $stoId, $id, $phone, 'manual');
        } elseif (in_array($role, ['admin','owner'], true) && !empty($b['stoId'])) {
            $stoId = (string)$b['stoId'];
            kareta_link_sto_client($pdo, $stoId, $id, $phone, 'admin_manual');
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    if (in_array($role,['admin','owner'],true)) kareta_sync_user_entity($pdo, $phone);
    kareta_json(['ok'=>true,'id'=>$id, 'scope'=>$role === 'sto' ? 'sto' : 'global']);
}
function clients_update(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=$b['id']??''; $patch=$b['patch']??[];
    $sets=[]; $vals=[];
    foreach (['name','phone','car','notes'] as $f) {
        if (isset($patch[$f])) { $sets[]=$f.'=?'; $vals[]=$f==='phone'?kareta_normalize_phone((string)$patch[$f]):$patch[$f]; }
    }
    if ($sets) { $vals[]=$id; $pdo->prepare("UPDATE `clients` SET ".implode(',',$sets)." WHERE id=?")->execute($vals); }
    $st=$pdo->prepare("SELECT user_id, user_phone, phone, name, car FROM `clients` WHERE id=? LIMIT 1"); $st->execute([$id]);
    $client=$st->fetch();
    if ($client) {
        $phone = kareta_normalize_phone((string)($client['user_phone'] ?: $client['phone']));
        if ($phone !== '') {
            kareta_upsert_profile($pdo, ['phone'=>$phone,'name'=>$client['name']??'','car'=>$client['car']??'']);
            $pdo->prepare("UPDATE `clients` SET user_id=?, user_phone=?, phone=? WHERE id=?")->execute([(kareta_user_id_by_phone($pdo,$phone) ?: null),$phone,$phone,$id]);
            kareta_sync_user_entity($pdo, $phone);
        }
    }
    kareta_json(['ok'=>true]);
}

function kareta_fmt_vehicle(array $v): array {
    return [
        'id' => (string)($v['id'] ?? ''), 'userId' => (int)($v['user_id'] ?? 0), 'userPhone' => (string)($v['user_phone'] ?? ''), 'clientId' => (string)($v['client_id'] ?? ''),
        'title' => (string)($v['title'] ?? ''), 'brand' => (string)($v['brand'] ?? ''), 'model' => (string)($v['model'] ?? ''), 'year' => (string)($v['year_label'] ?? ''), 'generation' => (string)($v['generation'] ?? ''), 'bodyType' => (string)($v['body_type'] ?? ''),
        'plate' => (string)($v['plate'] ?? ''), 'vin' => (string)($v['vin'] ?? ''), 'color' => (string)($v['color'] ?? ''), 'icon' => (string)($v['icon'] ?? '🚗'), 'photoUrl' => (string)($v['photo_url'] ?? ''), 'note' => (string)($v['note'] ?? ''),
        'mileageKm' => (int)($v['mileage_km'] ?? 0), 'engineType' => (string)($v['engine_type'] ?? ''), 'engineVolume' => (string)($v['engine_volume'] ?? ''), 'fuelType' => (string)($v['fuel_type'] ?? ''), 'transmission' => (string)($v['transmission'] ?? ''), 'driveType' => (string)($v['drive_type'] ?? ''), 'ownerName' => (string)($v['owner_name'] ?? ''), 'city' => (string)($v['city'] ?? ''), 'purchaseAt' => (string)($v['purchase_at'] ?? ''), 'insuranceUntil' => (string)($v['insurance_until'] ?? ''), 'inspectionUntil' => (string)($v['inspection_until'] ?? ''), 'tires' => (string)($v['tires'] ?? ''), 'battery' => (string)($v['battery'] ?? ''), 'oilType' => (string)($v['oil_type'] ?? ''), 'knownIssues' => (string)($v['known_issues'] ?? ''), 'serviceAt' => (string)($v['service_at'] ?? ''), 'serviceNote' => (string)($v['service_note'] ?? ''),
        'isDefault' => !empty($v['is_default']), 'active' => !isset($v['active']) || !empty($v['active']), 'createdAt' => (string)($v['created_at'] ?? ''), 'updatedAt' => (string)($v['updated_at'] ?? ''),
    ];
}

function kareta_assert_vehicle_mutation_scope(?PDO $pdo,array $body,bool $requireExisting=false): void {
    if(!$pdo instanceof PDO)_no_db();
    $payload=is_array($body['vehicle']??null)?$body['vehicle']:$body;
    $id=trim((string)($payload['id']??''));
    if($id!==''&&!preg_match('/^[A-Za-z0-9_-]{1,64}$/',$id))kareta_json(['ok'=>false,'error'=>'invalid_vehicle_id'],422);
    $photo=trim((string)($payload['photoUrl']??$payload['photo_url']??''));
    if($photo!==''&&!preg_match('~^(https://[^\s]+|data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$~i',$photo))kareta_json(['ok'=>false,'error'=>'invalid_vehicle_photo'],422);
    if(strlen($photo)>2200000)kareta_json(['ok'=>false,'error'=>'vehicle_photo_too_large'],413);
    if($id===''){if($requireExisting)kareta_json(['ok'=>false,'error'=>'id_required'],422);return;}
    // Hold a per-ID advisory lock until the request/connection ends. This closes
    // the select-then-upsert race where two users submit the same new ID.
    $lockName='kareta_vehicle_'.substr(hash('sha256',$id),0,40);
    $lock=$pdo->prepare("SELECT GET_LOCK(?,3)");$lock->execute([$lockName]);
    if((int)$lock->fetchColumn()!==1)kareta_json(['ok'=>false,'error'=>'vehicle_busy'],409);
    $st=$pdo->prepare("SELECT user_id,user_phone FROM client_vehicles WHERE id=? LIMIT 1");$st->execute([$id]);$existing=$st->fetch(PDO::FETCH_ASSOC);
    if(!$existing){if($requireExisting)kareta_json(['ok'=>false,'error'=>'not_found'],404);return;}
    $actor=kareta_session_user()??[];$uid=(int)($actor['id']??0);$phone=kareta_normalize_phone((string)($actor['phone']??''));
    $owns=($uid>0&&(int)($existing['user_id']??0)===$uid)||($phone!==''&&hash_equals($phone,kareta_normalize_phone((string)($existing['user_phone']??''))));
    if(!$owns)kareta_json(['ok'=>false,'error'=>'vehicle_forbidden'],403);
}

function vehicles_get_mine(?PDO $pdo, array $b): void {
    if(!$pdo)_no_db(); $phone=_actor_phone(); $uid=(int)(kareta_session_user()['id']??0);
    if($phone===''&&$uid<=0)kareta_json(['ok'=>true,'vehicles'=>[]]);
    if($phone!==''){
        $st=$pdo->prepare("SELECT * FROM `client_vehicles` WHERE active=1 AND (user_id=? OR user_phone=? OR client_id IN (SELECT id FROM `clients` WHERE user_phone=? OR phone=?)) ORDER BY is_default DESC,updated_at DESC,created_at DESC");
        $st->execute([$uid?:0,$phone,$phone,$phone]);
    }else{
        $st=$pdo->prepare("SELECT * FROM `client_vehicles` WHERE active=1 AND user_id=? ORDER BY is_default DESC,updated_at DESC,created_at DESC");
        $st->execute([$uid]);
    }
    kareta_json(['ok'=>true,'vehicles'=>array_map('kareta_fmt_vehicle',$st->fetchAll())]);
}

function vehicles_upsert(?PDO $pdo, array $b): void { if (!$pdo) _no_db(); $row=$b['vehicle'] ?? $b; $phone=_actor_phone(); $uid=(int)(kareta_session_user()['id'] ?? 0); if ($phone === '' && $uid <= 0) kareta_json(['ok'=>false,'error'=>'auth_required'],401); $ownerSql=$phone!==''?'(user_id=? OR user_phone=?)':'user_id=?'; $ownerArgs=$phone!==''?[$uid ?: 0,$phone]:[$uid]; kareta_ensure_column($pdo, 'client_vehicles', 'photo_url', "ALTER TABLE `client_vehicles` ADD COLUMN `photo_url` MEDIUMTEXT NULL DEFAULT NULL AFTER `icon`"); kareta_ensure_column($pdo, 'client_vehicles', 'generation', "ALTER TABLE `client_vehicles` ADD COLUMN `generation` VARCHAR(64) NULL DEFAULT NULL AFTER `year_label`"); kareta_ensure_column($pdo, 'client_vehicles', 'body_type', "ALTER TABLE `client_vehicles` ADD COLUMN `body_type` VARCHAR(64) NULL DEFAULT NULL AFTER `generation`"); kareta_ensure_column($pdo, 'client_vehicles', 'engine_type', "ALTER TABLE `client_vehicles` ADD COLUMN `engine_type` VARCHAR(64) NULL DEFAULT NULL AFTER `mileage_km`"); kareta_ensure_column($pdo, 'client_vehicles', 'engine_volume', "ALTER TABLE `client_vehicles` ADD COLUMN `engine_volume` VARCHAR(32) NULL DEFAULT NULL AFTER `engine_type`"); kareta_ensure_column($pdo, 'client_vehicles', 'fuel_type', "ALTER TABLE `client_vehicles` ADD COLUMN `fuel_type` VARCHAR(64) NULL DEFAULT NULL AFTER `engine_volume`"); kareta_ensure_column($pdo, 'client_vehicles', 'transmission', "ALTER TABLE `client_vehicles` ADD COLUMN `transmission` VARCHAR(64) NULL DEFAULT NULL AFTER `fuel_type`"); kareta_ensure_column($pdo, 'client_vehicles', 'drive_type', "ALTER TABLE `client_vehicles` ADD COLUMN `drive_type` VARCHAR(64) NULL DEFAULT NULL AFTER `transmission`"); kareta_ensure_column($pdo, 'client_vehicles', 'owner_name', "ALTER TABLE `client_vehicles` ADD COLUMN `owner_name` VARCHAR(120) NULL DEFAULT NULL AFTER `drive_type`"); kareta_ensure_column($pdo, 'client_vehicles', 'city', "ALTER TABLE `client_vehicles` ADD COLUMN `city` VARCHAR(120) NULL DEFAULT NULL AFTER `owner_name`"); kareta_ensure_column($pdo, 'client_vehicles', 'purchase_at', "ALTER TABLE `client_vehicles` ADD COLUMN `purchase_at` DATE NULL DEFAULT NULL AFTER `city`"); kareta_ensure_column($pdo, 'client_vehicles', 'insurance_until', "ALTER TABLE `client_vehicles` ADD COLUMN `insurance_until` DATE NULL DEFAULT NULL AFTER `purchase_at`"); kareta_ensure_column($pdo, 'client_vehicles', 'inspection_until', "ALTER TABLE `client_vehicles` ADD COLUMN `inspection_until` DATE NULL DEFAULT NULL AFTER `insurance_until`"); kareta_ensure_column($pdo, 'client_vehicles', 'tires', "ALTER TABLE `client_vehicles` ADD COLUMN `tires` VARCHAR(120) NULL DEFAULT NULL AFTER `inspection_until`"); kareta_ensure_column($pdo, 'client_vehicles', 'battery', "ALTER TABLE `client_vehicles` ADD COLUMN `battery` VARCHAR(120) NULL DEFAULT NULL AFTER `tires`"); kareta_ensure_column($pdo, 'client_vehicles', 'oil_type', "ALTER TABLE `client_vehicles` ADD COLUMN `oil_type` VARCHAR(120) NULL DEFAULT NULL AFTER `battery`"); kareta_ensure_column($pdo, 'client_vehicles', 'known_issues', "ALTER TABLE `client_vehicles` ADD COLUMN `known_issues` TEXT NULL DEFAULT NULL AFTER `oil_type`"); $id=trim((string)($row['id'] ?? '')) ?: ('veh_' . substr(md5(($phone ?: 'u'.$uid) . microtime(true)),0,16)); $stExistingVehicle=$pdo->prepare("SELECT id,is_default,active FROM `client_vehicles` WHERE BINARY id=BINARY ? AND {$ownerSql} LIMIT 1"); $stExistingVehicle->execute(array_merge([$id],$ownerArgs)); $existingVehicle=$stExistingVehicle->fetch(PDO::FETCH_ASSOC) ?: null; $isExistingVehicle=(bool)$existingVehicle; if($isExistingVehicle && empty($existingVehicle['active'])) kareta_json(['ok'=>false,'error'=>'vehicle_archived','message'=>'Автомобиль находится в архиве. Сначала восстановите его'],409); if(!$isExistingVehicle) kareta_tariff_client_guard($pdo,'vehicles',$uid,$phone,true); $title=kareta_clean_text($row['title'] ?? '',191); $brand=kareta_clean_text($row['brand'] ?? '',80); $model=kareta_clean_text($row['model'] ?? '',80); $year=kareta_clean_text($row['year'] ?? $row['yearLabel'] ?? '',16); $generation=kareta_clean_text($row['generation'] ?? '',64); $bodyType=kareta_clean_text($row['bodyType'] ?? $row['body_type'] ?? '',64); $plate=strtoupper(kareta_clean_text($row['plate'] ?? '',32)); $plate=preg_replace('~\s+~u',' ',trim($plate)) ?: ''; $vin=strtoupper(kareta_clean_text($row['vin'] ?? '',64)); $vin=preg_replace('~\s+~u','',trim($vin)) ?: ''; $firstVehicleFlow=str_starts_with((string)($row['flowVersion'] ?? ''),'first-vehicle-'); if($vin!=='' && !preg_match('~^[A-HJ-NPR-Z0-9]{17}$~',$vin)) kareta_json(['ok'=>false,'error'=>'invalid_vehicle_vin','message'=>'VIN должен содержать 17 символов без I, O и Q'],422); if($firstVehicleFlow){ $yearNumber=(int)$year; $maxVehicleYear=(int)date('Y')+1; if($brand===''||$model===''||!preg_match('~^\d{4}$~',$year)||$yearNumber<1950||$yearNumber>$maxVehicleYear) kareta_json(['ok'=>false,'error'=>'invalid_first_vehicle_basic','message'=>'Укажите марку, модель и корректный год выпуска'],422); } if($vin!==''){ $stDupVin=$pdo->prepare("SELECT id FROM `client_vehicles` WHERE {$ownerSql} AND BINARY id<>BINARY ? AND UPPER(vin)=? LIMIT 1"); $stDupVin->execute(array_merge($ownerArgs,[$id,$vin])); if($stDupVin->fetchColumn()) kareta_json(['ok'=>false,'error'=>'vehicle_duplicate_vin','message'=>'Этот автомобиль уже добавлен в ваш гараж'],409); } if($plate!==''){ $stDupPlate=$pdo->prepare("SELECT id FROM `client_vehicles` WHERE active=1 AND {$ownerSql} AND BINARY id<>BINARY ? AND UPPER(TRIM(plate))=? LIMIT 1"); $stDupPlate->execute(array_merge($ownerArgs,[$id,$plate])); if($stDupPlate->fetchColumn()) kareta_json(['ok'=>false,'error'=>'vehicle_duplicate_plate','message'=>'Автомобиль с таким госномером уже есть в гараже'],409); } if($title==='') $title = kareta_clean_text(trim(implode(' ', array_filter([$brand,$model,$year]))),191); if ($title==='') $title = kareta_clean_text(trim(implode(' · ', array_filter([$brand,$plate]))),191); if ($title==='') kareta_json(['ok'=>false,'error'=>'vehicle_title_required'],422); if($brand==='') { $parts=preg_split('~\s+~u', $title) ?: []; $brand=(string)($parts[0] ?? ''); } $color=kareta_clean_text($row['color'] ?? '',32); $icon=kareta_clean_text($row['icon'] ?? '🚗',8) ?: '🚗'; $photoUrl=trim((string)($row['photoUrl'] ?? $row['photo_url'] ?? '')); $note=kareta_clean_text($row['note'] ?? '',255); $mileage=(int)($row['mileageKm'] ?? $row['mileage_km'] ?? 0); if($firstVehicleFlow && $mileage < 0) kareta_json(['ok'=>false,'error'=>'invalid_vehicle_mileage','message'=>'Укажите корректный пробег'],422); if($mileage < 0) $mileage = 0; $engineType=kareta_clean_text($row['engineType'] ?? $row['engine_type'] ?? '',64); $engineVolume=kareta_clean_text($row['engineVolume'] ?? $row['engine_volume'] ?? '',32); $fuelType=kareta_clean_text($row['fuelType'] ?? $row['fuel_type'] ?? '',64); $transmission=kareta_clean_text($row['transmission'] ?? '',64); $driveType=kareta_clean_text($row['driveType'] ?? $row['drive_type'] ?? '',64); $ownerName=kareta_clean_text($row['ownerName'] ?? $row['owner_name'] ?? '',120); $city=kareta_clean_text($row['city'] ?? '',120); $purchaseAt=trim((string)($row['purchaseAt'] ?? $row['purchase_at'] ?? '')); if($purchaseAt!=='' && !preg_match('~^\d{4}-\d{2}-\d{2}$~',$purchaseAt)) $purchaseAt=''; $insuranceUntil=trim((string)($row['insuranceUntil'] ?? $row['insurance_until'] ?? '')); if($insuranceUntil!=='' && !preg_match('~^\d{4}-\d{2}-\d{2}$~',$insuranceUntil)) $insuranceUntil=''; $inspectionUntil=trim((string)($row['inspectionUntil'] ?? $row['inspection_until'] ?? '')); if($inspectionUntil!=='' && !preg_match('~^\d{4}-\d{2}-\d{2}$~',$inspectionUntil)) $inspectionUntil=''; $tires=kareta_clean_text($row['tires'] ?? '',120); $battery=kareta_clean_text($row['battery'] ?? '',120); $oilType=kareta_clean_text($row['oilType'] ?? $row['oil_type'] ?? '',120); $knownIssues=kareta_clean_text($row['knownIssues'] ?? $row['known_issues'] ?? '',2000); $serviceAt=trim((string)($row['serviceAt'] ?? $row['service_at'] ?? '')); if($serviceAt!=='' && preg_match('~^\d{4}-\d{2}-\d{2}$~',$serviceAt)) $serviceAt .= ' 00:00:00'; $serviceNote=kareta_clean_text($row['serviceNote'] ?? $row['service_note'] ?? '',191); $clientId=''; if ($phone!=='') { $stc=$pdo->prepare("SELECT id FROM `clients` WHERE user_phone=? OR phone=? LIMIT 1"); $stc->execute([$phone,$phone]); $clientId=(string)($stc->fetchColumn() ?: ''); } $isDefault=!empty($row['isDefault']) ? 1 : 0; if($isExistingVehicle && !empty($existingVehicle['is_default'])) $isDefault=1; if(!$isExistingVehicle){ $stVehicleCount=$pdo->prepare("SELECT COUNT(*) FROM `client_vehicles` WHERE active=1 AND {$ownerSql}"); $stVehicleCount->execute($ownerArgs); if((int)$stVehicleCount->fetchColumn()===0) $isDefault=1; } if ($isDefault) $pdo->prepare("UPDATE `client_vehicles` SET is_default=0 WHERE {$ownerSql}")->execute($ownerArgs); $pdo->prepare("INSERT INTO `client_vehicles`(id,user_id,user_phone,client_id,title,brand,model,year_label,generation,body_type,plate,vin,color,icon,photo_url,note,mileage_km,engine_type,engine_volume,fuel_type,transmission,drive_type,owner_name,city,purchase_at,insurance_until,inspection_until,tires,battery,oil_type,known_issues,service_at,service_note,is_default,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), user_phone=VALUES(user_phone), client_id=VALUES(client_id), title=VALUES(title), brand=VALUES(brand), model=VALUES(model), year_label=VALUES(year_label), generation=VALUES(generation), body_type=VALUES(body_type), plate=VALUES(plate), vin=VALUES(vin), color=VALUES(color), icon=VALUES(icon), photo_url=VALUES(photo_url), note=VALUES(note), mileage_km=VALUES(mileage_km), engine_type=VALUES(engine_type), engine_volume=VALUES(engine_volume), fuel_type=VALUES(fuel_type), transmission=VALUES(transmission), drive_type=VALUES(drive_type), owner_name=VALUES(owner_name), city=VALUES(city), purchase_at=VALUES(purchase_at), insurance_until=VALUES(insurance_until), inspection_until=VALUES(inspection_until), tires=VALUES(tires), battery=VALUES(battery), oil_type=VALUES(oil_type), known_issues=VALUES(known_issues), service_at=VALUES(service_at), service_note=VALUES(service_note), is_default=VALUES(is_default), active=1")->execute([$id,$uid ?: null,$phone,$clientId,$title,$brand,$model,$year,$generation,$bodyType,$plate,$vin,$color,$icon,($photoUrl!==''?$photoUrl:null),$note,$mileage,$engineType,$engineVolume,$fuelType,$transmission,$driveType,$ownerName,$city,($purchaseAt!==''?$purchaseAt:null),($insuranceUntil!==''?$insuranceUntil:null),($inspectionUntil!==''?$inspectionUntil:null),$tires,$battery,$oilType,$knownIssues,($serviceAt!==''?$serviceAt:null),$serviceNote,$isDefault]); if ($isDefault && $phone !== '') { kareta_upsert_profile($pdo,['phone'=>$phone,'car'=>$title]); } if($phone!=='') kareta_sync_user_entity($pdo,$phone); $st=$pdo->prepare("SELECT * FROM `client_vehicles` WHERE id=? LIMIT 1"); $st->execute([$id]); $row=$st->fetch() ?: ['id'=>$id,'title'=>$title,'brand'=>$brand,'model'=>$model,'year_label'=>$year,'generation'=>$generation,'body_type'=>$bodyType,'plate'=>$plate,'vin'=>$vin,'color'=>$color,'icon'=>$icon,'photo_url'=>$photoUrl,'note'=>$note,'mileage_km'=>$mileage,'engine_type'=>$engineType,'engine_volume'=>$engineVolume,'fuel_type'=>$fuelType,'transmission'=>$transmission,'drive_type'=>$driveType,'owner_name'=>$ownerName,'city'=>$city,'purchase_at'=>$purchaseAt,'insurance_until'=>$insuranceUntil,'inspection_until'=>$inspectionUntil,'tires'=>$tires,'battery'=>$battery,'oil_type'=>$oilType,'known_issues'=>$knownIssues,'service_at'=>$serviceAt,'service_note'=>$serviceNote,'is_default'=>$isDefault]; try{kareta_client_first_entry_mark_completed($pdo);}catch(Throwable $_){} kareta_json(['ok'=>true,'vehicle'=>kareta_fmt_vehicle($row)]); }

function vehicles_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=trim((string)($b['id'] ?? '')); if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $phone=_actor_phone(); $uid=(int)(kareta_session_user()['id'] ?? 0);
    $ownerSql=$phone!==''?'(user_id=? OR user_phone=?)':'user_id=?'; $ownerArgs=$phone!==''?[$uid ?: 0,$phone]:[$uid];
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare("SELECT id,title,is_default FROM `client_vehicles` WHERE BINARY id=BINARY ? AND {$ownerSql} LIMIT 1 FOR UPDATE");
        $st->execute(array_merge([$id],$ownerArgs)); $vehicle=$st->fetch(PDO::FETCH_ASSOC) ?: null;
        if(!$vehicle){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'not_found'],404);}
        $pdo->prepare("UPDATE `client_vehicles` SET active=0,is_default=0,updated_at=NOW() WHERE BINARY id=BINARY ?")->execute([$id]);
        $newDefaultId='';
        $defaultCheck=$pdo->prepare("SELECT id FROM `client_vehicles` WHERE active=1 AND is_default=1 AND {$ownerSql} LIMIT 1 FOR UPDATE");
        $defaultCheck->execute($ownerArgs); $hasDefault=(bool)$defaultCheck->fetchColumn();
        if(!$hasDefault){
            $next=$pdo->prepare("SELECT id,title FROM `client_vehicles` WHERE active=1 AND {$ownerSql} ORDER BY updated_at DESC,created_at DESC LIMIT 1 FOR UPDATE");
            $next->execute($ownerArgs); $row=$next->fetch(PDO::FETCH_ASSOC) ?: null;
            if($row){
                $newDefaultId=(string)$row['id'];
                $pdo->prepare("UPDATE `client_vehicles` SET is_default=1 WHERE BINARY id=BINARY ?")->execute([$newDefaultId]);
                if($phone!=='') kareta_upsert_profile($pdo,['phone'=>$phone,'car'=>(string)($row['title']??'')]);
            } elseif($phone!=='') {
                kareta_upsert_profile($pdo,['phone'=>$phone,'car'=>'']);
            }
        }
        $pdo->commit();
        if($phone!=='') kareta_sync_user_entity($pdo,$phone);
        kareta_json(['ok'=>true,'id'=>$id,'archived'=>true,'newDefaultId'=>$newDefaultId]);
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
}

function vehicles_restore(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=trim((string)($b['id'] ?? '')); if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $phone=_actor_phone(); $uid=(int)(kareta_session_user()['id'] ?? 0);
    $ownerSql=$phone!==''?'(user_id=? OR user_phone=?)':'user_id=?'; $ownerArgs=$phone!==''?[$uid ?: 0,$phone]:[$uid];
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare("SELECT * FROM `client_vehicles` WHERE BINARY id=BINARY ? AND {$ownerSql} LIMIT 1 FOR UPDATE");
        $st->execute(array_merge([$id],$ownerArgs)); $vehicle=$st->fetch(PDO::FETCH_ASSOC) ?: null;
        if(!$vehicle){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'not_found'],404);}
        if(!empty($vehicle['active'])){$pdo->commit();kareta_json(['ok'=>true,'id'=>$id,'restored'=>false,'vehicle'=>kareta_fmt_vehicle($vehicle)]);}
        $vin=strtoupper(trim((string)($vehicle['vin']??''))); $plate=strtoupper(trim((string)($vehicle['plate']??'')));
        if($vin!==''){
            $q=$pdo->prepare("SELECT id FROM client_vehicles WHERE active=1 AND BINARY id<>BINARY ? AND {$ownerSql} AND UPPER(vin)=? LIMIT 1");
            $q->execute(array_merge([$id],$ownerArgs,[$vin])); if($q->fetchColumn()){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'vehicle_duplicate_vin','message'=>'Нельзя восстановить: VIN уже используется другой машиной'],409);}
        }
        if($plate!==''){
            $q=$pdo->prepare("SELECT id FROM client_vehicles WHERE active=1 AND BINARY id<>BINARY ? AND {$ownerSql} AND UPPER(TRIM(plate))=? LIMIT 1");
            $q->execute(array_merge([$id],$ownerArgs,[$plate])); if($q->fetchColumn()){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'vehicle_duplicate_plate','message'=>'Нельзя восстановить: госномер уже используется другой машиной'],409);}
        }
        $q=$pdo->prepare("SELECT COUNT(*) FROM client_vehicles WHERE active=1 AND is_default=1 AND {$ownerSql}");$q->execute($ownerArgs);$makeDefault=(int)$q->fetchColumn()===0;
        $pdo->prepare("UPDATE client_vehicles SET active=1,is_default=?,updated_at=NOW() WHERE BINARY id=BINARY ?")->execute([$makeDefault?1:0,$id]);
        if($makeDefault&&$phone!=='')kareta_upsert_profile($pdo,['phone'=>$phone,'car'=>(string)($vehicle['title']??'')]);
        $pdo->commit(); if($phone!=='')kareta_sync_user_entity($pdo,$phone);
        $vehicle['active']=1;$vehicle['is_default']=$makeDefault?1:0;
        kareta_json(['ok'=>true,'id'=>$id,'restored'=>true,'vehicle'=>kareta_fmt_vehicle($vehicle)]);
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

function vehicles_set_default(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id=trim((string)($b['id'] ?? '')); if($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $phone=_actor_phone(); $uid=(int)(kareta_session_user()['id'] ?? 0);
    $ownerSql=$phone!==''?'(user_id=? OR user_phone=?)':'user_id=?'; $ownerArgs=$phone!==''?[$uid ?: 0,$phone]:[$uid];
    $pdo->beginTransaction();
    try {
        $st=$pdo->prepare("SELECT * FROM client_vehicles WHERE BINARY id=BINARY ? AND active=1 AND {$ownerSql} LIMIT 1 FOR UPDATE");
        $st->execute(array_merge([$id],$ownerArgs)); $vehicle=$st->fetch(PDO::FETCH_ASSOC) ?: null;
        if(!$vehicle){$pdo->rollBack();kareta_json(['ok'=>false,'error'=>'vehicle_not_active','message'=>'Автомобиль не найден или находится в архиве'],409);}
        $pdo->prepare("UPDATE client_vehicles SET is_default=0 WHERE active=1 AND {$ownerSql}")->execute($ownerArgs);
        $pdo->prepare("UPDATE client_vehicles SET is_default=1,updated_at=NOW() WHERE BINARY id=BINARY ?")->execute([$id]);
        if($phone!=='')kareta_upsert_profile($pdo,['phone'=>$phone,'car'=>(string)($vehicle['title']??'')]);
        $pdo->commit(); if($phone!=='')kareta_sync_user_entity($pdo,$phone);
        $vehicle['is_default']=1;
        kareta_json(['ok'=>true,'id'=>$id,'vehicle'=>kareta_fmt_vehicle($vehicle)]);
    } catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

/* ── CHATS ────────────────────────────────────────────────────────── */
function kareta_ensure_direct_chat_schema(PDO $pdo): void {
    try { kareta_ensure_column($pdo,'chats','chat_type',"ALTER TABLE `chats` ADD COLUMN `chat_type` VARCHAR(24) NOT NULL DEFAULT 'order' AFTER `id`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo,'chats','title',"ALTER TABLE `chats` ADD COLUMN `title` VARCHAR(191) NOT NULL DEFAULT '' AFTER `chat_type`"); } catch (Throwable $_) {}
    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_participants`(
        `chat_id` VARCHAR(64) NOT NULL, `user_id` BIGINT UNSIGNED NOT NULL, `role` VARCHAR(32) NOT NULL,
        `unread_count` INT UNSIGNED NOT NULL DEFAULT 0, `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `last_read_at` DATETIME NULL, `left_at` DATETIME NULL,
        PRIMARY KEY (`chat_id`,`user_id`), KEY `idx_cp_user` (`user_id`,`left_at`), KEY `idx_cp_chat` (`chat_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_message_reads`(
        `message_id` VARCHAR(96) NOT NULL, `chat_id` VARCHAR(64) NOT NULL, `user_id` BIGINT UNSIGNED NOT NULL,
        `read_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`message_id`,`user_id`), KEY `idx_cmr_chat_user` (`chat_id`,`user_id`), KEY `idx_cmr_message` (`message_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_chat_actor(PDO $pdo): array {
    $legacy = kareta_session_user() ?: [];
    $actor = function_exists('kareta_scope_identity_actor') ? kareta_scope_identity_actor($pdo) : [];
    $identityLegacy = is_array($actor['legacyUser'] ?? null) ? $actor['legacyUser'] : [];
    $account = is_array($actor['account'] ?? null) ? $actor['account'] : [];
    $effectiveUser = $identityLegacy ?: $legacy;
    $role = kareta_normalize_role((string)($actor['role'] ?? $effectiveUser['role'] ?? $legacy['role'] ?? 'guest'));
    $phone = kareta_normalize_phone((string)($effectiveUser['phone'] ?? $account['phone'] ?? $legacy['phone'] ?? _actor_phone()));
    $userId=(int)($effectiveUser['id'] ?? $legacy['id'] ?? 0);
    if($userId<=0 && $phone!==''){
        $u=$pdo->prepare("SELECT id FROM users WHERE active=1 AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-',''),'(',''),')',''),10)=RIGHT(?,10) ORDER BY id LIMIT 1");
        $u->execute([$phone]);
        $userId=(int)($u->fetchColumn()?:0);
    }
    return [
        'role'=>$role,
        'userId'=>$userId,
        'phone'=>$phone,
        'context'=>is_array($actor['context'] ?? null) ? $actor['context'] : null,
        'capabilities'=>is_array($actor['capabilities'] ?? null) ? $actor['capabilities'] : [],
    ];
}

function kareta_chat_actor_role(PDO $pdo): string {
    return (string)(kareta_chat_actor($pdo)['role'] ?? 'guest');
}

function chats_getAll(?PDO $pdo): void {
    if (!$pdo) _no_db();
    kareta_ensure_direct_chat_schema($pdo);
    try {
        kareta_ensure_column($pdo, 'chats', 'sto_id', "ALTER TABLE `chats` ADD COLUMN `sto_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`");
        kareta_ensure_column($pdo, 'chats', 'sto_user_id', "ALTER TABLE `chats` ADD COLUMN `sto_user_id` INT NULL DEFAULT NULL AFTER `sto_id`");
        kareta_ensure_column($pdo, 'chats', 'unread_sto', "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0");
        kareta_ensure_column($pdo, 'chats', 'unread_seller', "ALTER TABLE `chats` ADD COLUMN `unread_seller` INT NOT NULL DEFAULT 0");
    } catch (Throwable $_) {}
    $actor=kareta_chat_actor($pdo); $actorId=(int)$actor['userId']; $role=(string)$actor['role']; $phone=(string)$actor['phone'];
    if($actorId<=0) kareta_json(['ok'=>true,'chats'=>[],'unreadTotal'=>0]);
    // Keep participant-based unread state available for both direct and order chats.
    try {
        $pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role,unread_count) SELECT id,client_user_id,'client',unread_client FROM chats WHERE client_user_id=?")->execute([$actorId]);
        $pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role,unread_count) SELECT id,master_user_id,'master',unread_master FROM chats WHERE master_user_id=?")->execute([$actorId]);
        $pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role,unread_count) SELECT id,sto_user_id,'sto',unread_sto FROM chats WHERE sto_user_id=?")->execute([$actorId]);
        $pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role,unread_count) SELECT id,assigned_admin_user_id,'admin',unread_admin FROM chats WHERE assigned_admin_user_id=?")->execute([$actorId]);
    } catch (Throwable $_) {}
    $sql="SELECT DISTINCT c.*,
      (SELECT m.text FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message,
      (SELECT m.time FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_time,
      cp.unread_count participant_unread,
      pu.id peer_user_id, pu.name peer_name, pp.role peer_role, pu.initials peer_initials
      FROM chats c
      LEFT JOIN chat_participants cp ON cp.chat_id=c.id AND cp.user_id=? AND cp.role=? AND cp.left_at IS NULL
      LEFT JOIN chat_participants pp ON pp.chat_id=c.id AND c.chat_type='direct' AND pp.user_id<>? AND pp.left_at IS NULL
      LEFT JOIN users pu ON pu.id=pp.user_id";
    $chatRole=$role==='owner'?'admin':$role;
    $params=[$actorId,$chatRole,$actorId];
    if(in_array($role,['admin','owner'],true)) { $sql.=" WHERE (c.chat_type<>'direct' OR cp.user_id IS NOT NULL OR c.assigned_admin_user_id=? OR ? IN (SELECT user_id FROM chat_participants WHERE chat_id=c.id))"; $params[]=$actorId; $params[]=$actorId; }
    else if($role==='client') { $sql.=" WHERE (cp.user_id IS NOT NULL OR c.client_user_id=? OR c.client_phone=?)"; $params[]=$actorId; $params[]=$phone; }
    else if($role==='master') { $st=$pdo->prepare("SELECT id FROM masters WHERE user_id=? OR user_phone=? OR phone=? LIMIT 1");$st->execute([$actorId,$phone,$phone]);$mid=(string)($st->fetchColumn()?:'');$sql.=" WHERE (cp.user_id IS NOT NULL OR c.master_user_id=? OR c.master_id=?)";$params[]=$actorId;$params[]=$mid; }
    else if($role==='sto') { $sto=function_exists('kareta_scope_current_sto')?kareta_scope_current_sto($pdo,$actor['context']):null;$stoId=(string)($sto['id']??'');$sql.=" WHERE (cp.user_id IS NOT NULL OR c.sto_user_id=? OR c.sto_id=?)";$params[]=$actorId;$params[]=$stoId; }
    else $sql.=" WHERE cp.user_id IS NOT NULL";
    $sql.=" ORDER BY COALESCE(c.updated_at,c.created_at) DESC";
    $st=$pdo->prepare($sql);$st->execute($params);$rows=[];
    foreach($st->fetchAll() as $row){
        $f=_fmt_chat($row);
        if(($f['chatType']??'')==='direct'){
            $f['unread'][$role==='owner'?'admin':$role]=(int)($row['participant_unread']??0);
        } else {
            if($role==='master'){
                $f['peerRole']='client';
                $f['peerUserId']=(int)($f['clientUserId']??0);
                $f['peerName']=(string)($f['clientName']??'Клиент');
                $f['peerInitials']=(string)($f['clientInit']??'');
            } elseif($role==='client'){
                if((string)($f['masterId']??'0')!=='0'){
                    $f['peerRole']='master';
                    $f['peerUserId']=(int)($f['masterUserId']??0);
                    $f['peerName']=(string)($f['masterName']??'Мастер');
                    $f['peerInitials']=(string)($f['masterInit']??'');
                } elseif((string)($f['stoId']??'')!==''){
                    $f['peerRole']='sto';
                    $f['peerUserId']=(int)($f['stoUserId']??0);
                    $f['peerName']=(string)($f['stoName']??'СТО');
                }
            } elseif($role==='sto'){
                $f['peerRole']='client';
                $f['peerUserId']=(int)($f['clientUserId']??0);
                $f['peerName']=(string)($f['clientName']??'Клиент');
                $f['peerInitials']=(string)($f['clientInit']??'');
            }
        }
        $peerRole=(string)($f['peerRole']??'');
        $f['peerProfileUrl']='';
        if($peerRole==='master' && (string)($f['masterId']??'0')!=='0') $f['peerProfileUrl']='#/masters/profile/master/'.rawurlencode((string)$f['masterId']);
        elseif($peerRole==='sto' && (string)($f['stoId']??'')!=='') $f['peerProfileUrl']='#/masters/profile/sto/'.rawurlencode((string)$f['stoId']);
        $rows[]=$f;
    }
    $unreadTotal=0; foreach($rows as $item){$unreadTotal+=(int)($item['participantUnread']??($item['unread'][$role==='owner'?'admin':$role]??0));}
    kareta_json(['ok'=>true,'chats'=>$rows,'unreadTotal'=>$unreadTotal]);
}
function chats_contacts(?PDO $pdo): void {
    if(!$pdo)_no_db(); $actor=kareta_chat_actor($pdo);$me=(int)$actor['userId'];$role=(string)$actor['role'];if($me<=0)kareta_json(['ok'=>true,'contacts'=>[]]);
    $allowed = match($role){'client'=>['master','sto','seller','admin','owner'],'master'=>['client','master','admin','owner','sto'],'sto'=>['client','master','seller','admin','owner'],'seller'=>['client','sto','admin','owner'],'admin','owner'=>['client','master','sto','seller','admin','owner'],default=>[]};
    if(!$allowed)kareta_json(['ok'=>true,'contacts'=>[]]);$ph=implode(',',array_fill(0,count($allowed),'?'));
    $params=$allowed;$params[]=$me;$sql="SELECT id,name,role,initials,phone,spec,car FROM users WHERE active=1 AND role IN ($ph) AND id<>?";
    if($role==='master'){$sql.=" AND (role IN ('master','admin','owner') OR id IN (SELECT client_user_id FROM orders WHERE master_user_id=? OR master_id IN (SELECT id FROM masters WHERE user_id=?)))";$params[]=$me;$params[]=$me;}
    if($role==='client'){$sql.=" AND role IN ('master','sto','seller','admin','owner')";}
    $sql.=" ORDER BY FIELD(role,'admin','owner','master','sto','client'),name LIMIT 250";$st=$pdo->prepare($sql);$st->execute($params);
    $out=[];foreach($st->fetchAll() as $u)$out[]=['id'=>(int)$u['id'],'name'=>$u['name']?:'Пользователь','role'=>$u['role'],'initials'=>$u['initials']?:mb_strtoupper(mb_substr((string)$u['name'],0,1)),'subtitle'=>$u['spec']?:($u['car']?:chats_role_label($u['role']))];
    kareta_json(['ok'=>true,'contacts'=>$out]);
}
function chats_role_label(string $role): string { return ['client'=>'Клиент','master'=>'Мастер','sto'=>'СТО','seller'=>'Продавец','admin'=>'Администратор','owner'=>'Владелец'][$role]??'Пользователь'; }
function chats_resolve_master_user_id(PDO $pdo, string $masterId): int {
    if($masterId==='') return 0;
    $st=$pdo->prepare("SELECT * FROM masters WHERE id=? AND active=1 LIMIT 1");
    $st->execute([$masterId]);
    $master=$st->fetch(PDO::FETCH_ASSOC);
    if(!$master) return 0;

    $linked=(int)($master['user_id']??0);
    if($linked>0){
        $u=$pdo->prepare("SELECT id FROM users WHERE id=? AND active=1 LIMIT 1");
        $u->execute([$linked]);
        $resolved=(int)($u->fetchColumn()?:0);
        if($resolved>0) return $resolved;
    }

    $phones=[];
    foreach(['user_phone','phone'] as $field){
        $value=trim((string)($master[$field]??''));
        if($value!=='') $phones[]=$value;
    }
    foreach(array_values(array_unique($phones)) as $phone){
        $digits=preg_replace('/\D+/','',$phone)??'';
        if($digits==='') continue;
        $u=$pdo->prepare("SELECT id FROM users WHERE active=1 AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'+',''),' ',''),'-',''),'(',''),')',''),10)=RIGHT(?,10) ORDER BY id LIMIT 1");
        $u->execute([$digits]);
        $resolved=(int)($u->fetchColumn()?:0);
        if($resolved>0){
            try{$pdo->prepare("UPDATE masters SET user_id=? WHERE id=? AND (user_id IS NULL OR user_id=0)")->execute([$resolved,$masterId]);}catch(Throwable $_e){}
            return $resolved;
        }
    }
    return 0;
}
function chats_open_direct(?PDO $pdo,array $b): void {
    if(!$pdo)_no_db();
    kareta_ensure_direct_chat_schema($pdo);
    $actor=kareta_chat_actor($pdo);
    $me=(int)$actor['userId'];
    $actorRole=(string)$actor['role'];
    $participantRole=$actorRole==='owner'?'admin':$actorRole;
    $peer=(int)($b['userId']??$b['peerUserId']??0);
    $masterId=trim((string)($b['masterId']??$b['master_id']??''));
    $stoId=trim((string)($b['stoId']??$b['sto_id']??''));

    if($peer<=0 && $masterId!==''){
        $peer=chats_resolve_master_user_id($pdo,$masterId);
        if($peer<=0)kareta_json(['ok'=>false,'error'=>'master_chat_unavailable','message'=>'У этого мастера нет активной учетной записи. Проверьте привязку профиля мастера к пользователю'],404);
    }
    if($peer<=0 && $stoId!==''){
        try{
            $stPeer=$pdo->prepare("SELECT COALESCE(NULLIF(s.user_id,0),u.id) peer_user_id FROM sto_profiles s LEFT JOIN users u ON (u.id=s.user_id OR (s.contact_phone<>'' AND u.phone=s.contact_phone)) WHERE s.id=? AND s.active=1 ORDER BY (u.role='sto') DESC,u.id LIMIT 1");
            $stPeer->execute([$stoId]);
            $peer=(int)($stPeer->fetchColumn()?:0);
        }catch(Throwable $_e){$peer=0;}
        if($peer<=0)kareta_json(['ok'=>false,'error'=>'sto_chat_unavailable','message'=>'У этого СТО не привязана учетная запись для чата'],404);
    }
    if($me<=0)kareta_json(['ok'=>false,'error'=>'auth_required','message'=>'Войдите в аккаунт, чтобы написать мастеру'],401);
    if($peer<=0||$me===$peer)kareta_json(['ok'=>false,'error'=>'invalid_participant','message'=>'Невозможно открыть этот диалог'],422);

    $st=$pdo->prepare("SELECT id,name,role,initials FROM users WHERE id IN (?,?) AND active=1");
    $st->execute([$me,$peer]);
    $users=[];foreach($st->fetchAll() as $u)$users[(int)$u['id']]=$u;
    if(count($users)!==2)kareta_json(['ok'=>false,'error'=>'participant_not_found','message'=>'Участник чата не найден'],404);
    $a=$users[$me];$z=$users[$peer];
    $peerRole=$masterId!==''?'master':($stoId!==''?'sto':(string)$z['role']);
    $allowed=['client'=>['master','admin','owner','sto','seller'],'master'=>['client','master','admin','owner','sto'],'sto'=>['client','master','seller','admin','owner'],'seller'=>['client','sto','admin','owner'],'admin'=>['client','master','sto','seller','admin','owner'],'owner'=>['client','master','sto','seller','admin','owner']];
    if(!in_array($peerRole,$allowed[$actorRole]??[],true))kareta_json(['ok'=>false,'error'=>'chat_pair_forbidden','message'=>'Для этих ролей прямой чат недоступен'],403);

    $lo=min($me,$peer);$hi=max($me,$peer);
    $contextKey=(string)($actor['context']['contextKey']??$actor['context']['key']??$actorRole);
    $scopedId='d_'.$lo.'_'.$hi.'_'.substr(hash('sha256',$contextKey),0,12);
    $legacyId='direct_'.$lo.'_'.$hi;
    $find=$pdo->prepare("SELECT cp1.chat_id FROM chat_participants cp1 JOIN chat_participants cp2 ON cp2.chat_id=cp1.chat_id JOIN chats c ON c.id=cp1.chat_id WHERE c.chat_type='direct' AND cp1.user_id=? AND cp1.role=? AND cp2.user_id=? AND cp1.left_at IS NULL AND cp2.left_at IS NULL AND c.id IN (?,?) ORDER BY (c.id=?) DESC LIMIT 1");
    $find->execute([$me,$participantRole,$peer,$scopedId,$legacyId,$scopedId]);
    $id=(string)($find->fetchColumn()?:'');
    if($id===''){
        $id=$scopedId;$title=$a['name'].' — '.$z['name'];
        $pdo->beginTransaction();
        try{
            $pdo->prepare("INSERT IGNORE INTO chats(id,chat_type,title,order_id,client_id,client_name,client_phone,client_init,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())")->execute([$id,'direct',$title,'','','','','','','','Личный чат','','active',0,0,0]);
            $ins=$pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role) VALUES(?,?,?)");
            $ins->execute([$id,$me,$participantRole]);$ins->execute([$id,$peer,$peerRole]);
            $pdo->prepare("INSERT IGNORE INTO messages(id,chat_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,NOW())")->execute(['m_'.$id.'_start',$id,'system',null,'event','Диалог создан',date('H:i')]);
            $pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    $q=$pdo->prepare("SELECT c.*,? peer_user_id,? peer_name,? peer_role,? peer_initials,0 participant_unread FROM chats c WHERE c.id=?");
    $q->execute([$peer,$z['name'],$peerRole,$z['initials'],$id]);
    kareta_json(['ok'=>true,'chat'=>_fmt_chat($q->fetch())]);
}
function chats_support_open(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $user = kareta_session_user();
    $userId = (int)($user['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($user['phone'] ?? _actor_phone()));
    $name = trim((string)($user['name'] ?? 'Клиент')) ?: 'Клиент';
    $message = kareta_clean_text((string)($b['message'] ?? ''), 2000);
    if (!$message) kareta_json(['ok'=>false,'error'=>'message_required','message'=>'Введите сообщение'],422);
    $chatId = 'support_'.$userId;
    if ($userId <= 0) $chatId = 'support_'.substr(hash('sha256',$phone ?: session_id()),0,24);
    $pdo->prepare("INSERT INTO `chats` (id,order_id,client_id,client_user_id,client_name,client_phone,client_init,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE client_name=VALUES(client_name),client_phone=VALUES(client_phone),status='active',updated_at=NOW()")
        ->execute([$chatId,'','support_client_'.$userId,$userId ?: null,$name,$phone,mb_strtoupper(mb_substr($name,0,1,'UTF-8'),'UTF-8'),'Консультант KARETA.KZ','K','Онлайн-консультация','', 'active',0,0,1]);
    $msgId='support_msg_'.substr(hash('sha256',$chatId.':'.$message.':'.microtime(true)),0,32);
    $pdo->prepare("INSERT INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,NOW())")
        ->execute([$msgId,$chatId,'','client',$userId ?: null,'text',$message,date('H:i')]);
    try { $pdo->prepare("UPDATE `chats` SET unread_admin=unread_admin+1,updated_at=NOW() WHERE id=?")->execute([$chatId]); } catch (Throwable $_) {}
    $st=$pdo->prepare("SELECT * FROM `chats` WHERE id=? LIMIT 1"); $st->execute([$chatId]);
    kareta_json(['ok'=>true,'chat'=>_fmt_chat($st->fetch())]);
}

function chats_create(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_direct_chat_schema($pdo);
    $c=is_array($b['chat']??null)?$b['chat']:$b;
    $orderId=trim((string)($c['orderId']??$c['order_id']??''));
    if($orderId==='')kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $stOrder=$pdo->prepare("SELECT id,status,client_id,client_user_id,client_name,client_phone,client_car,master_id,master_user_id,master_name,assigned_admin_user_id,sto_id,service_names,type FROM orders WHERE id=? LIMIT 1");
    $stOrder->execute([$orderId]);$order=$stOrder->fetch(PDO::FETCH_ASSOC);
    if(!$order)kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $actor=kareta_session_user()??[];$actorRole=kareta_normalize_role((string)($actor['role']??'guest'));$actorId=(int)($actor['id']??0);$actorPhone=kareta_normalize_phone((string)($actor['phone']??''));
    $allowed=in_array($actorRole,['admin','owner'],true)
        ||($actorRole==='client'&&(($actorId>0&&(int)($order['client_user_id']??0)===$actorId)||($actorPhone!==''&&hash_equals($actorPhone,kareta_normalize_phone((string)($order['client_phone']??''))))))
        ||($actorRole==='master'&&$actorId>0&&(int)($order['master_user_id']??0)===$actorId);
    if(!$allowed&&$actorRole==='sto'){
        $sto=function_exists('kareta_resolve_current_sto')?kareta_resolve_current_sto($pdo,$actor,$b):null;
        $allowed=$sto&&hash_equals((string)($sto['id']??''),(string)($order['sto_id']??''));
    }
    if(!$allowed)kareta_json(['ok'=>false,'error'=>'chat_order_forbidden'],403);
    $existing=$pdo->prepare("SELECT id FROM chats WHERE order_id=? LIMIT 1");$existing->execute([$orderId]);
    $chatId=(string)($existing->fetchColumn()?:('ch_'.substr(preg_replace('/[^A-Za-z0-9]/','',$orderId)?:hash('sha256',$orderId),0,48)));
    $clientPhone=kareta_normalize_phone((string)($order['client_phone']??''));
    $clientUserId=(int)($order['client_user_id']??0);
    $masterId=(string)($order['master_id']??'0');$masterUserId=(int)($order['master_user_id']??0);
    $clientName=kareta_clean_text((string)($order['client_name']??'Клиент'),191);$masterName=kareta_clean_text((string)($order['master_name']??'Администрация'),191);
    $clientInit=mb_strtoupper(mb_substr($clientName,0,1,'UTF-8'),'UTF-8');$masterInit=mb_strtoupper(mb_substr($masterName,0,1,'UTF-8'),'UTF-8');
    $assignedAdminUserId=(int)($order['assigned_admin_user_id']??0)?:null;
    $stmtChatCreate = $pdo->prepare("INSERT IGNORE INTO `chats`
        (id,order_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $stmtChatCreate->execute([$chatId,$orderId,(string)($order['client_id']??''),$clientUserId?:null,$clientName,
                   $clientPhone,$clientInit,$masterId,$masterUserId?:null,$assignedAdminUserId,
                   $masterName,$masterInit,kareta_clean_text((string)($order['service_names']??($order['type']??'Заявка')),191),kareta_clean_text((string)($order['client_car']??''),191),(string)($order['status']??'new'),0,1,1]);
    if ($stmtChatCreate->rowCount() > 0) {
        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_init_'.$chatId,$chatId,$orderId,'system',null,'event','Заявка '.$orderId.' создана',date('H:i'),date('Y-m-d H:i:s')]);
    }
    $participant=$pdo->prepare("INSERT IGNORE INTO chat_participants(chat_id,user_id,role) VALUES(?,?,?)");
    if($clientUserId>0)$participant->execute([$chatId,$clientUserId,'client']);
    if($masterUserId>0)$participant->execute([$chatId,$masterUserId,'master']);
    if($assignedAdminUserId)$participant->execute([$chatId,$assignedAdminUserId,'admin']);
    kareta_rebuild_user_stats($pdo);
    $st=$pdo->prepare("SELECT * FROM `chats` WHERE id=? LIMIT 1"); $st->execute([$chatId]);
    kareta_json(['ok'=>true,'chat'=>_fmt_chat($st->fetch())]);
}
function chats_markRead(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId=(string)($b['chatId'] ?? '');
    kareta_require_chat_access($pdo, $chatId);
    $chatActor=kareta_chat_actor($pdo);
    $role=(string)($chatActor['role'] ?? 'guest');
    if ($role === 'owner') $role='admin';
    if (!in_array($role,['client','master','sto','seller','admin'],true)) kareta_json(['ok'=>false,'error'=>'invalid_role'],422);
    $unreadCol='unread_'.$role;
    $readCol='read_'.$role.'_at';
    if($role==='seller'){try{kareta_ensure_column($pdo,'chats','unread_seller',"ALTER TABLE `chats` ADD COLUMN `unread_seller` INT NOT NULL DEFAULT 0");}catch(Throwable $_){}}
    try { kareta_ensure_column($pdo,'messages',$readCol,"ALTER TABLE `messages` ADD COLUMN `{$readCol}` DATETIME NULL DEFAULT NULL AFTER `created_at`"); } catch (Throwable $_) {}
    $pdo->beginTransaction();
    try {
        $actorId=(int)($chatActor['userId'] ?? 0);
        try{
            kareta_ensure_direct_chat_schema($pdo);
            $pdo->prepare("UPDATE chat_participants SET unread_count=0,last_read_at=NOW() WHERE chat_id=? AND user_id=?")->execute([$chatId,$actorId]);
            if ($actorId > 0) {
                $pdo->prepare("INSERT IGNORE INTO chat_message_reads(message_id,chat_id,user_id,read_at) SELECT id,chat_id,?,NOW() FROM messages WHERE chat_id=? AND COALESCE(author_user_id,0)<>?")
                    ->execute([$actorId,$chatId,$actorId]);
            }
        }catch(Throwable $_){}
        $pdo->prepare("UPDATE `chats` SET `{$unreadCol}`=0, updated_at=updated_at WHERE id=?")->execute([$chatId]);
        $pdo->prepare("UPDATE `messages` SET `{$readCol}`=COALESCE(`{$readCol}`,NOW()) WHERE chat_id=? AND from_role<>?")->execute([$chatId,$role]);
        $pdo->commit();
    } catch (Throwable $e) { if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
    kareta_json(['ok'=>true,'chatId'=>$chatId,'role'=>$role]);
}
function chats_incUnread(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId = (string)($b['chatId'] ?? '');
    $targetRole=preg_replace('/[^a-z]/','',(string)($b['role']??'client'));
    if(!in_array($targetRole,['client','master','sto','seller','admin'],true))kareta_json(['ok'=>false,'error'=>'invalid_role'],422);
    $col='unread_'.$targetRole;
    kareta_require_chat_access($pdo, $chatId);
    $eventId = trim((string)($b['eventId'] ?? $b['idempotencyKey'] ?? $b['clientEventId'] ?? ''));
    if ($eventId !== '') {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `chat_counter_events` (`id` VARCHAR(80) NOT NULL, `chat_id` VARCHAR(64) NOT NULL, `counter` VARCHAR(32) NOT NULL, `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), KEY `idx_cce_chat` (`chat_id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $stmtEvent = $pdo->prepare("INSERT IGNORE INTO `chat_counter_events` (`id`,`chat_id`,`counter`) VALUES (?,?,?)");
        $stmtEvent->execute([substr(hash('sha256', $chatId.':'.$col.':'.$eventId),0,80), $chatId, $col]);
        if ($stmtEvent->rowCount() === 0) kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'counter_event_already_applied']);
    }
    $pdo->prepare("UPDATE `chats` SET {$col}={$col}+1 WHERE id=?")->execute([$chatId]);
    kareta_json(['ok'=>true]);
}

/* ── MESSAGES ─────────────────────────────────────────────────────── */
function kareta_message_public_file_url(string $stored,string $messageId,string $chatId): string {
    if(str_starts_with($stored,'secure-chat/'))return '/api/chat_attachment.php?chatId='.rawurlencode($chatId).'&messageId='.rawurlencode($messageId);
    return $stored;
}
function kareta_message_public_meta($raw): array {
    $decoded=is_array($raw)?$raw:json_decode((string)$raw,true);
    if(!is_array($decoded))return [];
    $allowed=['stageId','stageLabel','stageIco','orderId','parts','nextStep','fileMime','fileSize','replyToId','replyToText','replyToAuthor','reportId','partId','actorRole'];
    $result=[];
    foreach($allowed as $key)if(array_key_exists($key,$decoded)&&is_scalar($decoded[$key]))$result[$key]=mb_substr((string)$decoded[$key],0,1000,'UTF-8');
    return $result;
}
function messages_get(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId = (string)($b['chatId'] ?? '');
    $chat = kareta_require_chat_access($pdo, $chatId);
    kareta_ensure_direct_chat_schema($pdo);
    try { kareta_ensure_column($pdo,'messages','edited_at',"ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL DEFAULT NULL AFTER created_at"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo,'messages','deleted_at',"ALTER TABLE messages ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER created_at"); } catch (Throwable $_) {}
    $st=$pdo->prepare("SELECT m.*,u.name author_name,u.initials author_initials,
        EXISTS(SELECT 1 FROM chat_message_reads r WHERE r.message_id=m.id AND r.user_id<>COALESCE(m.author_user_id,0)) peer_read
        FROM `messages` m LEFT JOIN users u ON u.id=m.author_user_id WHERE m.chat_id=? ORDER BY m.created_at,m.id"); $st->execute([$chatId]);
    $rows=[];
    $viewerActor=kareta_chat_actor($pdo);
    $viewerRole=(string)($viewerActor['role'] ?? 'guest'); if($viewerRole==='owner')$viewerRole='admin';
    $viewerId=(int)($viewerActor['userId'] ?? 0);
    $isDirect=(($chat['chat_type'] ?? 'order') === 'direct');
    foreach ($st->fetchAll() as $m) {
        $row=['id'=>$m['id'],'from'=>$m['from_role'],'authorUserId'=>(int)($m['author_user_id']??0),'authorName'=>(string)($m['author_name']??''),'authorInitials'=>(string)($m['author_initials']??''),'type'=>$m['type'],'text'=>$m['text'],'time'=>$m['time'],'createdAt'=>$m['created_at'] ?? null,'editedAt'=>$m['edited_at']??null,'deletedAt'=>$m['deleted_at']??null];
        if ($m['file_name']) { $row['fileName']=$m['file_name']; $row['fileType']=$m['file_type']; }
        if (!empty($m['file_url'])) $row['fileUrl']=kareta_message_public_file_url((string)$m['file_url'],(string)$m['id'],$chatId); elseif ($m['file_data']) $row['fileData']=$m['file_data'];
        if ($m['meta']) { foreach (kareta_message_public_meta($m['meta']) as $k=>$v) $row[$k]=$v; }
        $readMap=['client'=>$m['read_client_at']??null,'master'=>$m['read_master_at']??null,'sto'=>$m['read_sto_at']??null,'seller'=>$m['read_seller_at']??null,'admin'=>$m['read_admin_at']??null];
        $row['readBy']=$readMap;
        if ((int)($m['author_user_id']??0) > 0 && (int)$m['author_user_id'] === $viewerId) {
            if ($isDirect) $row['deliveryStatus']=!empty($m['peer_read']) ? 'read' : 'delivered';
            else {
                $targets=[];
                foreach($readMap as $role=>$at){ if($role!==$viewerRole && $at)$targets[]=$role; }
                $row['deliveryStatus']=$targets ? 'read' : 'delivered';
            }
        } elseif (($m['from_role']??'') === $viewerRole && !$isDirect) {
            $targets=[];
            foreach($readMap as $role=>$at){ if($role!==$viewerRole && $at)$targets[]=$role; }
            $row['deliveryStatus']=$targets ? 'read' : 'delivered';
        }
        $rows[]=$row;
    }
    kareta_json(['ok'=>true,'messages'=>$rows]);
}

function messages_update(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId = trim((string)($b['chatId'] ?? ''));
    $messageId = trim((string)($b['messageId'] ?? $b['id'] ?? ''));
    $text = kareta_clean_text($b['text'] ?? null, 4000);
    if ($chatId === '' || $messageId === '') kareta_json(['ok'=>false,'error'=>'message_required'],422);
    if ($text === null || trim($text) === '') kareta_json(['ok'=>false,'error'=>'text_required','message'=>'Введите текст сообщения'],422);
    kareta_require_chat_access($pdo, $chatId);
    $actorId = (int)(kareta_chat_actor($pdo)['userId'] ?? 0);
    $st = $pdo->prepare("SELECT * FROM messages WHERE id=? AND chat_id=? LIMIT 1");
    $st->execute([$messageId,$chatId]);
    $row = $st->fetch();
    if (!$row) kareta_json(['ok'=>false,'error'=>'message_not_found'],404);
    if ((int)($row['author_user_id'] ?? 0) !== $actorId) kareta_json(['ok'=>false,'error'=>'message_not_owned'],403);
    if (($row['type'] ?? 'text') !== 'text') kareta_json(['ok'=>false,'error'=>'message_not_editable'],409);
    $created = strtotime((string)($row['created_at'] ?? '')) ?: 0;
    if ($created > 0 && time() - $created > 86400) kareta_json(['ok'=>false,'error'=>'edit_window_expired','message'=>'Сообщение можно изменить в течение 24 часов'],409);
    kareta_ensure_column($pdo,'messages','edited_at',"ALTER TABLE messages ADD COLUMN edited_at DATETIME NULL DEFAULT NULL AFTER created_at");
    $pdo->prepare("UPDATE messages SET text=?,edited_at=NOW() WHERE id=? AND chat_id=?")->execute([$text,$messageId,$chatId]);
    kareta_json(['ok'=>true,'id'=>$messageId,'text'=>$text,'editedAt'=>date('Y-m-d H:i:s')]);
}

function messages_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId = trim((string)($b['chatId'] ?? ''));
    $messageId = trim((string)($b['messageId'] ?? $b['id'] ?? ''));
    if ($chatId === '' || $messageId === '') kareta_json(['ok'=>false,'error'=>'message_required'],422);
    kareta_require_chat_access($pdo, $chatId);
    $chatActor=kareta_chat_actor($pdo);
    $actorId = (int)($chatActor['userId'] ?? 0);
    $role = (string)($chatActor['role'] ?? 'guest');
    $st = $pdo->prepare("SELECT * FROM messages WHERE id=? AND chat_id=? LIMIT 1");
    $st->execute([$messageId,$chatId]);
    $row = $st->fetch();
    if (!$row) kareta_json(['ok'=>false,'error'=>'message_not_found'],404);
    $canModerate = in_array($role,['admin','owner'],true);
    if ((int)($row['author_user_id'] ?? 0) !== $actorId && !$canModerate) kareta_json(['ok'=>false,'error'=>'message_not_owned'],403);
    if (in_array((string)($row['type'] ?? ''),['event','stage','report'],true) && !$canModerate) kareta_json(['ok'=>false,'error'=>'system_message_locked'],409);
    $fileUrl = trim((string)($row['file_url'] ?? ''));
    kareta_ensure_column($pdo,'messages','deleted_at',"ALTER TABLE messages ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER created_at");
    $pdo->prepare("UPDATE messages SET type='deleted',text='Сообщение удалено',file_name=NULL,file_type=NULL,file_url=NULL,file_data=NULL,meta=NULL,deleted_at=NOW() WHERE id=? AND chat_id=?")->execute([$messageId,$chatId]);
    if ($fileUrl !== '' && (strpos($fileUrl,'uploads/chat/') === 0 || strpos($fileUrl,'secure-chat/') === 0)) {
        $abs = strpos($fileUrl,'secure-chat/')===0
            ? KARETA_STORAGE_ROOT.'/uploads/chat/'.substr($fileUrl,strlen('secure-chat/'))
            : dirname(__DIR__).'/'.$fileUrl;
        if (is_file($abs)) @unlink($abs);
    }
    kareta_json(['ok'=>true,'id'=>$messageId,'deleted'=>true]);
}

function messages_add(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $chatId=(string)($b['chatId']??''); $msg=$b['msg']??$b['message']??[];
    $chat = kareta_require_chat_access($pdo, $chatId);
    $chatActor = kareta_chat_actor($pdo);
    $actorUserId = (int)($chatActor['userId'] ?? 0);
    $actorRole = (string)($chatActor['role'] ?? 'guest');
    if ($actorRole === 'owner') $actorRole='admin';
    $id=trim((string)($msg['id']??''));
    if(!preg_match('/^[A-Za-z0-9_-]{1,96}$/',$id))$id='m_'.bin2hex(random_bytes(16));
    $clientMessageId = trim((string)($msg['client_message_id'] ?? $msg['clientMessageId'] ?? $b['client_message_id'] ?? $b['clientMessageId'] ?? ''));
    if ($clientMessageId === '' && isset($msg['id'])) $clientMessageId = trim((string)$msg['id']);
    $clientMessageId = $clientMessageId !== '' ? mb_substr($clientMessageId, 0, 96, 'UTF-8') : null;
    // Resolve retries before decoding/writing attachments so duplicate requests cannot create orphan files.
    if ($clientMessageId !== null) {
        try {
            $dup=$pdo->prepare("SELECT id FROM messages WHERE chat_id=? AND from_role=? AND client_message_id=? LIMIT 1");
            $dupRole=$actorRole;
            $dup->execute([$chatId,$dupRole,$clientMessageId]);
            $existing=(string)($dup->fetchColumn()?:'');
            if($existing!=='') kareta_json(['ok'=>true,'id'=>$existing,'skipped'=>true,'reason'=>'duplicate_message']);
        } catch(Throwable $_) {}
    }
    $meta=[]; $metaKeys=['stageId','stageLabel','stageIco','orderId','parts','nextStep','fileMime','fileSize','replyToId','replyToText','replyToAuthor'];
    foreach ($metaKeys as $k) { if (isset($msg[$k])) $meta[$k]=is_scalar($msg[$k])?mb_substr((string)$msg[$k],0,1000,'UTF-8'):null; }
    $fileName = trim((string)($msg['fileName'] ?? ''));
    $fileType = strtolower(trim((string)($msg['fileType'] ?? '')));
    $fileData = (string)($msg['fileData'] ?? '');
    if ($fileData !== '') $fileName = mb_substr($fileName !== '' ? basename(str_replace('\\','/',$fileName)) : 'attachment', 0, 191, 'UTF-8');
    else { $fileName = ''; $fileType = ''; }
    $fileUrl = '';
    $writtenFile = '';
    if ($fileData !== '') {
        if (strlen($fileData) > 3600000 || !preg_match('~^data:([^;]+);base64,([A-Za-z0-9+/=]+)$~s', $fileData, $mm)) kareta_json(['ok'=>false,'error'=>'invalid_file_data'],422);
        $declared=strtolower(trim((string)$mm[1]));$raw=base64_decode($mm[2],true);
        if($raw===false)kareta_json(['ok'=>false,'error'=>'invalid_file_data'],422);
        if(strlen($raw)>2621440)kareta_json(['ok'=>false,'error'=>'file_too_large','message'=>'Файл превышает допустимый размер 2,5 МБ'],413);
        $allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','video/mp4'=>'mp4','video/webm'=>'webm','audio/webm'=>'webm','audio/ogg'=>'ogg','audio/mpeg'=>'mp3','application/pdf'=>'pdf','text/plain'=>'txt'];
        if(!isset($allowed[$declared]))kareta_json(['ok'=>false,'error'=>'unsupported_file_type','message'=>'Этот тип файла не поддерживается'],415);
        $detected=class_exists('finfo')?(string)(new finfo(FILEINFO_MIME_TYPE))->buffer($raw):'';
        $valid=$detected===$declared;
        if(in_array($declared,['video/webm','audio/webm'],true))$valid=in_array($detected,['video/webm','audio/webm','application/octet-stream'],true)&&str_starts_with($raw,"\x1A\x45\xDF\xA3");
        if($declared==='video/mp4')$valid=in_array($detected,['video/mp4','application/octet-stream'],true)&&substr($raw,4,4)==='ftyp';
        if($declared==='application/pdf')$valid=$detected==='application/pdf'&&str_starts_with($raw,'%PDF-');
        if(!$valid)kareta_json(['ok'=>false,'error'=>'file_content_mismatch'],415);
        $rel=date('Y/m');$dir=KARETA_STORAGE_ROOT.'/uploads/chat/'.$rel;
        if(!is_dir($dir)&&!mkdir($dir,0750,true)&&!is_dir($dir))kareta_json(['ok'=>false,'error'=>'upload_directory_failed'],500);
        $safe=bin2hex(random_bytes(24)).'.'.$allowed[$declared];$abs=$dir.'/'.$safe;
        if(file_put_contents($abs,$raw,LOCK_EX)===false)kareta_json(['ok'=>false,'error'=>'upload_write_failed'],500);
        @chmod($abs,0640);$writtenFile=$abs;$fileUrl='secure-chat/'.$rel.'/'.$safe;$fileData='';$fileType=$declared;
    }
    $from = $actorRole; if(!in_array($from,['client','master','sto','seller','admin'],true))$from='system';
    $authorUserId = null;
    if ($from === 'client') $authorUserId = (int)($chat['client_user_id'] ?? 0) ?: ($actorUserId ?: null);
    elseif ($from === 'master') $authorUserId = (int)($chat['master_user_id'] ?? 0) ?: ($actorUserId ?: null);
    elseif ($from === 'admin') $authorUserId = (int)($chat['assigned_admin_user_id'] ?? 0) ?: ($actorUserId ?: null);
    elseif (in_array($from,['sto','seller'],true)) $authorUserId = $actorUserId ?: null;
    if (!$authorUserId && $from !== 'system') $authorUserId = $actorUserId ?: null;
    try { kareta_ensure_column($pdo, 'messages', 'client_message_id', "ALTER TABLE `messages` ADD COLUMN `client_message_id` VARCHAR(96) NULL DEFAULT NULL AFTER `id`"); } catch (Throwable $_) {}
    try { kareta_ensure_index($pdo, 'messages', 'uq_messages_client_message_id', "ALTER TABLE `messages` ADD UNIQUE KEY `uq_messages_client_message_id` (`chat_id`,`from_role`,`client_message_id`)"); } catch (Throwable $_) {}
    $ins = $pdo->prepare("INSERT IGNORE INTO `messages`(id,client_message_id,chat_id,order_id,from_role,author_user_id,type,text,file_name,file_type,file_url,file_data,meta,time,created_at)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    try {
        $ins->execute([$id,$clientMessageId,$chatId,(string)($chat['order_id'] ?? ($meta['orderId'] ?? '')),$from,$authorUserId,
                       in_array((string)($msg['type'] ?? 'text'), ['text','event','image','video','file','stage','report'], true) ? (string)($msg['type'] ?? 'text') : 'text', kareta_clean_text($msg['text']??null, 4000) ?: null,
                       $fileName !== '' ? $fileName : null,$fileType !== '' ? $fileType : null,$fileUrl !== '' ? $fileUrl : null,$fileData !== '' ? $fileData : null,
                       $meta ? json_encode($meta,JSON_UNESCAPED_UNICODE) : null,
                       date('H:i'),date('Y-m-d H:i:s')]);
    } catch(Throwable $error) {
        if($writtenFile!==''&&is_file($writtenFile))@unlink($writtenFile);
        throw $error;
    }
    if ($ins->rowCount() === 0) {
        if($writtenFile!==''&&is_file($writtenFile))@unlink($writtenFile);
        $existing=$id;
        if($clientMessageId!==null){try{$dup=$pdo->prepare("SELECT id FROM messages WHERE chat_id=? AND from_role=? AND client_message_id=? LIMIT 1");$dup->execute([$chatId,$from,$clientMessageId]);$existing=(string)($dup->fetchColumn()?:$id);}catch(Throwable $_){}}
        kareta_json(['ok'=>true,'id'=>$existing,'skipped'=>true,'reason'=>'duplicate_message']);
    }
    try {
        $actorId=$actorUserId;
        $pdo->prepare("UPDATE chat_participants SET unread_count=unread_count+1 WHERE chat_id=? AND user_id<>? AND left_at IS NULL")->execute([$chatId,$actorId]);
        $pdo->prepare("UPDATE chats SET updated_at=NOW() WHERE id=?")->execute([$chatId]);
    } catch(Throwable $_) {}

    $isDirect = (($chat['chat_type'] ?? 'order') === 'direct');
    if ($isDirect) {
        try {
            $actorId=$actorUserId;
            $ps=$pdo->prepare("SELECT cp.user_id,cp.role,u.name FROM chat_participants cp JOIN users u ON u.id=cp.user_id WHERE cp.chat_id=? AND cp.user_id<>? AND cp.left_at IS NULL");
            $ps->execute([$chatId,$actorId]);
            foreach($ps->fetchAll() as $recipient){
                kareta_notification_insert($pdo,[
                    'recipientUserId'=>(int)$recipient['user_id'],'recipientRole'=>(string)$recipient['role'],
                    'eventType'=>'message.new','entityType'=>'chat','entityId'=>$chatId,
                    'title'=>'Новое личное сообщение','body'=>mb_substr((string)($msg['text']??$fileName?:'Вложение'),0,140),
                    'actionUrl'=>'#/chats?chatId='.rawurlencode($chatId),'meta'=>['chatId'=>$chatId]
                ]);
            }
        } catch(Throwable $_) {}
    } elseif ($from === 'client') {
        $pdo->prepare("UPDATE `chats` SET unread_master=unread_master+1, unread_admin=unread_admin+1, updated_at=NOW() WHERE id=?")->execute([$chatId]);
        if ((int)($chat['master_user_id'] ?? 0) > 0) {
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)$chat['master_user_id'],
                'recipientRole' => 'master',
                'eventType' => 'message.new',
                'entityType' => 'chat',
                'entityId' => $chatId,
                'title' => 'Новое сообщение по заявке ' . (string)($chat['order_id'] ?? ''),
                'body' => (string)($chat['client_name'] ?? 'Клиент') . ': ' . mb_substr((string)($msg['text'] ?? ''), 0, 140),
                'actionUrl' => '#/chats?chatId='.rawurlencode($chatId),
                'meta' => ['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
            ]);
        }
        kareta_notify_role($pdo, 'admin', [
            'eventType' => 'message.new',
            'entityType' => 'chat',
            'entityId' => $chatId,
            'title' => 'Новое сообщение клиента',
            'body' => (string)($chat['client_name'] ?? 'Клиент') . ': ' . mb_substr((string)($msg['text'] ?? ''), 0, 140),
            'actionUrl' => '#/chats?chatId='.rawurlencode($chatId),
            'meta' => ['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
        ]);
    } elseif (in_array($from, ['master','admin','owner'], true)) {
        $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, updated_at=NOW() WHERE id=?")->execute([$chatId]);
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($chat['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($chat['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'message.new',
            'entityType' => 'chat',
            'entityId' => $chatId,
            'title' => 'Новое сообщение по заявке ' . (string)($chat['order_id'] ?? ''),
            'body' => mb_substr((string)($msg['text'] ?? ''), 0, 140),
            'actionUrl' => '#/chats?chatId='.rawurlencode($chatId),
            'meta' => ['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
        ]);
    } elseif ($from === 'sto') {
        try { kareta_ensure_column($pdo, 'chats', 'unread_sto', "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0"); } catch (Throwable $_) {}
        $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_master=unread_master+1, updated_at=NOW() WHERE id=?")->execute([$chatId]);
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($chat['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($chat['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'message.new',
            'entityType' => 'chat',
            'entityId' => $chatId,
            'title' => 'Сообщение от СТО по заявке ' . (string)($chat['order_id'] ?? ''),
            'body' => mb_substr((string)($msg['text'] ?? ''), 0, 140),
            'actionUrl' => '#/chats?chatId='.rawurlencode($chatId),
            'meta' => ['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
        ]);
        if ((int)($chat['master_user_id'] ?? 0) > 0) {
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)$chat['master_user_id'],
                'recipientRole' => 'master',
                'eventType' => 'message.new',
                'entityType' => 'chat',
                'entityId' => $chatId,
                'title' => 'Сообщение от СТО по заявке ' . (string)($chat['order_id'] ?? ''),
                'body' => mb_substr((string)($msg['text'] ?? ''), 0, 140),
                'actionUrl' => '#/chats?chatId='.rawurlencode($chatId),
                'meta' => ['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
            ]);
        }
    } elseif ($from === 'seller') {
        try { kareta_ensure_column($pdo, 'chats', 'unread_seller', "ALTER TABLE `chats` ADD COLUMN `unread_seller` INT NOT NULL DEFAULT 0"); } catch (Throwable $_) {}
        try { kareta_ensure_column($pdo, 'chats', 'unread_sto', "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0"); } catch (Throwable $_) {}
        $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_sto=unread_sto+1, updated_at=NOW() WHERE id=?")->execute([$chatId]);
        kareta_notification_insert($pdo, [
            'recipientUserId'=>(int)($chat['client_user_id'] ?? 0) ?: null,
            'recipientPhone'=>(string)($chat['client_phone'] ?? ''),
            'recipientRole'=>'client','eventType'=>'message.new','entityType'=>'chat','entityId'=>$chatId,
            'title'=>'Сообщение от продавца','body'=>mb_substr((string)($msg['text'] ?? ''),0,140),
            'actionUrl'=>'#/chats?chatId='.rawurlencode($chatId),'meta'=>['chatId'=>$chatId,'orderId'=>(string)($chat['order_id'] ?? '')],
        ]);
    } elseif ($from === 'system') {
        $pdo->prepare("UPDATE `chats` SET unread_client=unread_client+1, unread_admin=unread_admin+1 WHERE id=?")->execute([$chatId]);
    }


    // R188.5.5.6.84.86: external channels are queued only after KARETA has
    // committed its own chat message. Provider network calls never block chat send.
    try {
        $externalText = trim((string)($msg['text'] ?? ''));
        if ($externalText === '') $externalText = $fileName !== '' ? ('Вложение: ' . $fileName) : 'Новое сообщение';
        kareta_messaging_enqueue_chat_message($pdo,$chatId,$id,(int)($authorUserId ?? 0),$externalText,'');
    } catch (Throwable $messagingError) {
        if (function_exists('kareta_log_error')) kareta_log_error('MESSAGING_ENQUEUE',$messagingError->getMessage());
    }

    kareta_rebuild_user_stats($pdo);
    kareta_json(['ok'=>true,'id'=>$id]);
}



function kareta_fmt_master_schedule(array $r): array {
    return [
        'id' => (string)($r['id'] ?? ''),
        'masterId' => (string)($r['master_id'] ?? ''),
        'workDate' => (string)($r['work_date'] ?? ''),
        'startTime' => substr((string)($r['start_time'] ?? ''), 0, 5),
        'endTime' => substr((string)($r['end_time'] ?? ''), 0, 5),
        'isDayOff' => !empty($r['is_day_off']),
        'note' => (string)($r['note'] ?? ''),
        'createdAt' => (string)($r['created_at'] ?? ''),
        'updatedAt' => (string)($r['updated_at'] ?? ''),
    ];
}

function master_schedule_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $row = $b['schedule'] ?? $b;
    $masterId = trim((string)($row['masterId'] ?? ''));
    $workDate = trim((string)($row['workDate'] ?? ''));
    if ($masterId === '' || $workDate === '') kareta_json(['ok'=>false,'error'=>'master_and_date_required'],422);
    // Patch 4: централизованная проверка владения
    kareta_assert_master_owns_profile($pdo, $masterId);
    $id = trim((string)($row['id'] ?? '')) ?: ('msh_' . substr(md5($masterId . '|' . $workDate),0,16));
    $isDayOff = !empty($row['isDayOff']) ? 1 : 0;
    $start = trim((string)($row['startTime'] ?? '09:00'));
    $end = trim((string)($row['endTime'] ?? '18:00'));
    $note = kareta_clean_text($row['note'] ?? '',191);
    if (!preg_match('~^\d{4}-\d{2}-\d{2}$~', $workDate)) kareta_json(['ok'=>false,'error'=>'invalid_work_date'],422);
    if (!$isDayOff) {
        if (!preg_match('~^\d{2}:\d{2}$~',$start) || !preg_match('~^\d{2}:\d{2}$~',$end)) kareta_json(['ok'=>false,'error'=>'invalid_work_time'],422);
    } else { $start = null; $end = null; }
    $pdo->prepare("INSERT INTO `master_schedules`(id,master_id,work_date,start_time,end_time,is_day_off,note) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE start_time=VALUES(start_time), end_time=VALUES(end_time), is_day_off=VALUES(is_day_off), note=VALUES(note), updated_at=CURRENT_TIMESTAMP")->execute([$id,$masterId,$workDate,$start,$end,$isDayOff,$note]);
    $st=$pdo->prepare("SELECT * FROM `master_schedules` WHERE id=? LIMIT 1"); $st->execute([$id]);
    $rowDb=$st->fetch() ?: ['id'=>$id,'master_id'=>$masterId,'work_date'=>$workDate,'start_time'=>$start,'end_time'=>$end,'is_day_off'=>$isDayOff,'note'=>$note];
    $recovery=function_exists('kareta_master_schedule_auto_recover')?kareta_master_schedule_auto_recover($pdo,$masterId,'date_schedule_changed',$workDate,'',false):[];
    kareta_json(['ok'=>true,'schedule'=>kareta_fmt_master_schedule($rowDb),'recovery'=>$recovery]);
}

function master_schedule_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = trim((string)($b['id'] ?? ''));
    if ($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    // Patch 4: находим masterId и проверяем владение
    if (!kareta_has_role('admin')) {
        $st = $pdo->prepare("SELECT master_id FROM `master_schedules` WHERE id=? LIMIT 1");
        $st->execute([$id]);
        $sched = $st->fetch();
        if (!$sched) kareta_json(['ok'=>false,'error'=>'not_found'],404);
        kareta_assert_master_owns_profile($pdo, (string)($sched['master_id'] ?? ''));
    }
    $pdo->prepare("DELETE FROM `master_schedules` WHERE id=?")->execute([$id]);
    kareta_json(['ok'=>true,'id'=>$id]);
}


function kareta_master_wall_ensure_table(?PDO $pdo): void {
    if (!$pdo) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS `master_wall_posts` (
      `id` VARCHAR(64) NOT NULL PRIMARY KEY,
      `master_id` VARCHAR(64) NOT NULL,
      `master_user_id` INT NULL DEFAULT NULL,
      `master_name` VARCHAR(190) NULL DEFAULT NULL,
      `order_id` VARCHAR(64) NULL DEFAULT NULL,
      `post_type` VARCHAR(32) NOT NULL DEFAULT 'report',
      `stage_code` VARCHAR(64) NULL DEFAULT NULL,
      `title` VARCHAR(255) NULL DEFAULT NULL,
      `text` MEDIUMTEXT NULL,
      `links_json` JSON NULL,
      `photos_json` JSON NULL,
      `files_json` JSON NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` DATETIME NULL DEFAULT NULL,
      `active` TINYINT(1) NOT NULL DEFAULT 1,
      KEY `idx_master_wall_master` (`master_id`),
      KEY `idx_master_wall_order` (`order_id`),
      KEY `idx_master_wall_active_created` (`active`,`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
function kareta_fmt_master_wall_post(array $r): array {
    return [
      'id'=>(string)($r['id']??''),
      'masterId'=>(string)($r['master_id']??''),
      'masterUserId'=>(int)($r['master_user_id']??0),
      'masterName'=>(string)($r['master_name']??''),
      'orderId'=>(string)($r['order_id']??''),
      'postType'=>(string)($r['post_type']??'report'),
      'stageCode'=>(string)($r['stage_code']??''),
      'category'=>(string)($r['category']??'repair_story'),
      'title'=>(string)($r['title']??''),
      'preview'=>(string)($r['preview']??''),
      'text'=>(string)($r['text']??''),
      'links'=>json_decode((string)($r['links_json']??'[]'),true)?:[],
      'photos'=>json_decode((string)($r['photos_json']??'[]'),true)?:[],
      'files'=>json_decode((string)($r['files_json']??'[]'),true)?:[],
      'steps'=>json_decode((string)($r['steps_json']??'[]'),true)?:[],
      'parts'=>json_decode((string)($r['parts_json']??'[]'),true)?:[],
      'createdAt'=>(string)($r['created_at']??''),
      'updatedAt'=>(string)($r['updated_at']??''),
    ];
}
function master_wall_get_mine(?PDO $pdo): void {
    if (!$pdo) _no_db();
    kareta_master_wall_ensure_table($pdo);
    $user = kareta_actor();
    $role = (string)($user['role'] ?? 'guest');
    $actorUserId = (int)($user['id'] ?? 0);
    $phone = trim((string)($user['phone'] ?? ''));
    if ($role === 'admin' || $role === 'owner') {
        $rows = kareta_try_query_all($pdo, "SELECT * FROM `master_wall_posts` WHERE active=1 ORDER BY created_at DESC", [], [], 'MASTER_WALL_ALL');
        kareta_json(['ok'=>true,'posts'=>array_map('kareta_fmt_master_wall_post',$rows)]);
    }
    $masterId = '';
    if ($actorUserId > 0) { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1"); $stm->execute([$actorUserId]); $masterId = (string)($stm->fetchColumn() ?: ''); }
    if ($masterId === '' && $phone !== '') { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1"); $stm->execute([$phone,$phone]); $masterId = (string)($stm->fetchColumn() ?: ''); }
    if ($masterId === '') kareta_json(['ok'=>true,'posts'=>[]]);
    $rows = kareta_try_query_all($pdo, "SELECT * FROM `master_wall_posts` WHERE active=1 AND master_id=? ORDER BY created_at DESC", [$masterId], [], 'MASTER_WALL_OWN');
    kareta_json(['ok'=>true,'posts'=>array_map('kareta_fmt_master_wall_post',$rows)]);
}
function master_wall_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_master_wall_ensure_table($pdo);
    $post = $b['post'] ?? [];
    $user = kareta_actor();
    $actorUserId = (int)($user['id'] ?? 0);
    $phone = trim((string)($user['phone'] ?? ''));
    $masterId = (string)($post['masterId'] ?? '');
    if ($masterId === '') {
        if ($actorUserId > 0) { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? LIMIT 1"); $stm->execute([$actorUserId]); $masterId = (string)($stm->fetchColumn() ?: ''); }
        if ($masterId === '' && $phone !== '') { $stm = $pdo->prepare("SELECT id FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1"); $stm->execute([$phone,$phone]); $masterId = (string)($stm->fetchColumn() ?: ''); }
    }
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_not_found'],400);
    $stm = $pdo->prepare("SELECT user_id, COALESCE(NULLIF(name,''), '') AS name FROM `masters` WHERE id=? LIMIT 1"); $stm->execute([$masterId]);
    $m = $stm->fetch() ?: ['user_id'=>null,'name'=>(string)($post['masterName'] ?? 'Мастер')];
    if ($role === 'master' && (int)($m['user_id'] ?? 0) > 0 && (int)($m['user_id'] ?? 0) !== $actorUserId) {
        kareta_json(['ok'=>false,'error'=>'forbidden_master_wall_owner'],403);
    }
    $id = trim((string)($post['id'] ?? '')); if ($id==='') $id = 'mwp_' . bin2hex(random_bytes(6));
    if ($id !== '' && $role === 'master') {
        $own = $pdo->prepare("SELECT master_id FROM `master_wall_posts` WHERE id=? LIMIT 1"); $own->execute([$id]);
        $ownMasterId = (string)($own->fetchColumn() ?: '');
        if ($ownMasterId !== '' && $ownMasterId !== $masterId) kareta_json(['ok'=>false,'error'=>'forbidden_master_wall_edit'],403);
    }
    $now = date('Y-m-d H:i:s');
    // Lazy add new columns
    try { $pdo->exec("ALTER TABLE `master_wall_posts` ADD COLUMN `category` VARCHAR(64) NULL DEFAULT 'repair_story'"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `master_wall_posts` ADD COLUMN `preview` TEXT NULL"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `master_wall_posts` ADD COLUMN `steps_json` JSON NULL"); } catch(Throwable $_){}
    try { $pdo->exec("ALTER TABLE `master_wall_posts` ADD COLUMN `parts_json` JSON NULL"); } catch(Throwable $_){}
    $category = trim((string)($post['category'] ?? 'repair_story')) ?: 'repair_story';
    $preview  = trim((string)($post['preview'] ?? ''));
    $stepsJson = json_encode(is_array($post['steps'] ?? null) ? $post['steps'] : [], JSON_UNESCAPED_UNICODE);
    $partsJson = json_encode(is_array($post['parts'] ?? null) ? $post['parts'] : [], JSON_UNESCAPED_UNICODE);
    $payload = [
      ':id'=>$id, ':master_id'=>$masterId, ':master_user_id'=>(int)($m['user_id'] ?? 0) ?: null, ':master_name'=>(string)($post['masterName'] ?? $m['name'] ?? 'Мастер'),
      ':order_id'=>trim((string)($post['orderId'] ?? '')) ?: null, ':post_type'=>trim((string)($post['postType'] ?? 'repair_story')) ?: 'repair_story', ':stage_code'=>trim((string)($post['stageCode'] ?? '')) ?: null,
      ':category'=>$category, ':preview'=>$preview,
      ':title'=>trim((string)($post['title'] ?? '')) ?: null, ':text'=>(string)($post['text'] ?? ''),
      ':links_json'=>json_encode($post['links'] ?? [], JSON_UNESCAPED_UNICODE),
      ':photos_json'=>json_encode($post['photos'] ?? [], JSON_UNESCAPED_UNICODE),
      ':files_json'=>json_encode($post['files'] ?? [], JSON_UNESCAPED_UNICODE),
      ':steps_json'=>$stepsJson, ':parts_json'=>$partsJson,
      ':updated_at'=>$now
    ];
    $pdo->prepare("INSERT INTO `master_wall_posts` (id,master_id,master_user_id,master_name,order_id,post_type,stage_code,category,preview,title,text,links_json,photos_json,files_json,steps_json,parts_json,created_at,updated_at,active) VALUES (:id,:master_id,:master_user_id,:master_name,:order_id,:post_type,:stage_code,:category,:preview,:title,:text,:links_json,:photos_json,:files_json,:steps_json,:parts_json,:updated_at,:updated_at,1) ON DUPLICATE KEY UPDATE order_id=VALUES(order_id), post_type=VALUES(post_type), stage_code=VALUES(stage_code), category=VALUES(category), preview=VALUES(preview), title=VALUES(title), text=VALUES(text), links_json=VALUES(links_json), photos_json=VALUES(photos_json), files_json=VALUES(files_json), steps_json=VALUES(steps_json), parts_json=VALUES(parts_json), master_name=VALUES(master_name), updated_at=VALUES(updated_at), active=1")->execute($payload);
    kareta_log_audit($pdo, 'masterWall.save', ['id'=>$id,'masterId'=>$masterId,'orderId'=>(string)($post['orderId'] ?? '')]);
    if (!empty($post['orderId'])) {
        kareta_notify_role($pdo, 'admin', ['eventType'=>'master.wall.post','entityType'=>'order','entityId'=>(string)$post['orderId'],'title'=>'Мастер добавил публикацию по заявке '.(string)$post['orderId'],'body'=>mb_substr(trim((string)($post['text'] ?? '')),0,140) ?: 'Новый этап работ на стене мастера.','actionUrl'=>'#admin','meta'=>['orderId'=>(string)$post['orderId'],'pane'=>'orders']]);
    }
    $row = $pdo->query("SELECT * FROM `master_wall_posts` WHERE id=".$pdo->quote($id)." LIMIT 1")->fetch() ?: [];
    kareta_json(['ok'=>true,'post'=>kareta_fmt_master_wall_post($row)]);
}
function master_wall_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_master_wall_ensure_table($pdo);
    $id = trim((string)($b['id'] ?? ''));
    if ($id==='') kareta_json(['ok'=>false,'error'=>'id_required'],400);
    $actor = kareta_actor();
    $role = (string)($actor['role'] ?? 'guest');
    $actorUserId = (int)($actor['id'] ?? 0);
    // Patch 10: жёсткая проверка — мастер удаляет только свои посты
    if (!in_array($role, ['admin','owner'], true)) {
        $st = $pdo->prepare("SELECT master_user_id, master_id FROM `master_wall_posts` WHERE id=? LIMIT 1");
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) kareta_json(['ok'=>false,'error'=>'not_found'],404);
        if ((int)($row['master_user_id'] ?? 0) > 0 && (int)($row['master_user_id'] ?? 0) !== $actorUserId) {
            kareta_log_audit($pdo, 'security.ownership_denied', ['action'=>'masterWall.delete','postId'=>$id,'actorId'=>$actorUserId]);
            kareta_json(['ok'=>false,'error'=>'not_your_post'],403);
        }
    }
    $pdo->prepare("UPDATE `master_wall_posts` SET active=0, updated_at=NOW() WHERE id=?")->execute([$id]);
    kareta_log_audit($pdo, 'masterWall.delete', ['id'=>$id,'mode'=>'soft','actorId'=>$actorUserId]);
    kareta_json(['ok'=>true]);
}

function notifications_fetch_mine(?PDO $pdo): array {
    if (!$pdo) return [];
    if (!kareta_table_exists($pdo, 'notifications')) return [];
    $user = kareta_session_user();
    $actorUserId = (int)($user['id'] ?? 0);
    $actorPhone = _actor_phone();
    $actorRole = _actor_role();

    $sql = "SELECT * FROM `notifications` WHERE 1=0";
    $params = [];
    if ($actorUserId > 0) { $sql .= " OR recipient_user_id=?"; $params[] = $actorUserId; }
    if ($actorPhone !== '') { $sql .= " OR recipient_phone=?"; $params[] = $actorPhone; }
    if ($actorRole !== '' && $actorRole !== 'guest') { $sql .= " OR (recipient_role=? AND recipient_user_id IS NULL AND recipient_phone='')"; $params[] = $actorRole; }
    $sql .= " ORDER BY created_at DESC LIMIT 200";
    $rows = kareta_try_query_all($pdo, $sql, $params, [], 'NOTIFICATIONS_GET_MINE');
    $out = [];
    foreach ($rows as $n) {
        $meta = json_decode((string)($n['meta'] ?? ''), true) ?: [];
        $row = [
            'id' => (string)($n['id'] ?? ''),
            'recipientUserId' => $n['recipient_user_id'] !== null ? (string)$n['recipient_user_id'] : '',
            'recipientPhone' => (string)($n['recipient_phone'] ?? ''),
            'recipientRole' => (string)($n['recipient_role'] ?? ''),
            'eventType' => (string)($n['event_type'] ?? ''),
            'entityType' => (string)($n['entity_type'] ?? ''),
            'entityId' => (string)($n['entity_id'] ?? ''),
            'title' => (string)($n['title'] ?? ''),
            'body' => (string)($n['body'] ?? ''),
            'actionUrl' => (string)($n['action_url'] ?? ''),
            'isRead' => (bool)($n['is_read'] ?? 0),
            'readAt' => $n['read_at'] ?? null,
            'createdAt' => $n['created_at'] ?? null,
            'createdAtLabel' => $n['created_at'] ? date('d.m H:i', strtotime((string)$n['created_at'])) : '',
        ];
        foreach ($meta as $k => $v) $row[$k] = $v;
        $out[] = $row;
    }
    return $out;
}

function notifications_get_mine(?PDO $pdo): void {
    if (!$pdo) _no_db();
    $rows=notifications_fetch_mine($pdo);$unread=0;foreach($rows as $row){if(empty($row['isRead']))$unread++;}
    kareta_json(['ok'=>true,'notifications'=>$rows,'unreadTotal'=>$unread]);
}

function notifications_mark_read(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'notification_id_required'],422);
    $user = kareta_session_user();
    $actorUserId = (int)($user['id'] ?? 0);
    $actorPhone = _actor_phone();
    $actorRole = _actor_role();
    $sql = "UPDATE `notifications` SET is_read=1, read_at=NOW() WHERE id=? AND (1=0";
    $params = [$id];
    if ($actorUserId > 0) { $sql .= " OR recipient_user_id=?"; $params[] = $actorUserId; }
    if ($actorPhone !== '') { $sql .= " OR recipient_phone=?"; $params[] = $actorPhone; }
    if ($actorRole !== '' && $actorRole !== 'guest') { $sql .= " OR (recipient_role=? AND recipient_user_id IS NULL AND recipient_phone='')"; $params[] = $actorRole; }
    $sql .= ")";
    $pdo->prepare($sql)->execute($params);
    if($actorUserId>0 && kareta_table_exists($pdo,'notification_center')){
        try{
            $key='legacy:'.$id.':user:'.$actorUserId;
            $pdo->prepare("UPDATE notification_center SET status='read',read_at=COALESCE(read_at,NOW()) WHERE notification_key=? AND user_id=?")
                ->execute([$key,$actorUserId]);
        }catch(Throwable $_){}
    }
    kareta_json(['ok'=>true]);
}

function notifications_mark_all_read(?PDO $pdo): void {
    if (!$pdo) _no_db();
    $user = kareta_session_user();
    $actorUserId = (int)($user['id'] ?? 0);
    $actorPhone = _actor_phone();
    $actorRole = _actor_role();
    $sql = "UPDATE `notifications` SET is_read=1, read_at=NOW() WHERE 1=0";
    $params = [];
    if ($actorUserId > 0) { $sql .= " OR recipient_user_id=?"; $params[] = $actorUserId; }
    if ($actorPhone !== '') { $sql .= " OR recipient_phone=?"; $params[] = $actorPhone; }
    if ($actorRole !== '' && $actorRole !== 'guest') { $sql .= " OR (recipient_role=? AND recipient_user_id IS NULL AND recipient_phone='')"; $params[] = $actorRole; }
    $pdo->prepare($sql)->execute($params);
    if($actorUserId>0 && kareta_table_exists($pdo,'notification_center')){
        try{
            $pdo->prepare("UPDATE notification_center SET status='read',read_at=COALESCE(read_at,NOW())
                WHERE user_id=? AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.source'))='legacy_notifications'")
                ->execute([$actorUserId]);
        }catch(Throwable $_){}
    }
    kareta_json(['ok'=>true]);
}

function kareta_notification_insert(PDO $pdo, array $row): void {
    if (!kareta_table_exists($pdo, 'notifications')) return;
    $recipientUserId = (int)($row['recipientUserId'] ?? 0) ?: null;
    $recipientPhone = kareta_normalize_phone((string)($row['recipientPhone'] ?? ''));
    $recipientRole = kareta_clean_text($row['recipientRole'] ?? '', 32);
    if ($recipientUserId === null && $recipientPhone === '' && $recipientRole === '') return;

    $eventType = kareta_clean_text($row['eventType'] ?? '', 64);
    $entityType = kareta_clean_text($row['entityType'] ?? '', 32);
    $entityId = kareta_clean_text($row['entityId'] ?? '', 64);
    $title = kareta_clean_text($row['title'] ?? '', 191);
    $body = kareta_clean_text($row['body'] ?? '', 2000);
    $actionUrl = kareta_clean_text($row['actionUrl'] ?? '', 255);
    $meta = is_array($row['meta'] ?? null) ? $row['meta'] : [];

    $insertNotification=$pdo->prepare("INSERT INTO `notifications`
        (recipient_user_id,recipient_phone,recipient_role,event_type,entity_type,entity_id,title,body,action_url,is_read,meta,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,0,?,NOW())");
    $insertNotification->execute([
        $recipientUserId,
        $recipientPhone,
        $recipientRole,
        $eventType,
        $entityType,
        $entityId,
        $title,
        $body,
        $actionUrl,
        $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) : null,
    ]);

    // Capture the legacy notification id before any compatibility insert changes
    // PDO::lastInsertId(). Messaging currently uses this legacy id as its stable
    // outbound delivery key, so the bridge must never replace it with a
    // notification_center id.
    $notificationId=(int)$pdo->lastInsertId();

    // Compatibility bridge: notification_center is the canonical in-app
    // notification read model. Legacy business producers still write
    // notifications, therefore every resolvable per-user legacy notification is
    // mirrored idempotently into notification_center. Role-only broadcasts with
    // no concrete user remain legacy-only until their recipient expansion is
    // explicitly migrated.
    try {
        $centerUserId=(int)($recipientUserId ?? 0);
        if($centerUserId<=0 && $recipientPhone!=='' && function_exists('kareta_user_id_by_phone')){
            $centerUserId=(int)kareta_user_id_by_phone($pdo,$recipientPhone);
        }
        if($notificationId>0 && $centerUserId>0 && kareta_table_exists($pdo,'notification_center')){
            $contextId=(int)($row['contextId'] ?? $row['context_id'] ?? 0) ?: null;
            $notificationKey='legacy:'.$notificationId.':user:'.$centerUserId;
            $payload=[
                'schemaVersion'=>1,
                'source'=>'legacy_notifications',
                'legacyNotificationId'=>$notificationId,
                'recipientRole'=>$recipientRole,
                'meta'=>$meta,
            ];
            $mirror=$pdo->prepare("INSERT INTO notification_center
                (notification_key,user_id,context_id,event_id,notification_type,title,body,action_url,entity_type,entity_key,status,payload_json,created_at)
                VALUES(?,?,?,NULL,?,?,?,?,?,?,'unread',?,NOW())
                ON DUPLICATE KEY UPDATE
                    context_id=COALESCE(VALUES(context_id),context_id),
                    notification_type=VALUES(notification_type),
                    title=VALUES(title),
                    body=VALUES(body),
                    action_url=VALUES(action_url),
                    entity_type=VALUES(entity_type),
                    entity_key=VALUES(entity_key),
                    payload_json=VALUES(payload_json)");
            $mirror->execute([
                $notificationKey,
                $centerUserId,
                $contextId,
                $eventType,
                $title,
                $body,
                $actionUrl,
                $entityType,
                $entityId,
                json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
            ]);
        }
    } catch (Throwable $e) {
        // Compatibility mirroring must never block the owning business command.
        // Keep the legacy notification + external messaging path alive and expose
        // the bridge problem through diagnostics/logging.
        try { kareta_log_error('NOTIFICATION_CENTER_BRIDGE',$e->getMessage()); } catch (Throwable $_) {}
    }

    // Order/approval/schedule notifications fan out through Messaging asynchronously.
    // Chat message delivery has its own queue below messages_add()/external inbound handling.
    // Do not enqueue message.new here: that would duplicate Telegram/WhatsApp delivery and can echo inbound messages.
    try {
        if ($eventType !== 'message.new' && function_exists('kareta_messaging_enqueue_notification')) {
            if($notificationId>0)kareta_messaging_enqueue_notification($pdo,$notificationId,$row);
        }
    } catch (Throwable $_) {}
}

function kareta_notify_role(PDO $pdo, string $role, array $row): void {
    if ($role === '') return;
    $users = kareta_try_query_all($pdo, "SELECT id, phone FROM `users` WHERE role=? AND active=1", [$role], [], 'NOTIFY_ROLE');
    if (!$users) {
        $row['recipientRole'] = $role;
        kareta_notification_insert($pdo, $row);
        return;
    }
    foreach ($users as $u) {
        $copy = $row;
        $copy['recipientUserId'] = (int)($u['id'] ?? 0) ?: null;
        $copy['recipientPhone'] = (string)($u['phone'] ?? '');
        $copy['recipientRole'] = $role;
        kareta_notification_insert($pdo, $copy);
    }
}

/* ── SHOP ─────────────────────────────────────────────────────────── */

function kareta_ensure_shop_parts_enrichment(PDO $pdo): void {
    if (!kareta_table_exists($pdo, 'shop_parts')) return;
    try { kareta_ensure_column($pdo, 'shop_parts', 'brand', "ALTER TABLE `shop_parts` ADD COLUMN `brand` VARCHAR(120) NULL DEFAULT NULL AFTER `sku`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'manufacturer_type', "ALTER TABLE `shop_parts` ADD COLUMN `manufacturer_type` VARCHAR(32) NULL DEFAULT NULL AFTER `brand`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'oem', "ALTER TABLE `shop_parts` ADD COLUMN `oem` VARCHAR(120) NULL DEFAULT NULL AFTER `manufacturer_type`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'analogs_json', "ALTER TABLE `shop_parts` ADD COLUMN `analogs_json` TEXT NULL AFTER `oem`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'crosses_json', "ALTER TABLE `shop_parts` ADD COLUMN `crosses_json` TEXT NULL AFTER `analogs_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'suppliers_json', "ALTER TABLE `shop_parts` ADD COLUMN `suppliers_json` TEXT NULL AFTER `crosses_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'compatibility', "ALTER TABLE `shop_parts` ADD COLUMN `compatibility` TEXT NULL AFTER `crosses_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'description', "ALTER TABLE `shop_parts` ADD COLUMN `description` TEXT NULL AFTER `compatibility`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'image', "ALTER TABLE `shop_parts` ADD COLUMN `image` VARCHAR(500) NULL DEFAULT NULL AFTER `description`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'vehicle_make', "ALTER TABLE `shop_parts` ADD COLUMN `vehicle_make` VARCHAR(80) NULL DEFAULT NULL AFTER `image`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'vehicle_model', "ALTER TABLE `shop_parts` ADD COLUMN `vehicle_model` VARCHAR(120) NULL DEFAULT NULL AFTER `vehicle_make`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'vehicle_generation', "ALTER TABLE `shop_parts` ADD COLUMN `vehicle_generation` VARCHAR(80) NULL DEFAULT NULL AFTER `vehicle_model`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'year_from', "ALTER TABLE `shop_parts` ADD COLUMN `year_from` SMALLINT NULL DEFAULT NULL AFTER `vehicle_generation`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'year_to', "ALTER TABLE `shop_parts` ADD COLUMN `year_to` SMALLINT NULL DEFAULT NULL AFTER `year_from`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'engine', "ALTER TABLE `shop_parts` ADD COLUMN `engine` VARCHAR(120) NULL DEFAULT NULL AFTER `year_to`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'body', "ALTER TABLE `shop_parts` ADD COLUMN `body` VARCHAR(120) NULL DEFAULT NULL AFTER `engine`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'vin_prefixes', "ALTER TABLE `shop_parts` ADD COLUMN `vin_prefixes` TEXT NULL AFTER `body`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'shop_parts', 'fitments_json', "ALTER TABLE `shop_parts` ADD COLUMN `fitments_json` TEXT NULL AFTER `vin_prefixes`"); } catch (Throwable $_) {}
    try { kareta_ensure_index($pdo, 'shop_parts', 'idx_shop_parts_vehicle', "ALTER TABLE `shop_parts` ADD INDEX `idx_shop_parts_vehicle` (`vehicle_make`,`vehicle_model`,`year_from`,`year_to`)"); } catch (Throwable $_) {}
}

function kareta_ensure_parts_catalog_fitment(PDO $pdo): void {
    if (!kareta_table_exists($pdo, 'parts_catalog')) return;
    try { kareta_ensure_column($pdo, 'parts_catalog', 'brand', "ALTER TABLE `parts_catalog` ADD COLUMN `brand` VARCHAR(120) NULL DEFAULT NULL AFTER `sku`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'manufacturer_type', "ALTER TABLE `parts_catalog` ADD COLUMN `manufacturer_type` VARCHAR(32) NULL DEFAULT NULL AFTER `brand`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'oem', "ALTER TABLE `parts_catalog` ADD COLUMN `oem` VARCHAR(120) NULL DEFAULT NULL AFTER `manufacturer_type`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'analogs_json', "ALTER TABLE `parts_catalog` ADD COLUMN `analogs_json` TEXT NULL AFTER `oem`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'crosses_json', "ALTER TABLE `parts_catalog` ADD COLUMN `crosses_json` TEXT NULL AFTER `analogs_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'suppliers_json', "ALTER TABLE `parts_catalog` ADD COLUMN `suppliers_json` TEXT NULL AFTER `crosses_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'compatibility', "ALTER TABLE `parts_catalog` ADD COLUMN `compatibility` TEXT NULL AFTER `crosses_json`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'vehicle_make', "ALTER TABLE `parts_catalog` ADD COLUMN `vehicle_make` VARCHAR(80) NULL DEFAULT NULL AFTER `compatibility`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'vehicle_model', "ALTER TABLE `parts_catalog` ADD COLUMN `vehicle_model` VARCHAR(120) NULL DEFAULT NULL AFTER `vehicle_make`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'vehicle_generation', "ALTER TABLE `parts_catalog` ADD COLUMN `vehicle_generation` VARCHAR(80) NULL DEFAULT NULL AFTER `vehicle_model`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'year_from', "ALTER TABLE `parts_catalog` ADD COLUMN `year_from` SMALLINT NULL DEFAULT NULL AFTER `vehicle_generation`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'year_to', "ALTER TABLE `parts_catalog` ADD COLUMN `year_to` SMALLINT NULL DEFAULT NULL AFTER `year_from`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'engine', "ALTER TABLE `parts_catalog` ADD COLUMN `engine` VARCHAR(120) NULL DEFAULT NULL AFTER `year_to`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'body', "ALTER TABLE `parts_catalog` ADD COLUMN `body` VARCHAR(120) NULL DEFAULT NULL AFTER `engine`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'vin_prefixes', "ALTER TABLE `parts_catalog` ADD COLUMN `vin_prefixes` TEXT NULL AFTER `body`"); } catch (Throwable $_) {}
    try { kareta_ensure_column($pdo, 'parts_catalog', 'fitments_json', "ALTER TABLE `parts_catalog` ADD COLUMN `fitments_json` TEXT NULL AFTER `vin_prefixes`"); } catch (Throwable $_) {}
    try { kareta_ensure_index($pdo, 'parts_catalog', 'idx_parts_catalog_vehicle', "ALTER TABLE `parts_catalog` ADD INDEX `idx_parts_catalog_vehicle` (`vehicle_make`,`vehicle_model`,`year_from`,`year_to`)"); } catch (Throwable $_) {}
}

function kareta_ensure_parts_crosses(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_crosses` (
        `id` varchar(64) NOT NULL,
        `source_type` varchar(32) NOT NULL DEFAULT 'manual',
        `source_id` varchar(64) NOT NULL DEFAULT '',
        `oem` varchar(120) DEFAULT NULL,
        `brand` varchar(120) DEFAULT NULL,
        `cross_number` varchar(120) NOT NULL DEFAULT '',
        `tier` varchar(32) DEFAULT NULL,
        `supplier` varchar(120) DEFAULT NULL,
        `price_label` varchar(64) DEFAULT NULL,
        `stock` tinyint(1) NOT NULL DEFAULT 0,
        `note` text DEFAULT NULL,
        `active` tinyint(1) NOT NULL DEFAULT 1,
        `created_at` date DEFAULT NULL,
        `updated_at` datetime DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_parts_crosses_oem` (`oem`),
        KEY `idx_parts_crosses_number` (`cross_number`),
        KEY `idx_parts_crosses_source` (`source_type`,`source_id`),
        KEY `idx_parts_crosses_tier` (`tier`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_parts_cross_rows($raw, string $oem = '', string $defaultBrand = ''): array {
    $rows = [];
    $push = function($brand, $number, $tier = '', $supplier = '', $price = '', $stock = 0, $note = '') use (&$rows, $defaultBrand) {
        $brand = trim((string)($brand ?: $defaultBrand));
        $number = trim((string)$number);
        if ($brand === '' && $number === '') return;
        $rows[] = [
            'brand'=>$brand,
            'number'=>$number !== '' ? $number : $brand,
            'tier'=>trim((string)$tier),
            'supplier'=>trim((string)$supplier),
            'price'=>trim((string)$price),
            'stock'=>(int)(bool)$stock,
            'note'=>trim((string)$note),
        ];
    };
    $data = $raw;
    if (is_string($raw)) {
        $txt = trim($raw);
        if ($txt !== '' && ($txt[0] === '[' || $txt[0] === '{')) {
            $decoded = json_decode($txt, true);
            if (json_last_error() === JSON_ERROR_NONE) $data = $decoded;
        }
    }
    if (is_array($data)) {
        $assoc = array_keys($data) !== range(0, count($data)-1);
        foreach ($data as $tierKey => $item) {
            $tier = $assoc ? (string)$tierKey : '';
            $items = is_array($item) && isset($item[0]) ? $item : [$item];
            foreach ($items as $x) {
                if (is_array($x)) $push($x['brand'] ?? ($x['manufacturer'] ?? ''), $x['number'] ?? ($x['sku'] ?? ($x['article'] ?? ($x['oem'] ?? ''))), $x['tier'] ?? $tier, $x['supplier'] ?? '', $x['price'] ?? ($x['priceLabel'] ?? ''), $x['stock'] ?? 0, $x['note'] ?? '');
                else $push('', (string)$x, $tier);
            }
        }
    } else {
        $txt = trim((string)$raw);
        foreach (preg_split('/[\r\n;]+/u', $txt) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $parts = array_map('trim', explode('|', $line));
            $main = $parts[0] ?? '';
            $brand = '';
            $number = $main;
            if (preg_match('/^([^:–—-]{2,40})\s*[:–—-]\s*(.+)$/u', $main, $m)) {
                $brand = trim($m[1]);
                $number = trim($m[2]);
            }
            $push($brand, $number, $parts[1] ?? '', $parts[2] ?? '', $parts[3] ?? '', 0, '');
        }
    }
    $seen = [];
    return array_values(array_filter($rows, function($r) use (&$seen) {
        $key = mb_strtolower(($r['brand'] ?? '').'|'.($r['number'] ?? ''), 'UTF-8');
        if ($key === '|' || isset($seen[$key])) return false;
        $seen[$key] = true;
        return true;
    }));
}
function kareta_sync_parts_crosses(PDO $pdo, string $sourceType, string $sourceId, $raw, string $oem = '', string $defaultBrand = ''): void {
    if ($sourceId === '') return;
    kareta_ensure_parts_crosses($pdo);
    $pdo->prepare("UPDATE `parts_crosses` SET active=0, updated_at=NOW() WHERE source_type=? AND source_id=?")->execute([$sourceType, $sourceId]);
    $rows = kareta_parts_cross_rows($raw, $oem, $defaultBrand);
    $st = $pdo->prepare("INSERT INTO `parts_crosses`(id,source_type,source_id,oem,brand,cross_number,tier,supplier,price_label,stock,note,active,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
        ON DUPLICATE KEY UPDATE oem=VALUES(oem), brand=VALUES(brand), cross_number=VALUES(cross_number), tier=VALUES(tier), supplier=VALUES(supplier), price_label=VALUES(price_label), stock=VALUES(stock), note=VALUES(note), active=1, updated_at=NOW()");
    foreach ($rows as $r) {
        $id = 'pcx_' . substr(sha1($sourceType.'|'.$sourceId.'|'.($r['brand'] ?? '').'|'.($r['number'] ?? '')), 0, 20);
        $st->execute([$id,$sourceType,$sourceId,$oem,$r['brand'],$r['number'],$r['tier'],$r['supplier'],$r['price'],$r['stock'],$r['note'],1,date('Y-m-d')]);
    }
}

function kareta_ensure_parts_suppliers(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_suppliers` (
        `id` varchar(64) NOT NULL,
        `source_type` varchar(32) NOT NULL DEFAULT 'manual',
        `source_id` varchar(64) NOT NULL DEFAULT '',
        `supplier` varchar(160) NOT NULL DEFAULT '',
        `price_label` varchar(80) DEFAULT NULL,
        `delivery_eta` varchar(80) DEFAULT NULL,
        `stock_text` varchar(80) DEFAULT NULL,
        `stock_qty` int NOT NULL DEFAULT 0,
        `city` varchar(120) DEFAULT NULL,
        `note` text DEFAULT NULL,
        `active` tinyint(1) NOT NULL DEFAULT 1,
        `created_at` date DEFAULT NULL,
        `updated_at` datetime DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_parts_suppliers_source` (`source_type`,`source_id`),
        KEY `idx_parts_suppliers_supplier` (`supplier`),
        KEY `idx_parts_suppliers_city` (`city`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_parts_supplier_rows($raw): array {
    $rows = [];
    $push = function($supplier, $price = '', $eta = '', $stock = '', $city = '', $note = '') use (&$rows) {
        $supplier = trim((string)$supplier);
        $price = trim((string)$price);
        $eta = trim((string)$eta);
        $stockText = trim((string)$stock);
        $city = trim((string)$city);
        $note = trim((string)$note);
        if ($supplier === '' && $price === '' && $eta === '' && $stockText === '' && $city === '') return;
        if ($supplier === '') $supplier = 'Поставщик';
        preg_match('/(\d+)\s*(шт|pcs|pc)?/iu', $stockText, $m);
        $qty = isset($m[1]) ? (int)$m[1] : 0;
        $rows[] = ['supplier'=>$supplier,'price'=>$price,'eta'=>$eta,'stockText'=>$stockText,'stockQty'=>$qty,'city'=>$city,'note'=>$note];
    };
    $data = $raw;
    if (is_string($raw)) {
        $txt = trim($raw);
        if ($txt !== '' && ($txt[0] === '[' || $txt[0] === '{')) {
            $decoded = json_decode($txt, true);
            if (json_last_error() === JSON_ERROR_NONE) $data = $decoded;
        }
    }
    if (is_array($data)) {
        foreach ($data as $x) {
            if (is_array($x)) $push($x['supplier'] ?? ($x['name'] ?? ($x['vendor'] ?? '')), $x['price'] ?? ($x['priceLabel'] ?? ''), $x['eta'] ?? ($x['delivery'] ?? ($x['deliveryEta'] ?? '')), $x['stockQty'] ?? ($x['stock'] ?? ($x['availability'] ?? '')), $x['city'] ?? ($x['location'] ?? ''), $x['note'] ?? ($x['comment'] ?? ''));
            else $push((string)$x);
        }
    } else {
        foreach (preg_split('/[\r\n;]+/u', trim((string)$raw)) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $parts = array_map('trim', explode('|', $line));
            $head = array_shift($parts) ?: '';
            $supplier = $head;
            $price = $parts[0] ?? '';
            if (preg_match('/^([^:–—-]{2,80})\s*[:–—-]\s*(.+)$/u', $head, $m)) {
                $supplier = trim($m[1]);
                if ($price === '') $price = trim($m[2]);
            }
            $push($supplier, $price, $parts[1] ?? '', $parts[2] ?? '', $parts[3] ?? '', implode(' | ', array_slice($parts, 4)));
        }
    }
    $seen = [];
    return array_values(array_filter($rows, function($r) use (&$seen) {
        $key = mb_strtolower(($r['supplier'] ?? '').'|'.($r['price'] ?? '').'|'.($r['eta'] ?? '').'|'.($r['city'] ?? ''), 'UTF-8');
        if (isset($seen[$key])) return false;
        $seen[$key] = true;
        return true;
    }));
}

function kareta_sync_parts_suppliers(PDO $pdo, string $sourceType, string $sourceId, $raw): void {
    if ($sourceId === '') return;
    kareta_ensure_parts_suppliers($pdo);
    $pdo->prepare("UPDATE `parts_suppliers` SET active=0, updated_at=NOW() WHERE source_type=? AND source_id=?")->execute([$sourceType, $sourceId]);
    $rows = kareta_parts_supplier_rows($raw);
    $st = $pdo->prepare("INSERT INTO `parts_suppliers`(id,source_type,source_id,supplier,price_label,delivery_eta,stock_text,stock_qty,city,note,active,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NOW())
        ON DUPLICATE KEY UPDATE supplier=VALUES(supplier), price_label=VALUES(price_label), delivery_eta=VALUES(delivery_eta), stock_text=VALUES(stock_text), stock_qty=VALUES(stock_qty), city=VALUES(city), note=VALUES(note), active=1, updated_at=NOW()");
    foreach ($rows as $r) {
        $id = 'psu_' . substr(sha1($sourceType.'|'.$sourceId.'|'.($r['supplier'] ?? '').'|'.($r['price'] ?? '').'|'.($r['eta'] ?? '').'|'.($r['city'] ?? '')), 0, 20);
        $st->execute([$id,$sourceType,$sourceId,$r['supplier'],$r['price'],$r['eta'],$r['stockText'],$r['stockQty'],$r['city'],$r['note'],1,date('Y-m-d')]);
    }
}

function kareta_ensure_parts_fitments(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `parts_fitments` (
        `id` varchar(64) NOT NULL,
        `source_type` varchar(32) NOT NULL DEFAULT 'manual',
        `source_id` varchar(64) NOT NULL DEFAULT '',
        `vehicle_make` varchar(80) DEFAULT NULL,
        `vehicle_model` varchar(120) DEFAULT NULL,
        `vehicle_generation` varchar(80) DEFAULT NULL,
        `year_from` smallint DEFAULT NULL,
        `year_to` smallint DEFAULT NULL,
        `engine` varchar(120) DEFAULT NULL,
        `body` varchar(120) DEFAULT NULL,
        `vin_prefixes` text DEFAULT NULL,
        `note` text DEFAULT NULL,
        `active` tinyint(1) NOT NULL DEFAULT 1,
        `created_at` date DEFAULT NULL,
        `updated_at` datetime DEFAULT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_parts_fitments_source` (`source_type`,`source_id`),
        KEY `idx_parts_fitments_vehicle` (`vehicle_make`,`vehicle_model`,`year_from`,`year_to`),
        KEY `idx_parts_fitments_engine` (`engine`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_parts_fitment_rows($raw, array $fallback = []): array {
    $rows = [];
    $push = function($make='', $model='', $generation='', $yearFrom=null, $yearTo=null, $engine='', $body='', $vinPrefixes='', $note='') use (&$rows) {
        $make = trim((string)$make);
        $model = trim((string)$model);
        $generation = trim((string)$generation);
        $engine = trim((string)$engine);
        $body = trim((string)$body);
        $vinPrefixes = trim((string)$vinPrefixes);
        $note = trim((string)$note);
        $yf = $yearFrom !== '' && $yearFrom !== null ? (int)$yearFrom : null;
        $yt = $yearTo !== '' && $yearTo !== null ? (int)$yearTo : null;
        if ($make === '' && $model === '' && $generation === '' && !$yf && !$yt && $engine === '' && $body === '' && $vinPrefixes === '') return;
        $rows[] = ['make'=>$make,'model'=>$model,'generation'=>$generation,'yearFrom'=>$yf,'yearTo'=>$yt,'engine'=>$engine,'body'=>$body,'vinPrefixes'=>$vinPrefixes,'note'=>$note];
    };
    $data = $raw;
    if (is_string($raw)) {
        $txt = trim($raw);
        if ($txt !== '' && ($txt[0] === '[' || $txt[0] === '{')) {
            $decoded = json_decode($txt, true);
            if (json_last_error() === JSON_ERROR_NONE) $data = $decoded;
        }
    }
    if (is_array($data) && $data) {
        $assoc = array_keys($data) !== range(0, count($data)-1);
        $items = $assoc ? [$data] : $data;
        foreach ($items as $x) {
            if (!is_array($x)) { $push((string)$x); continue; }
            $push($x['make'] ?? ($x['vehicleMake'] ?? ($x['vehicle_make'] ?? '')), $x['model'] ?? ($x['vehicleModel'] ?? ($x['vehicle_model'] ?? '')), $x['generation'] ?? ($x['vehicleGeneration'] ?? ($x['vehicle_generation'] ?? '')), $x['yearFrom'] ?? ($x['year_from'] ?? null), $x['yearTo'] ?? ($x['year_to'] ?? null), $x['engine'] ?? '', $x['body'] ?? '', is_array($x['vinPrefixes'] ?? null) ? implode(' · ', $x['vinPrefixes']) : ($x['vinPrefixes'] ?? ($x['vin_prefixes'] ?? '')), $x['note'] ?? '');
        }
    } else {
        foreach (preg_split('/[\r\n]+/u', trim((string)$raw)) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $parts = array_map('trim', explode('|', $line));
            $yearFrom = null; $yearTo = null; $generation = $parts[2] ?? '';
            $years = $parts[3] ?? '';
            if (preg_match('/(\d{4})\s*[–—-]\s*(\d{4})?/u', $years, $m)) { $yearFrom = (int)$m[1]; $yearTo = !empty($m[2]) ? (int)$m[2] : null; }
            elseif (preg_match('/(\d{4})\s*[–—-]\s*(\d{4})?/u', $generation, $m)) { $yearFrom = (int)$m[1]; $yearTo = !empty($m[2]) ? (int)$m[2] : null; $generation = ''; }
            $push($parts[0] ?? '', $parts[1] ?? '', $generation, $yearFrom, $yearTo, $parts[4] ?? ($parts[3] ?? ''), $parts[5] ?? ($parts[4] ?? ''), $parts[6] ?? ($parts[5] ?? ''), '');
        }
    }
    if (!$rows && $fallback) {
        $push($fallback['vehicleMake'] ?? ($fallback['vehicle_make'] ?? ''), $fallback['vehicleModel'] ?? ($fallback['vehicle_model'] ?? ''), $fallback['vehicleGeneration'] ?? ($fallback['vehicle_generation'] ?? ''), $fallback['yearFrom'] ?? ($fallback['year_from'] ?? null), $fallback['yearTo'] ?? ($fallback['year_to'] ?? null), $fallback['engine'] ?? '', $fallback['body'] ?? '', $fallback['vinPrefixes'] ?? ($fallback['vin_prefixes'] ?? ''), 'legacy_single_fitment');
    }
    $seen = [];
    return array_values(array_filter($rows, function($r) use (&$seen) {
        $key = mb_strtolower(($r['make'] ?? '').'|'.($r['model'] ?? '').'|'.($r['generation'] ?? '').'|'.($r['yearFrom'] ?? '').'|'.($r['yearTo'] ?? '').'|'.($r['engine'] ?? '').'|'.($r['body'] ?? '').'|'.($r['vinPrefixes'] ?? ''), 'UTF-8');
        if ($key === '|||||||' || isset($seen[$key])) return false;
        $seen[$key] = true;
        return true;
    }));
}

function kareta_sync_parts_fitments(PDO $pdo, string $sourceType, string $sourceId, $raw, array $fallback = []): void {
    if ($sourceId === '') return;
    kareta_ensure_parts_fitments($pdo);
    $pdo->prepare("UPDATE `parts_fitments` SET active=0, updated_at=NOW() WHERE source_type=? AND source_id=?")->execute([$sourceType, $sourceId]);
    $rows = kareta_parts_fitment_rows($raw, $fallback);
    $st = $pdo->prepare("INSERT INTO `parts_fitments`(id,source_type,source_id,vehicle_make,vehicle_model,vehicle_generation,year_from,year_to,engine,body,vin_prefixes,note,active,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?, ?, NOW())
        ON DUPLICATE KEY UPDATE vehicle_make=VALUES(vehicle_make), vehicle_model=VALUES(vehicle_model), vehicle_generation=VALUES(vehicle_generation), year_from=VALUES(year_from), year_to=VALUES(year_to), engine=VALUES(engine), body=VALUES(body), vin_prefixes=VALUES(vin_prefixes), note=VALUES(note), active=1, updated_at=NOW()");
    foreach ($rows as $r) {
        $id = 'pft_' . substr(sha1($sourceType.'|'.$sourceId.'|'.($r['make'] ?? '').'|'.($r['model'] ?? '').'|'.($r['generation'] ?? '').'|'.($r['yearFrom'] ?? '').'|'.($r['yearTo'] ?? '').'|'.($r['engine'] ?? '').'|'.($r['body'] ?? '').'|'.($r['vinPrefixes'] ?? '')), 0, 20);
        $st->execute([$id,$sourceType,$sourceId,$r['make'],$r['model'],$r['generation'],$r['yearFrom'],$r['yearTo'],$r['engine'],$r['body'],$r['vinPrefixes'],$r['note'],1,date('Y-m-d')]);
    }
}

function shop_getAll(?PDO $pdo): void {
    if (!$pdo) _no_db();
    kareta_ensure_shop_parts_enrichment($pdo);
    try { kareta_ensure_parts_crosses($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_suppliers($pdo); } catch (Throwable $_) {}
    $shopsRaw = $pdo->query("SELECT * FROM `shops` WHERE active=1 ORDER BY created_at DESC, id")->fetchAll();
    $partsRaw = $pdo->query("SELECT * FROM `shop_parts` ORDER BY created_at DESC, id")->fetchAll();
    $shops = [];
    foreach ($shopsRaw as $sh) {
        $shopId = (string)($sh['id'] ?? '');
        $shops[$shopId] = [
            'id' => $shopId,
            'masterId' => (string)($sh['master_id'] ?? ''),
            'masterName' => (string)($sh['master_name'] ?? ''),
            'name' => (string)($sh['name'] ?? ''),
            'desc' => (string)($sh['desc'] ?? ''),
            'created_at' => $sh['created_at'] ?? null,
            'parts' => [],
        ];
    }
    foreach ($partsRaw as $p) {
        $shopId = (string)($p['shop_id'] ?? '');
        if (!isset($shops[$shopId])) continue;
        $shops[$shopId]['parts'][] = [
            'id' => (string)($p['id'] ?? ''),
            'name' => (string)($p['name'] ?? ''),
            'sku' => (string)($p['sku'] ?? ''),
            'cat' => (string)($p['cat'] ?? 'other'),
            'price' => (int)($p['price'] ?? 0),
            'stock' => (bool)($p['stock'] ?? 0),
            'stockQty' => (int)($p['stock_qty'] ?? 0),
            'note' => (string)($p['note'] ?? ''),
            'brand' => (string)($p['brand'] ?? ''),
            'manufacturer' => (string)($p['brand'] ?? ''),
            'manufacturerType' => (string)($p['manufacturer_type'] ?? ''),
            'oem' => (string)($p['oem'] ?? ''),
            'analogs' => (string)($p['analogs_json'] ?? ''),
            'crosses' => (string)($p['crosses_json'] ?? ''),
            'suppliers' => (string)($p['suppliers_json'] ?? ''),
            'suppliersText' => (string)($p['suppliers_json'] ?? ''),
            'compatibility' => (string)($p['compatibility'] ?? ''),
            'description' => (string)($p['description'] ?? ''),
            'image' => (string)($p['image'] ?? ''),
            'vehicleMake' => (string)($p['vehicle_make'] ?? ''),
            'vehicleModel' => (string)($p['vehicle_model'] ?? ''),
            'vehicleGeneration' => (string)($p['vehicle_generation'] ?? ''),
            'yearFrom' => $p['year_from'] !== null ? (int)$p['year_from'] : '',
            'yearTo' => $p['year_to'] !== null ? (int)$p['year_to'] : '',
            'engine' => (string)($p['engine'] ?? ''),
            'body' => (string)($p['body'] ?? ''),
            'vinPrefixes' => (string)($p['vin_prefixes'] ?? ''),
            'fitments' => (string)($p['fitments_json'] ?? ''),
            'fitmentsText' => (string)($p['fitments_json'] ?? ''),
            'created_at' => $p['created_at'] ?? null,
            'masterId' => (string)($p['master_id'] ?? ''),
            'shopName' => (string)$shops[$shopId]['name'],
            'masterName' => (string)$shops[$shopId]['masterName'],
        ];
    }
    kareta_json(['ok'=>true,'shops'=>array_values($shops)]);
}
function shop_create(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $s=$b['shop']??$b;
    $masterId = (string)($s['masterId']??'');
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'masterId_required'],400);
    // Patch 7: мастер может создать магазин только для себя
    kareta_assert_master_owns_profile($pdo, $masterId);
    $id='shop_'.$masterId;
    $pdo->prepare("INSERT IGNORE INTO `shops`(id,master_id,master_name,name,`desc`,created_at) VALUES(?,?,?,?,?,?)")
        ->execute([$id,$masterId,$s['masterName']??'',$s['name']??'Мой магазин',$s['desc']??'',date('Y-m-d')]);
    kareta_log_audit($pdo, 'shop.create', ['masterId'=>$masterId,'shopId'=>$id]);
    kareta_json(['ok'=>true,'id'=>$id]);
}
function shop_update(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $masterId=(string)($b['masterId']??''); $patch=$b['patch']??[];
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'masterId_required'],400);
    // Patch 7
    kareta_assert_master_owns_shop($pdo, $masterId);
    $sets=[]; $vals=[];
    foreach (['name'=>'name','desc'=>'`desc`'] as $js=>$col) {
        if (isset($patch[$js])) { $sets[]=$col.'=?'; $vals[]=$patch[$js]; }
    }
    if ($sets) { $vals[]=$masterId; $pdo->prepare("UPDATE `shops` SET ".implode(',',$sets)." WHERE master_id=?")->execute($vals); }
    kareta_log_audit($pdo, 'shop.update', ['masterId'=>$masterId]);
    kareta_json(['ok'=>true]);
}
function shop_addPart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_shop_parts_enrichment($pdo);
    try { kareta_ensure_parts_crosses($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_suppliers($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_fitments($pdo); } catch (Throwable $_) {}
    $masterId=(string)($b['masterId']??''); $p=$b['part']??$b;
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'masterId_required'],400);
    // Patch 7
    kareta_assert_master_owns_shop($pdo, $masterId);
    $id='sp_'.uniqid(); $shopId='shop_'.$masterId;
    $pdo->prepare("INSERT INTO `shop_parts`(id,shop_id,master_id,name,sku,brand,manufacturer_type,oem,analogs_json,crosses_json,suppliers_json,compatibility,description,image,vehicle_make,vehicle_model,vehicle_generation,year_from,year_to,engine,body,vin_prefixes,fitments_json,cat,price,stock,stock_qty,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$id,$shopId,$masterId,$p['name']??'',$p['sku']??'', $p['brand']??($p['manufacturer']??''), $p['manufacturerType']??($p['manufacturer_type']??''), $p['oem']??'', $p['analogs']??($p['analogsText']??''), $p['crosses']??($p['crossesText']??''), $p['suppliers']??($p['suppliersText']??''), $p['compatibility']??'', $p['description']??'', $p['image']??($p['img']??''),
                   $p['vehicleMake']??($p['vehicle_make']??''), $p['vehicleModel']??($p['vehicle_model']??''), $p['vehicleGeneration']??($p['vehicle_generation']??''),
                   ($p['yearFrom']??($p['year_from']??null)) ?: null, ($p['yearTo']??($p['year_to']??null)) ?: null, $p['engine']??'', $p['body']??'', $p['vinPrefixes']??($p['vin_prefixes']??''), $p['fitments']??($p['fitmentsText']??($p['fitments_json']??'')), $p['cat']??'other',
                   (int)($p['price']??0),(int)(bool)($p['stock']??true),(int)($p['stockQty']??0),
                   $p['note']??'',date('Y-m-d')]);
    try { kareta_sync_parts_crosses($pdo, 'shop_part', $id, $p['crosses'] ?? ($p['crossesText'] ?? ($p['analogs'] ?? '')), (string)($p['oem'] ?? ''), (string)($p['brand'] ?? ($p['manufacturer'] ?? ''))); } catch (Throwable $_) {}
    try { kareta_sync_parts_suppliers($pdo, 'shop_part', $id, $p['suppliers'] ?? ($p['suppliersText'] ?? '')); } catch (Throwable $_) {}
    try { kareta_sync_parts_fitments($pdo, 'shop_part', $id, $p['fitments'] ?? ($p['fitmentsText'] ?? ($p['fitments_json'] ?? '')), $p); } catch (Throwable $_) {}
    kareta_json(['ok'=>true,'id'=>$id]);
}
function shop_updatePart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_shop_parts_enrichment($pdo);
    try { kareta_ensure_parts_crosses($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_suppliers($pdo); } catch (Throwable $_) {}
    try { kareta_ensure_parts_fitments($pdo); } catch (Throwable $_) {}
    $partId=(string)($b['partId']??'');
    if ($partId === '') kareta_json(['ok'=>false,'error'=>'partId_required'],400);
    // Patch 7: проверяем что товар принадлежит магазину текущего мастера
    $ownerMasterId = kareta_get_shop_part_master($pdo, $partId);
    if ($ownerMasterId === '') kareta_json(['ok'=>false,'error'=>'part_not_found'],404);
    kareta_assert_master_owns_shop($pdo, $ownerMasterId);
    $patch=$b['patch']??[];
    $map=['name'=>'name','sku'=>'sku','cat'=>'cat','price'=>'price','note'=>'note','stock'=>'stock','stockQty'=>'stock_qty','brand'=>'brand','manufacturerType'=>'manufacturer_type','manufacturer_type'=>'manufacturer_type','oem'=>'oem','analogs'=>'analogs_json','analogsText'=>'analogs_json','crosses'=>'crosses_json','crossesText'=>'crosses_json','crosses_json'=>'crosses_json','suppliers'=>'suppliers_json','suppliersText'=>'suppliers_json','suppliers_json'=>'suppliers_json','compatibility'=>'compatibility','description'=>'description','image'=>'image','img'=>'image','vehicleMake'=>'vehicle_make','vehicle_make'=>'vehicle_make','vehicleModel'=>'vehicle_model','vehicle_model'=>'vehicle_model','vehicleGeneration'=>'vehicle_generation','vehicle_generation'=>'vehicle_generation','yearFrom'=>'year_from','year_from'=>'year_from','yearTo'=>'year_to','year_to'=>'year_to','engine'=>'engine','body'=>'body','vinPrefixes'=>'vin_prefixes','vin_prefixes'=>'vin_prefixes','fitments'=>'fitments_json','fitmentsText'=>'fitments_json','fitments_json'=>'fitments_json'];
    $sets=[]; $vals=[];
    foreach ($map as $js=>$col) {
        if (!array_key_exists($js,$patch)) continue;
        $val = $js==='stock' ? (int)(bool)$patch[$js] : ($js==='stockQty'||$js==='price'||$js==='yearFrom'||$js==='year_from'||$js==='yearTo'||$js==='year_to' ? ((int)$patch[$js] ?: null) : $patch[$js]);
        $sets[]=$col.'=?'; $vals[]=$val;
    }
    if ($sets) { $vals[]=$partId; $pdo->prepare("UPDATE `shop_parts` SET ".implode(',',$sets)." WHERE id=?")->execute($vals); }
    if (array_key_exists('crosses',$patch) || array_key_exists('crossesText',$patch) || array_key_exists('analogs',$patch) || array_key_exists('oem',$patch) || array_key_exists('brand',$patch)) {
        try { kareta_sync_parts_crosses($pdo, 'shop_part', $partId, $patch['crosses'] ?? ($patch['crossesText'] ?? ($patch['analogs'] ?? '')), (string)($patch['oem'] ?? ''), (string)($patch['brand'] ?? '')); } catch (Throwable $_) {}
    }
    if (array_key_exists('suppliers',$patch) || array_key_exists('suppliersText',$patch) || array_key_exists('suppliers_json',$patch)) {
        try { kareta_sync_parts_suppliers($pdo, 'shop_part', $partId, $patch['suppliers'] ?? ($patch['suppliersText'] ?? ($patch['suppliers_json'] ?? ''))); } catch (Throwable $_) {}
    }
    if (array_key_exists('fitments',$patch) || array_key_exists('fitmentsText',$patch) || array_key_exists('fitments_json',$patch) || array_key_exists('vehicleMake',$patch) || array_key_exists('vehicleModel',$patch)) {
        try { kareta_sync_parts_fitments($pdo, 'shop_part', $partId, $patch['fitments'] ?? ($patch['fitmentsText'] ?? ($patch['fitments_json'] ?? '')), $patch); } catch (Throwable $_) {}
    }
    kareta_json(['ok'=>true]);
}
function shop_deletePart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $partId = (string)($b['partId']??'');
    if ($partId === '') kareta_json(['ok'=>false,'error'=>'partId_required'],400);
    // Patch 7
    $ownerMasterId = kareta_get_shop_part_master($pdo, $partId);
    if ($ownerMasterId === '') kareta_json(['ok'=>false,'error'=>'part_not_found'],404);
    kareta_assert_master_owns_shop($pdo, $ownerMasterId);
    $pdo->prepare("DELETE FROM `shop_parts` WHERE id=?")->execute([$partId]);
    kareta_log_audit($pdo, 'shop.deletePart', ['partId'=>$partId,'masterId'=>$ownerMasterId]);
    kareta_json(['ok'=>true]);
}

function shop_sellPart(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    if (!kareta_table_exists($pdo, 'shop_sales')) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `shop_sales` (
            `id` varchar(64) NOT NULL,
            `shop_id` varchar(64) NOT NULL,
            `master_id` varchar(64) NOT NULL,
            `part_id` varchar(64) NOT NULL,
            `part_name` varchar(255) NOT NULL,
            `qty` int NOT NULL DEFAULT 1,
            `unit_price` int NOT NULL DEFAULT 0,
            `total` int NOT NULL DEFAULT 0,
            `customer_name` varchar(255) DEFAULT '',
            `order_id` varchar(64) DEFAULT NULL,
            `client_id` varchar(64) DEFAULT NULL,
            `vehicle_title` varchar(255) DEFAULT NULL,
            `note` text DEFAULT NULL,
            `created_at` date DEFAULT NULL,
            PRIMARY KEY (`id`),
            KEY `idx_shop_sales_master` (`master_id`),
            KEY `idx_shop_sales_part` (`part_id`),
            KEY `idx_shop_sales_order` (`order_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
    kareta_ensure_column($pdo, 'shop_sales', 'order_id', "ALTER TABLE `shop_sales` ADD COLUMN `order_id` VARCHAR(64) NULL DEFAULT NULL AFTER `customer_name`");
    kareta_ensure_column($pdo, 'shop_sales', 'client_id', "ALTER TABLE `shop_sales` ADD COLUMN `client_id` VARCHAR(64) NULL DEFAULT NULL AFTER `order_id`");
    kareta_ensure_column($pdo, 'shop_sales', 'vehicle_title', "ALTER TABLE `shop_sales` ADD COLUMN `vehicle_title` VARCHAR(255) NULL DEFAULT NULL AFTER `client_id`");
    $masterId = (string)($b['masterId'] ?? '');
    $partId   = (string)($b['partId'] ?? '');
    // Patch 7: проверяем владение магазином
    if ($masterId !== '') {
        kareta_assert_master_owns_shop($pdo, $masterId);
    } elseif ($partId !== '') {
        $ownerMid = kareta_get_shop_part_master($pdo, $partId);
        if ($ownerMid !== '') kareta_assert_master_owns_shop($pdo, $ownerMid);
    }
    $sale     = is_array($b['sale'] ?? null) ? $b['sale'] : $b;
    $qty      = max(1, (int)($sale['qty'] ?? 1));
    $unit     = max(0, (int)($sale['unitPrice'] ?? 0));
    $customer = trim((string)($sale['customerName'] ?? ''));
    $note     = trim((string)($sale['note'] ?? ''));
    $orderId  = trim((string)($sale['orderId'] ?? ''));
    $clientId = trim((string)($sale['clientId'] ?? ''));
    $vehicleTitle = trim((string)($sale['vehicleTitle'] ?? ''));
    $stm = $pdo->prepare("SELECT id, shop_id, master_id, name, price, stock_qty FROM `shop_parts` WHERE id=? LIMIT 1");
    $stm->execute([$partId]);
    $part = $stm->fetch();
    if (!$part) kareta_json(['ok'=>false,'error'=>'shop_part_not_found'], 404);
    if ($masterId !== '' && (string)($part['master_id'] ?? '') !== $masterId) kareta_json(['ok'=>false,'error'=>'shop_part_master_mismatch'], 409);
    $stockQty = (int)($part['stock_qty'] ?? 0);
    if ($stockQty < $qty) kareta_json(['ok'=>false,'error'=>'shop_part_stock_low'], 409);
    if ($orderId !== '') {
        $ost = $pdo->prepare("SELECT id, master_id, client_id, client_name, client_car, vehicle_title, type FROM `orders` WHERE id=? LIMIT 1");
        $ost->execute([$orderId]);
        $ord = $ost->fetch();
        if (!$ord) kareta_json(['ok'=>false,'error'=>'shop_sale_order_not_found'], 404);
        if ((string)($ord['master_id'] ?? '0') !== (string)($part['master_id'] ?? $masterId)) kareta_json(['ok'=>false,'error'=>'shop_sale_order_master_mismatch'], 409);
        if ($clientId === '') $clientId = (string)($ord['client_id'] ?? '');
        if ($customer === '') $customer = trim((string)($ord['client_name'] ?? ''));
        if ($vehicleTitle === '') $vehicleTitle = trim((string)($ord['client_car'] ?? $ord['vehicle_title'] ?? ''));
    }
    if ($unit <= 0) $unit = (int)($part['price'] ?? 0);
    $newQty = max(0, $stockQty - $qty);
    $saleId = trim((string)($sale['id'] ?? $sale['saleId'] ?? $sale['clientSaleId'] ?? ''));
    if ($saleId === '') $saleId = 'ss_' . uniqid();
    try {
        $pdo->beginTransaction();
        $stExistingSale = $pdo->prepare("SELECT id FROM `shop_sales` WHERE id=? LIMIT 1");
        $stExistingSale->execute([$saleId]);
        if ($stExistingSale->fetchColumn()) {
            $pdo->rollBack();
            kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'sale_already_recorded','sale'=>['id'=>$saleId]]);
        }
        $stmtStock = $pdo->prepare("UPDATE `shop_parts` SET stock_qty=stock_qty-?, stock=IF(stock_qty-?>0,1,0) WHERE id=? AND stock_qty>=?");
        $stmtStock->execute([$qty, $qty, $partId, $qty]);
        if ($stmtStock->rowCount() === 0) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'shop_part_stock_low'], 409); }
    $row = [
        'id' => $saleId,
        'shop_id' => (string)($part['shop_id'] ?? ('shop_'.$masterId)),
        'master_id' => (string)($part['master_id'] ?? $masterId),
        'part_id' => $partId,
        'part_name' => (string)($part['name'] ?? ''),
        'qty' => $qty,
        'unit_price' => $unit,
        'total' => $qty * $unit,
        'customer_name' => $customer,
        'order_id' => $orderId !== '' ? $orderId : null,
        'client_id' => $clientId !== '' ? $clientId : null,
        'vehicle_title' => $vehicleTitle !== '' ? $vehicleTitle : null,
        'note' => $note,
        'created_at' => date('Y-m-d'),
    ];
    $pdo->prepare("INSERT INTO `shop_sales`(id,shop_id,master_id,part_id,part_name,qty,unit_price,total,customer_name,order_id,client_id,vehicle_title,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$row['id'],$row['shop_id'],$row['master_id'],$row['part_id'],$row['part_name'],$row['qty'],$row['unit_price'],$row['total'],$row['customer_name'],$row['order_id'],$row['client_id'],$row['vehicle_title'],$row['note'],$row['created_at']]);
    $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    kareta_json(['ok'=>true,'sale'=>[
        'id'=>$row['id'],'shopId'=>$row['shop_id'],'masterId'=>$row['master_id'],'partId'=>$row['part_id'],'partName'=>$row['part_name'],
        'qty'=>$row['qty'],'unitPrice'=>$row['unit_price'],'total'=>$row['total'],'customerName'=>$row['customer_name'],'orderId'=>$row['order_id'],'clientId'=>$row['client_id'],'vehicleTitle'=>$row['vehicle_title'],'note'=>$row['note'],'createdAt'=>$row['created_at']
    ]]);
}

/* ── AUDIT ────────────────────────────────────────────────────────── */
function audit_write(?PDO $pdo, array $b): void {
    if (!$pdo) kareta_json(['ok'=>true]); // не блокируем при недоступной БД
    if (!kareta_table_exists($pdo, 'audit_log')) {
        kareta_create_schema($pdo);
    }
    if (!kareta_table_exists($pdo, 'audit_log')) {
        kareta_json(['ok'=>true]);
    }
    $sessionActor = kareta_session_user() ?? [];
    $meta = $b['meta'] ?? [];
    if (!is_array($meta)) $meta = ['value' => $meta];
    $action = trim((string)($b['eventAction'] ?? $b['auditAction'] ?? $b['action'] ?? 'unknown')) ?: 'unknown';
    $actorUserId = array_key_exists('actorUserId', $b) ? ((int)$b['actorUserId'] ?: null) : (((int)($sessionActor['id'] ?? 0)) ?: null);
    $actorPhone = (string)($b['actorPhone'] ?? ($sessionActor['phone'] ?? ''));
    $actorRole  = (string)($b['actorRole'] ?? ($sessionActor['role'] ?? 'guest'));
    $actorName  = (string)($b['actorName'] ?? ($sessionActor['name'] ?? '—'));
    $pdo->prepare("INSERT INTO `audit_log`(action,actor_user_id,actor_phone,actor_role,actor_name,meta) VALUES(?,?,?,?,?,?)")
        ->execute([$action,$actorUserId,$actorPhone,$actorRole,$actorName,
                   $meta ? json_encode($meta,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) : null]);
    kareta_rebuild_user_stats($pdo);
    kareta_json(['ok'=>true]);
}
function audit_read(?PDO $pdo, array $b): void {
    if (!$pdo) kareta_json(['ok'=>true,'entries'=>[]]);
    $n=max(1,min(500,(int)($b['limit']??100)));
    $st=$pdo->prepare("SELECT actor_user_id AS actorUserId, action,actor_phone AS actorPhone,actor_role AS actorRole,actor_name AS actorName,meta,created_at AS ts FROM `audit_log` ORDER BY created_at DESC LIMIT ?");
    $st->bindValue(1, $n, PDO::PARAM_INT);
    $st->execute();
    $entries=$st->fetchAll();
    foreach ($entries as &$e) $e['meta']=$e['meta']?json_decode($e['meta'],true):[]; unset($e);
    kareta_json(['ok'=>true,'entries'=>$entries]);
}
function audit_clear(?PDO $pdo): void {
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $pdo->exec("TRUNCATE TABLE `audit_log`");
    kareta_rebuild_user_stats($pdo);
    kareta_log_audit($pdo, 'audit.clear', []);
    kareta_json(['ok'=>true]);
}


// ══════════════════════════════════════════════════════════════════════════════
//  NEWS ARTICLES
// ══════════════════════════════════════════════════════════════════════════════


/* ══════════════════════════════════════════════════════════════
   APP CONFIG — data/_private/app_config.json
══════════════════════════════════════════════════════════════ */
function app_config_path(): string {
    return dirname(__DIR__) . '/data/_private/app_config.json';
}

function app_config_default(): array {
    return [
        'debug' => [
            'enabled'    => false,
            'categories' => ['router','fetch','render','error'],
            'roles'      => 'all',
        ]
    ];
}

/* ── Биржа заявок: мастер сам берёт / возвращает ──────────────────── */

function orders_master_claim(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'order_id_required'], 400);
    $date = trim((string)($b['date'] ?? $b['scheduledDate'] ?? $b['workDate'] ?? ''));
    $time = trim((string)($b['time'] ?? $b['scheduledTime'] ?? $b['startTime'] ?? ''));
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        kareta_json(['ok'=>false,'error'=>'date_required','message'=>'Укажите день работы'], 400);
    }
    if ($time === '' || !preg_match('/^\d{2}:\d{2}/', $time)) {
        kareta_json(['ok'=>false,'error'=>'time_required','message'=>'Укажите примерное время работы'], 400);
    }
    $time = substr($time, 0, 5);
    $actor   = kareta_session_user() ?? [];
    $actorId = (int)($actor['id'] ?? 0);
    if ($actorId <= 0) kareta_json(['ok'=>false,'error'=>'forbidden'], 403);
    $stM = $pdo->prepare("SELECT id, name, initials FROM `masters` WHERE user_id=? AND COALESCE(active,1)=1 LIMIT 1");
    $stM->execute([$actorId]);
    $masterRow = $stM->fetch();
    if (!$masterRow) kareta_json(['ok'=>false,'error'=>'master_profile_not_found'], 403);
    try {
        kareta_ensure_column($pdo, 'orders', 'accepted_at', "ALTER TABLE `orders` ADD COLUMN `accepted_at` DATETIME NULL DEFAULT NULL AFTER `created_at`");
        try { kareta_ensure_schema_columns($pdo); } catch (Throwable $_) {}
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT id, master_id, status, client_user_id, client_phone FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$id]);
        $order = $st->fetch();
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'not_found'], 404); }
        if ((string)($order['master_id'] ?? '0') !== '0') {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'already_taken','message'=>'Заявку уже взял другой мастер'], 409);
        }
        if (!in_array((string)$order['status'], ['new','waiting_responses'], true)) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_not_available'], 409);
        }
        kareta_tariff_master_guard($pdo,(string)$masterRow['id'],$date,$id,true);
        $aff = $pdo->prepare("UPDATE `orders` SET master_id=?, master_user_id=?, master_name=?, status='process', `date`=?, `time`=?, time_mode='approx', accepted_at=COALESCE(accepted_at,NOW()), assigned_admin_user_id=NULL WHERE id=? AND COALESCE(master_id,'0')='0'");
        $aff->execute([$masterRow['id'], $actorId, $masterRow['name'], $date, $time, $id]);
        if ($aff->rowCount() === 0) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'race_condition','message'=>'Заявку только что взял другой мастер'], 409); }
        kareta_tariff_record_master_acceptance($pdo,(string)$masterRow['id'],$id,date('Y-m-d'),'master_claim');
        $mInit = $masterRow['initials'] ?: mb_substr($masterRow['name'], 0, 1, 'UTF-8');
        $pdo->prepare("UPDATE `chats` SET master_id=?, master_user_id=?, master_name=?, master_init=?, status='process', assigned_admin_user_id=NULL WHERE order_id=?")
            ->execute([$masterRow['id'], $actorId, $masterRow['name'], $mInit, $id]);
        $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1"); $stChat->execute([$id]);
        $chatId = (string)($stChat->fetchColumn() ?: '');
        if ($chatId) {
            $eventText = 'Мастер '.$masterRow['name'].' принял заявку. Запись: '.$date.' примерно '.$time.'.';
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_mc_'.time().'_'.rand(100,999),$chatId,$id,'system',$actorId,'event',$eventText,date('H:i'),date('Y-m-d H:i:s')]);
            kareta_write_event($pdo, $id, 'master_accepted', ['title'=>'Мастер принял заявку','body'=>$eventText,'masterId'=>$masterRow['id'],'date'=>$date,'time'=>$time]);
            kareta_notification_insert($pdo, [
                'recipientUserId' => (int)($order['client_user_id'] ?? 0) ?: null,
                'recipientPhone'  => (string)($order['client_phone'] ?? ''),
                'recipientRole'   => 'client',
                'eventType'       => 'order.assigned',
                'entityType'      => 'order',
                'entityId'        => $id,
                'title'           => 'Заявка '.$id.': назначен мастер',
                'body'            => 'Вашу заявку взял мастер '.$masterRow['name'].'. Запись: '.$date.' примерно '.$time.'.',
                'actionUrl'       => '#myorders',
                'meta'            => ['orderId'=>$id,'masterName'=>$masterRow['name'],'date'=>$date,'time'=>$time],
            ]);
        }
        kareta_log_audit($pdo, 'orders.masterClaim', ['id'=>$id,'masterId'=>$masterRow['id'],'date'=>$date,'time'=>$time]);
        $pdo->commit();
        $stO = $pdo->prepare("SELECT o.*,(SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1"); $stO->execute([$id]);
        $stC = $pdo->prepare("SELECT * FROM `chats` WHERE order_id=? LIMIT 1"); $stC->execute([$id]);
        kareta_json(['ok'=>true,'order'=>_fmt_order($stO->fetch()),'chat'=>_fmt_chat($stC->fetch())]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.masterClaim', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'master_claim_failed','requestId'=>KARETA_REQUEST_ID], 500);
    }
}

function orders_master_decline(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id     = (string)($b['id'] ?? '');
    $reason = kareta_clean_text($b['reason'] ?? '', 300);
    if ($id === '') kareta_json(['ok'=>false,'error'=>'order_id_required'], 400);
    $actor   = kareta_session_user() ?? [];
    $actorId = (int)($actor['id'] ?? 0);
    if ($actorId <= 0) kareta_json(['ok'=>false,'error'=>'forbidden'], 403);
    $stM = $pdo->prepare("SELECT id, name FROM `masters` WHERE user_id=? LIMIT 1"); $stM->execute([$actorId]);
    $masterRow = $stM->fetch();
    if (!$masterRow) kareta_json(['ok'=>false,'error'=>'master_profile_not_found'], 403);
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT id, master_id, master_user_id, status FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE"); $st->execute([$id]);
        $order = $st->fetch();
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'not_found'], 404); }
        $isMine = ((string)($order['master_id'] ?? '') === (string)$masterRow['id']) || ((int)($order['master_user_id'] ?? 0) === $actorId);
        if (!$isMine) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'not_your_order'], 403); }
        if ($order['status'] === 'done') { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_done'], 409); }
        $pdo->prepare("UPDATE `orders` SET master_id=NULL, master_user_id=NULL, master_name='Администрация', assigned_admin_user_id=NULL WHERE id=?")->execute([$id]);
        $pdo->prepare("UPDATE `chats` SET master_id=NULL, master_user_id=NULL, master_name='Администрация', master_init='А', assigned_admin_user_id=NULL WHERE order_id=?")->execute([$id]);
        $stChat = $pdo->prepare("SELECT id FROM `chats` WHERE order_id=? LIMIT 1"); $stChat->execute([$id]);
        $chatId = (string)($stChat->fetchColumn() ?: '');
        if ($chatId) {
            $msgText = 'Мастер '.$masterRow['name'].' вернул заявку в биржу.'.($reason ? ' Причина: '.$reason : '');
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_md_'.time().'_'.rand(100,999),$chatId,$id,'system',$actorId,'event',$msgText,date('H:i'),date('Y-m-d H:i:s')]);
        }
        kareta_log_audit($pdo, 'orders.masterDecline', ['id'=>$id,'masterId'=>$masterRow['id'],'reason'=>$reason]);
        $pdo->commit();
        kareta_json(['ok'=>true]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        kareta_log_error('orders.masterDecline', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'master_decline_failed','requestId'=>KARETA_REQUEST_ID], 500);
    }
}


function app_config_read(): array {
    $path = app_config_path();
    if (!file_exists($path)) {
        // Создаём файл с дефолтами если нет
        @file_put_contents($path, json_encode(app_config_default(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        return app_config_default();
    }
    $raw = @file_get_contents($path);
    $data = $raw ? json_decode($raw, true) : null;
    return is_array($data) ? array_merge_recursive(app_config_default(), $data) : app_config_default();
}

function app_config_save(array $b): void {
    $current = app_config_read();
    // Обновляем только известные ключи — защита от произвольной записи
    if (isset($b['debug']) && is_array($b['debug'])) {
        if (isset($b['debug']['enabled']))    $current['debug']['enabled']    = (bool)$b['debug']['enabled'];
        if (isset($b['debug']['categories'])) $current['debug']['categories'] = array_values(array_intersect(
            (array)$b['debug']['categories'], ['router','fetch','render','error']
        ));
        if (isset($b['debug']['roles']))      $current['debug']['roles'] = in_array($b['debug']['roles'],['all','owner','admin'],true)
            ? $b['debug']['roles'] : 'all';
    }
    $path = app_config_path();
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    file_put_contents($path, json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function news_ensure_table(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `news_articles` (
        `id`            VARCHAR(40)   NOT NULL PRIMARY KEY,
        `slug`          VARCHAR(160)  NOT NULL DEFAULT '',
        `title`         VARCHAR(255)  NOT NULL DEFAULT '',
        `intro`         TEXT          NOT NULL,
        `body`          LONGTEXT      NOT NULL,
        `cover_url`     VARCHAR(500)  NOT NULL DEFAULT '',
        `category`      VARCHAR(60)   NOT NULL DEFAULT 'auto',
        `tags`          VARCHAR(500)  NOT NULL DEFAULT '[]',
        `author_name`   VARCHAR(120)  NOT NULL DEFAULT '',
        `author_role`   VARCHAR(120)  NOT NULL DEFAULT '',
        `author_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
        `published_at`  DATE          NOT NULL,
        `reading_time`  TINYINT UNSIGNED NOT NULL DEFAULT 3,
        `views_count`   INT UNSIGNED  NOT NULL DEFAULT 0,
        `is_featured`   TINYINT(1)    NOT NULL DEFAULT 0,
        `active`        TINYINT(1)    NOT NULL DEFAULT 1,
        `sort`          INT UNSIGNED  NOT NULL DEFAULT 0,
        `created_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_news_slug` (`slug`),
        KEY `idx_news_category` (`category`,`active`),
        KEY `idx_news_featured` (`is_featured`,`active`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    // ALTER для существующих таблиц — добавляем новые колонки если нет
    foreach ([
        "ALTER TABLE `news_articles` ADD COLUMN `category`       VARCHAR(60)  NOT NULL DEFAULT 'auto' AFTER `cover_url`",
        "ALTER TABLE `news_articles` ADD COLUMN `tags`           VARCHAR(500) NOT NULL DEFAULT '[]' AFTER `category`",
        "ALTER TABLE `news_articles` ADD COLUMN `author_user_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `author_role`",
        "ALTER TABLE `news_articles` ADD COLUMN `reading_time`   TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER `published_at`",
        "ALTER TABLE `news_articles` ADD COLUMN `views_count`    INT UNSIGNED NOT NULL DEFAULT 0 AFTER `reading_time`",
        "ALTER TABLE `news_articles` ADD COLUMN `is_featured`    TINYINT(1) NOT NULL DEFAULT 0 AFTER `views_count`",
    ] as $sql) {
        try { $pdo->exec($sql); } catch (Throwable $_e) { /* уже существует */ }
    }
}

function news_seed_15(PDO $pdo): void {
    news_ensure_table($pdo);
    $existing = (int)$pdo->query("SELECT COUNT(*) FROM `news_articles`")->fetchColumn();
    if ($existing > 0) return; // уже засеяно

    // Определяем владельца — первый пользователь с ролью owner/admin
    $ownerRow = $pdo->query("SELECT id FROM `users` WHERE role IN ('owner','admin') ORDER BY id ASC LIMIT 1")->fetch();
    $ownerId  = $ownerRow ? (int)$ownerRow['id'] : null;

    $articles = [
        ['gen-diag-2025','Генератор не заряжает: 5 признаков неисправности и что делать','tips',
         'Слабый заряд АКБ, свист из-под капота, мигающий индикатор — всё это симптомы больного генератора. Рассказываем, как диагностировать проблему до поездки в сервис.',
         '<p>Генератор — сердце электросистемы вашего автомобиля. Когда он выходит из строя, проблемы нарастают незаметно, пока аккумулятор не садится прямо в дороге.</p>
<h3>Признак №1: вольтметр показывает ниже 13,5 В</h3>
<p>Здоровый генератор выдаёт 13,8–14,4 В при работающем двигателе. Если ваш бортовой вольтметр или мультиметр показывает меньше — начинается тихий разряд аккумулятора.</p>
<h3>Признак №2: горит индикатор АКБ</h3>
<p>Многие игнорируют этот значок, списывая на «глюк». Это ошибка. Индикатор загорается, когда разница между напряжением генератора и бортсети превышает норму.</p>
<h3>Признак №3: свист или скрежет из области генератора</h3>
<p>Изношенные щётки ротора или разбитый подшипник дают характерный звук. На холодную он тише, на горячую — нарастает.</p>
<h3>Признак №4: тусклые фары при включении нагрузки</h3>
<p>Включили кондиционер, обогрев стекла и магнитолу — фары стали заметно тусклее? Генератор не справляется с нагрузкой.</p>
<h3>Признак №5: «просадка» при раскрутке</h3>
<p>На холостых оборотах напряжение нормальное, а при резком газе — падает. Это диодный мост или регулятор напряжения.</p>
<h3>Что делать?</h3>
<p>Не ждите, пока аккумулятор сядет окончательно. Диагностика генератора у нас занимает 20–30 минут и стоит от 3 000 ₸. Выявим причину точно — без угадывания.</p>',
         'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',1,0,'2025-11-15',5],

        ['akb-winter-tips','Аккумулятор зимой: как не остаться с разряженным АКБ в мороз','tips',
         'Зимой аккумулятор теряет до 40% ёмкости. Узнайте, как проверить его состояние, правильно зарядить и когда пора менять.',
         '<p>Казахстанские зимы с морозами до -30°C — серьёзное испытание для аккумулятора. Даже относительно новый АКБ может подвести при температуре ниже -20°C.</p>
<h3>Почему зимой хуже</h3>
<p>Химическая реакция внутри АКБ замедляется на холоде. При -18°C батарея отдаёт лишь 40% от номинальной ёмкости, при этом стартеру нужно больше тока — масло загустело.</p>
<h3>Проверяем состояние АКБ</h3>
<p>Нагрузочная вилка покажет реальное состояние батареи. Напряжение под нагрузкой ниже 9,5 В — пора менять. Мы проверяем АКБ бесплатно при любом визите.</p>
<h3>Правила зимней эксплуатации</h3>
<ul><li>Перед пуском отключите нагрузку (фары, обогрев)</li><li>Прогрейте АКБ несколькими включениями зажигания без старта</li><li>Не слушайте музыку при заглушённом двигателе</li><li>Раз в месяц делайте зарядку от стационарного зарядного устройства</li></ul>
<h3>Когда однозначно менять</h3>
<p>Если АКБ старше 4–5 лет, плохо держит заряд летом или не раз «садился в ноль» — не рискуйте зимой. Замена обойдётся дешевле эвакуатора.</p>',
         'https://images.unsplash.com/photo-1609621838510-5ad474b7d25d?w=800&q=80',0,1,'2025-11-28',4],

        ['starter-repair-how','Ремонт стартера: как это происходит у нас в сервисе','service',
         'Показываем весь процесс изнутри — от первичной диагностики до проверки на стенде. Без лишних слов, только факты.',
         '<p>Стартер — один из самых надёжных агрегатов в машине, но и он выходит из строя. Рассказываем, что происходит, когда вы привозите его к нам.</p>
<h3>Этап 1: диагностика</h3>
<p>Прежде чем разбирать, проверяем электрическую часть — напряжение на клеммах, ток потребления при прокрутке. Часто оказывается, что проблема не в самом стартере, а в проводке или реле.</p>
<h3>Этап 2: разборка и дефектовка</h3>
<p>Разбираем полностью: якорь, щётки, коллектор, втягивающее реле, бендикс. Каждый элемент проверяется отдельно. Фотографируем до и после — чтобы вы видели, что именно заменялось.</p>
<h3>Этап 3: замена деталей</h3>
<p>Используем только проверенные запчасти. Щётки, бендиксы, подшипники — всё оригинального качества. Никакого Китая с непонятной маркировкой.</p>
<h3>Этап 4: сборка и испытание на стенде</h3>
<p>После сборки каждый стартер проходит тестирование на стенде: замеряем ток холостого хода, ток под нагрузкой, частоту вращения якоря. Только после этого выдаём гарантию.</p>
<h3>Срок и стоимость</h3>
<p>Большинство ремонтов — 1 рабочий день. Стоимость от 6 000 ₸ в зависимости от сложности. Капитальный ремонт — от 12 000 ₸ с гарантией 6 месяцев.</p>',
         'https://images.unsplash.com/photo-1615906655593-ad0386982a0f?w=800&q=80',0,0,'2025-12-05',5],

        ['auto-electrics-myths','5 мифов об автоэлектрике, которые стоят вам денег','tips',
         'Многие водители годами верят в заблуждения об электросистеме авто. Разбираем самые дорогостоящие из них.',
         '<p>Автоэлектрика окружена мифами. Некоторые из них безобидны, другие — прямой путь к дорогому ремонту. Разбираем самые распространённые.</p>
<h3>Миф №1: «Если запустился — значит, всё нормально»</h3>
<p>Двигатель может запускаться даже при напряжении 11,5 В. Но длительная работа при низком заряде убивает генератор, а потом и АКБ. Проверяйте систему раз в сезон.</p>
<h3>Миф №2: «Короткое замыкание = сгоревший предохранитель, меняем и едем»</h3>
<p>Предохранитель — не решение, а сигнал. Если он перегорает второй раз — ищите причину, а не меняйте на больший номинал. Это может закончиться пожаром.</p>
<h3>Миф №3: «Сигнализацию можно поставить самостоятельно»</h3>
<p>Можно. Но неправильно подключённая сигнализация садит АКБ, мешает запуску и иногда блокирует двигатель в самый неподходящий момент. Мы регулярно переделываем такие установки.</p>
<h3>Миф №4: «Качество не важно, все генераторы одинаковые»</h3>
<p>Ресурс генераторов китайского производства без бренда — 30–50 тысяч км. Оригинал или качественный аналог ходит 150–200 тысяч. Разница в цене — 30%, разница в ресурсе — 300%.</p>
<h3>Миф №5: «Электрика — это сложно, сам не разберусь»</h3>
<p>Базовую диагностику с мультиметром освоит любой. Покажем при визите в сервис — бесплатно.</p>',
         'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80',0,0,'2025-12-10',4],

        ['alarm-starline-a93','Starline A93: почему это лучший выбор для защиты авто в 2025','parts',
         'Рассматриваем флагман отечественного рынка автосигнализаций. Что реально умеет A93 и стоит ли переплачивать за A96?',
         '<p>Starline A93 — самая популярная сигнализация в нашем сервисе. Устанавливаем её несколько раз в неделю и знаем все нюансы.</p>
<h3>Что умеет A93</h3>
<ul><li>2 CAN-шины + 2 LIN-шины — работает с большинством современных авто без дополнительных модулей</li><li>Автозапуск по температуре, расписанию или с телефона</li><li>Диалоговый код — защита от сканирования и relay-атак</li><li>GSM-модуль опционально — можно добавить позже</li><li>Турботаймер для бензиновых и дизельных</li></ul>
<h3>Чем отличается от A96</h3>
<p>A96 добавляет встроенный GPS-трекер и улучшенный алгоритм защиты от угона. Если авто стоит дороже 8 миллионов — берите A96. Для большинства автомобилей A93 избыточно хорош.</p>
<h3>Стоимость установки у нас</h3>
<p>Комплект + установка «под ключ» от 42 000 ₸. Настройка автозапуска, программирование меток, инструктаж по работе с приложением — включено. Гарантия 12 месяцев.</p>
<h3>Важный момент</h3>
<p>Правильная установка сигнализации требует знания электросхемы конкретного автомобиля. У нас есть базы данных схем для всех популярных марок — не угадываем, а знаем точно.</p>',
         'https://images.unsplash.com/photo-1558980394-da1f85d3b540?w=800&q=80',0,0,'2025-12-15',5],

        ['gen-rewind-vs-replace','Перемотка генератора или замена: что выгоднее в 2025 году','tips',
         'Разбираем экономику ремонта: когда восстановление генератора оправдано, а когда лучше взять контрактный агрегат.',
         '<p>Генератор умер. Перед вами три пути: перемотка, замена контрактным, покупка нового. Рассмотрим каждый.</p>
<h3>Перемотка (восстановление)</h3>
<p><strong>Плюсы:</strong> сохраняете оригинальный агрегат под ваш автомобиль, стоимость в 2–4 раза ниже нового. <strong>Минусы:</strong> имеет смысл только если корпус и ротор в хорошем состоянии.</p>
<p>Перемотка у нас: от 8 000 ₸, срок — 1 рабочий день, гарантия 6 месяцев.</p>
<h3>Контрактный агрегат</h3>
<p><strong>Плюсы:</strong> дешевле нового, часто оригинал из Японии или Кореи с небольшим пробегом. <strong>Минусы:</strong> неизвестна история агрегата, нет гарантии ресурса.</p>
<h3>Новый генератор</h3>
<p><strong>Плюсы:</strong> известный ресурс, гарантия производителя. <strong>Минусы:</strong> оригинал на многие марки стоит 80 000–200 000 ₸.</p>
<h3>Наша рекомендация</h3>
<p>Для автомобилей до 3 млн ₸: перемотка при хорошем корпусе или контрактный. Для дорогих авто — новый оригинал или качественный аналог (Bosch, Denso, Valeo).</p>',
         'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',0,0,'2026-01-08',4],

        ['current-leak-find','Как найти утечку тока: пошаговая инструкция','tips',
         'АКБ садится за ночь? Утечка тока можно найти самостоятельно с обычным мультиметром. Подробная инструкция от наших мастеров.',
         '<p>Утечка тока — одна из самых распространённых жалоб в нашем сервисе. Хорошая новость: её можно локализовать самостоятельно.</p>
<h3>Что вам нужно</h3>
<p>Цифровой мультиметр (от 2 000 ₸ в любом магазине электроники). Больше ничего.</p>
<h3>Шаг 1: замер тока покоя</h3>
<p>Выключите всё, закройте двери, подождите 10 минут (бортовой компьютер должен «уснуть»). Переведите мультиметр в режим тока (10 А). Подключите между минусовой клеммой АКБ и массой кузова. Норма — до 50 мА (0,05 А). Больше 80 мА — есть утечка.</p>
<h3>Шаг 2: методом исключения</h3>
<p>Начните вытаскивать предохранители по одному. Когда ток резко упал — цепь найдена. Смотрите, что питается от этого предохранителя по схеме.</p>
<h3>Частые виновники</h3>
<ul><li>Сигнализация (особенно самоустановленная)</li><li>Китайский видеорегистратор, подключённый напрямую к АКБ</li><li>Неисправный замок бардачка или двери (постоянно шлёт сигнал)</li><li>Подсветка салона с неисправным концевиком</li></ul>
<h3>Когда нужен мастер</h3>
<p>Если предохранители исчерпаны, а ток не падает — утечка в основных цепях (генератор, стартер, проводка). Звоните нам.</p>',
         'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80',0,0,'2026-01-15',5],

        ['kareta-team-2026','Наша команда в 2026: кто ремонтирует ваше авто','service',
         'Рассказываем о мастерах KARETA.KZ — их специализации, опыте и подходе к работе. Знакомьтесь с теми, кому доверяете машину.',
         '<p>Мы намеренно не делаем из сервиса анонимный конвейер. Вы должны знать, кто работает с вашим автомобилем.</p>
<h3>Артём — специалист по генераторам и стартерам</h3>
<p>8 лет в электрике автомобилей. Начинал на авторазборке, потом три года на официальном дилере Toyota, теперь у нас. Специализация — тяжёлые случаи, когда другие сервисы уже «пробовали».</p>
<p><em>«Генератор — это как сердце. Его можно вылечить, если не запустить.»</em></p>
<h3>Руслан — мастер по сигнализациям и проводке</h3>
<p>6 лет опыта. Сертифицированный установщик Starline и Pandect. Знает наизусть электросхемы более 200 моделей авто — японских, корейских, европейских.</p>
<p><em>«Неправильная установка сигнализации хуже, чем её отсутствие. Делаю только правильно.»</em></p>
<h3>Почему это важно для вас</h3>
<p>Когда вы записываетесь к нам, вы знаете заранее, кто будет работать с машиной. Никаких стажёров без надзора, никаких «кто свободен».</p>',
         'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80',0,1,'2026-01-22',4],

        ['wire-repair-full','Ремонт автопроводки: почему это сложнее, чем кажется','service',
         'Клиенты часто думают, что «перебросить провод» — дело на 15 минут. Объясняем, почему диагностика проводки требует времени и опыта.',
         '<p>Автопроводка современного автомобиля — это 2–4 км проводов, десятки блоков управления и тысячи соединений. Неисправность в любой точке может проявляться совсем не там, где её ждёшь.</p>
<h3>Классический пример</h3>
<p>Клиент приехал с жалобой: иногда не работает правое заднее стекло. Через полчаса обнаружили перетёртый провод в районе водительской двери — из-за него БУ кузовной электроники периодически «слетал» и отключал один из каналов управления стёклами.</p>
<h3>Почему долго?</h3>
<p>Мультиметром проверяем каждый участок цепи. Используем осциллограф для проверки импульсных сигналов. На некоторых автомобилях нужен специализированный сканер для чтения ошибок по CAN-шине.</p>
<h3>Что входит в ремонт проводки</h3>
<ul><li>Диагностика с мультиметром и сканером</li><li>Локализация повреждения</li><li>Замена или восстановление участка жгута</li><li>Восстановление изоляции</li><li>Проверка после ремонта</li></ul>
<h3>Стоимость и сроки</h3>
<p>Диагностика — от 3 000 ₸. Ремонт — от 5 000 ₸ в зависимости от объёма. Сложные случаи (множественные повреждения жгута) — по факту. Честно оцениваем до начала работ.</p>',
         'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80',0,0,'2026-01-30',5],

        ['auto-diag-what-is','Компьютерная диагностика: что показывает и зачем нужна','tips',
         'Многие путают диагностику с «чтением ошибок». Объясняем разницу и почему правильная диагностика — основа любого ремонта.',
         '<p>«Подключи сканер и скажи, что не так» — фраза, которую мы слышим несколько раз в неделю. Объясняем, почему это не совсем так работает.</p>
<h3>Что такое OBD-II коды</h3>
<p>Стандартные коды ошибок (P, B, C, U) — это сигналы от датчиков о выходе параметра за допустимые пределы. Код P0301 означает «пропуск зажигания в цилиндре 1», но не говорит ПОЧЕМУ: свеча, катушка, форсунка, компрессия или датчик.</p>
<h3>Что реально даёт диагностика</h3>
<p>Правильная диагностика — это работа с живыми данными в реальном времени: замеры напряжений, осциллограммы, адаптации, обучение. Это и есть работа мастера-диагноста, а не «сканерщика».</p>
<h3>Стоимость у нас</h3>
<p>Базовое чтение кодов — 1 500 ₸ (10–15 минут). Полная диагностика с анализом живых параметров — от 3 000 ₸ (30–60 минут). Стоимость диагностики засчитывается в ремонт.</p>
<h3>Когда нужна диагностика</h3>
<ul><li>Горит Check Engine</li><li>Непонятное поведение двигателя</li><li>Перед покупкой автомобиля</li><li>После любого серьёзного ремонта</li></ul>',
         'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80',0,0,'2026-02-05',4],

        ['brushes-gen-life','Щётки генератора: когда менять и как не ошибиться с выбором','parts',
         'Щётки — самый расходный элемент генератора. Правильный выбор и своевременная замена продлят жизнь всему агрегату.',
         '<p>Графитовые щётки — единственная деталь генератора, которая изнашивается по плану. Их ресурс — 80–120 тысяч км. Но «дожить» до конца ресурса удаётся редко.</p>
<h3>Признаки изношенных щёток</h3>
<ul><li>Нестабильное напряжение (плавает от 13,5 до 15 В)</li><li>Характерный свист или потрескивание</li><li>Иногда — запах горелой пластмассы</li><li>Проблемы с зарядом на малых оборотах</li></ul>
<h3>Как выбрать щётки</h3>
<p>Главный параметр — размер (длина, ширина, высота) и марка держателя. Никогда не берите «универсальные» щётки с рынка без точной привязки к артикулу. Неправильный размер = неравномерный износ коллектора.</p>
<h3>Что проверяем при замене</h3>
<p>При замене щёток обязательно проверяем состояние коллектора: нет ли выработки, кругового следа, подгоревших пластин. Иногда дешевле сразу сделать полную ревизию.</p>
<h3>Стоимость</h3>
<p>Замена щёток с диагностикой — от 4 500 ₸. Если нужна проточка коллектора — добавьте 2 000–3 000 ₸.</p>',
         'https://images.unsplash.com/photo-1605559424843-9073c6e78c52?w=800&q=80',0,0,'2026-02-12',3],

        ['before-buy-check','Что проверить в электрике перед покупкой подержанного авто','tips',
         'Покупаете «бэушку»? Список из 8 проверок электросистемы, которые сэкономят вам от 50 000 до 300 000 ₸.',
         '<p>Каждую неделю к нам приезжают клиенты с недавно купленными автомобилями и проблемами, которые можно было увидеть ещё на осмотре.</p>
<h3>Проверка 1: АКБ под нагрузкой</h3>
<p>Просто напряжение на клеммах — не показатель. Нужна нагрузочная вилка. Если продавец против — это уже ответ.</p>
<h3>Проверка 2: генератор при работающем двигателе</h3>
<p>Мультиметр, режим постоянного тока. Норма 13,8–14,4 В. Ниже 13,5 В — вопросы к генератору.</p>
<h3>Проверка 3: состояние проводки в моторном отсеке</h3>
<p>Смотрите на жгуты проводов: потрескавшаяся изоляция, следы самодельных скруток, нестандартные предохранители на скотче — всё это красные флаги.</p>
<h3>Проверка 4: сканер ошибок</h3>
<p>Подключить OBD-II адаптер и прочитать ошибки. Важно: некоторые продавцы стирают ошибки перед продажей. Если в архиве есть стёртые ошибки — узнать, когда.</p>
<h3>Проверки 5–8</h3>
<ul><li>Все стёкла и замки работают штатно</li><li>Нет запаха горелой проводки при прогреве</li><li>Ток покоя не превышает 80 мА</li><li>Нет посторонних предохранителей «на замену»</li></ul>
<h3>Услуга «Проверка перед покупкой»</h3>
<p>Мы проводим комплексную проверку электросистемы для покупателей — 5 000 ₸, 1 час. Выдаём письменное заключение.</p>',
         'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80',0,0,'2026-02-20',5],

        ['kareta-warranty','Гарантия в KARETA.KZ: что мы гарантируем и почему это важно','service',
         'Подробно о нашей гарантийной политике. Что покрывает гарантия, что нет, и как мы разрешаем спорные ситуации.',
         '<p>Слово «гарантия» в авторемонте часто звучит как маркетинг. Объясняем, как устроена наша гарантия на деле.</p>
<h3>Что мы гарантируем</h3>
<ul><li><strong>Электрика и генераторы:</strong> 6 месяцев или 20 000 км (что наступит раньше)</li><li><strong>Установка сигнализаций:</strong> 12 месяцев на монтаж, гарантия производителя на оборудование</li><li><strong>Ремонт стартеров:</strong> 6 месяцев</li><li><strong>Диагностические работы:</strong> точность заключения — если через 30 дней та же проблема не устранена нашим ремонтом, разбираемся бесплатно</li></ul>
<h3>Что не покрывает гарантия</h3>
<ul><li>Повреждения от ДТП или затопления</li><li>Вмешательство сторонних мастеров</li><li>Механические повреждения после выдачи</li></ul>
<h3>Как работает гарантийный случай</h3>
<p>Приезжаете, описываете ситуацию. Мы проверяем. Если проблема в нашей работе — устраняем бесплатно без лишних слов. Всегда.</p>',
         'https://images.unsplash.com/photo-1560472355-536de3962603?w=800&q=80',0,0,'2026-03-01',3],

        ['spring-checkup-2026','Весенняя проверка авто: что сделать после зимы в первую очередь','tips',
         'Зима закончилась. Что нужно проверить в электросистеме вашего автомобиля прямо сейчас — подробный чеклист.',
         '<p>После казахстанской зимы любой автомобиль нуждается в осмотре. Электросистема — в первую очередь.</p>
<h3>Чеклист весенней проверки электрики</h3>
<p><strong>АКБ:</strong> зима — главный враг аккумулятора. Проверьте ёмкость и ток холодного пуска. Если АКБ пережил 4+ зимы — плановая замена.</p>
<p><strong>Генератор:</strong> зимой он работает с повышенной нагрузкой (обогрев, освещение). Проверьте напряжение на клеммах и ток зарядки при нагрузке.</p>
<p><strong>Проводка:</strong> перепады температур, реагенты, мойка — всё это ускоряет разрушение изоляции. Осмотрите жгуты в моторном отсеке визуально.</p>
<p><strong>Датчики и разъёмы:</strong> окисленные контакты после зимы — частая причина глюков. Обработайте все доступные разъёмы контактной смазкой.</p>
<p><strong>Сигнализация:</strong> проверьте работу автозапуска, если есть. Именно весной чаще всего выясняется, что что-то «разошлось» за зиму.</p>
<h3>Акция «Весенний осмотр»</h3>
<p>До 30 апреля 2026 — комплексная диагностика электросистемы за 2 500 ₸ вместо 3 500 ₸. Запись онлайн или по телефону.</p>',
         'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80',1,1,'2026-03-10',4],

        ['parts-original-vs-copy','Оригинальные запчасти vs аналоги: честный разбор для электрики','parts',
         'Когда переплата за оригинал оправдана, а когда качественный аналог ничем не хуже. Говорим о конкретных деталях.',
         '<p>Вопрос «брать оригинал или аналог?» — один из самых частых от наших клиентов. Единого ответа нет, но есть чёткие критерии.</p>
<h3>Где оригинал обязателен</h3>
<ul><li><strong>Регуляторы напряжения</strong> — некачественный регулятор убивает аккумулятор за 2–3 месяца</li><li><strong>Диодные мосты</strong> — дешёвые горят через 20–30 тыс. км</li><li><strong>Блоки управления</strong> — здесь аналогов нет вообще</li></ul>
<h3>Где качественный аналог не хуже</h3>
<ul><li>Щётки генератора (Bosch, Valeo, Herth+Buss)</li><li>Подшипники (SKF, FAG, NSK)</li><li>Бендиксы стартеров (Cargo, AS-PL)</li></ul>
<h3>Что категорически не берём</h3>
<p>Безымянные детали с маркетплейсов без артикула и страны производства. Даже если визуально они идентичны оригиналу — ресурс непредсказуем.</p>
<h3>Наша политика</h3>
<p>Мы используем только проверенных поставщиков. Каждая запчасть приходит с документами. Вы видите, что именно устанавливается в вашу машину.</p>',
         'https://images.unsplash.com/photo-1609881408591-4b6b0a8c2b4d?w=800&q=80',0,0,'2026-03-18',4],
    ];

    $categories = ['tips','service','auto','parts','diagnostics'];
    $cats = ['tips'=>'Советы','service'=>'Сервис','parts'=>'Запчасти'];

    $stmt = $pdo->prepare("INSERT IGNORE INTO `news_articles`
        (id,slug,title,intro,body,cover_url,category,tags,author_name,author_role,author_user_id,published_at,reading_time,views_count,is_featured,active,sort)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)");

    foreach ($articles as $idx => $art) {
        [$slug,$title,$cat,$intro,$body,$cover,$featured,$pinned,$date,$readtime] = $art;
        $id = 'na_' . $slug;
        $authorName = 'Команда KARETA.KZ';
        $authorRoles = [
            'tips'=>'Советы по эксплуатации',
            'service'=>'О нашем сервисе',
            'parts'=>'Запчасти и комплектующие',
        ];
        $authorRole = $authorRoles[$cat] ?? 'Авто';
        $views = rand(120, 1840);
        $tagsByCategory = [
            'tips'=>['электрика','советы','диагностика'],
            'service'=>['сервис','ремонт','мастера'],
            'parts'=>['запчасти','генератор','стартер'],
        ];
        $tagsArr = $tagsByCategory[$cat] ?? ['авто'];
        $stmt->execute([
            $id, $slug, $title, $intro, $body, $cover,
            $cat, json_encode($tagsArr, JSON_UNESCAPED_UNICODE),
            $authorName, $authorRole, $ownerId,
            $date, $readtime, $views, $featured, $idx * 10
        ]);
    }
}

function news_getAll(?PDO $pdo, array $b): void {
    if (!$pdo) { kareta_json(['ok'=>true,'news',[]]); return; }
    news_ensure_table($pdo);
    $active = ($b['all'] ?? false) ? null : true;
    if ($active === null) {
        kareta_require_any_role(['admin','owner']);
        $rows = $pdo->query("SELECT * FROM `news_articles` ORDER BY sort ASC, published_at DESC")->fetchAll();
    } else {
        $rows = $pdo->query("SELECT * FROM `news_articles` WHERE active=1 ORDER BY sort ASC, published_at DESC LIMIT 50")->fetchAll();
    }
    kareta_json(['ok'=>true,'news'=>array_values($rows)]);
}

function news_mine(PDO $pdo): void {
    news_ensure_table($pdo);
    $user = kareta_session_user();
    $role = strtolower((string)($user['role'] ?? ''));
    $userId = (int)($user['id'] ?? 0);
    if ($userId < 1) kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    if (in_array($role, ['admin','owner'], true)) {
        $stmt = $pdo->query("SELECT * FROM `news_articles` ORDER BY created_at DESC, published_at DESC LIMIT 300");
    } else {
        $stmt = $pdo->prepare("SELECT * FROM `news_articles` WHERE author_user_id=? ORDER BY created_at DESC, published_at DESC LIMIT 300");
        $stmt->execute([$userId]);
    }
    kareta_json(['ok'=>true,'news'=>array_values($stmt->fetchAll(PDO::FETCH_ASSOC))]);
}

function news_assert_owner(PDO $pdo, string $id, array $user): void {
    $role = strtolower((string)($user['role'] ?? ''));
    if (in_array($role, ['admin','owner'], true)) return;
    $stmt = $pdo->prepare("SELECT author_user_id FROM `news_articles` WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $ownerId = $stmt->fetchColumn();
    if ($ownerId === false) return;
    if ((int)$ownerId !== (int)($user['id'] ?? 0)) kareta_json(['ok'=>false,'error'=>'news_forbidden'],403);
}

function news_save(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    news_ensure_table($pdo);
    $row = $b['article'] ?? $b;
    $sessionUser = kareta_session_user();
    if (!$sessionUser) kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    $sessionRole = strtolower((string)($sessionUser['role'] ?? ''));
    $id = trim((string)($row['id'] ?? ''));
    if ($id !== '') news_assert_owner($pdo, $id, $sessionUser);
    if ($id === '') $id = 'na_' . bin2hex(random_bytes(5));
    $title = kareta_clean_text($row['title'] ?? '', 255);
    if ($title === '') kareta_json(['ok'=>false,'error'=>'title_required'],422);
    $slug = trim((string)($row['slug'] ?? ''));
    if ($slug === '') {
        $slug = preg_replace('/[^a-z0-9]+/', '-', mb_strtolower($title));
        $slug = trim($slug, '-');
        if ($slug === '') $slug = substr($id, 0, 20);
    }
    $authorUserId = (int)($sessionUser['id'] ?? 0);
    $authorName = kareta_clean_text($sessionUser['name'] ?? $sessionUser['fullName'] ?? $sessionUser['fio'] ?? 'Мастер KARETA.KZ', 120);
    $authorRole = $sessionRole;
    if (in_array($sessionRole, ['admin','owner'], true)) {
        if (!empty($row['authorUserId'])) $authorUserId = (int)$row['authorUserId'];
        if (!empty($row['authorName'])) $authorName = kareta_clean_text($row['authorName'],120);
        if (!empty($row['authorRole'])) $authorRole = kareta_clean_text($row['authorRole'],120);
    }
    $allowedCategories = ['tips','service','auto','parts','diagnostics','platform'];
    $category = in_array($row['category'] ?? 'service', $allowedCategories, true) ? $row['category'] : 'service';
    $tags = is_array($row['tags'] ?? null) ? $row['tags'] : (is_string($row['tags'] ?? null) ? json_decode($row['tags'],true) : []);
    $isFeatured = in_array($sessionRole, ['admin','owner'], true) ? (int)(bool)($row['isFeatured'] ?? $row['is_featured'] ?? false) : 0;
    $pdo->prepare("INSERT INTO `news_articles`(id,slug,title,intro,body,cover_url,category,tags,author_name,author_role,author_user_id,published_at,reading_time,is_featured,active,sort)
                   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE slug=VALUES(slug),title=VALUES(title),intro=VALUES(intro),body=VALUES(body),
                   cover_url=VALUES(cover_url),category=VALUES(category),tags=VALUES(tags),
                   author_name=VALUES(author_name),author_role=VALUES(author_role),author_user_id=VALUES(author_user_id),
                   published_at=VALUES(published_at),reading_time=VALUES(reading_time),
                   is_featured=VALUES(is_featured),active=VALUES(active),sort=VALUES(sort)")
        ->execute([
            $id,$slug,$title,
            kareta_clean_text($row['intro'] ?? '',2000),(string)($row['body'] ?? ''),
            kareta_clean_text($row['coverUrl'] ?? $row['cover_url'] ?? '',500),$category,
            json_encode(array_values((array)($tags ?? [])),JSON_UNESCAPED_UNICODE),
            $authorName,$authorRole,$authorUserId,
            kareta_clean_text($row['publishedAt'] ?? $row['published_at'] ?? date('Y-m-d'),10),
            max(1,(int)($row['readingTime'] ?? $row['reading_time'] ?? 3)),
            $isFeatured,(int)(bool)($row['active'] ?? true),(int)($row['sort'] ?? 0),
        ]);
    kareta_log_audit($pdo,'news.save',['id'=>$id,'title'=>$title,'authorUserId'=>$authorUserId]);
    kareta_json(['ok'=>true,'id'=>$id,'slug'=>$slug]);
}

function news_view(?PDO $pdo, array $b): void {
    if (!$pdo) { kareta_json(['ok'=>true]); return; }
    $id = (string)($b['id'] ?? '');
    if ($id === '') { kareta_json(['ok'=>false,'error'=>'id_required'],422); return; }
    try { $pdo->prepare("UPDATE `news_articles` SET views_count=views_count+1 WHERE id=?")->execute([$id]); } catch(Throwable $_e) {}
    kareta_json(['ok'=>true]);
}

function news_delete(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $id = (string)($b['id'] ?? '');
    if ($id === '') kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $user = kareta_session_user();
    if (!$user) kareta_json(['ok'=>false,'error'=>'auth_required'],401);
    news_assert_owner($pdo, $id, $user);
    $pdo->prepare("UPDATE `news_articles` SET active=0 WHERE id=?")->execute([$id]);
    kareta_log_audit($pdo,'news.delete',['id'=>$id]);
    kareta_json(['ok'=>true]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MASTER POSTS
═══════════════════════════════════════════════════════════════════════ */
function master_posts_get_mine(PDO $pdo): void {
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);
    $rows = $pdo->prepare("SELECT * FROM `master_posts` WHERE master_id=? ORDER BY created_at DESC LIMIT 200");
    $rows->execute([$masterId]);
    $posts = array_map('master_posts_row_to_js', $rows->fetchAll(PDO::FETCH_ASSOC));
    kareta_json(['ok'=>true,'posts'=>$posts]);
}

function master_posts_get_all(PDO $pdo): void {
    $rows = $pdo->query("SELECT * FROM `master_posts` WHERE status='published' ORDER BY published_at DESC LIMIT 500");
    $posts = array_map('master_posts_row_to_js', $rows->fetchAll(PDO::FETCH_ASSOC));
    kareta_json(['ok'=>true,'posts'=>$posts]);
}

function master_posts_row_to_js(array $r): array {
    $r['photos'] = !empty($r['photos_json']) ? json_decode($r['photos_json'], true) : [];
    unset($r['photos_json']);
    return $r;
}

function master_posts_save(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);

    $id     = trim($body['id'] ?? '');
    $isNew  = ($id === '');
    if ($isNew) $id = 'mp_' . bin2hex(random_bytes(8));

    $type    = trim($body['type']    ?? 'case');
    $title   = trim($body['title']   ?? '');
    $preview = trim($body['preview'] ?? '');
    $body_   = trim($body['body']    ?? '');
    $photos  = $body['photos'] ?? [];
    $tags    = trim($body['tags']    ?? '');
    $status  = trim($body['status']  ?? 'draft');
    $allowed_statuses = ['draft','published','archived'];
    if (!in_array($status, $allowed_statuses, true)) $status = 'draft';

    $pubAt = null;
    if ($status === 'published') {
        // Check if already published
        if (!$isNew) {
            $existing = $pdo->prepare("SELECT published_at FROM `master_posts` WHERE id=? AND master_id=?");
            $existing->execute([$id, $masterId]);
            $ex = $existing->fetch(PDO::FETCH_ASSOC);
            $pubAt = $ex['published_at'] ?? date('Y-m-d H:i:s');
        } else {
            $pubAt = date('Y-m-d H:i:s');
        }
    }

    $photosJson = json_encode(array_values(array_filter((array)$photos)));

    if ($isNew) {
        $pdo->prepare("INSERT INTO `master_posts` (id,master_id,type,title,preview,body,photos_json,tags,status,published_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([$id,$masterId,$type,$title,$preview,$body_,$photosJson,$tags,$status,$pubAt]);
    } else {
        // Ensure master owns it
        $own = $pdo->prepare("SELECT id FROM `master_posts` WHERE id=? AND master_id=?");
        $own->execute([$id, $masterId]);
        if (!$own->fetch()) kareta_json(['ok'=>false,'error'=>'not_found'],404);
        $pdo->prepare("UPDATE `master_posts` SET type=?,title=?,preview=?,body=?,photos_json=?,tags=?,status=?,published_at=? WHERE id=? AND master_id=?")
            ->execute([$type,$title,$preview,$body_,$photosJson,$tags,$status,$pubAt,$id,$masterId]);
    }

    kareta_log_audit($pdo, 'masterPost.save', ['id'=>$id,'status'=>$status,'masterId'=>$masterId]);
    kareta_json(['ok'=>true,'id'=>$id]);
}

function master_posts_delete(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);
    $id = trim($body['id'] ?? '');
    if (!$id) kareta_json(['ok'=>false,'error'=>'id_required'],422);
    // Archive instead of hard delete
    $pdo->prepare("UPDATE `master_posts` SET status='archived' WHERE id=? AND master_id=?")->execute([$id,$masterId]);
    kareta_log_audit($pdo, 'masterPost.archive', ['id'=>$id,'masterId'=>$masterId]);
    kareta_json(['ok'=>true]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MASTER REVIEWS
═══════════════════════════════════════════════════════════════════════ */
function kareta_master_review_summary(array $rows): array {
    $count=count($rows);$sum=0;$verified=0;$breakdown=['1'=>0,'2'=>0,'3'=>0,'4'=>0,'5'=>0];
    $dims=['quality'=>[0,0],'timing'=>[0,0],'neatness'=>[0,0],'communication'=>[0,0]];
    foreach($rows as $r){$rating=max(1,min(5,(int)($r['rating']??0)));$sum+=$rating;$breakdown[(string)$rating]++;if(trim((string)($r['order_id']??''))!=='')$verified++;
        foreach(['quality'=>'quality_rating','timing'=>'timing_rating','neatness'=>'neatness_rating','communication'=>'communication_rating'] as $k=>$col){$v=(int)($r[$col]??0);if($v>0){$dims[$k][0]+=$v;$dims[$k][1]++;}}
    }
    $averages=[];foreach($dims as $k=>[$total,$n])$averages[$k]=$n?round($total/$n,1):0.0;
    return ['count'=>$count,'verified'=>$verified,'average'=>$count?round($sum/$count,1):0.0,'breakdown'=>$breakdown,'dimensions'=>$averages,'unanswered'=>count(array_filter($rows,static fn($r)=>trim((string)($r['master_reply']??''))===''))];
}

function master_reviews_get_mine(PDO $pdo): void {
    kareta_ensure_verified_review_schema($pdo);
    $master=function_exists('kareta_master_workplace_profile')?kareta_master_workplace_profile($pdo):[];
    $masterId=trim((string)($master['id']??''));
    if($masterId==='')kareta_json(['ok'=>false,'error'=>'no_master'],403);
    $rows=$pdo->prepare("SELECT id,master_id,order_id,author_name,rating,quality_rating,timing_rating,neatness_rating,communication_rating,text,master_reply,master_reply_at,status,created_at FROM master_reviews mr JOIN orders o ON o.id=mr.order_id AND o.status='done' WHERE mr.master_id=? AND mr.status='published' ORDER BY mr.created_at DESC LIMIT 300");
    $rows->execute([$masterId]);$items=$rows->fetchAll(PDO::FETCH_ASSOC)?:[];
    kareta_json(['ok'=>true,'reviews'=>$items,'data'=>['items'=>$items,'summary'=>kareta_master_review_summary($items),'master'=>['id'=>$masterId,'name'=>(string)($master['name']??'Мастер')]]]);
}

function master_reviews_reply(PDO $pdo, array $body): void {
    kareta_ensure_verified_review_schema($pdo);
    $master=function_exists('kareta_master_workplace_profile')?kareta_master_workplace_profile($pdo):[];
    $masterId=trim((string)($master['id']??''));
    if($masterId==='')kareta_json(['ok'=>false,'error'=>'no_master'],403);
    $id=kareta_clean_text($body['id']??$body['reviewId']??'',64);
    $reply=kareta_clean_text($body['reply']??'',1600);
    if($id==='')kareta_json(['ok'=>false,'error'=>'id_required'],422);
    $q=$pdo->prepare("SELECT id,order_id,source_review_id FROM master_reviews WHERE id=? AND master_id=? AND status='published' LIMIT 1");$q->execute([$id,$masterId]);$review=$q->fetch(PDO::FETCH_ASSOC)?:[];
    if(!$review)kareta_json(['ok'=>false,'error'=>'review_not_found'],404);
    $replyAt=$reply!==''?date('Y-m-d H:i:s'):null;
    $pdo->prepare("UPDATE master_reviews SET master_reply=?,master_reply_at=? WHERE id=? AND master_id=?")->execute([$reply!==''?$reply:null,$replyAt,$id,$masterId]);
    if(kareta_table_exists($pdo,'reviews_public')){
        $sourceId=trim((string)($review['source_review_id']??''));$orderId=trim((string)($review['order_id']??''));
        if($sourceId!=='')$pdo->prepare("UPDATE reviews_public SET master_reply=?,master_reply_at=? WHERE id=? AND master_id=?")->execute([$reply!==''?$reply:null,$replyAt,$sourceId,$masterId]);
        elseif($orderId!=='')$pdo->prepare("UPDATE reviews_public SET master_reply=?,master_reply_at=? WHERE order_id=? AND master_id=? AND review_type='service' AND active=1")->execute([$reply!==''?$reply:null,$replyAt,$orderId,$masterId]);
    }
    kareta_log_audit($pdo,'masterReviews.reply',['reviewId'=>$id,'masterId'=>$masterId,'cleared'=>$reply==='']);
    kareta_json(['ok'=>true,'data'=>['id'=>$id,'reply'=>$reply,'replyAt'=>$replyAt]]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MASTER METRICS
═══════════════════════════════════════════════════════════════════════ */
function master_metrics_track(PDO $pdo, array $body): void {
    $masterId = trim($body['masterId'] ?? '');
    $event    = trim($body['event']   ?? '');
    if (!$masterId || !$event) kareta_json(['ok'=>true]); // silent
    $allowed = ['profile_views','modal_opens','profile_clicks','wa_clicks','order_proposals'];
    if (!in_array($event, $allowed, true)) kareta_json(['ok'=>true]);
    $today = date('Y-m-d');
    $id    = 'mmc_'.$masterId.'_'.$today;
    $pdo->prepare("INSERT INTO `master_metrics_cache` (id,master_id,metric_date,`{$event}`) VALUES (?,?,?,1)
        ON DUPLICATE KEY UPDATE `{$event}`=`{$event}`+1")
        ->execute([$id,$masterId,$today]);
    kareta_json(['ok'=>true]);
}

function master_metrics_get_mine(PDO $pdo): void {
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);
    // Last 30 days
    $rows = $pdo->prepare("SELECT * FROM `master_metrics_cache` WHERE master_id=? AND metric_date >= DATE_SUB(CURDATE(),INTERVAL 30 DAY) ORDER BY metric_date DESC");
    $rows->execute([$masterId]);
    $metrics = $rows->fetchAll(PDO::FETCH_ASSOC);
    // Totals
    $totals = ['profile_views'=>0,'modal_opens'=>0,'profile_clicks'=>0,'wa_clicks'=>0,'order_proposals'=>0];
    foreach ($metrics as $m) {
        foreach ($totals as $k => $_) $totals[$k] += (int)($m[$k] ?? 0);
    }
    kareta_json(['ok'=>true,'metrics'=>$metrics,'totals'=>$totals]);
}

/* ═══════════════════════════════════════════════════════════════════════
   MASTER PROFILE SAVE (расширенный)
═══════════════════════════════════════════════════════════════════════ */
function master_save_profile(PDO $pdo, array $body): void {
    kareta_ensure_column($pdo, 'masters', 'resume', "ALTER TABLE `masters` ADD COLUMN `resume` JSON NULL DEFAULT NULL");
    kareta_ensure_column($pdo, 'masters', 'offer_text', "ALTER TABLE `masters` ADD COLUMN `offer_text` VARCHAR(255) NULL DEFAULT NULL AFTER `spec`");
        kareta_ensure_column($pdo, 'masters', 'work_radius_km',      "ALTER TABLE `masters` ADD COLUMN `work_radius_km` INT NOT NULL DEFAULT 30");
    kareta_ensure_column($pdo, 'masters', 'field_service_enabled', "ALTER TABLE `masters` ADD COLUMN `field_service_enabled` TINYINT(1) NOT NULL DEFAULT 0");
    kareta_ensure_column($pdo, 'masters', 'base_lat',              "ALTER TABLE `masters` ADD COLUMN `base_lat` DECIMAL(10,7) NULL DEFAULT NULL");
    kareta_ensure_column($pdo, 'masters', 'base_lng',              "ALTER TABLE `masters` ADD COLUMN `base_lng` DECIMAL(10,7) NULL DEFAULT NULL");
    kareta_ensure_column($pdo, 'masters', 'work_mode', "ALTER TABLE `masters` ADD COLUMN `work_mode` VARCHAR(32) NULL DEFAULT NULL AFTER `offer_text`");
    kareta_ensure_column($pdo, 'masters', 'district', "ALTER TABLE `masters` ADD COLUMN `district` VARCHAR(120) NULL DEFAULT NULL AFTER `work_mode`");
    kareta_ensure_column($pdo, 'masters', 'primary_services', "ALTER TABLE `masters` ADD COLUMN `primary_services` JSON NULL DEFAULT NULL AFTER `district`");
    kareta_ensure_column($pdo, 'masters', 'availability', "ALTER TABLE `masters` ADD COLUMN `availability` VARCHAR(24) NOT NULL DEFAULT 'online' AFTER `primary_services`");
    kareta_ensure_column($pdo, 'masters', 'profile_visible', "ALTER TABLE `masters` ADD COLUMN `profile_visible` TINYINT(1) NOT NULL DEFAULT 1 AFTER `availability`");
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);

    // Поля прямого профиля
    $allowed_availability = ['online','busy','replying','offline'];
    $availability = in_array($body['availability'] ?? '', $allowed_availability, true)
        ? $body['availability'] : 'online';

    $pdo->prepare("UPDATE `masters` SET
        offer_text=?, work_mode=?, district=?, primary_services=?,
        availability=?, profile_visible=?
        WHERE id=?")
        ->execute([
            trim($body['offerText']     ?? '') ?: null,
            trim($body['workMode']      ?? '') ?: null,
            trim($body['district']      ?? '') ?: null,
            isset($body['primaryServices']) ? json_encode(array_values((array)$body['primaryServices'])) : null,
            $availability,
            isset($body['profileVisible']) ? (int)(bool)$body['profileVisible'] : 1,
            $masterId,
        ]);

    // Также сохраняем resume-поля если переданы
    $resumeKeys = ['bio','experience','spec','businessType','orgName','address','city',
                   'education','courses','awards','skills','languages',
                   'offer','workMode','district','startingPrice','responseTimeLabel',
                   'guarantee','minCheck','paymentMethods','workWithOwnParts','urgentWork'];
    $existing = $pdo->prepare("SELECT resume FROM `masters` WHERE id=?");
    $existing->execute([$masterId]);
    $row = $existing->fetch(PDO::FETCH_ASSOC);
    $resume = [];
    if (!empty($row['resume'])) {
        $dec = json_decode($row['resume'], true);
        if (is_array($dec)) $resume = $dec;
    }
    foreach ($resumeKeys as $k) {
        if (isset($body['resume'][$k])) $resume[$k] = $body['resume'][$k];
    }
    $pdo->prepare("UPDATE `masters` SET resume=? WHERE id=?")->execute([json_encode($resume), $masterId]);

    kareta_log_audit($pdo, 'master.saveProfile', ['masterId'=>$masterId]);
    kareta_json(['ok'=>true]);
}

/* ═══════════════════════════════════════════════════════════════════
   MASTER GEO SAVE
═══════════════════════════════════════════════════════════════════ */
function master_save_geo(PDO $pdo, array $body): void {
    kareta_ensure_column($pdo, 'masters', 'work_mode', "ALTER TABLE `masters` ADD COLUMN `work_mode` VARCHAR(32) NULL DEFAULT NULL AFTER `offer_text`");
    kareta_ensure_column($pdo, 'masters', 'city', "ALTER TABLE `masters` ADD COLUMN `city` VARCHAR(120) NOT NULL DEFAULT '' AFTER `spec`");
    kareta_ensure_column($pdo, 'masters', 'service_address', "ALTER TABLE `masters` ADD COLUMN `service_address` VARCHAR(255) NULL DEFAULT NULL AFTER `city`");
    kareta_ensure_column($pdo, 'masters', 'service_radius_km', "ALTER TABLE `masters` ADD COLUMN `service_radius_km` INT NOT NULL DEFAULT 0 AFTER `service_address`");
    kareta_ensure_column($pdo, 'masters', 'service_lat', "ALTER TABLE `masters` ADD COLUMN `service_lat` DECIMAL(10,7) NULL DEFAULT NULL AFTER `service_radius_km`");
    kareta_ensure_column($pdo, 'masters', 'service_lng', "ALTER TABLE `masters` ADD COLUMN `service_lng` DECIMAL(10,7) NULL DEFAULT NULL AFTER `service_lat`");
    kareta_ensure_column($pdo, 'masters', 'location_source', "ALTER TABLE `masters` ADD COLUMN `location_source` VARCHAR(16) NOT NULL DEFAULT 'manual' AFTER `service_lng`");
    kareta_ensure_column($pdo, 'masters', 'location_visibility', "ALTER TABLE `masters` ADD COLUMN `location_visibility` VARCHAR(16) NOT NULL DEFAULT 'city' AFTER `location_source`");
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'no_master'],403);

    $allowed_work_modes   = ['shop','mobile','hybrid'];
    $allowed_visibility   = ['city','district','hidden'];
    $allowed_loc_sources  = ['manual','ip','gps'];

    $workMode   = in_array($body['workMode'] ?? '', $allowed_work_modes, true) ? $body['workMode'] : 'shop';
    $visibility = in_array($body['locationVisibility'] ?? '', $allowed_visibility, true) ? $body['locationVisibility'] : 'city';
    $locSource  = in_array($body['locationSource'] ?? '', $allowed_loc_sources, true) ? $body['locationSource'] : 'manual';
    $radius     = max(0, min(500, (int)($body['serviceRadiusKm'] ?? 0)));
    $address    = trim($body['serviceAddress'] ?? '');
    $city       = trim($body['city'] ?? '');
    if ($city === '') kareta_json(['ok'=>false,'error'=>'city_required','message'=>'Город обязателен'], 422);
    $lat        = isset($body['lat']) ? round((float)$body['lat'], 7) : null;
    $lng        = isset($body['lng']) ? round((float)$body['lng'], 7) : null;

    $pdo->prepare("UPDATE `masters` SET
        work_mode=?, service_radius_km=?, service_address=?, city=?,
        service_lat=?, service_lng=?, location_source=?, location_visibility=?
        WHERE id=?")
        ->execute([$workMode, $radius, $address, $city, $lat, $lng, $locSource, $visibility, $masterId]);

    // Синхронизируем город в users
    if ($city !== '') {
        $pdo->prepare("UPDATE `users` u INNER JOIN `masters` m ON m.user_id=u.id OR m.user_phone=u.phone SET u.city=? WHERE m.id=?")
            ->execute([$city, $masterId]);
    }

    kareta_log_audit($pdo, 'master.saveGeo', ['masterId'=>$masterId,'workMode'=>$workMode,'city'=>$city]);
    kareta_json(['ok'=>true]);
}


function sto_save_profile(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'], 401);
    $role = (string)($u['role'] ?? '');
    if (!in_array($role, ['sto','admin','owner'], true)) {
        kareta_json(['ok'=>false,'error'=>'forbidden'], 403);
    }

    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    if ($phone === '') kareta_json(['ok'=>false,'error'=>'phone_required'], 422);

    $stoId = kareta_sto_id_by_phone($pdo, $phone);
    if ($stoId === '') $stoId = 'sto_' . substr(md5($phone), 0, 10);

    $name = trim((string)($body['name'] ?? $u['name'] ?? ''));
    $city = trim((string)($body['city'] ?? $u['city'] ?? ''));
    if ($name === '') kareta_json(['ok'=>false,'error'=>'name_required','message'=>'Название СТО обязательно'], 422);
    $address = trim((string)($body['address'] ?? ''));
    $contactPhone = kareta_normalize_phone((string)($body['contactPhone'] ?? $phone)) ?: $phone;
    $workHours = trim((string)($body['workHours'] ?? ''));
    $countryCode = strtoupper(trim((string)($body['countryCode'] ?? $u['country_code'] ?? 'KZ'))) ?: 'KZ';

    $pdo->prepare("INSERT INTO `sto_profiles`(id,user_id,user_phone,name,contact_phone,country_code,city,address,work_hours,active)
                   VALUES(?,?,?,?,?,?,?,?,?,?)
                   ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), user_phone=VALUES(user_phone), name=VALUES(name),
                                           contact_phone=VALUES(contact_phone), country_code=VALUES(country_code), city=VALUES(city),
                                           address=VALUES(address), work_hours=VALUES(work_hours), active=VALUES(active)")
        ->execute([
            $stoId,
            ((int)($u['id'] ?? 0) ?: null),
            $phone,
            $name !== '' ? $name : 'СТО',
            $contactPhone,
            $countryCode,
            $city,
            $address,
            $workHours,
            1,
        ]);

    $pdo->prepare("UPDATE `users` SET name=?, city=?, country_code=?, role='sto', entry_role='sto' WHERE id=? OR phone=? LIMIT 1")
        ->execute([$name !== '' ? $name : 'СТО', $city, $countryCode, ((int)($u['id'] ?? 0) ?: null), $phone]);

    kareta_log_audit($pdo, 'sto.saveProfile', ['stoId'=>$stoId, 'city'=>$city]);
    kareta_json(['ok'=>true, 'stoId'=>$stoId]);
}

/* ── Helper: resolve master_id from current user ── */
function kareta_resolve_master_id(PDO $pdo, ?array $u): ?string {
    if (!$u) return null;
    $role = $u['role'] ?? '';
    if (in_array($role, ['admin','owner'], true)) {
        // Admin context: use body masterId if provided
        return null; // will be handled per-action
    }
    // Master: find by user binding
    $r = $pdo->prepare("SELECT id FROM `masters` WHERE user_id=? OR phone=? LIMIT 1");
    $r->execute([$u['id'] ?? '', $u['phone'] ?? '']);
    $row = $r->fetch(PDO::FETCH_ASSOC);
    return $row ? (string)$row['id'] : null;
}

/* ═══════════════════════════════════════════════════════════════════
   STO — MASTER LINKS
═══════════════════════════════════════════════════════════════════ */
function sto_assign_master(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'], 401);
    $role = (string)($u['role'] ?? '');
    $masterId = trim((string)($body['masterId'] ?? ''));
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_id_required'], 422);

    $mst = $pdo->prepare("SELECT id, sto_id FROM `masters` WHERE id=? LIMIT 1");
    $mst->execute([$masterId]);
    $masterRow = $mst->fetch(PDO::FETCH_ASSOC);
    if (!$masterRow) kareta_json(['ok'=>false,'error'=>'master_not_found'], 404);

    $stoId = '';
    if ($role === 'sto') {
        $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
        if ($phone === '') kareta_json(['ok'=>false,'error'=>'phone_required'], 422);
        $stoId = kareta_sto_id_by_phone($pdo, $phone);
        if ($stoId === '') kareta_json(['ok'=>false,'error'=>'sto_profile_required','message'=>'Сначала заполните профиль СТО'], 422);

        $currentSto = trim((string)($masterRow['sto_id'] ?? ''));
        if ($currentSto !== '' && $currentSto !== $stoId) {
            kareta_json(['ok'=>false,'error'=>'master_already_linked_to_other_sto'], 409);
        }
    } else {
        if (!in_array($role, ['admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'], 403);
        $stoId = trim((string)($body['stoId'] ?? ''));
        if ($stoId === '') kareta_json(['ok'=>false,'error'=>'sto_id_required','message'=>'Для привязки мастера администратором требуется явный stoId'],422);
    }

    $currentStoBefore = trim((string)($masterRow['sto_id'] ?? ''));
    if ($currentStoBefore === $stoId) {
        kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'master_already_assigned_to_sto','stoId'=>$stoId,'masterId'=>$masterId]);
    }
    $stoName = '';
    if ($stoId !== '') {
        $stSto = $pdo->prepare("SELECT name FROM `sto_profiles` WHERE id=? AND active=1 LIMIT 1");
        $stSto->execute([$stoId]);
        $stoName = (string)($stSto->fetchColumn() ?: '');
        if ($stoName === '') kareta_json(['ok'=>false,'error'=>'sto_not_found'], 404);
    }

    $pdo->prepare("UPDATE `masters` SET sto_id=?, sto_name=? WHERE id=?")->execute([$stoId, $stoName, $masterId]);
    if ($stoId !== '') {
        $pdo->prepare("INSERT INTO `sto_master_links`(sto_id,master_id,status,invited_at,accepted_at)
                       VALUES(?,?,'active',NOW(),NOW())
                       ON DUPLICATE KEY UPDATE status='active', accepted_at=NOW(), updated_at=CURRENT_TIMESTAMP")
            ->execute([$stoId, $masterId]);
    } else {
        $pdo->prepare("UPDATE `sto_master_links` SET status='detached', updated_at=CURRENT_TIMESTAMP WHERE master_id=? AND status='active'")->execute([$masterId]);
    }
    kareta_log_audit($pdo,'sto.assignMaster',['stoId'=>$stoId,'masterId'=>$masterId,'role'=>$role]);
    kareta_json(['ok'=>true,'stoId'=>$stoId,'stoName'=>$stoName,'masterId'=>$masterId]);
}

function sto_invite_master(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    $role = (string)($u['role'] ?? 'guest');
    if (!in_array($role, ['sto','admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    $sto = kareta_resolve_current_sto($pdo, $u, $body);
    $stoId = (string)$sto['id'];

    $masterId = trim((string)($body['masterId'] ?? ''));
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'master_id_required'], 422);

    // Проверяем что мастер существует
    $mst = $pdo->prepare("SELECT id FROM `masters` WHERE id=? LIMIT 1");
    $mst->execute([$masterId]);
    if (!$mst->fetchColumn()) kareta_json(['ok'=>false,'error'=>'master_not_found'], 404);

    $stExistingInvite = $pdo->prepare("SELECT status FROM `sto_master_links` WHERE sto_id=? AND master_id=? LIMIT 1");
    $stExistingInvite->execute([$stoId, $masterId]);
    $existingInviteStatus = (string)($stExistingInvite->fetchColumn() ?: '');
    if (in_array($existingInviteStatus, ['pending','active'], true)) {
        kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'invite_already_exists','stoId'=>$stoId,'masterId'=>$masterId,'status'=>$existingInviteStatus]);
    }
    // Создаём или обновляем связь
    $pdo->prepare("INSERT INTO `sto_master_links`(sto_id,master_id,status,invited_at)
                   VALUES(?,?,'pending',NOW())
                   ON DUPLICATE KEY UPDATE status=IF(status='rejected','pending',status), invited_at=NOW()")
        ->execute([$stoId, $masterId]);

    // Создаём уведомление мастеру
    if (kareta_table_exists($pdo, 'notifications')) {
        $masterUserId = (int)($pdo->query("SELECT user_id FROM `masters` WHERE id='$masterId' LIMIT 1")->fetchColumn() ?: 0);
        if ($masterUserId > 0) {
            $stoName = (string)($pdo->query("SELECT name FROM `sto_profiles` WHERE id='$stoId' LIMIT 1")->fetchColumn() ?: 'СТО');
            $pdo->prepare("INSERT INTO `notifications`(user_id,type,title,body,data_json,created_at)
                           VALUES(?,?,?,?,?,NOW())")
                ->execute([$masterUserId,'sto_invite','Приглашение от СТО',
                    'Автосервис «'.$stoName.'» приглашает вас в свою команду.',
                    json_encode(['stoId'=>$stoId,'masterId'=>$masterId,'action'=>'sto_invite'])]);
        }
    }

    kareta_log_audit($pdo,'sto.inviteMaster',['stoId'=>$stoId,'masterId'=>$masterId]);
    kareta_json(['ok'=>true,'stoId'=>$stoId,'masterId'=>$masterId]);
}

function sto_get_links(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    $role = (string)($u['role'] ?? '');
    if (!in_array($role, ['master','sto','admin','owner'], true)) kareta_json(['ok'=>false,'error'=>'forbidden'],403);

    if ($role === 'master') {
        $masterId = kareta_resolve_master_id($pdo, $u);
        if (!$masterId) kareta_json(['ok'=>true,'links'=>[]]);
        $rows = $pdo->prepare("SELECT l.*, s.name as sto_name, s.city as sto_city, s.address as sto_address
            FROM `sto_master_links` l JOIN `sto_profiles` s ON s.id=l.sto_id
            WHERE l.master_id=? ORDER BY l.invited_at DESC");
        $rows->execute([$masterId]);
    } else {
        $sto = kareta_resolve_current_sto($pdo, $u, $body);
        $stoId = (string)$sto['id'];
        $rows = $pdo->prepare("SELECT l.*, m.name as master_name, m.spec as master_spec, m.color as master_color
            FROM `sto_master_links` l JOIN `masters` m ON m.id=l.master_id
            WHERE l.sto_id=? ORDER BY l.status='active' DESC, l.invited_at DESC");
        $rows->execute([$stoId]);
    }
    kareta_json(['ok'=>true,'links'=>$rows->fetchAll()]);
}

function sto_accept_invite(PDO $pdo, array $body): void {
    $u = kareta_current_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'not_a_master'], 403);

    $stoId  = trim((string)($body['stoId'] ?? ''));
    if ($stoId === '') kareta_json(['ok'=>false,'error'=>'sto_id_required'],422);
    $accept = (bool)($body['accept'] ?? true);
    $status = $accept ? 'active' : 'rejected';

    $stLink = $pdo->prepare("SELECT status FROM `sto_master_links` WHERE sto_id=? AND master_id=? LIMIT 1");
    $stLink->execute([$stoId, $masterId]);
    $beforeStatus = (string)($stLink->fetchColumn() ?: '');
    if ($beforeStatus === '') kareta_json(['ok'=>false,'error'=>'invite_not_found'],404);
    if ($beforeStatus === $status) {
        kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'invite_status_already_set','status'=>$status]);
    }

    $stmtAccept = $pdo->prepare("UPDATE `sto_master_links` SET status=?, accepted_at=?, updated_at=CURRENT_TIMESTAMP WHERE sto_id=? AND master_id=? AND status=?");
    $stmtAccept->execute([$status, $accept ? date('Y-m-d H:i:s') : null, $stoId, $masterId, $beforeStatus]);
    if ($stmtAccept->rowCount() === 0) {
        kareta_json(['ok'=>false,'error'=>'invite_race_condition'],409);
    }
    if ($accept) {
        $stSto = $pdo->prepare("SELECT name FROM `sto_profiles` WHERE id=? AND active=1 LIMIT 1");
        $stSto->execute([$stoId]);
        $stoName = (string)($stSto->fetchColumn() ?: '');
        $pdo->prepare("UPDATE `masters` SET sto_id=?, sto_name=? WHERE id=? AND (COALESCE(sto_id,'')='' OR sto_id=?)")
            ->execute([$stoId, $stoName ?: 'СТО', $masterId, $stoId]);
    }

    kareta_log_audit($pdo,'sto.acceptInvite',['stoId'=>$stoId,'masterId'=>$masterId,'from'=>$beforeStatus,'status'=>$status]);
    kareta_json(['ok'=>true,'status'=>$status]);
}

/* ── masterExchange.cancelResponse (ТЗ 3.8) ── */
function master_exchange_cancel_response(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $orderId = trim((string)($b['orderId'] ?? $b['request_id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $u = kareta_current_user();
    $masterId = '';
    if (function_exists('kareta_master_workplace_profile')) {
        $profile = kareta_master_workplace_profile($pdo);
        $masterId = trim((string)($profile['id'] ?? ''));
    }
    if ($masterId === '') $masterId = (string)(kareta_resolve_master_id($pdo, $u) ?? '');
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_not_found'],403);

    $st = $pdo->prepare("SELECT r.id, r.response_status, r.master_user_id, o.client_phone, o.client_user_id
        FROM `master_exchange_responses` r
        LEFT JOIN `orders` o ON o.id=r.request_id
        WHERE r.request_id=? AND r.master_id=? AND r.active=1 LIMIT 1");
    $st->execute([$orderId, $masterId]);
    $row = $st->fetch();
    if (!$row) kareta_json(['ok'=>false,'error'=>'response_not_found'],404);
    if ((string)$row['response_status'] === 'accepted') {
        kareta_json(['ok'=>false,'error'=>'already_accepted','message'=>'Нельзя отменить принятый отклик'],409);
    }

    $pdo->prepare("UPDATE `master_exchange_responses` SET response_status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE id=?")
        ->execute([(string)$row['id']]);
    kareta_write_event($pdo, $orderId, 'response_cancelled', ['responseId'=>(string)$row['id'], 'masterId'=>$masterId]);
    try {
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($row['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($row['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'exchange.response.cancelled',
            'entityType' => 'order',
            'entityId' => $orderId,
            'title' => 'Мастер отменил отклик',
            'body' => 'Один из откликов по заявке '.$orderId.' был отменён.',
            'actionUrl' => '#myorders',
            'meta' => ['orderId'=>$orderId,'responseId'=>(string)$row['id']],
        ]);
    } catch (\Throwable $_e) {}
    kareta_log_audit($pdo, 'masterExchange.cancelResponse', ['orderId'=>$orderId,'responseId'=>(string)$row['id'],'masterId'=>$masterId]);
    kareta_json(['ok'=>true,'cancelled'=>true,'state'=>kareta_master_exchange_fetch_state($pdo, $masterId, (int)($row['master_user_id'] ?? 0) ?: null)]);
}



function kareta_sto_exchange_ensure_schema(PDO $pdo): void {
    kareta_ensure_schema_columns($pdo);
    kareta_ensure_column($pdo, 'orders', 'sto_id', "ALTER TABLE `orders` ADD COLUMN `sto_id` VARCHAR(64) NOT NULL DEFAULT '' AFTER `master_name`");
    kareta_ensure_column($pdo, 'orders', 'sto_name', "ALTER TABLE `orders` ADD COLUMN `sto_name` VARCHAR(191) NOT NULL DEFAULT '' AFTER `sto_id`");
    $pdo->exec("CREATE TABLE IF NOT EXISTS `sto_exchange_hidden`(
        `sto_id` VARCHAR(64) NOT NULL,
        `order_id` VARCHAR(64) NOT NULL,
        `active` TINYINT NOT NULL DEFAULT 1,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(`sto_id`,`order_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function kareta_resolve_current_sto(PDO $pdo, array $u, ?array $body = null): array {
    $role = (string)($u['role'] ?? 'guest');
    $stoId = '';
    if ($role === 'sto') {
        $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
        if ($phone !== '') $stoId = kareta_sto_id_by_phone($pdo, $phone);
    }
    if (in_array($role, ['admin','owner'], true)) {
        $body = is_array($body) ? $body : (json_decode(file_get_contents('php://input') ?: '[]', true) ?: []);
        $stoId = trim((string)($body['stoId'] ?? $_POST['stoId'] ?? ''));
        if ($stoId === '') {
            kareta_json(['ok'=>false,'error'=>'sto_id_required','message'=>'Для admin/owner операций СТО требуется явный stoId'],422);
        }
    }
    if ($stoId === '') kareta_json(['ok'=>false,'error'=>'sto_profile_required','message'=>'Сначала заполните профиль СТО'],422);
    $st = $pdo->prepare("SELECT * FROM `sto_profiles` WHERE id=? AND active=1 LIMIT 1");
    $st->execute([$stoId]);
    $sto = $st->fetch(PDO::FETCH_ASSOC);
    if (!$sto) kareta_json(['ok'=>false,'error'=>'sto_not_found'],404);
    return $sto;
}

function kareta_actor_is_adminish(?array $u = null): bool {
    $u = $u ?: (kareta_session_user() ?: []);
    return in_array((string)($u['role'] ?? 'guest'), ['admin','owner'], true);
}

function kareta_sto_assert_order_scope(array $order, string $stoId, ?array $u = null, bool $allowUnclaimed = false): void {
    $orderStoId = trim((string)($order['sto_id'] ?? ''));
    if ($orderStoId === '') {
        if ($allowUnclaimed) return;
        kareta_json(['ok'=>false,'error'=>'order_not_owned_by_sto','message'=>'Заявка ещё не закреплена за этим СТО'],403);
    }
    if ($orderStoId !== $stoId) {
        kareta_json(['ok'=>false,'error'=>'foreign_sto_order','message'=>'Заявка принадлежит другому СТО'],403);
    }
}

function kareta_sto_assert_master_in_team(PDO $pdo, string $stoId, string $masterId): void {
    if ($stoId === '' || $masterId === '') kareta_json(['ok'=>false,'error'=>'sto_master_params_required'],422);
    $stLink = $pdo->prepare("SELECT 1 FROM `sto_master_links` WHERE sto_id=? AND master_id=? AND status='active' LIMIT 1");
    $stLink->execute([$stoId, $masterId]);
    if (!$stLink->fetchColumn()) kareta_json(['ok'=>false,'error'=>'master_not_in_sto_team'],403);
}

function kareta_sto_fetch_team(PDO $pdo, string $stoId): array {
    return kareta_try_query_all($pdo, "SELECT m.id, m.user_id AS userId, m.phone, COALESCE(NULLIF(m.name,''),'Мастер') AS name, m.spec, m.color, m.initials, COALESCE(m.rating,0) AS rating, COALESCE(m.reviews_count,0) AS reviewsCount FROM `sto_master_links` l JOIN `masters` m ON m.id=l.master_id WHERE l.sto_id=? AND l.status='active' AND m.active=1 ORDER BY m.name", [$stoId], [], 'STO_EXCHANGE_TEAM');
}

function kareta_sto_order_row(PDO $pdo, string $orderId): ?array {
    $st = $pdo->prepare("SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id FROM `orders` o WHERE o.id=? LIMIT 1");
    $st->execute([$orderId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ? _fmt_order($row) : null;
}

function sto_exchange_get_leads(PDO $pdo, array $body): void {
    kareta_sto_exchange_ensure_schema($pdo);
    $u = kareta_current_user() ?: [];
    $sto = kareta_resolve_current_sto($pdo, $u, $body);
    $stoId = (string)$sto['id'];
    $sql = "SELECT o.*, (SELECT c.id FROM `chats` c WHERE c.order_id=o.id ORDER BY c.id ASC LIMIT 1) AS chat_id
            FROM `orders` o
            LEFT JOIN `sto_exchange_hidden` h ON h.order_id=o.id AND h.sto_id=? AND h.active=1
            WHERE h.order_id IS NULL
              AND (
                (o.status IN ('new','waiting_responses') AND (COALESCE(o.sto_id,'')='' OR o.sto_id=?))
                OR (COALESCE(o.sto_id,'')=? AND o.status IN ('process','done_pending_client','done','dispute','cancelled'))
              )
            ORDER BY FIELD(o.status,'new','waiting_responses','process','done_pending_client','dispute','done','cancelled'), o.created_at DESC
            LIMIT 300";
    $rows = kareta_try_query_all($pdo, $sql, [$stoId,$stoId,$stoId], [], 'STO_EXCHANGE_DASHBOARD');
    $orders = array_map('_fmt_order', $rows);
    // STO-ASSIGN: dispatcher rows тоже получают history-count/lastAssignment,
    // чтобы СТО видел историю без отдельного ручного запроса.
    kareta_attach_order_assignment_history($pdo, $orders);
    $buckets = [
        'leads' => [], 'accepted' => [], 'unassigned' => [], 'assigned' => [],
        'pendingDone' => [], 'done' => [], 'dispute' => [], 'cancelled' => [],
    ];
    foreach ($orders as $o) {
        $status = (string)($o['status'] ?? 'new');
        $hasSto = trim((string)($o['stoId'] ?? '')) !== '';
        $hasMaster = trim((string)($o['masterId'] ?? '')) !== '' && (string)($o['masterId'] ?? '') !== '0';
        if (in_array($status, ['new','waiting_responses'], true) && !$hasSto) $buckets['leads'][] = $o;
        elseif (in_array($status, ['new','waiting_responses'], true) && $hasSto && !$hasMaster) $buckets['accepted'][] = $o;
        elseif ($status === 'process' && !$hasMaster) $buckets['unassigned'][] = $o;
        elseif ($status === 'process' && $hasMaster) $buckets['assigned'][] = $o;
        elseif ($status === 'done_pending_client') $buckets['pendingDone'][] = $o;
        elseif ($status === 'done') $buckets['done'][] = $o;
        elseif ($status === 'dispute') $buckets['dispute'][] = $o;
        elseif ($status === 'cancelled') $buckets['cancelled'][] = $o;
    }
    $masters = kareta_sto_fetch_team($pdo, $stoId);
    $stats = [
        'leads'=>count($buckets['leads']), 'accepted'=>count($buckets['accepted']),
        'unassigned'=>count($buckets['unassigned']), 'assigned'=>count($buckets['assigned']),
        'pendingDone'=>count($buckets['pendingDone']), 'done'=>count($buckets['done']), 'dispute'=>count($buckets['dispute']), 'cancelled'=>count($buckets['cancelled']),
        'masters'=>count($masters), 'total'=>count($orders),
    ];
    // STO-DISPATCH: фронту нужен лёгкий health-срез, чтобы СТО видел,
    // что данные пришли из серверного scoped pull, а не из пустого локального состояния.
    $dispatchHealth = [
        'scope'=>'sto',
        'stoId'=>$stoId,
        'orders'=>count($orders),
        'masters'=>count($masters),
        'buckets'=>[
            'leads'=>count($buckets['leads']),
            'accepted'=>count($buckets['accepted']),
            'unassigned'=>count($buckets['unassigned']),
            'assigned'=>count($buckets['assigned']),
            'pendingDone'=>count($buckets['pendingDone']),
            'done'=>count($buckets['done']),
            'dispute'=>count($buckets['dispute']),
            'cancelled'=>count($buckets['cancelled']),
        ],
    ];
    kareta_json(['ok'=>true,'stoId'=>$stoId,'stoName'=>(string)($sto['name'] ?? 'СТО'),'leads'=>$buckets['leads'],'orders'=>$orders,'buckets'=>$buckets,'masters'=>$masters,'stats'=>$stats,'dispatchHealth'=>$dispatchHealth]);
}

function sto_exchange_accept_lead(PDO $pdo, array $body): void {
    kareta_sto_exchange_ensure_schema($pdo);
    try { kareta_ensure_sto_client_links($pdo); } catch (Throwable $_) {}
    $u = kareta_current_user() ?: [];
    $sto = kareta_resolve_current_sto($pdo, $u, $body);
    $stoId = (string)($sto['id'] ?? '');
    $stoName = (string)($sto['name'] ?? 'СТО');
    $stoUserId = ((int)($sto['user_id'] ?? ($u['id'] ?? 0)) ?: null);
    $orderId = trim((string)($body['orderId'] ?? $body['id'] ?? ''));
    $masterId = trim((string)($body['masterId'] ?? $body['master_id'] ?? ''));
    $assignComment = trim((string)($body['comment'] ?? $body['assignComment'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);

    // STO-LEAD: если СТО сразу выбирает мастера при принятии лида,
    // accept и assign должны проходить одним серверным контрактом. Нельзя
    // обходить accept-flow прямым assign публичного лида, иначе теряются
    // sto_client_links, событие принятия лида и корректная история.
    $assignRequested = ($masterId !== '');
    $master = null;
    if ($assignRequested) {
        kareta_ensure_order_assignments($pdo);
        kareta_sto_assert_master_in_team($pdo, $stoId, $masterId);
        $m = $pdo->prepare("SELECT id,user_id,name,initials,phone FROM `masters` WHERE id=? AND active=1 LIMIT 1");
        $m->execute([$masterId]);
        $master = $m->fetch(PDO::FETCH_ASSOC);
        if (!$master) kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
    }

    $acceptedNow = false;
    $assignedNow = false;
    $assignId = '';
    $order = [];
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$orderId]);
        $order = $st->fetch(PDO::FETCH_ASSOC);
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }

        $orderStoId = trim((string)($order['sto_id'] ?? ''));
        $status = (string)($order['status'] ?? 'new');
        if ($orderStoId !== '' && $orderStoId !== $stoId) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'lead_taken_by_other_sto'],409);
        }
        if (!in_array($status, ['new','waiting_responses','process'], true)) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'wrong_status'],409);
        }

        $currentMaster = trim((string)($order['master_id'] ?? ''));
        if ($assignRequested && $currentMaster !== '' && $currentMaster !== '0' && $currentMaster !== $masterId) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_already_assigned','message'=>'Лид уже назначен другому мастеру. Для смены используйте переназначение.'],409);
        }
        $newMasterAssignment=$assignRequested && $currentMaster!==$masterId;
        if($newMasterAssignment){$targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');kareta_tariff_master_guard($pdo,$masterId,$targetDate,$orderId,true);}

        $alreadyAcceptedBySto = ($orderStoId === $stoId && in_array($status, ['waiting_responses','process'], true));
        $targetStatus = $assignRequested ? 'process' : 'waiting_responses';
        if (!$alreadyAcceptedBySto || ($assignRequested && $status !== 'process')) {
            $up = $pdo->prepare("UPDATE `orders`
                SET sto_id=?, sto_name=?, status=?
                WHERE id=?
                  AND status IN ('new','waiting_responses','process')
                  AND (COALESCE(sto_id,'')='' OR sto_id=?)");
            $up->execute([$stoId, $stoName, $targetStatus, $orderId, $stoId]);
            if ($up->rowCount() === 0) {
                $pdo->rollBack();
                kareta_json(['ok'=>false,'error'=>'lead_accept_race_condition','message'=>'Лид уже изменён другим запросом'],409);
            }
            $acceptedNow = !$alreadyAcceptedBySto;
            $order['sto_id'] = $stoId;
            $order['sto_name'] = $stoName;
            $order['status'] = $targetStatus;
        }

        if ($assignRequested) {
            if ($currentMaster === $masterId && (string)($order['status'] ?? '') === 'process') {
                // retry того же accept+assign: не создаём новую историю, но ниже
                // всё равно дочиним scoped-связь клиента/чат.
                $order['master_id'] = $masterId;
                $order['master_user_id'] = ((int)($master['user_id'] ?? 0) ?: null);
                $order['master_name'] = (string)($master['name'] ?? 'Мастер');
            } else {
                $pdo->prepare("UPDATE `order_assignments` SET status='superseded' WHERE order_id=? AND status='active'")->execute([$orderId]);
                $assignId = 'oa_' . substr(md5($orderId . ':' . $stoId . ':' . $masterId . ':' . microtime(true)), 0, 20);
                $pdo->prepare("INSERT INTO `order_assignments` (id,order_id,sto_id,master_id,assigned_by,comment,status) VALUES (?,?,?,?,?,?,'active')")
                    ->execute([$assignId, $orderId, $stoId, $masterId, ((int)($u['id'] ?? 0) ?: null), $assignComment !== '' ? $assignComment : 'sto_lead_accept_assign']);
                $upMaster = $pdo->prepare("UPDATE `orders`
                    SET master_id=?, master_user_id=?, master_name=?, status='process', accepted_at=COALESCE(accepted_at,NOW()), assigned_admin_user_id=NULL
                    WHERE id=?
                      AND sto_id=?
                      AND status IN ('waiting_responses','process')
                      AND (COALESCE(master_id,'')='' OR master_id='0')");
                $upMaster->execute([$masterId, ((int)($master['user_id'] ?? 0) ?: null), (string)($master['name'] ?? 'Мастер'), $orderId, $stoId]);
                if ($upMaster->rowCount() === 0) {
                    $pdo->rollBack();
                    kareta_json(['ok'=>false,'error'=>'lead_assign_race_condition','message'=>'Лид был назначен параллельным запросом'],409);
                }
                $assignedNow = true;
                kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'sto_lead_accept_assign');
                $order['master_id'] = $masterId;
                $order['master_user_id'] = ((int)($master['user_id'] ?? 0) ?: null);
                $order['master_name'] = (string)($master['name'] ?? 'Мастер');
                $order['status'] = 'process';
            }
        }

        $clientId = trim((string)($order['client_id'] ?? ''));
        $clientPhone = kareta_normalize_phone((string)($order['client_phone'] ?? ''));
        if ($clientId !== '') {
            $linkId = 'scl_'.substr(md5($stoId.'|'.$clientId), 0, 18);
            $pdo->prepare("INSERT INTO `sto_client_links`(id,sto_id,client_id,client_phone,source,created_by)
                VALUES(?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE client_phone=VALUES(client_phone), source=VALUES(source), updated_at=NOW()")
                ->execute([$linkId,$stoId,$clientId,$clientPhone ?: null,$assignRequested ? 'lead_accept_assign' : 'lead_accept',((int)($u['id'] ?? 0) ?: null)]);
        }

        $chatId = 'ch_' . strtolower(str_replace('-', '', $orderId));
        $orderTitle = trim((string)($order['service_names'] ?? ''));
        if ($orderTitle === '') $orderTitle = trim((string)($order['notes'] ?? ''));
        if ($orderTitle === '') $orderTitle = 'Заявка';
        $clientInit = 'К';
        $clientName = trim((string)($order['client_name'] ?? ''));
        $nameParts = preg_split('/\s+/u', $clientName) ?: [];
        $letters = [];
        foreach ($nameParts as $part) {
            $part = trim((string)$part);
            if ($part === '') continue;
            $letters[] = mb_strtoupper(mb_substr($part, 0, 1, 'UTF-8'), 'UTF-8');
            if (count($letters) >= 2) break;
        }
        if ($letters) $clientInit = implode('', $letters);

        $chatStatus = $assignRequested ? 'process' : 'waiting_responses';
        $chatMasterId = $assignRequested ? $masterId : (string)($order['master_id'] ?? '');
        $chatMasterUserId = $assignRequested ? (((int)($master['user_id'] ?? 0)) ?: null) : (((int)($order['master_user_id'] ?? 0)) ?: null);
        $chatMasterName = $assignRequested ? (string)($master['name'] ?? 'Мастер') : (string)($order['master_name'] ?? 'СТО');
        $chatMasterInit = $assignRequested ? (string)($master['initials'] ?? 'М') : (trim((string)($order['master_name'] ?? '')) !== '' ? 'М' : 'С');

        $pdo->prepare("INSERT INTO `chats` (id,order_id,sto_id,sto_user_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,unread_sto)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE sto_id=VALUES(sto_id), sto_user_id=VALUES(sto_user_id), client_id=VALUES(client_id), client_user_id=VALUES(client_user_id), client_name=VALUES(client_name), client_phone=VALUES(client_phone), master_id=IF(VALUES(master_id)<>'',VALUES(master_id),master_id), master_user_id=IF(VALUES(master_user_id) IS NOT NULL,VALUES(master_user_id),master_user_id), master_name=IF(VALUES(master_name)<>'',VALUES(master_name),master_name), master_init=IF(VALUES(master_init)<>'',VALUES(master_init),master_init), order_title=VALUES(order_title), car=VALUES(car), status=VALUES(status), unread_client=unread_client+IF(COALESCE(sto_id,'')='',1,0), unread_master=unread_master+VALUES(unread_master), unread_sto=unread_sto+VALUES(unread_sto)")
            ->execute([
                $chatId,
                $orderId,
                $stoId,
                $stoUserId,
                $clientId,
                ((int)($order['client_user_id'] ?? 0) ?: null),
                $clientName,
                $clientPhone,
                $clientInit,
                $chatMasterId,
                $chatMasterUserId,
                null,
                $chatMasterName,
                $chatMasterInit,
                $orderTitle,
                (string)($order['client_car'] ?? $order['vehicle_title'] ?? ''),
                $chatStatus,
                $acceptedNow ? 1 : 0,
                $assignedNow ? 1 : 0,
                0,
                0
            ]);
        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_sto_accept_'.substr(md5($orderId.':'.$stoId),0,18),$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event','СТО '. $stoName .' приняло лид в работу.',date('H:i'),date('Y-m-d H:i:s')]);
        if ($assignRequested) {
            $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                ->execute(['m_sto_accept_assign_'.substr(md5($orderId.':'.$stoId.':'.$masterId),0,18),$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event','СТО приняло лид и назначило мастера '.(string)($master['name'] ?? 'Мастер').'.',date('H:i'),date('Y-m-d H:i:s')]);
        }

        $pdo->commit();
    } catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }

    if ($acceptedNow) {
        kareta_write_event($pdo, $orderId, 'sto_lead_accepted', ['stoId'=>$stoId, 'stoName'=>$stoName]);
        try { kareta_notification_insert($pdo, [
            'recipientUserId'=>(int)($order['client_user_id'] ?? 0) ?: null, 'recipientPhone'=>(string)($order['client_phone'] ?? ''), 'recipientRole'=>'client',
            'eventType'=>'sto.lead.accepted', 'entityType'=>'order', 'entityId'=>$orderId,
            'title'=>'СТО приняло заявку', 'body'=>$assignRequested ? 'Автосервис '.$stoName.' принял вашу заявку и назначил мастера.' : 'Автосервис '.$stoName.' принял вашу заявку и готовит назначение мастера.',
            'actionUrl'=>'#myorders', 'meta'=>['orderId'=>$orderId,'stoId'=>$stoId,'masterId'=>$assignRequested ? $masterId : null],
        ]); } catch(Throwable $_e) {}
        kareta_log_audit($pdo, 'stoExchange.acceptLead', ['stoId'=>$stoId,'orderId'=>$orderId,'mode'=>$assignRequested ? 'accepted_and_assigned' : 'accepted','masterId'=>$assignRequested ? $masterId : null,'assignId'=>$assignId]);
    } else {
        kareta_log_audit($pdo, 'stoExchange.acceptLead', ['stoId'=>$stoId,'orderId'=>$orderId,'mode'=>$assignRequested ? 'repair_or_retry_assign' : 'repair_or_retry','masterId'=>$assignRequested ? $masterId : null,'assignId'=>$assignId]);
    }

    if ($assignedNow) {
        kareta_write_event($pdo, $orderId, 'sto_master_assigned', ['stoId'=>$stoId,'stoName'=>$stoName,'masterId'=>$masterId,'masterName'=>(string)($master['name'] ?? ''),'assignId'=>$assignId,'source'=>'lead_accept']);
        try {
            kareta_notification_insert($pdo, ['recipientUserId'=>((int)($master['user_id'] ?? 0) ?: null),'recipientPhone'=>(string)($master['phone'] ?? ''),'recipientRole'=>'master','eventType'=>'sto.order.assigned','entityType'=>'order','entityId'=>$orderId,'title'=>'СТО назначило вам заказ','body'=>'Заявка '.$orderId.' принята СТО и передана вам в работу.','actionUrl'=>'#master:work:process','meta'=>['orderId'=>$orderId,'stoId'=>$stoId,'assignId'=>$assignId,'source'=>'lead_accept']]);
            kareta_notification_insert($pdo, ['recipientUserId'=>(int)($order['client_user_id'] ?? 0) ?: null,'recipientPhone'=>(string)($order['client_phone'] ?? ''),'recipientRole'=>'client','eventType'=>'sto.master.assigned','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер назначен','body'=>'СТО назначило мастера '.(string)($master['name'] ?? 'Мастер').' на вашу заявку.','actionUrl'=>'#myorders','meta'=>['orderId'=>$orderId,'masterId'=>$masterId,'stoId'=>$stoId,'assignId'=>$assignId,'source'=>'lead_accept']]);
        } catch(Throwable $_e) {}
    }

    kareta_json(['ok'=>true,'accepted'=>true,'assigned'=>$assignRequested,'assignedNow'=>$assignedNow,'skipped'=>!$acceptedNow && !$assignedNow,'reason'=>$acceptedNow || $assignedNow ? null : 'lead_already_accepted_by_sto','orderId'=>$orderId,'stoId'=>$stoId,'masterId'=>$assignRequested ? $masterId : null,'assignId'=>$assignId,'status'=>$assignRequested ? 'process' : 'waiting_responses','order'=>kareta_sto_order_row($pdo,$orderId)]);
}

function sto_exchange_assign_order_master(PDO $pdo, array $body): void {
    kareta_sto_exchange_ensure_schema($pdo);
    kareta_ensure_order_assignments($pdo);
    $u = kareta_current_user() ?: [];
    $sto = kareta_resolve_current_sto($pdo, $u, $body);
    $stoId = (string)$sto['id'];
    $orderId = trim((string)($body['orderId'] ?? $body['id'] ?? ''));
    $masterId = trim((string)($body['masterId'] ?? $body['master_id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    if ($masterId === '') kareta_json(['ok'=>false,'error'=>'master_id_required'],422);
    kareta_sto_assert_master_in_team($pdo, $stoId, $masterId);
    $m = $pdo->prepare("SELECT id,user_id,name,initials,phone FROM `masters` WHERE id=? AND active=1 LIMIT 1");
    $m->execute([$masterId]);
    $master = $m->fetch(PDO::FETCH_ASSOC);
    if (!$master) kareta_json(['ok'=>false,'error'=>'master_not_found'],404);
    $assignId = '';
    $order = [];
    try {
        $pdo->beginTransaction();
        $st = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $st->execute([$orderId]);
        $order = $st->fetch(PDO::FETCH_ASSOC);
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }
        $orderStoId = trim((string)($order['sto_id'] ?? ''));
        if ($orderStoId !== '' && $orderStoId !== $stoId) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'lead_taken_by_other_sto'],409); }
        if (!in_array((string)$order['status'], ['new','waiting_responses','process'], true)) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'wrong_status'],409); }
        if (trim((string)($order['sto_id'] ?? '')) !== '' && (string)$order['sto_id'] !== $stoId) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'lead_taken_by_other_sto'],409); }
        $currentMaster = trim((string)($order['master_id'] ?? ''));
        if ($currentMaster === $masterId && (string)($order['status'] ?? '') === 'process') {
            $pdo->rollBack();
            kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'order_already_assigned_to_master','orderId'=>$orderId,'masterId'=>$masterId,'order'=>kareta_sto_order_row($pdo,$orderId)]);
        }
        if ($currentMaster !== '' && $currentMaster !== '0' && $currentMaster !== $masterId) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_already_assigned','message'=>'Заявка уже назначена другому мастеру. Для смены используйте переназначение.'],409);
        }
        $targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');
        kareta_tariff_master_guard($pdo,$masterId,$targetDate,$orderId,true);

        // STO-ASSIGN: первое назначение мастера должно фиксироваться не только
        // в orders/chats, но и в order_assignments. Иначе audit health видел бы
        // активную работу без sto_id/истории назначения.
        $pdo->prepare("UPDATE `order_assignments` SET status='superseded' WHERE order_id=? AND status='active'")->execute([$orderId]);
        $assignId = 'oa_' . substr(md5($orderId . ':' . $stoId . ':' . $masterId . ':' . microtime(true)), 0, 20);
        $pdo->prepare("INSERT INTO `order_assignments` (id,order_id,sto_id,master_id,assigned_by,comment,status) VALUES (?,?,?,?,?,?,'active')")
            ->execute([$assignId, $orderId, $stoId, $masterId, ((int)($u['id'] ?? 0) ?: null), 'sto_exchange_assign']);

        $up = $pdo->prepare("UPDATE `orders`
            SET sto_id=?, sto_name=?, master_id=?, master_user_id=?, master_name=?, status='process', accepted_at=COALESCE(accepted_at,NOW()), assigned_admin_user_id=NULL
            WHERE id=?
              AND status IN ('new','waiting_responses','process')
              AND (COALESCE(sto_id,'')='' OR sto_id=?)
              AND (COALESCE(master_id,'')='' OR master_id='0')");
        $up->execute([$stoId, (string)$sto['name'], $masterId, ((int)($master['user_id'] ?? 0) ?: null), (string)($master['name'] ?? 'Мастер'), $orderId, $stoId]);
        if ($up->rowCount() === 0) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_assignment_race_condition','message'=>'Заявка была изменена параллельным запросом'],409);
        }
        kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'sto_exchange_assign');

        $chatId = 'ch_' . strtolower(str_replace('-', '', $orderId));
        $pdo->prepare("INSERT INTO `chats` (id,order_id,sto_id,sto_user_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,unread_sto)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE sto_id=VALUES(sto_id), sto_user_id=VALUES(sto_user_id), master_id=VALUES(master_id), master_user_id=VALUES(master_user_id), master_name=VALUES(master_name), master_init=VALUES(master_init), assigned_admin_user_id=NULL, status='process', unread_client=unread_client+1, unread_master=unread_master+1, unread_sto=unread_sto+1")
            ->execute([$chatId,$orderId,$stoId,((int)($sto['user_id'] ?? 0) ?: null),(string)($order['client_id'] ?? ''),(int)($order['client_user_id'] ?? 0) ?: null,(string)($order['client_name'] ?? ''),(string)($order['client_phone'] ?? ''),'К',$masterId,((int)($master['user_id'] ?? 0) ?: null),null,(string)($master['name'] ?? 'Мастер'),(string)($master['initials'] ?? 'М'),(string)($order['service_names'] ?? 'Заявка'),(string)($order['client_car'] ?? ''),'process',1,1,0,1]);
        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_sto_assign_'.substr(md5($orderId.':'.$masterId),0,18),$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event','СТО назначило мастера '.(string)($master['name'] ?? 'Мастер').' на заявку.',date('H:i'),date('Y-m-d H:i:s')]);
        $pdo->commit();
    } catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    kareta_write_event($pdo, $orderId, 'sto_master_assigned', ['stoId'=>$stoId,'stoName'=>(string)$sto['name'],'masterId'=>$masterId,'masterName'=>(string)($master['name'] ?? ''),'assignId'=>$assignId]);
    try {
        kareta_notification_insert($pdo, ['recipientUserId'=>((int)($master['user_id'] ?? 0) ?: null),'recipientPhone'=>(string)($master['phone'] ?? ''),'recipientRole'=>'master','eventType'=>'sto.order.assigned','entityType'=>'order','entityId'=>$orderId,'title'=>'СТО назначило вам заказ','body'=>'Заявка '.$orderId.' передана вам в работу.','actionUrl'=>'#master:work:process','meta'=>['orderId'=>$orderId,'stoId'=>$stoId,'assignId'=>$assignId]]);
        kareta_notification_insert($pdo, ['recipientUserId'=>(int)($order['client_user_id'] ?? 0) ?: null,'recipientPhone'=>(string)($order['client_phone'] ?? ''),'recipientRole'=>'client','eventType'=>'sto.master.assigned','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер назначен','body'=>'СТО назначило мастера '.(string)($master['name'] ?? 'Мастер').' на вашу заявку.','actionUrl'=>'#myorders','meta'=>['orderId'=>$orderId,'masterId'=>$masterId,'stoId'=>$stoId,'assignId'=>$assignId]]);
    } catch(Throwable $_e) {}
    kareta_log_audit($pdo, 'stoExchange.assignOrderMaster', ['stoId'=>$stoId,'orderId'=>$orderId,'masterId'=>$masterId,'assignId'=>$assignId]);
    kareta_json(['ok'=>true,'orderId'=>$orderId,'masterId'=>$masterId,'assignId'=>$assignId,'status'=>'process','order'=>kareta_sto_order_row($pdo,$orderId)]);
}

function sto_exchange_hide_lead(PDO $pdo, array $body): void {
    kareta_sto_exchange_ensure_schema($pdo);
    $u = kareta_current_user() ?: [];
    $sto = kareta_resolve_current_sto($pdo, $u, $body);
    $stoId = (string)($sto['id'] ?? '');
    $orderId = trim((string)($body['orderId'] ?? $body['id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);

    $st = $pdo->prepare("SELECT id,status,sto_id FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $order = $st->fetch(PDO::FETCH_ASSOC);
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $orderStoId = trim((string)($order['sto_id'] ?? ''));
    if ($orderStoId !== '' && $orderStoId !== $stoId) {
        kareta_json(['ok'=>false,'error'=>'lead_taken_by_other_sto'],409);
    }
    if ($orderStoId === $stoId) {
        kareta_json(['ok'=>false,'error'=>'lead_already_accepted_by_sto','message'=>'Принятый лид нельзя скрыть как публичный'],409);
    }
    if (!in_array((string)($order['status'] ?? ''), ['new','waiting_responses'], true)) {
        kareta_json(['ok'=>false,'error'=>'wrong_status'],409);
    }

    $pdo->prepare("INSERT INTO `sto_exchange_hidden` (`sto_id`,`order_id`,`active`) VALUES (?,?,1) ON DUPLICATE KEY UPDATE active=1, updated_at=CURRENT_TIMESTAMP")->execute([$stoId,$orderId]);
    kareta_log_audit($pdo, 'stoExchange.hideLead', ['stoId'=>$stoId,'orderId'=>$orderId]);
    kareta_json(['ok'=>true,'hidden'=>true,'orderId'=>$orderId]);
}

/* ── orders.complete (мастер завершает → done_pending_client) ── */
function orders_complete_by_master(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $orderId = trim((string)($b['orderId'] ?? $b['id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $u = kareta_current_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    if (!$masterId) kareta_json(['ok'=>false,'error'=>'master_not_found'],403);

    $st = $pdo->prepare("SELECT id, status, client_phone, client_user_id FROM `orders` WHERE id=? AND master_id=? LIMIT 1");
    $st->execute([$orderId, $masterId]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    if (!in_array((string)$order['status'], ['process'], true)) kareta_json(['ok'=>false,'error'=>'wrong_status'],409);
    // Требуем финальный этап (ТЗ 4.3 — нельзя обойти этапную систему)
    if (!($b['forceComplete'] ?? false)) {
        $stStg = $pdo->prepare("SELECT id, stage_key FROM `order_stages` WHERE order_id=? AND stage_key IN ('quality','done','delivered') LIMIT 1");
        $stStg->execute([$orderId]);
        $finalStageRow = $stStg->fetch();
        // Fallback: JSON stages
        if (!$finalStageRow) {
            $stJSON = $pdo->prepare("SELECT stages FROM `orders` WHERE id=? LIMIT 1");
            $stJSON->execute([$orderId]);
            $stagesJson = (string)($stJSON->fetchColumn() ?: '[]');
            $stages = json_decode($stagesJson, true);
            $stages = is_array($stages) ? $stages : [];
            $finalStageRow = !empty(array_filter($stages, fn($s)=>in_array((string)($s['id']??$s['stage_key']??''), ['quality','done','delivered'], true)));
        }
        if (!$finalStageRow) {
            kareta_json(['ok'=>false,'error'=>'stages_incomplete',
                'message'=>'Нужно пройти этап «Проверка качества» перед завершением',
                'hint'=>'Добавьте этап quality или done через Добавить этап'], 422);
        }
    }

    $finalPrice = (float)($b['finalPrice']??$b['price']??0);
    $tx = kareta_order_transition($pdo, $orderId, 'done_pending_client', 'master', ['source'=>'orders.complete']);
    if (empty($tx['ok'])) kareta_json(['ok'=>false,'error'=>$tx['error'] ?? 'invalid_transition','from'=>$tx['from'] ?? null,'to'=>'done_pending_client'],409);
    if (empty($tx['skipped'])) {
        $pdo->prepare("UPDATE `orders` SET completed_at=COALESCE(completed_at,CURRENT_TIMESTAMP), final_price=COALESCE(?,final_price) WHERE id=?")
            ->execute([$finalPrice?:null, $orderId]);
        kareta_sync_order_relations($pdo, $orderId, 'done_pending_client', ['source'=>'orders.complete']);
        kareta_write_event($pdo, $orderId, 'order_completed_by_master', ['masterId'=>$masterId, 'finalPrice'=>$finalPrice?:null]);
    }
    try {
        kareta_notification_insert($pdo, [
            'recipientUserId' => (int)($order['client_user_id'] ?? 0) ?: null,
            'recipientPhone' => (string)($order['client_phone'] ?? ''),
            'recipientRole' => 'client',
            'eventType' => 'order.done_pending',
            'entityType' => 'order',
            'entityId' => $orderId,
            'title' => 'Мастер завершил работу',
            'body' => 'Мастер отметил заявку как выполненную. Подтвердите завершение.',
            'actionUrl' => '#myorders',
            'meta' => ['orderId'=>$orderId],
        ]);
    } catch(\Throwable $_e) {}
    kareta_json(['ok'=>true,'status'=>'done_pending_client','skipped'=>!empty($tx['skipped']),'order'=>kareta_order_snapshot($pdo,$orderId)]);
}

/* ── orders.confirmDone (клиент подтверждает) ── */
function orders_confirm_done_by_client(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $orderId = trim((string)($b['orderId'] ?? $b['id'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    if(function_exists('kareta_client_order_handover_confirm')&&kareta_table_exists($pdo,'work_order_handovers')){
        $handover=$pdo->prepare("SELECT status FROM work_order_handovers WHERE order_id=? LIMIT 1");$handover->execute([$orderId]);
        if(in_array((string)($handover->fetchColumn()?:''),['ready','accepted'],true))kareta_client_order_handover_confirm($pdo,['orderId'=>$orderId]);
    }
    $u = kareta_current_user();
    $actorId = (int)($u['id'] ?? 0);
    $actorPhone = kareta_normalize_phone((string)($u['phone'] ?? ''));

    $st = $pdo->prepare("SELECT id, status, master_id, client_phone, client_user_id FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $owned = ((int)($order['client_user_id'] ?? 0) > 0 && (int)$order['client_user_id'] === $actorId)
        || ($actorPhone !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $actorPhone);
    if (!$owned) kareta_json(['ok'=>false,'error'=>'forbidden_order_owner'],403);
    if (!in_array((string)$order['status'], ['done_pending_client'], true)) kareta_json(['ok'=>false,'error'=>'wrong_status'],409);

    $tx = kareta_order_transition($pdo, $orderId, 'done', 'client', ['source'=>'orders.confirmDone']);
    if (empty($tx['ok'])) kareta_json(['ok'=>false,'error'=>$tx['error'] ?? 'invalid_transition','from'=>$tx['from'] ?? null,'to'=>'done'],409);
    if (empty($tx['skipped'])) {
        $pdo->prepare("UPDATE `orders` SET confirmed_at=COALESCE(confirmed_at,CURRENT_TIMESTAMP) WHERE id=?")->execute([$orderId]);
        kareta_sync_order_relations($pdo, $orderId, 'done', ['source'=>'orders.confirmDone']);
        kareta_write_event($pdo, $orderId, 'order_confirmed_by_client', ['masterId'=>(string)($order['master_id'] ?? '')]);
    }
    try {
        $mid = (string)($order['master_id'] ?? '');
        if ($mid !== '') {
            $mu = $pdo->prepare("SELECT user_id, phone FROM `masters` WHERE id=? LIMIT 1");
            $mu->execute([$mid]);
            $mr = $mu->fetch(PDO::FETCH_ASSOC) ?: [];
            kareta_notification_insert($pdo, [
                'recipientUserId'=>(int)($mr['user_id'] ?? 0) ?: null,
                'recipientPhone'=>(string)($mr['phone'] ?? ''),
                'recipientRole'=>'master', 'eventType'=>'order.done.confirmed', 'entityType'=>'order', 'entityId'=>$orderId,
                'title'=>'Клиент подтвердил завершение', 'body'=>'Заявка '.$orderId.' закрыта. Клиент может оставить отзыв.',
                'actionUrl'=>'#master:work:process', 'meta'=>['orderId'=>$orderId],
            ]);
        }
    } catch (Throwable $_e) {}
    kareta_json(['ok'=>true,'status'=>'done','skipped'=>!empty($tx['skipped']),'order'=>kareta_order_snapshot($pdo,$orderId)]);
}

/* ── orders.dispute (ТЗ 5.2 — спор) ── */
function orders_open_dispute(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_disputes_table($pdo);
    $orderId = trim((string)($b['orderId'] ?? $b['id'] ?? ''));
    $text = trim((string)($b['text'] ?? $b['disputeText'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    if ($text === '') kareta_json(['ok'=>false,'error'=>'text_required','message'=>'Опишите проблему'],422);

    $u = kareta_current_user();
    $role = (string)($u['role'] ?? 'guest');
    $actorId = (int)($u['id'] ?? 0);
    $actorPhone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    $st = $pdo->prepare("SELECT id, status, client_phone, client_user_id, master_id, master_user_id, sto_id FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);

    $allowed = false;
    if ($role === 'client') {
        $allowed = ((int)($order['client_user_id'] ?? 0) > 0 && (int)$order['client_user_id'] === $actorId)
            || ($actorPhone !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $actorPhone);
    } elseif ($role === 'master') {
        $masterId = kareta_resolve_master_id($pdo, $u);
        $allowed = ($masterId && (string)($order['master_id'] ?? '') === $masterId)
            || ((int)($order['master_user_id'] ?? 0) > 0 && (int)$order['master_user_id'] === $actorId);
    } elseif ($role === 'sto') {
        try {
            $sto = kareta_resolve_current_sto($pdo, $u, $b);
            $allowed = ((string)($order['sto_id'] ?? '') !== '' && (string)($order['sto_id'] ?? '') === (string)($sto['id'] ?? ''));
        } catch (Throwable $_e) { $allowed = false; }
    } elseif (in_array($role, ['admin','owner'], true)) {
        $allowed = true;
    }
    if (!$allowed) kareta_json(['ok'=>false,'error'=>'forbidden_order_access'],403);

    $actorLifecycleRole = in_array($role, ['client','master','sto','admin','owner'], true) ? $role : 'client';
    $tx = kareta_order_transition($pdo, $orderId, 'dispute', $actorLifecycleRole, ['source'=>'orders.dispute']);
    if (empty($tx['ok'])) kareta_json(['ok'=>false,'error'=>$tx['error'] ?? 'invalid_transition','from'=>$tx['from'] ?? null,'to'=>'dispute'],409);
    $pdo->prepare("UPDATE `orders` SET dispute_text=?, dispute_at=COALESCE(dispute_at,CURRENT_TIMESTAMP) WHERE id=?")
        ->execute([$text, $orderId]);
    kareta_sync_order_relations($pdo, $orderId, 'dispute', ['source'=>'orders.dispute']);
    // Создаём запись спора
    $u2 = kareta_session_user();
    $dispId = 'dis_' . bin2hex(random_bytes(4));
    try {
        $pdo->prepare("INSERT IGNORE INTO `order_disputes` (id,order_id,opened_by,opener_role,text,status) VALUES (?,?,?,?,?,'open')")
            ->execute([$dispId, $orderId, (int)($u2['id']??0)?:null, (string)($u2['role']??''), $text]);
        kareta_write_event($pdo, $orderId, 'order_dispute_opened', ['disputeId'=>$dispId,'text'=>$text]);
    } catch (\Throwable $__e) {}
    try {
        kareta_notification_insert($pdo, [
            'recipientRole' => 'admin',
            'eventType' => 'order.dispute',
            'entityType' => 'order',
            'entityId' => $orderId,
            'title' => 'Спор по заявке ' . $orderId,
            'body' => $text,
            'actionUrl' => '#admin',
            'meta' => ['orderId'=>$orderId],
        ]);
    } catch(\Throwable $_e) {}
    kareta_json(['ok'=>true,'status'=>'dispute','skipped'=>!empty($tx['skipped']),'order'=>kareta_order_snapshot($pdo,$orderId)]);
}
/* ── orders.cancelByClient (ТЗ — отмена заявки клиентом) ── */
function orders_cancel_by_client(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $orderId = trim((string)($b['orderId'] ?? $b['id'] ?? ''));
    $reason  = trim((string)($b['reason'] ?? $b['cancelReason'] ?? ''));
    if ($orderId === '') kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    $u = kareta_session_user();
    $phone = (string)($u['phone'] ?? '');
    // Проверяем что заявка принадлежит клиенту
    $st = $pdo->prepare("SELECT id, status, master_id FROM `orders` WHERE id=? LIMIT 1");
    $st->execute([$orderId]);
    $order = $st->fetch();
    if (!$order) kareta_json(['ok'=>false,'error'=>'not_found'],404);
    $st2 = $pdo->prepare("SELECT id FROM `orders` WHERE id=? AND client_phone=? LIMIT 1");
    $st2->execute([$orderId, $phone]);
    if (!$st2->fetch()) {
        // Fallback — проверяем по client_user_id
        $uid = (int)($u['id'] ?? 0);
        $st3 = $pdo->prepare("SELECT id FROM `orders` WHERE id=? AND client_user_id=? LIMIT 1");
        $st3->execute([$orderId, $uid]);
        if (!$st3->fetch()) kareta_json(['ok'=>false,'error'=>'forbidden'],403);
    }
    $status = (string)($order['status'] ?? 'new');
    // Правила отмены по ТЗ
    if (in_array($status, ['done','cancelled'], true)) {
        kareta_json(['ok'=>false,'error'=>'cannot_cancel','message'=>'Заявку нельзя отменить в статусе '.$status],409);
    }
    if ($status === 'dispute') {
        kareta_json(['ok'=>false,'error'=>'in_dispute','message'=>'Заявка в споре — обратитесь в поддержку'],409);
    }
    if ($status === 'done_pending_client') {
        kareta_json(['ok'=>false,'error'=>'use_confirm_or_dispute','message'=>'Работа выполнена — подтвердите или откройте спор'],409);
    }
    // process — если работа уже началась по этапам, обычная отмена запрещена: нужен спор.
    if ($status === 'process') {
        $stStages = $pdo->prepare("SELECT stages FROM `orders` WHERE id=? LIMIT 1");
        $stStages->execute([$orderId]);
        $stagesRaw = (string)($stStages->fetchColumn() ?: '');
        $stages = $stagesRaw !== '' ? json_decode($stagesRaw, true) : [];
        if (is_array($stages) && count($stages) > 0) {
            kareta_json(['ok'=>false,'error'=>'use_dispute','message'=>'Работа уже началась — откройте спор, чтобы зафиксировать проблему'],409);
        }
        if (!$reason) {
            kareta_json(['ok'=>false,'error'=>'reason_required','message'=>'Укажите причину отмены — заявка уже в работе'],422);
        }
    }
    $tx = kareta_order_transition($pdo, $orderId, 'cancelled', 'client', ['source'=>'orders.cancelByClient']);
    if (empty($tx['ok'])) kareta_json(['ok'=>false,'error'=>$tx['error'] ?? 'invalid_transition','from'=>$tx['from'] ?? null,'to'=>'cancelled'],409);
    $pdo->prepare("UPDATE `orders` SET cancel_reason=?, cancelled_at=COALESCE(cancelled_at,CURRENT_TIMESTAMP) WHERE id=?")
        ->execute([$reason ?: null, $orderId]);
    kareta_sync_order_relations($pdo, $orderId, 'cancelled', ['source'=>'orders.cancelByClient']);
    // Закрываем все pending-отклики и уведомляем мастеров
    try {
        $stResps = $pdo->prepare("SELECT mer.*, m.user_phone FROM `master_exchange_responses` mer LEFT JOIN `masters` m ON m.id=mer.master_id WHERE mer.request_id=? AND mer.response_status IN ('pending','viewed')");
        $stResps->execute([$orderId]);
        $pendingResps = $stResps->fetchAll();
        if ($pendingResps) {
            $pdo->prepare("UPDATE `master_exchange_responses` SET response_status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE request_id=? AND response_status IN ('pending','viewed')")
                ->execute([$orderId]);
            foreach ($pendingResps as $resp) {
                $mPhone = (string)($resp['user_phone'] ?? '');
                if ($mPhone) {
                    try {
                        kareta_insert_notification($pdo, $mPhone, 'master', 'order.cancelled_by_client',
                            'order', $orderId, 'Клиент отменил заявку',
                            'Заявка была отменена клиентом' . ($reason ? ': '.$reason : ''), '#master:work:responses', []);
                    } catch (\Throwable $__ne) {}
                }
            }
        }
        kareta_write_event($pdo, $orderId, 'order_cancelled_by_client', ['reason'=>$reason, 'pending_closed'=>count($pendingResps ?? [])]);
        try {
            $chatId = (string)($pdo->query("SELECT id FROM `chats` WHERE order_id=".$pdo->quote($orderId)." LIMIT 1")->fetchColumn() ?: '');
            if ($chatId !== '') {
                $pdo->prepare("INSERT INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
                    ->execute(['m_cancel_'.time().'_'.rand(100,999), $chatId, $orderId, 'system', null, 'event', 'Клиент отменил заявку'.($reason?': '.$reason:''), date('H:i'), date('Y-m-d H:i:s')]);
            }
        } catch (Throwable $_msg) {}
    } catch (\Throwable $__e) {}
    kareta_json(['ok'=>true,'status'=>'cancelled']);
}
/* ── orders.proposeExtraQuote (ТЗ 2.5) ── */
function orders_propose_extra_quote(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_extra_quotes_table($pdo);
    $orderId  = trim((string)($b['orderId'] ?? ''));
    $title    = trim((string)($b['title']   ?? 'Допработа'));
    if (!$orderId) kareta_json(['ok'=>false,'error'=>'order_id_required'],422);
    // Проверяем что заказ назначен текущему мастеру и в статусе process
    $u = kareta_session_user();
    $masterId = kareta_resolve_master_id($pdo, $u);
    $stChk = $pdo->prepare("SELECT id,status,master_id FROM `orders` WHERE id=? LIMIT 1");
    $stChk->execute([$orderId]);
    $ord = $stChk->fetch();
    if (!$ord) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    if ($ord['status'] !== 'process') kareta_json(['ok'=>false,'error'=>'order_not_in_process','message'=>'Допработы доступны только для заявок в работе'],422);
    if ((string)$ord['master_id'] !== (string)$masterId) kareta_json(['ok'=>false,'error'=>'not_your_order','message'=>'Это не ваша заявка'],403);
    $laborP   = (float)($b['laborPrice']  ?? 0);
    $partsP   = (float)($b['partsPrice']  ?? 0);
    $items    = json_encode($b['items'] ?? [], JSON_UNESCAPED_UNICODE);
    $comment  = trim((string)($b['comment'] ?? ''));
    $id = 'eq_' . bin2hex(random_bytes(4));
    $pdo->prepare("INSERT INTO `order_extra_quotes` (id,order_id,master_id,title,labor_price,parts_price,total_price,items_json,comment,status) VALUES (?,?,?,?,?,?,?,?,?,'pending')")
        ->execute([$id, $orderId, $masterId, $title, $laborP, $partsP, $laborP+$partsP, $items, $comment]);
    // Уведомление клиенту
    try {
        $stOrd = $pdo->prepare("SELECT client_phone FROM `orders` WHERE id=? LIMIT 1");
        $stOrd->execute([$orderId]);
        $clientPhone = (string)($stOrd->fetchColumn() ?: '');
        if ($clientPhone) kareta_insert_notification($pdo, $clientPhone, 'client', 'extra_quote.proposed', 'order', $orderId,
            'Мастер предлагает допработу', "{$title} — ".number_format($laborP+$partsP,0,'.',',').' ₸', '#myorders', []);
    } catch(\Throwable $__e) {}
    try { kareta_write_event($pdo, $orderId, 'extra_quote_proposed', ['id'=>$id,'title'=>$title,'total'=>$laborP+$partsP]); } catch(\Throwable $__e) {}
    kareta_json(['ok'=>true,'id'=>$id]);
}

/* ── orders.acceptExtraQuote / declineExtraQuote ── */
function orders_decide_extra_quote(?PDO $pdo, array $b, string $decision): void {
    if (!$pdo) _no_db();
    $quoteId = trim((string)($b['quoteId'] ?? $b['id'] ?? ''));
    if (!$quoteId) kareta_json(['ok'=>false,'error'=>'quote_id_required'],422);
    $stQ = $pdo->prepare("SELECT * FROM `order_extra_quotes` WHERE id=? LIMIT 1");
    $stQ->execute([$quoteId]);
    $quote = $stQ->fetch();
    if (!$quote) kareta_json(['ok'=>false,'error'=>'quote_not_found'],404);
    if ($quote['status'] !== 'pending') kareta_json(['ok'=>false,'error'=>'already_decided'],409);
    // Проверяем владельца заявки
    $u2 = kareta_session_user();
    $actorPhone = _actor_phone();
    $actorId    = (int)($u2['id'] ?? 0);
    $stOwnChk = $pdo->prepare("SELECT id,client_phone,client_user_id FROM `orders` WHERE id=? LIMIT 1");
    $stOwnChk->execute([(string)$quote['order_id']]);
    $ownOrd = $stOwnChk->fetch();
    if (!$ownOrd) kareta_json(['ok'=>false,'error'=>'order_not_found'],404);
    $isOwner = ($actorPhone !== '' && kareta_normalize_phone((string)($ownOrd['client_phone']??'')) === $actorPhone)
        || ($actorId > 0 && (int)($ownOrd['client_user_id']??0) === $actorId);
    if (!$isOwner) kareta_json(['ok'=>false,'error'=>'not_owner','message'=>'Только владелец заявки может решать по допработам'],403);
    $pdo->prepare("UPDATE `order_extra_quotes` SET status=?, decided_at=NOW() WHERE id=?")->execute([$decision, $quoteId]);
    if ($decision === 'accepted') {
        // Добавляем к итоговой сумме и ведём раздельные финансовые поля, если их ещё нет.
        try {
            kareta_ensure_column($pdo, 'orders', 'labor_price', "ALTER TABLE `orders` ADD COLUMN `labor_price` DECIMAL(12,2) NOT NULL DEFAULT 0");
            kareta_ensure_column($pdo, 'orders', 'parts_price', "ALTER TABLE `orders` ADD COLUMN `parts_price` DECIMAL(12,2) NOT NULL DEFAULT 0");
            kareta_ensure_column($pdo, 'orders', 'extra_price', "ALTER TABLE `orders` ADD COLUMN `extra_price` DECIMAL(12,2) NOT NULL DEFAULT 0");
            kareta_ensure_column($pdo, 'orders', 'payment_status', "ALTER TABLE `orders` ADD COLUMN `payment_status` VARCHAR(32) NOT NULL DEFAULT 'not_required'");
        } catch (Throwable $_e) {}
        $pdo->prepare("UPDATE `orders` SET labor_price=COALESCE(labor_price,0)+?, parts_price=COALESCE(parts_price,0)+?, extra_price=COALESCE(extra_price,0)+?, final_price=COALESCE(final_price,0)+? WHERE id=?")
            ->execute([(float)$quote['labor_price'], (float)$quote['parts_price'], (float)$quote['total_price'], (float)$quote['total_price'], (string)$quote['order_id']]);
    }
    try { kareta_write_event($pdo, (string)$quote['order_id'], 'extra_quote_'.$decision, ['quoteId'=>$quoteId]); } catch(\Throwable $__e) {}
    kareta_json(['ok'=>true,'status'=>$decision]);
}
/* ══════════════════════════════════════════════════════════════════
   СПОРЫ (r155)
══════════════════════════════════════════════════════════════════ */
function kareta_dispute_order_access(PDO $pdo, array $order, array $u, string $role): bool {
    $uid = (int)($u['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($u['phone'] ?? ''));
    if (in_array($role, ['admin','owner'], true)) return true;
    if ($role === 'client') {
        return ((int)($order['client_user_id'] ?? 0) > 0 && (int)$order['client_user_id'] === $uid)
            || ($phone !== '' && kareta_normalize_phone((string)($order['client_phone'] ?? '')) === $phone);
    }
    if ($role === 'master') {
        $mid = kareta_resolve_master_id($pdo, $u);
        return ($mid && (string)($order['master_id'] ?? '') === (string)$mid)
            || ((int)($order['master_user_id'] ?? 0) > 0 && (int)$order['master_user_id'] === $uid);
    }
    if ($role === 'sto') {
        try { $sto = kareta_resolve_current_sto($pdo, $u, null); return (string)($order['sto_id'] ?? '') !== '' && (string)($order['sto_id'] ?? '') === (string)($sto['id'] ?? ''); }
        catch (Throwable $_e) { return false; }
    }
    return false;
}

function disputes_get_mine(?PDO $pdo): void {
    if (!$pdo) _no_db();
    try { kareta_ensure_disputes_table($pdo); } catch(\Throwable $__e) {}
    $u = kareta_session_user();
    $role = _actor_role();
    $uid = (int)($u['id'] ?? 0);
    $phone = _actor_phone();
    if (in_array($role, ['admin','owner'], true)) {
        $st = $pdo->query("SELECT d.*,o.status AS order_status,o.client_name,o.master_name,o.sto_name FROM `order_disputes` d JOIN `orders` o ON o.id=d.order_id ORDER BY d.created_at DESC LIMIT 80");
        kareta_json(['ok'=>true,'disputes'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
    }
    if ($role === 'client') {
        $st = $pdo->prepare("SELECT d.*,o.status AS order_status,o.client_name,o.master_name,o.sto_name FROM `order_disputes` d JOIN `orders` o ON o.id=d.order_id WHERE o.client_user_id=? OR o.client_phone=? ORDER BY d.created_at DESC LIMIT 30");
        $st->execute([$uid ?: -1, $phone]);
    } elseif ($role === 'master') {
        $mid = kareta_resolve_master_id($pdo, $u) ?: '';
        $st = $pdo->prepare("SELECT d.*,o.status AS order_status,o.client_name,o.master_name,o.sto_name FROM `order_disputes` d JOIN `orders` o ON o.id=d.order_id WHERE o.master_id=? OR o.master_user_id=? ORDER BY d.created_at DESC LIMIT 30");
        $st->execute([$mid, $uid ?: -1]);
    } elseif ($role === 'sto') {
        try { $sto = kareta_resolve_current_sto($pdo, $u, null); $stoId = (string)($sto['id'] ?? ''); }
        catch (Throwable $_e) { $stoId = ''; }
        $st = $pdo->prepare("SELECT d.*,o.status AS order_status,o.client_name,o.master_name,o.sto_name FROM `order_disputes` d JOIN `orders` o ON o.id=d.order_id WHERE o.sto_id=? ORDER BY d.created_at DESC LIMIT 50");
        $st->execute([$stoId]);
    } else {
        kareta_json(['ok'=>true,'disputes'=>[]]);
    }
    kareta_json(['ok'=>true,'disputes'=>$st->fetchAll(PDO::FETCH_ASSOC)]);
}

function disputes_add_message(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    try { kareta_ensure_disputes_table($pdo); } catch(\Throwable $__e) {}
    $disputeId = trim((string)($b['disputeId'] ?? ''));
    $text = trim((string)($b['text'] ?? ''));
    if (!$disputeId || !$text) kareta_json(['ok'=>false,'error'=>'invalid_params'],422);
    $u = kareta_session_user();
    $role = _actor_role();
    $st = $pdo->prepare("SELECT d.*,o.client_user_id,o.client_phone,o.master_id,o.master_user_id,o.sto_id FROM `order_disputes` d JOIN `orders` o ON o.id=d.order_id WHERE d.id=? LIMIT 1");
    $st->execute([$disputeId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) kareta_json(['ok'=>false,'error'=>'dispute_not_found'],404);
    if (!kareta_dispute_order_access($pdo, $row, $u, $role)) kareta_json(['ok'=>false,'error'=>'forbidden_dispute'],403);
    $id = 'dm_' . bin2hex(random_bytes(4));
    $pdo->prepare("INSERT INTO `order_dispute_messages` (id,dispute_id,order_id,author_id,author_role,text) VALUES (?,?,?,?,?,?)")
        ->execute([$id, $disputeId, (string)$row['order_id'], (int)($u['id']??0)?:null, $role, $text]);
    try { kareta_write_event($pdo, (string)$row['order_id'], 'dispute_message_added', ['disputeId'=>$disputeId,'role'=>$role]); } catch (Throwable $_e) {}
    kareta_json(['ok'=>true,'id'=>$id]);
}

function disputes_resolve(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    $disputeId  = trim((string)($b['disputeId'] ?? ''));
    $resolution = trim((string)($b['resolution'] ?? ''));
    $newStatus  = trim((string)($b['orderStatus'] ?? 'cancelled')); // или 'done'
    if (!$disputeId) kareta_json(['ok'=>false,'error'=>'dispute_id_required'],422);
    $u = kareta_session_user();
    $pdo->prepare("UPDATE `order_disputes` SET status='resolved',resolution=?,resolved_by=?,resolved_at=NOW() WHERE id=?")
        ->execute([$resolution, (int)($u['id']??0), $disputeId]);
    $stD = $pdo->prepare("SELECT order_id FROM `order_disputes` WHERE id=? LIMIT 1");
    $stD->execute([$disputeId]);
    $orderId = (string)($stD->fetchColumn() ?: '');
    if ($orderId && in_array($newStatus, ['done','cancelled','process'], true)) {
        $pdo->prepare("UPDATE `orders` SET status=? WHERE id=?")->execute([$newStatus, $orderId]);
        try { kareta_write_event($pdo, $orderId, 'dispute_resolved', ['disputeId'=>$disputeId,'resolution'=>$resolution,'newStatus'=>$newStatus]); } catch(\Throwable $__e) {}
    }
    kareta_json(['ok'=>true,'resolved'=>true]);
}

/* ══════════════════════════════════════════════════════════════════
   СТО НАЗНАЧЕНИЯ (r156) — переназначение и история
══════════════════════════════════════════════════════════════════ */
function kareta_ensure_order_assignments(?PDO $pdo): void {
    if (!$pdo) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `order_assignments` (
            `id`          VARCHAR(64)  NOT NULL PRIMARY KEY,
            `order_id`    VARCHAR(64)  NOT NULL,
            `sto_id`      VARCHAR(64)  DEFAULT NULL,
            `master_id`   VARCHAR(64)  DEFAULT NULL,
            `assigned_by` INT          DEFAULT NULL,
            `assigned_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            `status`      VARCHAR(32)  NOT NULL DEFAULT 'active',
            `comment`     TEXT         DEFAULT NULL,
            INDEX `idx_oa_order` (`order_id`),
            INDEX `idx_oa_master` (`master_id`),
            INDEX `idx_oa_sto_status` (`sto_id`,`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        // STO-ASSIGN: старые таблицы order_assignments могли быть созданы
        // до появления полного audit-контракта. Держим ensure идемпотентным,
        // чтобы db_pull/history не падал из-за отсутствующей колонки.
        try { kareta_ensure_column($pdo, 'order_assignments', 'sto_id', "ALTER TABLE `order_assignments` ADD COLUMN `sto_id` VARCHAR(64) DEFAULT NULL AFTER `order_id`"); } catch (\Throwable $_) {}
        try { kareta_ensure_column($pdo, 'order_assignments', 'master_id', "ALTER TABLE `order_assignments` ADD COLUMN `master_id` VARCHAR(64) DEFAULT NULL AFTER `sto_id`"); } catch (\Throwable $_) {}
        try { kareta_ensure_column($pdo, 'order_assignments', 'assigned_by', "ALTER TABLE `order_assignments` ADD COLUMN `assigned_by` INT DEFAULT NULL AFTER `master_id`"); } catch (\Throwable $_) {}
        try { kareta_ensure_column($pdo, 'order_assignments', 'assigned_at', "ALTER TABLE `order_assignments` ADD COLUMN `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `assigned_by`"); } catch (\Throwable $_) {}
        try { kareta_ensure_column($pdo, 'order_assignments', 'status', "ALTER TABLE `order_assignments` ADD COLUMN `status` VARCHAR(32) NOT NULL DEFAULT 'active' AFTER `assigned_at`"); } catch (\Throwable $_) {}
        try { kareta_ensure_column($pdo, 'order_assignments', 'comment', "ALTER TABLE `order_assignments` ADD COLUMN `comment` TEXT DEFAULT NULL AFTER `status`"); } catch (\Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `order_assignments` ADD INDEX `idx_oa_order` (`order_id`)"); } catch (\Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `order_assignments` ADD INDEX `idx_oa_master` (`master_id`)"); } catch (\Throwable $_) {}
        try { $pdo->exec("ALTER TABLE `order_assignments` ADD INDEX `idx_oa_sto_status` (`sto_id`,`status`)"); } catch (\Throwable $_) {}
    } catch (\Throwable $__e) {}
}

function kareta_attach_order_assignment_history(?PDO $pdo, array &$orders): void {
    foreach ($orders as &$o) {
        if (is_array($o)) $o['assignmentHistory'] = [];
    }
    unset($o);
    if (!$pdo || empty($orders)) return;
    try { kareta_ensure_order_assignments($pdo); } catch (Throwable $_) { return; }
    if (!kareta_table_exists($pdo, 'order_assignments')) return;
    $orderIds = array_values(array_unique(array_filter(array_map(static fn($o) => (string)($o['id'] ?? ''), $orders))));
    if (empty($orderIds)) return;
    try {
        $ph = implode(',', array_fill(0, count($orderIds), '?'));
        $rows = kareta_try_query_all($pdo,
            "SELECT oa.id,
                    oa.order_id AS orderId,
                    COALESCE(oa.sto_id,'') AS stoId,
                    COALESCE(oa.master_id,'') AS masterId,
                    COALESCE(NULLIF(m.name,''), NULLIF(oa.master_id,''), 'Мастер') AS masterName,
                    oa.assigned_by AS assignedByUserId,
                    COALESCE(NULLIF(u.name,''), '') AS assignedByName,
                    COALESCE(oa.comment,'') AS comment,
                    COALESCE(oa.status,'active') AS status,
                    oa.assigned_at AS assignedAt
             FROM `order_assignments` oa
             LEFT JOIN `masters` m ON m.id=oa.master_id
             LEFT JOIN `users` u ON u.id=oa.assigned_by
             WHERE oa.order_id IN ($ph)
             ORDER BY oa.assigned_at ASC, oa.id ASC",
            $orderIds, [], 'ORDER_ASSIGNMENT_HISTORY'
        );
        $byOrder = [];
        foreach ($rows as $row) {
            $oid = (string)($row['orderId'] ?? '');
            if ($oid === '') continue;
            $row['assignedByUserId'] = isset($row['assignedByUserId']) ? ((int)$row['assignedByUserId'] ?: null) : null;
            $byOrder[$oid][] = $row;
        }
        foreach ($orders as &$o) {
            $oid = (string)($o['id'] ?? '');
            $o['assignmentHistory'] = $byOrder[$oid] ?? [];
            $o['assignmentHistoryCount'] = count($o['assignmentHistory']);
            $last = !empty($o['assignmentHistory']) ? $o['assignmentHistory'][count($o['assignmentHistory']) - 1] : null;
            if ($last) $o['lastAssignment'] = $last;
        }
        unset($o);
    } catch (Throwable $e) {
        try { kareta_log_error('ORDER_ASSIGNMENT_HISTORY', $e->getMessage()); } catch (Throwable $_) {}
    }
}

function sto_reassign_master(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_order_assignments($pdo);
    kareta_sto_exchange_ensure_schema($pdo);
    try {
        kareta_ensure_column($pdo, 'chats', 'sto_id',      "ALTER TABLE `chats` ADD COLUMN `sto_id` VARCHAR(64) NULL DEFAULT NULL");
        kareta_ensure_column($pdo, 'chats', 'sto_user_id', "ALTER TABLE `chats` ADD COLUMN `sto_user_id` INT NULL DEFAULT NULL");
        kareta_ensure_column($pdo, 'chats', 'unread_sto',  "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0");
    } catch (Throwable $_) {}

    $orderId  = trim((string)($b['orderId'] ?? ''));
    $masterId = trim((string)($b['masterId'] ?? ''));
    $expectedMasterId = trim((string)($b['expectedMasterId'] ?? $b['currentMasterId'] ?? ''));
    $comment  = trim((string)($b['comment'] ?? ''));
    if (!$orderId || !$masterId) kareta_json(['ok'=>false,'error'=>'params_required'],422);

    $u = kareta_session_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    $sto = kareta_resolve_current_sto($pdo, $u, $b);
    $stoId = (string)$sto['id'];
    kareta_sto_assert_master_in_team($pdo, $stoId, $masterId);

    $stMaster = $pdo->prepare("SELECT id,user_id,name,initials,phone FROM `masters` WHERE id=? AND active=1 LIMIT 1");
    $stMaster->execute([$masterId]);
    $master = $stMaster->fetch(PDO::FETCH_ASSOC);
    if (!$master) kareta_json(['ok'=>false,'error'=>'master_not_found'],404);

    $assignId = '';
    $previousMasterId = '';
    $previousMasterName = '';
    $order = [];
    try {
        $pdo->beginTransaction();
        $stOrder = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $stOrder->execute([$orderId]);
        $order = $stOrder->fetch(PDO::FETCH_ASSOC);
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }

        $orderStoId = trim((string)($order['sto_id'] ?? ''));
        if ($orderStoId === '') { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_owned_by_sto'],403); }
        if ($orderStoId !== $stoId) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'foreign_sto_order'],403); }
        if (in_array((string)($order['status'] ?? ''), ['done','cancelled','dispute'], true)) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_locked','message'=>'Нельзя переназначать мастера в текущем статусе заявки'],409);
        }

        $previousMasterId = trim((string)($order['master_id'] ?? ''));
        if ($previousMasterId === '0') $previousMasterId = '';
        $previousMasterName = trim((string)($order['master_name'] ?? ''));
        if ($previousMasterId === '') {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'order_has_no_master','message'=>'У заявки нет текущего мастера. Используйте первое назначение.'],409);
        }
        if ($expectedMasterId !== '' && $expectedMasterId !== $previousMasterId) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'master_reassign_race_condition','message'=>'Мастер заявки уже изменился. Обновите диспетчеризацию.'],409);
        }
        if ($previousMasterId === $masterId) {
            $pdo->rollBack();
            kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'order_already_assigned_to_master','order'=>kareta_sto_order_row($pdo,$orderId)]);
        }
        $targetDate=preg_match('/^\d{4}-\d{2}-\d{2}$/',(string)($order['date']??''))?(string)$order['date']:date('Y-m-d');
        kareta_tariff_master_guard($pdo,$masterId,$targetDate,$orderId,true);

        $assignId = 'oa_' . substr(md5($orderId . ':' . $stoId . ':' . $previousMasterId . ':' . $masterId . ':' . microtime(true)), 0, 20);
        $supComment = '[STO-ASSIGN] superseded_by='.$assignId.'; to='.$masterId;
        $pdo->prepare("UPDATE `order_assignments`
            SET status='superseded', comment=TRIM(CONCAT(COALESCE(comment,''), IF(COALESCE(comment,'')='', '', '\n'), ?))
            WHERE order_id=? AND sto_id=? AND status='active'")
            ->execute([$supComment, $orderId, $stoId]);

        $assignComment = trim('reassign_from='.$previousMasterId.'; '.($comment !== '' ? $comment : 'sto_reassign_master'));
        $pdo->prepare("INSERT INTO `order_assignments` (id,order_id,sto_id,master_id,assigned_by,comment,status) VALUES (?,?,?,?,?,?,'active')")
            ->execute([$assignId, $orderId, $stoId, $masterId, (int)($u['id']??0)?:null, $assignComment]);

        $up = $pdo->prepare("UPDATE `orders`
            SET master_id=?, master_user_id=?, master_name=?, status=IF(status IN ('new','waiting_responses'), 'process', status), assigned_admin_user_id=NULL
            WHERE id=? AND sto_id=? AND master_id=?");
        $up->execute([$masterId, ((int)($master['user_id'] ?? 0) ?: null), (string)($master['name'] ?? 'Мастер'), $orderId, $stoId, $previousMasterId]);
        if ($up->rowCount() === 0) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'master_reassign_race_condition','message'=>'Заявка была изменена параллельным запросом'],409);
        }
        kareta_tariff_record_master_acceptance($pdo,$masterId,$orderId,date('Y-m-d'),'sto_reassign_master');

        $chatId = 'ch_' . strtolower(str_replace('-', '', $orderId));
        $pdo->prepare("INSERT INTO `chats` (id,order_id,sto_id,sto_user_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,assigned_admin_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,unread_sto)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE sto_id=VALUES(sto_id), sto_user_id=VALUES(sto_user_id), master_id=VALUES(master_id), master_user_id=VALUES(master_user_id), master_name=VALUES(master_name), master_init=VALUES(master_init), assigned_admin_user_id=NULL, status='process', unread_client=unread_client+1, unread_master=unread_master+1, unread_sto=unread_sto+1")
            ->execute([$chatId,$orderId,$stoId,((int)($sto['user_id'] ?? 0) ?: null),(string)($order['client_id'] ?? ''),(int)($order['client_user_id'] ?? 0) ?: null,(string)($order['client_name'] ?? ''),(string)($order['client_phone'] ?? ''),'К',$masterId,((int)($master['user_id'] ?? 0) ?: null),null,(string)($master['name'] ?? 'Мастер'),(string)($master['initials'] ?? 'М'),(string)($order['service_names'] ?? 'Заявка'),(string)($order['client_car'] ?? ''),'process',1,1,0,1]);

        $msg = 'СТО переназначило заявку: '.($previousMasterName !== '' ? $previousMasterName : $previousMasterId).' → '.(string)($master['name'] ?? 'Мастер').'.';
        if ($comment !== '') $msg .= ' Причина: '.$comment;
        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_sto_reassign_'.substr(md5($assignId),0,18),$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event',$msg,date('H:i'),date('Y-m-d H:i:s')]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }

    try { kareta_write_event($pdo, $orderId, 'sto_master_reassigned', ['stoId'=>$stoId,'fromMasterId'=>$previousMasterId,'toMasterId'=>$masterId,'assignId'=>$assignId]); } catch(Throwable $__e) {}
    try {
        kareta_notification_insert($pdo, ['recipientUserId'=>((int)($master['user_id'] ?? 0) ?: null),'recipientPhone'=>(string)($master['phone'] ?? ''),'recipientRole'=>'master','eventType'=>'sto.master.reassigned','entityType'=>'order','entityId'=>$orderId,'title'=>'СТО переназначило вам заказ','body'=>'Заявка '.$orderId.' передана вам в работу.','actionUrl'=>'#master:work:process','meta'=>['orderId'=>$orderId,'stoId'=>$stoId,'assignId'=>$assignId,'previousMasterId'=>$previousMasterId]]);
        kareta_notification_insert($pdo, ['recipientUserId'=>(int)($order['client_user_id'] ?? 0) ?: null,'recipientPhone'=>(string)($order['client_phone'] ?? ''),'recipientRole'=>'client','eventType'=>'sto.master.reassigned','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер изменён','body'=>'СТО переназначило мастера по вашей заявке.','actionUrl'=>'#myorders','meta'=>['orderId'=>$orderId,'masterId'=>$masterId,'stoId'=>$stoId,'assignId'=>$assignId,'previousMasterId'=>$previousMasterId]]);
    } catch(Throwable $_e) {}
    kareta_log_audit($pdo, 'sto.reassignMaster', ['stoId'=>$stoId,'orderId'=>$orderId,'fromMasterId'=>$previousMasterId,'toMasterId'=>$masterId,'assignId'=>$assignId]);
    kareta_json(['ok'=>true,'assignId'=>$assignId,'previousMasterId'=>$previousMasterId,'masterId'=>$masterId,'order'=>kareta_sto_order_row($pdo,$orderId)]);
}

function sto_unassign_master(?PDO $pdo, array $b): void {
    if (!$pdo) _no_db();
    kareta_ensure_order_assignments($pdo);
    kareta_sto_exchange_ensure_schema($pdo);
    try {
        kareta_ensure_column($pdo, 'chats', 'sto_id',      "ALTER TABLE `chats` ADD COLUMN `sto_id` VARCHAR(64) NULL DEFAULT NULL");
        kareta_ensure_column($pdo, 'chats', 'sto_user_id', "ALTER TABLE `chats` ADD COLUMN `sto_user_id` INT NULL DEFAULT NULL");
        kareta_ensure_column($pdo, 'chats', 'unread_sto',  "ALTER TABLE `chats` ADD COLUMN `unread_sto` INT NOT NULL DEFAULT 0");
    } catch (Throwable $_) {}

    $orderId = trim((string)($b['orderId'] ?? ''));
    $expectedMasterId = trim((string)($b['expectedMasterId'] ?? $b['currentMasterId'] ?? ''));
    $comment = trim((string)($b['comment'] ?? ''));
    if (!$orderId) kareta_json(['ok'=>false,'error'=>'order_id_required'],422);

    $u = kareta_session_user();
    if (!$u) kareta_json(['ok'=>false,'error'=>'unauthorized'],401);
    $sto = kareta_resolve_current_sto($pdo, $u, $b);
    $stoId = (string)$sto['id'];

    $previousMasterId = '';
    $previousMasterName = '';
    $removeId = '';
    $order = [];
    try {
        $pdo->beginTransaction();
        $stOrder = $pdo->prepare("SELECT * FROM `orders` WHERE id=? LIMIT 1 FOR UPDATE");
        $stOrder->execute([$orderId]);
        $order = $stOrder->fetch(PDO::FETCH_ASSOC);
        if (!$order) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_not_found'],404); }

        $orderStoId = trim((string)($order['sto_id'] ?? ''));
        if ($orderStoId === '' || $orderStoId !== $stoId) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'foreign_sto_order'],403); }
        if (in_array((string)($order['status'] ?? ''), ['done','cancelled','dispute'], true)) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'order_locked'],409); }

        $previousMasterId = trim((string)($order['master_id'] ?? ''));
        if ($previousMasterId === '0') $previousMasterId = '';
        $previousMasterName = trim((string)($order['master_name'] ?? ''));
        if ($previousMasterId === '') {
            $pdo->rollBack();
            kareta_json(['ok'=>true,'skipped'=>true,'reason'=>'order_already_unassigned','order'=>kareta_sto_order_row($pdo,$orderId)]);
        }
        if ($expectedMasterId !== '' && $expectedMasterId !== $previousMasterId) {
            $pdo->rollBack();
            kareta_json(['ok'=>false,'error'=>'master_unassign_race_condition','message'=>'Мастер заявки уже изменился. Обновите диспетчеризацию.'],409);
        }

        $removeId = 'oa_rm_' . substr(md5($orderId . ':' . $stoId . ':' . $previousMasterId . ':' . microtime(true)), 0, 17);
        $removeComment = trim('unassign_master='.$previousMasterId.'; '.($comment !== '' ? $comment : 'sto_unassign_master'));
        $markRemoved = $pdo->prepare("UPDATE `order_assignments`
            SET status='removed', comment=TRIM(CONCAT(COALESCE(comment,''), IF(COALESCE(comment,'')='', '', '\n'), ?))
            WHERE order_id=? AND sto_id=? AND master_id=? AND status='active'");
        $markRemoved->execute([$removeComment, $orderId, $stoId, $previousMasterId]);
        if ($markRemoved->rowCount() === 0) {
            $pdo->prepare("INSERT INTO `order_assignments` (id,order_id,sto_id,master_id,assigned_by,comment,status) VALUES (?,?,?,?,?,?,'removed')")
                ->execute([$removeId, $orderId, $stoId, $previousMasterId, (int)($u['id']??0)?:null, $removeComment]);
        }

        $up = $pdo->prepare("UPDATE `orders`
            SET master_id=NULL, master_user_id=NULL, master_name='', assigned_admin_user_id=NULL
            WHERE id=? AND sto_id=? AND master_id=?");
        $up->execute([$orderId, $stoId, $previousMasterId]);
        if ($up->rowCount() === 0) { $pdo->rollBack(); kareta_json(['ok'=>false,'error'=>'master_unassign_race_condition'],409); }

        $chatId = 'ch_' . strtolower(str_replace('-', '', $orderId));
        $pdo->prepare("UPDATE `chats`
            SET master_id=NULL, master_user_id=NULL, master_name='', master_init='', assigned_admin_user_id=NULL, unread_client=unread_client+1, unread_sto=unread_sto+1
            WHERE order_id=? AND sto_id=?")
            ->execute([$orderId, $stoId]);
        $msg = 'СТО сняло мастера '.($previousMasterName !== '' ? $previousMasterName : $previousMasterId).' с заявки.';
        if ($comment !== '') $msg .= ' Причина: '.$comment;
        $pdo->prepare("INSERT IGNORE INTO `messages`(id,chat_id,order_id,from_role,author_user_id,type,text,time,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            ->execute(['m_sto_unassign_'.substr(md5($removeId),0,18),$chatId,$orderId,'system',(int)($u['id'] ?? 0) ?: null,'event',$msg,date('H:i'),date('Y-m-d H:i:s')]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }

    try { kareta_write_event($pdo, $orderId, 'sto_master_unassigned', ['stoId'=>$stoId,'masterId'=>$previousMasterId,'removeId'=>$removeId]); } catch(Throwable $__e) {}
    try {
        kareta_notification_insert($pdo, ['recipientUserId'=>(int)($order['client_user_id'] ?? 0) ?: null,'recipientPhone'=>(string)($order['client_phone'] ?? ''),'recipientRole'=>'client','eventType'=>'sto.master.unassigned','entityType'=>'order','entityId'=>$orderId,'title'=>'Мастер снят с заявки','body'=>'СТО временно сняло мастера с вашей заявки.','actionUrl'=>'#myorders','meta'=>['orderId'=>$orderId,'stoId'=>$stoId,'masterId'=>$previousMasterId,'removeId'=>$removeId]]);
    } catch(Throwable $_e) {}
    kareta_log_audit($pdo, 'sto.unassignMaster', ['stoId'=>$stoId,'orderId'=>$orderId,'masterId'=>$previousMasterId,'removeId'=>$removeId]);
    kareta_json(['ok'=>true,'removeId'=>$removeId,'previousMasterId'=>$previousMasterId,'order'=>kareta_sto_order_row($pdo,$orderId)]);
}


/* r70x — public news adapter for every account role */
function news_public_list(?PDO $pdo, array $query = []): void {
    if (!$pdo) { kareta_json(['ok'=>true,'data'=>kareta_fallback_news($query)]); }
    try {
        news_ensure_table($pdo);
        news_seed_15($pdo);
        $limit=max(1,min(100,(int)($query['limit'] ?? 50)));
        $category=kareta_clean_text($query['category'] ?? '',60);
        $where='WHERE active=1'; $params=[];
        if($category!=='' && $category!=='all'){ $where.=' AND category=?'; $params[]=$category; }
        $st=$pdo->prepare("SELECT id,slug,title,intro AS summary,body AS content,cover_url AS image_url,category,is_featured AS featured,published_at,created_at,updated_at,reading_time,views_count,author_name,author_role FROM news_articles $where ORDER BY is_featured DESC, sort ASC, published_at DESC LIMIT $limit");
        $st->execute($params); $items=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if(!$items) kareta_json(['ok'=>true,'data'=>kareta_fallback_news($query)]);
        kareta_json(['ok'=>true,'data'=>['items'=>$items,'source'=>'news_articles']]);
    } catch(Throwable $e) {
        try { kareta_log_error('NEWS_PUBLIC_FALLBACK',$e->getMessage()); } catch(Throwable $_) {}
        kareta_json(['ok'=>true,'data'=>kareta_fallback_news($query)]);
    }
}

function masters_public_catalog(?PDO $pdo, array $query = []): void {
    if (!$pdo) kareta_json(['ok'=>false,'error'=>'db_unavailable'],503);
    $avatarExpr = function_exists('kareta_catalog_table_has_column') && kareta_catalog_table_has_column($pdo,'users','avatar_url') ? "COALESCE(NULLIF(u.avatar_url,''),'')" : "''";
    $experienceExpr = function_exists('kareta_catalog_table_has_column') && kareta_catalog_table_has_column($pdo,'masters','experience_label') ? "COALESCE(m.experience_label,'')" : "''";
    $type = trim((string)($query['type'] ?? 'all'));
    $city = trim((string)($query['city'] ?? ''));
    $search = trim((string)($query['search'] ?? ''));
    $payload = ['masters'=>[], 'stations'=>[], 'metrics'=>['masters'=>0,'stations'=>0,'offers'=>0]];
    try {
        $where = ["COALESCE(m.active,1)=1", "COALESCE(m.profile_visible,1)=1"];
        $params = [];
        if ($city !== '') { $where[] = "COALESCE(NULLIF(m.city,''),NULLIF(u.city,''),'')=?"; $params[] = $city; }
        if ($search !== '') { $where[] = "(COALESCE(NULLIF(u.name,''),m.name) LIKE ? OR COALESCE(NULLIF(u.spec,''),m.spec) LIKE ? OR COALESCE(NULLIF(sp.name,''),m.sto_name,'') LIKE ?)"; $like='%'.$search.'%'; array_push($params,$like,$like,$like); }
        $sql = "SELECT m.id,COALESCE(NULLIF(u.name,''),m.name) name,COALESCE(NULLIF(u.spec,''),m.spec) spec,COALESCE(NULLIF(m.city,''),NULLIF(u.city,''),'Усть-Каменогорск') city,COALESCE(m.rating,0) rating,COALESCE(m.reviews_count,0) reviewsCount,COALESCE(m.availability,'online') availability,COALESCE(m.work_mode,'shop') workMode,COALESCE(NULLIF(sp.name,''),NULLIF(m.sto_name,''),'Частный мастер') stoName,COALESCE(m.color,'#ff6b00') color,{$avatarExpr} avatar_url,{$experienceExpr} experienceLabel,(SELECT COUNT(*) FROM service_offers so WHERE so.owner_type='master' AND so.owner_entity_id=m.id AND so.active=1 AND so.moderation_status='approved') offerCount,(SELECT MIN(NULLIF(so.price,0)) FROM service_offers so WHERE so.owner_type='master' AND so.owner_entity_id=m.id AND so.active=1 AND so.moderation_status='approved') minPrice FROM masters m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN sto_profiles sp ON sp.id=m.sto_id WHERE ".implode(' AND ',$where)." ORDER BY offerCount DESC,rating DESC,name LIMIT 100";
        $st=$pdo->prepare($sql); $st->execute($params); $payload['masters']=$st->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $whereSto=["COALESCE(s.active,1)=1"];
        $paramsSto=[];
        if ($city !== '') { $whereSto[]="COALESCE(s.city,'')=?"; $paramsSto[]=$city; }
        if ($search !== '') { $whereSto[]="(s.name LIKE ? OR COALESCE(s.description,'') LIKE ? OR COALESCE(s.primary_specialization,'') LIKE ?)"; $like='%'.$search.'%'; array_push($paramsSto,$like,$like,$like); }
        $sqlSto="SELECT s.id,s.name,COALESCE(s.primary_specialization,'Комплексный ремонт автомобилей') spec,COALESCE(s.city,'Усть-Каменогорск') city,COALESCE(s.address,'') address,COALESCE(s.work_hours,'') workHours,COALESCE(s.rating,0) rating,COALESCE(s.orders_count,0) ordersCount,COALESCE(s.description,'СТО с записью через KARETA.KZ') description,(SELECT COUNT(*) FROM sto_master_links l WHERE l.sto_id=s.id AND l.status='active') masterCount,(SELECT COUNT(*) FROM service_offers so WHERE so.owner_type='sto' AND so.owner_entity_id=s.id AND so.active=1 AND so.moderation_status='approved') offerCount,(SELECT MIN(NULLIF(so.price,0)) FROM service_offers so WHERE so.owner_type='sto' AND so.owner_entity_id=s.id AND so.active=1 AND so.moderation_status='approved') minPrice FROM sto_profiles s WHERE ".implode(' AND ',$whereSto)." ORDER BY offerCount DESC,rating DESC,name LIMIT 100";
        $st2=$pdo->prepare($sqlSto); $st2->execute($paramsSto); $payload['stations']=$st2->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $masterStates = function_exists('kareta_master_social_states') ? kareta_master_social_states($pdo,array_column($payload['masters'],'id')) : [];
        foreach ($payload['masters'] as &$masterRow) { $masterRow['type']='master'; $masterRow['social_state']=$masterStates[(string)($masterRow['id']??'')] ?? ['following'=>false,'followNews'=>true,'followWorks'=>true]; }
        unset($masterRow);
        $stoStates = function_exists('kareta_sto_social_states') ? kareta_sto_social_states($pdo,array_column($payload['stations'],'id')) : [];
        foreach ($payload['stations'] as &$stationRow) { $stationRow['type']='sto'; $stationRow['social_state']=$stoStates[(string)($stationRow['id']??'')] ?? ['following'=>false,'followNews'=>true,'followWorks'=>true]; }
        unset($stationRow);
        if ($type==='master') $payload['stations']=[];
        if ($type==='sto') $payload['masters']=[];
        $payload['metrics']['masters']=count($payload['masters']);
        $payload['metrics']['stations']=count($payload['stations']);
        $payload['metrics']['offers']=array_sum(array_map(static fn($r)=>(int)($r['offerCount']??0),$payload['masters']))+array_sum(array_map(static fn($r)=>(int)($r['offerCount']??0),$payload['stations']));
        header('Cache-Control: private, max-age=30, stale-while-revalidate=120');
        kareta_json(['ok'=>true,'data'=>$payload]);
    } catch (Throwable $e) {
        kareta_log_error('MASTERS_PUBLIC_CATALOG', $e->getMessage());
        kareta_json(['ok'=>false,'error'=>'masters_catalog_unavailable','requestId'=>KARETA_REQUEST_ID],500);
    }
}
