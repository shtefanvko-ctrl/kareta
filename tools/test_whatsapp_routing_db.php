<?php
declare(strict_types=1);

require_once __DIR__ . '/test_whatsapp_routing.php';

$dsn = getenv('KARETA_TEST_MYSQL_DSN') ?: '';
if (!preg_match('/^mysql:.*(?:^|;)dbname=(kareta_test_whatsapp_[a-z0-9_]+)(?:;|$)/D', $dsn, $match)) {
    fwrite(STDERR, "Require a dedicated KARETA_TEST_MYSQL_DSN with dbname=kareta_test_whatsapp_<suffix>.\n");
    exit(2);
}
$pdo = new PDO($dsn, getenv('KARETA_TEST_MYSQL_USER') ?: 'root', getenv('KARETA_TEST_MYSQL_PASS') ?: '', [
    PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false]);
check($pdo->query('SELECT DATABASE()')->fetchColumn() === $match[1], 'only the dedicated test DB is writable');
$socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
if (!$socket) throw new RuntimeException('Cannot reserve a local mock port');
$address = stream_socket_get_name($socket, false);
fclose($socket);
$sendLog = tempnam(sys_get_temp_dir(), 'kareta-wa-test-');
$mockLog = tempnam(sys_get_temp_dir(), 'kareta-wa-server-');
$mock = proc_open([PHP_BINARY, '-n', '-S', $address, __DIR__.'/fixtures/whatsapp_send_mock.php'],
    [0=>['pipe','r'], 1=>['file',$mockLog,'a'], 2=>['file',$mockLog,'a']], $pipes, null, ['KARETA_TEST_SEND_LOG'=>$sendLog]);
if (!is_resource($mock)) throw new RuntimeException('Cannot start the local provider mock');
register_shutdown_function(static function() use ($mock, $sendLog, $mockLog): void {
    proc_terminate($mock); proc_close($mock); @unlink($sendLog); @unlink($mockLog);
});
$ready = false;
for ($i=0; $i<50; ++$i) {
    $connection = @stream_socket_client('tcp://'.$address, $errno, $error, 0.1);
    if ($connection) { fclose($connection); $ready=true; break; }
    usleep(50000);
}
check($ready, 'local provider mock is ready');
define('KARETA_MESSAGING', ['enabled'=>true, 'auto_schema'=>false, 'public_url'=>'https://kareta.test',
    'telegram'=>['enabled'=>false], 'whatsapp'=>['enabled'=>true,
        'access_token'=>'TEST_ONLY_TOKEN', 'phone_number_id'=>'10001', 'business_phone'=>'77010000000',
        'verify_token'=>'TEST_ONLY_VERIFY_012345', 'app_secret'=>'TEST_ONLY_SECRET_012345',
        'graph_base_url'=>'http://'.$address.'/v23.0']]);
require_once dirname(__DIR__) . '/api/messaging_core.php';

function sends(string $path): int { return count(file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []); }
function scalar(PDO $pdo, string $sql) { return $pdo->query($sql)->fetchColumn(); }
function process_payload(PDO $pdo, array $payload): void
{
    $events = kareta_messaging_whatsapp_events($payload, '10001');
    foreach ($events as $event) kareta_messaging_whatsapp_observe($pdo, $event);
    foreach ($events as $event) kareta_messaging_whatsapp_process_message($pdo, $event);
}

// Only these fixtures are replaced, after checking the selected DB name above.
foreach (['messages','chat_participants','chats','users','messaging_whatsapp_threads',
    'messaging_channel_links','messaging_link_tokens','messaging_preferences',
    'messaging_deliveries','messaging_inbound_events','messaging_action_tokens'] as $table) $pdo->exec("DROP TABLE IF EXISTS `{$table}`");
kareta_messaging_install_schema($pdo, false);
kareta_messaging_schema($pdo);
check((int)scalar($pdo, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()") === 6, 'existing Telegram schema needs no routing table');
$blocked = kareta_messaging_whatsapp_send_raw($pdo, '77010000001', 'must not send');
check(($blocked['error'] ?? '') === 'whatsapp_routing_unavailable' && sends($sendLog) === 0, 'missing routing schema blocks sends without a network request or runtime DDL');
check((int)scalar($pdo, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()") === 6, 'send guard did not create the missing table');
kareta_messaging_install_schema($pdo);
kareta_messaging_install_schema($pdo);
kareta_messaging_whatsapp_schema($pdo);
check((int)scalar($pdo, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()") === 7, 'explicit installer adds one table and is idempotent');

$pdo->exec("CREATE TABLE users(id BIGINT UNSIGNED PRIMARY KEY, role VARCHAR(16), active TINYINT) ENGINE=InnoDB");
$pdo->exec("CREATE TABLE chats(id VARCHAR(64) PRIMARY KEY,order_id VARCHAR(64),client_user_id BIGINT UNSIGNED,master_user_id BIGINT UNSIGNED,unread_client INT DEFAULT 0,unread_master INT DEFAULT 0,unread_admin INT DEFAULT 0,updated_at DATETIME) ENGINE=InnoDB");
$pdo->exec("CREATE TABLE chat_participants(chat_id VARCHAR(64),user_id BIGINT UNSIGNED,left_at DATETIME NULL,unread_count INT DEFAULT 0,PRIMARY KEY(chat_id,user_id)) ENGINE=InnoDB");
$pdo->exec("CREATE TABLE messages(id VARCHAR(96) PRIMARY KEY,client_message_id VARCHAR(96),chat_id VARCHAR(64),order_id VARCHAR(64),from_role VARCHAR(16),author_user_id BIGINT UNSIGNED,type VARCHAR(16),text TEXT,meta JSON,time VARCHAR(8),created_at DATETIME,UNIQUE KEY uq_messages_client_message_id(chat_id,from_role,client_message_id)) ENGINE=InnoDB");
$pdo->exec("INSERT INTO users VALUES(1,'client',1),(2,'master',1),(3,'client',1)");
$pdo->exec("INSERT INTO chats(id,order_id,client_user_id,master_user_id,updated_at) VALUES('chat-owned','',1,2,NOW()),('chat-foreign','',3,2,NOW())");
$pdo->exec("INSERT INTO chat_participants(chat_id,user_id) VALUES('chat-owned',1),('chat-owned',2),('chat-foreign',3),('chat-foreign',2)");
kareta_messaging_link($pdo, 1, 'whatsapp', '77010000001');
$pdo->exec("INSERT INTO messaging_deliveries(message_id,chat_id,recipient_user_id,channel,status,external_message_id) VALUES('sent-owned','chat-owned',1,'whatsapp','sent','wamid.sent')");

process_payload($pdo, incoming('standby', 'wamid.once', time()-20));
process_payload($pdo, incoming('standby', 'wamid.once', time()-20));
check((int)scalar($pdo, 'SELECT COUNT(*) FROM messages') === 1 && (int)scalar($pdo, "SELECT unread_count FROM chat_participants WHERE chat_id='chat-owned' AND user_id=2") === 1, 'duplicate standby creates one authorized message and one unread increment');
check(sends($sendLog) === 0, 'standby sends no automatic response');
check((kareta_messaging_whatsapp_send_raw($pdo, '77010000001', 'blocked')['error'] ?? '') === 'whatsapp_thread_not_owned' && sends($sendLog) === 0, 'raw sender enforces ownership for every caller');
$pdo->exec("INSERT INTO messaging_deliveries(message_id,chat_id,recipient_user_id,channel,status,payload_json) VALUES('queued','chat-owned',1,'whatsapp','pending','{\"text\":\"reply\"}')");
$worker = kareta_messaging_worker_once($pdo);
check($worker['blocked'] === 1 && scalar($pdo, "SELECT status FROM messaging_deliveries WHERE message_id='queued'") === 'blocked_window' && sends($sendLog) === 0, 'worker keeps a non-owner delivery queued');
process_payload($pdo, handover('control_passed', time()-10));
check(scalar($pdo, "SELECT status FROM messaging_deliveries WHERE message_id='queued'") === 'retry', 'handover wakes the blocked delivery within an existing service window');
$worker = kareta_messaging_worker_once($pdo);
check($worker['sent'] === 1 && sends($sendLog) === 1, 'owned queued delivery reaches the local provider once');
$request = json_decode((string)file($sendLog)[0], true);
check($request['method'] === 'POST' && $request['path'] === '/v23.0/10001/messages' && $request['payload']['to'] === '77010000001', 'send uses the configured version and phone /messages endpoint');
process_payload($pdo, handover('control_taken', time()-9));
process_payload($pdo, handover('control_passed', time()-10));
process_payload($pdo, incoming('messages', 'wamid.old', time()-30));
check((kareta_messaging_whatsapp_send_raw($pdo, '77010000001', 'blocked')['error'] ?? '') === 'whatsapp_thread_not_owned' && sends($sendLog) === 1, 'old grants and old normal delivery cannot reopen a revoked thread');

$token = 'TEST_LINK_TOKEN_012345';
$pdo->prepare("INSERT INTO messaging_link_tokens(token_hash,user_id,channel,expires_at) VALUES(?,3,'whatsapp',DATE_ADD(NOW(),INTERVAL 15 MINUTE))")->execute([hash('sha256',$token)]);
process_payload($pdo, incoming('standby', 'wamid.token.standby', time()-8, 'KARETA '.$token));
check(scalar($pdo, 'SELECT used_at FROM messaging_link_tokens') === null && (int)scalar($pdo, "SELECT user_id FROM messaging_channel_links WHERE external_user_id='77010000001'") === 1 && sends($sendLog) === 1, 'standby link command neither consumes token nor changes account nor responds');

process_payload($pdo, incoming('messages', 'foreign-phone', time(), 'KARETA '.$token, '99999'));
check((int)scalar($pdo, "SELECT COUNT(*) FROM messaging_inbound_events WHERE event_id='foreign-phone'") === 0 && scalar($pdo, 'SELECT used_at FROM messaging_link_tokens') === null, 'foreign phone cannot consume a link token or create an inbox event');
$foreignChat = incoming('standby', 'foreign-chat', time()-7);
$foreignChat['entry'][0]['changes'][0]['value']['standby']['messages'][0]['context']['id'] = 'wamid.foreign';
$pdo->exec("UPDATE messaging_deliveries SET chat_id='chat-foreign',external_message_id='wamid.foreign' WHERE message_id='sent-owned'");
process_payload($pdo, $foreignChat);
check((int)scalar($pdo, "SELECT COUNT(*) FROM messages WHERE chat_id='chat-foreign'") === 0 && scalar($pdo, "SELECT status FROM messaging_inbound_events WHERE event_id='foreign-chat'") === 'unrouted', 'standby preserves server-side chat authorization');
$pdo->exec("UPDATE messaging_deliveries SET chat_id='chat-owned',external_message_id='wamid.sent' WHERE message_id='sent-owned'");

$before = (int)scalar($pdo, 'SELECT COUNT(*) FROM messages');
$pdo->exec("CREATE TRIGGER fail_inbound BEFORE UPDATE ON chats FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test transient failure after insert'");
$failed = incoming('standby', 'wamid.retry', time()-6);
$didFail = false;
try { process_payload($pdo, $failed); } catch (PDOException $e) { $didFail=true; }
check($didFail && !$pdo->inTransaction() && (int)scalar($pdo, "SELECT COUNT(*) FROM messaging_inbound_events WHERE event_id='wamid.retry'") === 0, 'transient DB error rolls back the inbox dedup claim');
check((int)scalar($pdo, 'SELECT COUNT(*) FROM messages') === $before, 'failed insert leaves no partial message');
check((int)scalar($pdo, "SELECT unread_count FROM chat_participants WHERE chat_id='chat-owned' AND user_id=2") === $before, 'failure after insert also rolls back unread changes');
$pdo->exec('DROP TRIGGER fail_inbound');
process_payload($pdo, $failed);
process_payload($pdo, $failed);
check((int)scalar($pdo, 'SELECT COUNT(*) FROM messages') === $before+1 && scalar($pdo, "SELECT status FROM messaging_inbound_events WHERE event_id='wamid.retry'") === 'processed', 'redelivery after rollback completes once');

$pdo->exec("UPDATE messaging_preferences SET allow_external_replies=0 WHERE user_id=1");
$before = (int)scalar($pdo, 'SELECT COUNT(*) FROM messages');
process_payload($pdo, incoming('standby', 'wamid.optout', time()-5));
check((int)scalar($pdo, 'SELECT COUNT(*) FROM messages') === $before && scalar($pdo, "SELECT error_code FROM messaging_inbound_events WHERE event_id='wamid.optout'") === 'external_replies_disabled', 'external-reply opt-out remains enforced');
$pdo->exec("UPDATE messaging_preferences SET allow_external_replies=1 WHERE user_id=1");

process_payload($pdo, $outbound);
check((int)scalar($pdo, 'SELECT COUNT(*) FROM messages') === $before && sends($sendLog) === 1, 'echoes and receipts cause no inbox insertion or auto-send');
$pdo->exec("UPDATE messaging_whatsapp_threads SET ownership='owned',last_customer_at=UNIX_TIMESTAMP()-86400 WHERE external_user_id='77010000001'");
check((kareta_messaging_whatsapp_send_raw($pdo, '77010000001', 'expired')['error'] ?? '') === 'whatsapp_service_window_closed' && sends($sendLog) === 1, 'expired customer activity blocks a raw send even when owned');

// The link helpers must join an outer transaction and retain standalone behavior.
$pdo->beginTransaction();
check(kareta_messaging_consume_link_token($pdo, 'whatsapp', $token) === 3, 'valid link token works inside the receiver transaction');
kareta_messaging_link($pdo, 3, 'whatsapp', '77010000002');
$pdo->rollBack();
check(scalar($pdo, 'SELECT used_at FROM messaging_link_tokens') === null && (int)scalar($pdo, "SELECT COUNT(*) FROM messaging_channel_links WHERE user_id=3") === 0, 'outer rollback restores token and link together');
kareta_messaging_link($pdo, 3, 'telegram', 'telegram-test');
check(kareta_messaging_find_user_by_external($pdo, 'telegram', 'telegram-test') === 3, 'standalone Telegram linking still commits');
check((int)scalar($pdo, "SELECT unread_count FROM chat_participants WHERE chat_id='chat-owned' AND user_id=2") === (int)scalar($pdo, 'SELECT COUNT(*) FROM messages'), 'all accepted text messages have exactly one unread effect');
process_payload($pdo, incoming('messages', 'wamid.normal.link', time()-1, 'KARETA '.$token, '10001', '77010000003'));
process_payload($pdo, incoming('messages', 'wamid.normal.link', time()-1, 'KARETA '.$token, '10001', '77010000003'));
check(scalar($pdo, 'SELECT used_at FROM messaging_link_tokens') !== null && kareta_messaging_find_user_by_external($pdo, 'whatsapp', '77010000003') === 3 && sends($sendLog) === 2, 'normal link delivery commits account and token once and sends one confirmation after commit');
echo "WhatsApp database integration: {$checks} total checks passed.\n";
