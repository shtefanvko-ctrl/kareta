<?php
declare(strict_types=1);

/** WhatsApp ownership is scoped to a business phone and a customer, not a KARETA role. */
function kareta_messaging_whatsapp_array($value): array
{
    return is_array($value) ? $value : [];
}

function kareta_messaging_whatsapp_customer($value): string
{
    // This transport supports phone/wa_id identity. Never turn a BSUID into a phone.
    if (!is_string($value) || !preg_match('/^\+?[0-9]{1,32}$/D', $value)) return '';
    return ltrim($value, '+');
}

function kareta_messaging_whatsapp_timestamp($value, int $now): int
{
    if ((!is_string($value) && !is_int($value)) || !preg_match('/^[0-9]{1,11}$/D', (string)$value)) return 0;
    $timestamp = (int)$value;
    // Reject malformed/future grants; a small clock skew does not extend a window.
    return $timestamp > 0 && $timestamp <= $now + 300 ? min($timestamp, $now) : 0;
}

function kareta_messaging_whatsapp_events(array $payload, string $phoneId, ?int $now = null): array
{
    $now = $now ?? time();
    $events = [];
    if ($phoneId === '' || ($payload['object'] ?? '') !== 'whatsapp_business_account') return $events;
    foreach (kareta_messaging_whatsapp_array($payload['entry'] ?? null) as $entry) {
        if (!is_array($entry)) continue;
        foreach (kareta_messaging_whatsapp_array($entry['changes'] ?? null) as $change) {
            if (!is_array($change)) continue;
            $field = $change['field'] ?? '';
            $value = kareta_messaging_whatsapp_array($change['value'] ?? null);
            if (($value['messaging_product'] ?? '') !== 'whatsapp') continue;
            if ($field === 'messaging_handovers') {
                $recipient = kareta_messaging_whatsapp_array($value['recipient'] ?? null);
                $sender = kareta_messaging_whatsapp_array($value['sender'] ?? null);
                $type = $value['type'] ?? '';
                $waId = kareta_messaging_whatsapp_customer($sender['phone_number'] ?? null);
                $timestamp = kareta_messaging_whatsapp_timestamp($value['timestamp'] ?? null, $now);
                if (($recipient['phone_number_id'] ?? '') !== $phoneId || $waId === '' || !$timestamp
                    || !in_array($type, ['control_passed', 'control_taken'], true)
                    || !is_array($value[$type] ?? null)) continue;
                $events[] = ['phoneId'=>$phoneId, 'waId'=>$waId, 'source'=>$type,
                    'ownership'=>$type === 'control_passed' ? 'owned' : 'standby',
                    'timestamp'=>$timestamp, 'customerAt'=>0];
                continue;
            }
            if (!in_array($field, ['messages', 'standby'], true)) continue;
            $metadata = kareta_messaging_whatsapp_array($value['metadata'] ?? null);
            if (($metadata['phone_number_id'] ?? '') !== $phoneId) continue;
            $body = $field === 'standby' ? kareta_messaging_whatsapp_array($value['standby'] ?? null) : $value;
            $names = [];
            foreach (kareta_messaging_whatsapp_array($body['contacts'] ?? null) as $contact) {
                if (!is_array($contact)) continue;
                $waId = kareta_messaging_whatsapp_customer($contact['wa_id'] ?? null);
                $profile = kareta_messaging_whatsapp_array($contact['profile'] ?? null);
                if ($waId !== '' && is_string($profile['name'] ?? null)) $names[$waId] = $profile['name'];
            }
            foreach (kareta_messaging_whatsapp_array($body['messages'] ?? null) as $message) {
                if (!is_array($message)) continue;
                $waId = kareta_messaging_whatsapp_customer($message['from'] ?? null);
                $timestamp = kareta_messaging_whatsapp_timestamp($message['timestamp'] ?? null, $now);
                $id = $message['id'] ?? '';
                if ($waId === '' || !$timestamp || !is_string($id) || $id === '' || strlen($id) > 191) continue;
                $events[] = ['phoneId'=>$phoneId, 'waId'=>$waId, 'source'=>$field,
                    'ownership'=>$field === 'messages' ? 'owned' : 'standby',
                    'timestamp'=>$timestamp, 'customerAt'=>$timestamp, 'id'=>$id,
                    'message'=>$message, 'displayName'=>$names[$waId] ?? ''];
            }
            if ($field !== 'standby') continue;
            // Outbound traffic is an ownership signal, never customer text or activity.
            foreach (['message_echoes', 'statuses'] as $kind) {
                foreach (kareta_messaging_whatsapp_array($body[$kind] ?? null) as $item) {
                    if (!is_array($item)) continue;
                    $echoMessage = kareta_messaging_whatsapp_array($item['message'] ?? null);
                    $waId = kareta_messaging_whatsapp_customer($kind === 'message_echoes'
                        ? ($echoMessage['to'] ?? null) : ($item['recipient_id'] ?? null));
                    $timestamp = kareta_messaging_whatsapp_timestamp($item['timestamp'] ?? null, $now);
                    if ($waId === '' || !$timestamp) continue;
                    $events[] = ['phoneId'=>$phoneId, 'waId'=>$waId, 'source'=>'standby',
                        'ownership'=>'standby', 'timestamp'=>$timestamp, 'customerAt'=>0];
                }
            }
        }
    }
    return $events;
}

function kareta_messaging_whatsapp_fold(array $state, array $event): array
{
    $state += ['ownership'=>'unknown', 'event_at'=>0, 'last_customer_at'=>0, 'source'=>''];
    $timestamp = (int)$event['timestamp'];
    // Meta timestamps have second precision. A conflicting revoke wins a tie.
    if ($timestamp > (int)$state['event_at'] || ($timestamp === (int)$state['event_at']
        && $event['ownership'] === 'standby')) {
        $state['ownership'] = $event['ownership'];
        $state['event_at'] = $timestamp;
        $state['source'] = $event['source'];
    }
    $state['last_customer_at'] = max((int)$state['last_customer_at'], (int)$event['customerAt']);
    return $state;
}

function kareta_messaging_whatsapp_block_reason(array $state, int $now): string
{
    if (($state['ownership'] ?? '') !== 'owned') return 'whatsapp_thread_not_owned';
    $customerAt = (int)($state['last_customer_at'] ?? 0);
    if ($customerAt <= 0 || $customerAt > $now || $customerAt <= $now - 86400) return 'whatsapp_service_window_closed';
    return '';
}

function kareta_messaging_whatsapp_install_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS messaging_whatsapp_threads (
        phone_number_id VARCHAR(64) NOT NULL,
        external_user_id VARCHAR(32) NOT NULL,
        ownership VARCHAR(16) NOT NULL DEFAULT 'unknown',
        event_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
        last_customer_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
        source VARCHAR(24) NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(phone_number_id,external_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_messaging_whatsapp_schema(PDO $pdo): void
{
    $st = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='messaging_whatsapp_threads'");
    if ((int)$st->fetchColumn() !== 1) throw new RuntimeException('whatsapp_routing_schema_not_installed');
}

function kareta_messaging_whatsapp_thread(PDO $pdo, string $phoneId, string $waId): array
{
    kareta_messaging_whatsapp_schema($pdo);
    $st = $pdo->prepare('SELECT ownership,event_at,last_customer_at,source FROM messaging_whatsapp_threads WHERE phone_number_id=? AND external_user_id=?');
    $st->execute([$phoneId, $waId]);
    return $st->fetch(PDO::FETCH_ASSOC) ?: [];
}

function kareta_messaging_whatsapp_observe(PDO $pdo, array $event): void
{
    kareta_messaging_whatsapp_schema($pdo);
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT IGNORE INTO messaging_whatsapp_threads(phone_number_id,external_user_id) VALUES(?,?)')
            ->execute([$event['phoneId'], $event['waId']]);
        $st = $pdo->prepare('SELECT ownership,event_at,last_customer_at,source FROM messaging_whatsapp_threads WHERE phone_number_id=? AND external_user_id=? FOR UPDATE');
        $st->execute([$event['phoneId'], $event['waId']]);
        $state = kareta_messaging_whatsapp_fold($st->fetch(PDO::FETCH_ASSOC) ?: [], $event);
        $pdo->prepare('UPDATE messaging_whatsapp_threads SET ownership=?,event_at=?,last_customer_at=?,source=? WHERE phone_number_id=? AND external_user_id=?')
            ->execute([$state['ownership'], $state['event_at'], $state['last_customer_at'], $state['source'], $event['phoneId'], $event['waId']]);
        if (kareta_messaging_whatsapp_block_reason($state, time()) === '') {
            $pdo->prepare("UPDATE messaging_deliveries d JOIN messaging_channel_links l ON l.user_id=d.recipient_user_id AND l.channel=d.channel
                SET d.status='retry',d.next_attempt_at=NOW() WHERE d.channel='whatsapp' AND d.status='blocked_window'
                AND d.error_code IN ('whatsapp_thread_not_owned','whatsapp_service_window_closed','whatsapp_routing_unavailable')
                AND l.status='linked' AND l.external_user_id=?")->execute([$event['waId']]);
        }
        if ($ownTransaction) $pdo->commit();
    } catch (Throwable $e) {
        if ($ownTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function kareta_messaging_whatsapp_process_message(PDO $pdo, array $event): void
{
    if (!isset($event['message'], $event['id'])) return;
    kareta_messaging_schema($pdo);
    $message = $event['message'];
    $eventId = $event['id'];
    $waId = $event['waId'];
    $reply = '';
    $pdo->beginTransaction();
    try {
        $eventRaw = json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!kareta_messaging_record_inbound($pdo, 'whatsapp', $eventId, $eventRaw)) {
            $pdo->commit();
            return;
        }
        $body = kareta_messaging_whatsapp_array($message['text'] ?? null);
        $text = ($message['type'] ?? '') === 'text' && is_string($body['body'] ?? null) ? trim($body['body']) : '';
        if ($text === '') {
            kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'ignored', 0, '', '', 'unsupported_message');
        } elseif (preg_match('~^KARETA\s+([A-Za-z0-9_-]{8,128})\s*$~ui', $text, $m)) {
            $state = kareta_messaging_whatsapp_thread($pdo, $event['phoneId'], $waId);
            if ($event['source'] === 'standby' || kareta_messaging_whatsapp_block_reason($state, time()) !== '') {
                kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'rejected', 0, '', '', 'whatsapp_thread_not_owned');
            } else {
                $userId = kareta_messaging_consume_link_token($pdo, 'whatsapp', $m[1]);
                if ($userId <= 0) {
                    $reply = 'Ссылка подключения KARETA истекла. Создайте новую в настройках аккаунта.';
                    kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'rejected', 0, '', '', 'link_token_invalid');
                } else {
                    kareta_messaging_link($pdo, $userId, 'whatsapp', $waId, $waId, $waId, $event['displayName']);
                    $reply = 'WhatsApp подключён к KARETA.KZ. Ответы на сообщения KARETA будут сохранены в соответствующем чате.';
                    kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'linked', $userId);
                }
            }
        } else {
            $userId = kareta_messaging_find_user_by_external($pdo, 'whatsapp', $waId);
            if ($userId <= 0) {
                kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'rejected', 0, '', '', 'channel_not_linked');
            } else {
                $context = kareta_messaging_whatsapp_array($message['context'] ?? null);
                $replyId = is_string($context['id'] ?? null) ? $context['id'] : '';
                $chatId = kareta_messaging_resolve_chat($pdo, $userId, 'whatsapp', $replyId, true);
                if ($chatId === '') {
                    if ($event['source'] !== 'standby') $reply = 'Не удалось определить чат KARETA. Откройте нужный чат KARETA и ответьте на последнее сообщение.';
                    kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'unrouted', $userId, '', '', 'chat_not_resolved');
                } else {
                    // WhatsApp runs inside this transaction: never attempt legacy runtime DDL.
                    $messageId = kareta_messaging_insert_external_message($pdo, $userId, 'whatsapp', $eventId, $chatId, $text, false);
                    kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'processed', $userId, $chatId, $messageId);
                }
                $pdo->prepare('UPDATE messaging_channel_links SET last_inbound_at=GREATEST(COALESCE(last_inbound_at,FROM_UNIXTIME(0)),FROM_UNIXTIME(?)) WHERE user_id=? AND channel=\'whatsapp\'')
                    ->execute([$event['customerAt'], $userId]);
            }
        }
        $pdo->commit();
    } catch (DomainException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $pdo->beginTransaction();
        try {
            if (kareta_messaging_record_inbound($pdo, 'whatsapp', $eventId, $eventRaw)) {
                kareta_messaging_finish_inbound($pdo, 'whatsapp', $eventId, 'rejected', 0, '', '', $e->getMessage());
            }
            $pdo->commit();
        } catch (Throwable $recordError) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $recordError;
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    // The send rechecks ownership after commit; the event itself never takes control.
    if ($reply !== '') kareta_messaging_whatsapp_send_raw($pdo, $waId, $reply);
}
