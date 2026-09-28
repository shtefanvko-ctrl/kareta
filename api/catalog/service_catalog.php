<?php
declare(strict_types=1);

function kareta_service_catalog_source_path(): string
{
    return dirname(__DIR__, 2) . '/storage/catalog/services.json';
}

function kareta_service_catalog_text(mixed $value, int $max = 1000): string
{
    $value = trim((string)$value);
    return function_exists('mb_substr') ? mb_substr($value, 0, $max, 'UTF-8') : substr($value, 0, $max);
}

function kareta_service_catalog_is_list(array $value): bool
{
    return array_keys($value) === range(0, count($value) - 1);
}

function kareta_service_catalog_canonicalize(mixed $value): mixed
{
    if (!is_array($value)) return $value;
    if (kareta_service_catalog_is_list($value)) {
        return array_map('kareta_service_catalog_canonicalize', $value);
    }
    ksort($value);
    foreach ($value as $key => $item) $value[$key] = kareta_service_catalog_canonicalize($item);
    return $value;
}

function kareta_service_catalog_load_source(): array
{
    $path = kareta_service_catalog_source_path();
    if (!is_file($path) || !is_readable($path)) {
        throw new RuntimeException('service_catalog_source_missing');
    }
    $decoded = json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded) || !is_array($decoded['services'] ?? null)) {
        throw new RuntimeException('service_catalog_source_invalid');
    }

    $meta = is_array($decoded['source'] ?? null) ? $decoded['source'] : [];
    $expectedCount = (int)($meta['count'] ?? 0);
    if ($expectedCount !== count($decoded['services'])) {
        throw new RuntimeException('service_catalog_count_mismatch');
    }

    $expectedSha = strtolower(kareta_service_catalog_text($meta['sha256'] ?? '', 64));
    if ($expectedSha !== '') {
        $copy = $decoded;
        unset($copy['source']['sha256']);
        $canonical = json_encode(kareta_service_catalog_canonicalize($copy), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $actualSha = hash('sha256', (string)$canonical);
        if (!hash_equals($expectedSha, $actualSha)) {
            throw new RuntimeException('service_catalog_checksum_mismatch');
        }
    }

    $ids = [];
    foreach ($decoded['services'] as $row) {
        if (!is_array($row)) throw new RuntimeException('service_catalog_row_invalid');
        $id = kareta_service_catalog_text($row['id'] ?? '', 64);
        if ($id === '' || isset($ids[$id])) throw new RuntimeException('service_catalog_duplicate_id:' . $id);
        $ids[$id] = true;
    }
    return $decoded;
}

function kareta_service_catalog_normalize_service(array $row, array $sourceMeta = []): array
{
    $steps = array_values(array_filter(array_map(static fn($v) => kareta_service_catalog_text($v, 255), is_array($row['steps'] ?? null) ? $row['steps'] : []), static fn($v) => $v !== ''));
    $variants = array_values(array_filter(array_map(static fn($v) => kareta_service_catalog_text($v, 255), is_array($row['priceVariants'] ?? null) ? $row['priceVariants'] : []), static fn($v) => $v !== ''));
    $normalized = [
        'id' => kareta_service_catalog_text($row['id'] ?? '', 64),
        'category_key' => kareta_service_catalog_text($row['category'] ?? 'other', 64) ?: 'other',
        'icon' => kareta_service_catalog_text($row['icon'] ?? '⚙', 16),
        'name' => kareta_service_catalog_text($row['name'] ?? '', 191),
        'short_desc' => kareta_service_catalog_text($row['shortDesc'] ?? '', 1000),
        'why_text' => kareta_service_catalog_text($row['whyText'] ?? '', 1000),
        'base_price' => max(0, (int)($row['basePrice'] ?? 0)),
        'avg_time' => kareta_service_catalog_text($row['avgTime'] ?? '', 64),
        'price_label' => kareta_service_catalog_text($row['priceLabel'] ?? '', 255),
        'time_label' => kareta_service_catalog_text($row['avgTime'] ?? '', 64),
        'steps_json' => json_encode($steps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]',
        'variants_json' => json_encode($variants, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]',
        'sort' => max(0, (int)($row['sort'] ?? 0)),
        'active' => !array_key_exists('active', $row) || (bool)$row['active'] ? 1 : 0,
        'source_key' => kareta_service_catalog_text($sourceMeta['key'] ?? 'external', 64),
        'source_hash' => kareta_service_catalog_text($row['sourceHash'] ?? '', 64),
        'source_updated_at' => kareta_service_catalog_text($sourceMeta['effectiveDate'] ?? '', 32),
    ];
    if ($normalized['id'] === '' || $normalized['name'] === '') throw new RuntimeException('service_catalog_required_fields_missing');
    if ($normalized['source_hash'] === '') {
        $normalized['source_hash'] = hash('sha256', json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    return $normalized;
}

function kareta_service_catalog_column_exists(PDO $pdo, string $table, string $column): bool
{
    $st = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $st->execute([$table, $column]);
    return (int)$st->fetchColumn() > 0;
}

function kareta_service_catalog_ensure_legacy_columns(PDO $pdo): void
{
    $columns = [
        'short_desc' => "ALTER TABLE `services` ADD COLUMN `short_desc` TEXT NULL AFTER `cat`",
        'why_text' => "ALTER TABLE `services` ADD COLUMN `why_text` TEXT NULL AFTER `short_desc`",
        'price_label' => "ALTER TABLE `services` ADD COLUMN `price_label` VARCHAR(255) NOT NULL DEFAULT '' AFTER `avg_time`",
        'time_label' => "ALTER TABLE `services` ADD COLUMN `time_label` VARCHAR(64) NOT NULL DEFAULT '' AFTER `price_label`",
        'steps_json' => "ALTER TABLE `services` ADD COLUMN `steps_json` TEXT NULL AFTER `time_label`",
        'list_json' => "ALTER TABLE `services` ADD COLUMN `list_json` TEXT NULL AFTER `steps_json`",
    ];
    foreach ($columns as $column => $sql) {
        if (!kareta_service_catalog_column_exists($pdo, 'services', $column)) $pdo->exec($sql);
    }
}

function kareta_service_catalog_ensure_schema(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS `service_categories` (
        `category_key` VARCHAR(64) NOT NULL PRIMARY KEY,
        `name` VARCHAR(191) NOT NULL DEFAULT '',
        `icon` VARCHAR(16) NOT NULL DEFAULT '',
        `sort` INT NOT NULL DEFAULT 0,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `source_key` VARCHAR(64) NOT NULL DEFAULT '',
        `source_hash` CHAR(64) NOT NULL DEFAULT '',
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_service_categories_active` (`active`,`sort`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `service_catalog` (
        `id` VARCHAR(64) NOT NULL PRIMARY KEY,
        `category_key` VARCHAR(64) NOT NULL DEFAULT 'other',
        `icon` VARCHAR(16) NOT NULL DEFAULT '',
        `name` VARCHAR(191) NOT NULL DEFAULT '',
        `short_desc` TEXT NULL,
        `why_text` TEXT NULL,
        `base_price` INT UNSIGNED NOT NULL DEFAULT 0,
        `avg_time` VARCHAR(64) NOT NULL DEFAULT '',
        `price_label` VARCHAR(255) NOT NULL DEFAULT '',
        `time_label` VARCHAR(64) NOT NULL DEFAULT '',
        `steps_json` TEXT NULL,
        `variants_json` TEXT NULL,
        `sort` INT NOT NULL DEFAULT 0,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `manual_override` TINYINT(1) NOT NULL DEFAULT 0,
        `source_key` VARCHAR(64) NOT NULL DEFAULT '',
        `source_hash` CHAR(64) NOT NULL DEFAULT '',
        `source_updated_at` DATE NULL,
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY `idx_service_catalog_category` (`category_key`,`active`,`sort`),
        KEY `idx_service_catalog_source` (`source_key`,`active`),
        KEY `idx_service_catalog_name` (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `service_offers` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        `service_id` VARCHAR(64) NOT NULL,
        `owner_type` VARCHAR(24) NOT NULL DEFAULT 'platform',
        `owner_user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        `owner_entity_id` VARCHAR(64) NOT NULL DEFAULT '',
        `city` VARCHAR(120) NOT NULL DEFAULT '',
        `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `price_type` VARCHAR(24) NOT NULL DEFAULT 'fixed',
        `price_max` DECIMAL(12,2) NOT NULL DEFAULT 0,
        `duration_min` INT UNSIGNED NOT NULL DEFAULT 0,
        `duration_max_min` INT UNSIGNED NOT NULL DEFAULT 0,
        `warranty_days` INT UNSIGNED NOT NULL DEFAULT 0,
        `availability_status` VARCHAR(24) NOT NULL DEFAULT 'available',
        `booking_enabled` TINYINT(1) NOT NULL DEFAULT 1,
        `notes` VARCHAR(500) NOT NULL DEFAULT '',
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `moderation_status` VARCHAR(24) NOT NULL DEFAULT 'approved',
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `uq_service_offer_owner` (`service_id`,`owner_type`,`owner_user_id`,`owner_entity_id`),
        KEY `idx_service_offer_lookup` (`service_id`,`active`,`moderation_status`,`city`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $offerColumns = [
        'price_type' => "ALTER TABLE `service_offers` ADD COLUMN `price_type` VARCHAR(24) NOT NULL DEFAULT 'fixed' AFTER `price`",
        'price_max' => "ALTER TABLE `service_offers` ADD COLUMN `price_max` DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER `price_type`",
        'duration_max_min' => "ALTER TABLE `service_offers` ADD COLUMN `duration_max_min` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `duration_min`",
        'availability_status' => "ALTER TABLE `service_offers` ADD COLUMN `availability_status` VARCHAR(24) NOT NULL DEFAULT 'available' AFTER `warranty_days`",
        'booking_enabled' => "ALTER TABLE `service_offers` ADD COLUMN `booking_enabled` TINYINT(1) NOT NULL DEFAULT 1 AFTER `availability_status`",
        'notes' => "ALTER TABLE `service_offers` ADD COLUMN `notes` VARCHAR(500) NOT NULL DEFAULT '' AFTER `booking_enabled`",
    ];
    foreach ($offerColumns as $column => $sql) {
        if (!kareta_service_catalog_column_exists($pdo, 'service_offers', $column)) $pdo->exec($sql);
    }

    kareta_service_catalog_ensure_legacy_columns($pdo);
}

function kareta_service_catalog_sync_legacy(PDO $pdo): void
{
    kareta_service_catalog_ensure_legacy_columns($pdo);
    $pdo->exec("INSERT INTO `services` (`id`,`icon`,`name`,`cat`,`short_desc`,`why_text`,`base_price`,`avg_time`,`price_label`,`time_label`,`steps_json`,`list_json`,`sort`,`active`)
        SELECT `id`,`icon`,`name`,`category_key`,`short_desc`,`why_text`,`base_price`,`avg_time`,`price_label`,`time_label`,`steps_json`,`variants_json`,`sort`,`active`
        FROM `service_catalog`
        ON DUPLICATE KEY UPDATE
            `icon`=VALUES(`icon`),`name`=VALUES(`name`),`cat`=VALUES(`cat`),`short_desc`=VALUES(`short_desc`),`why_text`=VALUES(`why_text`),
            `base_price`=VALUES(`base_price`),`avg_time`=VALUES(`avg_time`),`price_label`=VALUES(`price_label`),`time_label`=VALUES(`time_label`),
            `steps_json`=VALUES(`steps_json`),`list_json`=VALUES(`list_json`),`sort`=VALUES(`sort`),`active`=VALUES(`active`)");
}

function kareta_service_catalog_import(PDO $pdo): array
{
    kareta_service_catalog_ensure_schema($pdo);
    $source = kareta_service_catalog_load_source();
    $meta = is_array($source['source'] ?? null) ? $source['source'] : [];
    $expectedServices = count(is_array($source['services'] ?? null) ? $source['services'] : []);
    $expectedCategories = count(is_array($source['categories'] ?? null) ? $source['categories'] : []);
    $sourceKey = kareta_service_catalog_text($meta['key'] ?? 'external', 64);
    $ownTransaction = !$pdo->inTransaction();
    if ($ownTransaction) $pdo->beginTransaction();

    try {
        $categoryUpsert = $pdo->prepare("INSERT INTO `service_categories` (`category_key`,`name`,`icon`,`sort`,`active`,`source_key`,`source_hash`)
            VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
            `name`=VALUES(`name`),`icon`=VALUES(`icon`),`sort`=VALUES(`sort`),`active`=VALUES(`active`),`source_key`=VALUES(`source_key`),`source_hash`=VALUES(`source_hash`)");
        foreach (is_array($source['categories'] ?? null) ? $source['categories'] : [] as $category) {
            if (!is_array($category)) continue;
            $key = kareta_service_catalog_text($category['key'] ?? '', 64);
            if ($key === '') continue;
            $hash = hash('sha256', json_encode(kareta_service_catalog_canonicalize($category), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            $categoryUpsert->execute([$key, kareta_service_catalog_text($category['name'] ?? $key, 191), kareta_service_catalog_text($category['icon'] ?? '', 16), (int)($category['sort'] ?? 0), !empty($category['active']) ? 1 : 0, $sourceKey, $hash]);
        }

        $upsert = $pdo->prepare("INSERT INTO `service_catalog`
            (`id`,`category_key`,`icon`,`name`,`short_desc`,`why_text`,`base_price`,`avg_time`,`price_label`,`time_label`,`steps_json`,`variants_json`,`sort`,`active`,`manual_override`,`source_key`,`source_hash`,`source_updated_at`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,NULLIF(?,''))
            ON DUPLICATE KEY UPDATE
              `category_key`=IF(`manual_override`=1,`category_key`,VALUES(`category_key`)),
              `icon`=IF(`manual_override`=1,`icon`,VALUES(`icon`)),
              `name`=IF(`manual_override`=1,`name`,VALUES(`name`)),
              `short_desc`=IF(`manual_override`=1,`short_desc`,VALUES(`short_desc`)),
              `why_text`=IF(`manual_override`=1,`why_text`,VALUES(`why_text`)),
              `base_price`=IF(`manual_override`=1,`base_price`,VALUES(`base_price`)),
              `avg_time`=IF(`manual_override`=1,`avg_time`,VALUES(`avg_time`)),
              `price_label`=IF(`manual_override`=1,`price_label`,VALUES(`price_label`)),
              `time_label`=IF(`manual_override`=1,`time_label`,VALUES(`time_label`)),
              `steps_json`=IF(`manual_override`=1,`steps_json`,VALUES(`steps_json`)),
              `variants_json`=IF(`manual_override`=1,`variants_json`,VALUES(`variants_json`)),
              `sort`=IF(`manual_override`=1,`sort`,VALUES(`sort`)),
              `active`=IF(`manual_override`=1,`active`,VALUES(`active`)),
              `source_key`=VALUES(`source_key`),`source_hash`=VALUES(`source_hash`),`source_updated_at`=VALUES(`source_updated_at`)");

        $seen = [];
        foreach ($source['services'] as $raw) {
            $row = kareta_service_catalog_normalize_service($raw, $meta);
            $seen[] = $row['id'];
            $upsert->execute(array_values($row));
        }

        if ($seen) {
            $placeholders = implode(',', array_fill(0, count($seen), '?'));
            $archive = $pdo->prepare("UPDATE `service_catalog` SET `active`=0 WHERE `source_key`=? AND `manual_override`=0 AND `id` NOT IN ($placeholders)");
            $archive->execute(array_merge([$sourceKey], $seen));
        }

        $pdo->exec("INSERT INTO `service_offers` (`service_id`,`owner_type`,`owner_user_id`,`owner_entity_id`,`price`,`duration_min`,`warranty_days`,`availability_status`,`booking_enabled`,`notes`,`active`,`moderation_status`)
            SELECT `id`,'platform',0,'',`base_price`,0,0,'available',1,'',`active`,'approved' FROM `service_catalog`
            ON DUPLICATE KEY UPDATE `price`=VALUES(`price`),`active`=VALUES(`active`),`booking_enabled`=VALUES(`booking_enabled`),`moderation_status`='approved',`updated_at`=CURRENT_TIMESTAMP");

        kareta_service_catalog_sync_legacy($pdo);
        // Detect partial imports before committing: the canonical source must be represented in full.
        $storedServices = (int)($pdo->query("SELECT COUNT(*) FROM `service_catalog` WHERE `source_key`=" . $pdo->quote($sourceKey))->fetchColumn() ?: 0);
        $storedCategories = (int)($pdo->query("SELECT COUNT(*) FROM `service_categories` WHERE `source_key`=" . $pdo->quote($sourceKey))->fetchColumn() ?: 0);
        if ($storedServices < $expectedServices || $storedCategories < $expectedCategories) {
            throw new RuntimeException('service_catalog_partial_imports');
        }
        if ($ownTransaction) $pdo->commit();
        return ['sourceKey'=>$sourceKey,'imported'=>count($seen),'categories'=>count($source['categories'] ?? []),'expectedServices'=>$expectedServices,'expectedCategories'=>$expectedCategories,'checksum'=>(string)($meta['sha256'] ?? '')];
    } catch (Throwable $e) {
        if ($ownTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

function kareta_service_catalog_ensure_available(PDO $pdo): void
{
    kareta_service_catalog_ensure_schema($pdo);
    $source = kareta_service_catalog_load_source();
    $expectedServices = count(is_array($source['services'] ?? null) ? $source['services'] : []);
    $expectedCategories = count(is_array($source['categories'] ?? null) ? $source['categories'] : []);
    $totalCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_catalog`")->fetchColumn() ?: 0);
    $categoryCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_categories`")->fetchColumn() ?: 0);
    $activeCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_catalog` WHERE `active`=1")->fetchColumn() ?: 0);
    $activeCategoryCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_categories` WHERE `active`=1")->fetchColumn() ?: 0);

    // Таблица могла быть создана старой миграцией, но остаться пустой либо содержать
    // только неактивные строки. В таком состоянии наличие таблицы не означает,
    // что каталог действительно доступен.
    if ($totalCount < $expectedServices || $categoryCount < $expectedCategories || $activeCount === 0 || $activeCategoryCount === 0) {
        kareta_service_catalog_import($pdo);
        $activeCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_catalog` WHERE `active`=1")->fetchColumn() ?: 0);
        $activeCategoryCount = (int)($pdo->query("SELECT COUNT(*) FROM `service_categories` WHERE `active`=1")->fetchColumn() ?: 0);
        if ($activeCount === 0 || $activeCategoryCount === 0) {
            throw new RuntimeException('service_catalog_active_rows_missing');
        }
    }

    $legacyCount = (int)($pdo->query("SELECT COUNT(*) FROM `services` WHERE `active`=1")->fetchColumn() ?: 0);
    if ($legacyCount === 0) kareta_service_catalog_sync_legacy($pdo);
}

function kareta_service_catalog_legacy_rows(): array
{
    $source = kareta_service_catalog_load_source();
    $meta = is_array($source['source'] ?? null) ? $source['source'] : [];
    $rows = [];
    foreach ($source['services'] as $raw) {
        $row = kareta_service_catalog_normalize_service($raw, $meta);
        $rows[] = [
            'id'=>$row['id'],'icon'=>$row['icon'],'name'=>$row['name'],'cat'=>$row['category_key'],
            'short_desc'=>$row['short_desc'],'why_text'=>$row['why_text'],'base_price'=>$row['base_price'],
            'avg_time'=>$row['avg_time'],'price_label'=>$row['price_label'],'time_label'=>$row['time_label'],
            'steps'=>json_decode($row['steps_json'], true) ?: [],'list'=>json_decode($row['variants_json'], true) ?: [],
            'sort'=>$row['sort'],'active'=>$row['active'],
        ];
    }
    return $rows;
}

function kareta_service_catalog_save_manual(PDO $pdo, array $service, string $id): void
{
    kareta_service_catalog_ensure_schema($pdo);
    $steps = is_array($service['steps'] ?? null) ? $service['steps'] : [];
    $variants = is_array($service['list'] ?? null) ? $service['list'] : [];
    $category = kareta_service_catalog_text($service['cat'] ?? $service['category'] ?? 'other', 64) ?: 'other';
    $pdo->prepare("INSERT INTO `service_categories` (`category_key`,`name`,`icon`,`sort`,`active`,`source_key`,`source_hash`) VALUES (?,?,?,?,1,'manual','') ON DUPLICATE KEY UPDATE `active`=1")
        ->execute([$category, $category, kareta_service_catalog_text($service['icon'] ?? '⚙', 16), (int)($service['sort'] ?? 0)]);
    $pdo->prepare("INSERT INTO `service_catalog`
        (`id`,`category_key`,`icon`,`name`,`short_desc`,`why_text`,`base_price`,`avg_time`,`price_label`,`time_label`,`steps_json`,`variants_json`,`sort`,`active`,`manual_override`,`source_key`,`source_hash`)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'manual','')
        ON DUPLICATE KEY UPDATE `category_key`=VALUES(`category_key`),`icon`=VALUES(`icon`),`name`=VALUES(`name`),`short_desc`=VALUES(`short_desc`),`why_text`=VALUES(`why_text`),`base_price`=VALUES(`base_price`),`avg_time`=VALUES(`avg_time`),`price_label`=VALUES(`price_label`),`time_label`=VALUES(`time_label`),`steps_json`=VALUES(`steps_json`),`variants_json`=VALUES(`variants_json`),`sort`=VALUES(`sort`),`active`=VALUES(`active`),`manual_override`=1")
        ->execute([
            $id,$category,kareta_service_catalog_text($service['icon'] ?? '⚙',16),kareta_service_catalog_text($service['name'] ?? '',191),
            kareta_service_catalog_text($service['shortDesc'] ?? $service['short_desc'] ?? '',1000),kareta_service_catalog_text($service['whyText'] ?? $service['why_text'] ?? '',1000),
            max(0,(int)($service['basePrice'] ?? $service['base_price'] ?? 0)),kareta_service_catalog_text($service['avgTime'] ?? $service['avg_time'] ?? '',64),
            kareta_service_catalog_text($service['priceLabel'] ?? $service['price_label'] ?? '',255),kareta_service_catalog_text($service['timeLabel'] ?? $service['time_label'] ?? '',64),
            json_encode($steps,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?: '[]',json_encode($variants,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?: '[]',
            max(0,(int)($service['sort'] ?? 0)),(int)(bool)($service['active'] ?? true),
        ]);
    kareta_service_catalog_sync_legacy($pdo);
}

function kareta_service_catalog_delete_manual(PDO $pdo, string $id): void
{
    kareta_service_catalog_ensure_schema($pdo);
    $pdo->prepare("UPDATE `service_catalog` SET `active`=0,`manual_override`=1,`updated_at`=CURRENT_TIMESTAMP WHERE `id`=?")->execute([$id]);
    $pdo->prepare("UPDATE `service_offers` SET `active`=0,`updated_at`=CURRENT_TIMESTAMP WHERE `service_id`=?")->execute([$id]);
    $pdo->prepare("UPDATE `services` SET `active`=0 WHERE `id`=?")->execute([$id]);
}


function kareta_service_offer_ensure_master_capability(PDO $pdo): void
{
    try {
        if (!function_exists('kareta_resolve_api_actor')) return;
        $actor = kareta_resolve_api_actor($pdo);
        $ctx = is_array($actor['context'] ?? null) ? $actor['context'] : [];
        $type = strtolower((string)($ctx['type'] ?? $ctx['contextType'] ?? ''));
        $profileType = strtolower((string)($ctx['profileType'] ?? $ctx['profile_type'] ?? ''));
        if (($actor['role'] ?? '') !== 'master' || $type !== 'profile' || $profileType !== 'master') return;

        $pdo->exec("INSERT INTO capability_sets(code,title,scope_type,is_system)
            VALUES('profile.master','Профессиональный профиль мастера','profile',1)
            ON DUPLICATE KEY UPDATE scope_type='profile',is_system=1");
        $setId = (int)($pdo->query("SELECT id FROM capability_sets WHERE code='profile.master' LIMIT 1")->fetchColumn() ?: 0);
        if ($setId <= 0) return;

        $st = $pdo->prepare("INSERT INTO capabilities(capability_set_id,capability_key,effect)
            VALUES(?,?,'allow') ON DUPLICATE KEY UPDATE effect='allow'");
        foreach (['services.manage','profile.read'] as $capability) $st->execute([$setId,$capability]);

        $contextId = (int)($actor['contextId'] ?? $ctx['id'] ?? 0);
        if ($contextId > 0) {
            $pdo->prepare("UPDATE contexts SET capability_set_id=? WHERE id=?")->execute([$setId,$contextId]);
            $accountId = (int)($actor['accountId'] ?? 0);
            if ($accountId > 0) {
                $pdo->prepare("UPDATE context_members SET capability_set_id=? WHERE context_id=? AND account_id=?")
                    ->execute([$setId,$contextId,$accountId]);
            }
        }
    } catch (Throwable $_) {}
}

function kareta_service_offer_actor_context(PDO $pdo): array
{
    $actor = function_exists('kareta_resolve_api_actor') ? kareta_resolve_api_actor($pdo) : (kareta_session_user() ?: []);
    if (!$actor) kareta_json(['ok'=>false,'error'=>'unauthenticated'],401);
    $role = (string)($actor['role'] ?? 'client');
    if (function_exists('kareta_master_workplace_identity_context')) {
        $identity = kareta_master_workplace_identity_context($pdo);
        $context = is_array($identity['context'] ?? null) ? $identity['context'] : [];
        $type = strtolower((string)($context['type'] ?? $context['contextType'] ?? ''));
        $profileType = strtolower((string)($context['profileType'] ?? ''));
        $organizationType = strtolower((string)($context['organizationType'] ?? ''));
        if ($type === 'profile' && $profileType === 'master') $role = 'master';
        elseif ($type === 'organization' && $organizationType !== 'parts_store') $role = 'sto';
    }
    if (!in_array($role, ['master','sto','admin','owner'], true)) {
        kareta_json(['ok'=>false,'error'=>'forbidden','needRole'=>['master','sto','admin','owner']],403);
    }

    $userId = (int)($actor['id'] ?? 0);
    $phone = kareta_normalize_phone((string)($actor['phone'] ?? ''));
    $entityId = '';
    $city = (string)($actor['city'] ?? '');
    $label = (string)($actor['name'] ?? '');
    $ownerType = $role;

    if ($role === 'master') {
        $row = [];
        // Resolve the concrete profile selected in Identity, not just the first
        // master row attached to this phone/account.
        if (function_exists('kareta_master_workplace_profile')) {
            $row = kareta_master_workplace_profile($pdo);
        }
        if (!$row) {
            if ($phone !== '') kareta_sync_user_entity($pdo, $phone);
            if ($userId > 0) {
                $st = $pdo->prepare("SELECT id,COALESCE(city,'') AS city,COALESCE(name,'') AS name FROM `masters` WHERE user_id=? LIMIT 1");
                $st->execute([$userId]);
                $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
            }
            if (!$row && $phone !== '') {
                $st = $pdo->prepare("SELECT id,COALESCE(city,'') AS city,COALESCE(name,'') AS name FROM `masters` WHERE user_phone=? OR phone=? LIMIT 1");
                $st->execute([$phone,$phone]);
                $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
                if ($row && $userId > 0) {
                    $pdo->prepare("UPDATE `masters` SET user_id=?,user_phone=? WHERE id=?")->execute([$userId,$phone,(string)$row['id']]);
                }
            }
        }
        $entityId = (string)($row['id'] ?? '');
        $city = (string)($row['city'] ?? $city);
        $label = (string)($row['name'] ?? $label);
    } elseif ($role === 'sto') {
        if ($phone !== '') kareta_sync_user_entity($pdo, $phone);
        $row = [];
        if ($userId > 0) {
            $st = $pdo->prepare("SELECT id,COALESCE(city,'') AS city,COALESCE(name,'') AS name FROM `sto_profiles` WHERE user_id=? LIMIT 1");
            $st->execute([$userId]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
        }
        if (!$row && $phone !== '') {
            $st = $pdo->prepare("SELECT id,COALESCE(city,'') AS city,COALESCE(name,'') AS name FROM `sto_profiles` WHERE user_phone=? OR contact_phone=? LIMIT 1");
            $st->execute([$phone,$phone]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: [];
            if ($row && $userId > 0) {
                $pdo->prepare("UPDATE `sto_profiles` SET user_id=?,user_phone=? WHERE id=?")->execute([$userId,$phone,(string)$row['id']]);
            }
        }
        $entityId = (string)($row['id'] ?? '');
        $city = (string)($row['city'] ?? $city);
        $label = (string)($row['name'] ?? $label);
    } else {
        $ownerType = 'platform';
        $entityId = '';
        $label = $label !== '' ? $label : 'KARETA.KZ';
    }

    if ($role === 'master' || $role === 'sto') {
        if ($userId <= 0 || $entityId === '') {
            kareta_json(['ok'=>false,'error'=>'role_profile_missing','role'=>$role],409);
        }
    }

    return [
        'role'=>$role,
        'ownerType'=>$ownerType,
        'ownerUserId'=>$ownerType === 'platform' ? 0 : $userId,
        'ownerEntityId'=>$entityId,
        'city'=>$city,
        'label'=>$label,
    ];
}

function kareta_service_offer_normalize_row(array $row): array
{
    return [
        'id'=>(int)($row['id'] ?? 0),
        'serviceId'=>(string)($row['service_id'] ?? $row['serviceId'] ?? ''),
        'ownerType'=>(string)($row['owner_type'] ?? $row['ownerType'] ?? ''),
        'ownerUserId'=>(int)($row['owner_user_id'] ?? $row['ownerUserId'] ?? 0),
        'ownerEntityId'=>(string)($row['owner_entity_id'] ?? $row['ownerEntityId'] ?? ''),
        'ownerName'=>(string)($row['owner_name'] ?? $row['ownerName'] ?? ''),
        'city'=>(string)($row['city'] ?? ''),
        'price'=>(float)($row['price'] ?? 0),
        'priceType'=>(string)($row['price_type'] ?? $row['priceType'] ?? 'fixed'),
        'priceMax'=>(float)($row['price_max'] ?? $row['priceMax'] ?? 0),
        'durationMin'=>(int)($row['duration_min'] ?? $row['durationMin'] ?? 0),
        'durationMaxMin'=>(int)($row['duration_max_min'] ?? $row['durationMaxMin'] ?? 0),
        'warrantyDays'=>(int)($row['warranty_days'] ?? $row['warrantyDays'] ?? 0),
        'availabilityStatus'=>(string)($row['availability_status'] ?? $row['availabilityStatus'] ?? 'available'),
        'bookingEnabled'=>(bool)($row['booking_enabled'] ?? $row['bookingEnabled'] ?? 1),
        'notes'=>(string)($row['notes'] ?? ''),
        'active'=>(bool)($row['active'] ?? 1),
        'moderationStatus'=>(string)($row['moderation_status'] ?? $row['moderationStatus'] ?? 'approved'),
        'updatedAt'=>$row['updated_at'] ?? $row['updatedAt'] ?? null,
    ];
}

function kareta_service_offers_mine(PDO $pdo): array
{
    kareta_service_catalog_ensure_available($pdo);
    $context = kareta_service_offer_actor_context($pdo);
    $catalog = $pdo->query("SELECT id,category_key AS category,icon,name,short_desc AS shortDesc,base_price AS basePrice,avg_time AS avgTime,sort FROM `service_catalog` WHERE active=1 ORDER BY sort,name")->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($catalog as &$row) $row['basePrice'] = (int)($row['basePrice'] ?? 0);
    unset($row);

    $st = $pdo->prepare("SELECT * FROM `service_offers` WHERE owner_type=? AND owner_user_id=? AND owner_entity_id=? AND active=1 ORDER BY updated_at DESC,id DESC");
    $st->execute([$context['ownerType'],$context['ownerUserId'],$context['ownerEntityId']]);
    $offers = array_map('kareta_service_offer_normalize_row', $st->fetchAll(PDO::FETCH_ASSOC) ?: []);

    $active = count(array_filter($offers, static fn(array $offer): bool => $offer['active'] && $offer['bookingEnabled']));
    return [
        'context'=>$context,
        'catalog'=>array_values($catalog),
        'offers'=>array_values($offers),
        'metrics'=>[
            'catalogCount'=>count($catalog),
            'configuredCount'=>count($offers),
            'activeCount'=>$active,
        ],
    ];
}

function kareta_service_offer_save(PDO $pdo, array $body): array
{
    kareta_service_catalog_ensure_available($pdo);
    $context = kareta_service_offer_actor_context($pdo);
    $offer = is_array($body['offer'] ?? null) ? $body['offer'] : $body;
    $serviceId = kareta_service_catalog_text($offer['serviceId'] ?? $offer['service_id'] ?? '', 64);
    if ($serviceId === '') kareta_json(['ok'=>false,'error'=>'service_id_required'],422);
    $check = $pdo->prepare("SELECT id FROM `service_catalog` WHERE id=? AND active=1 LIMIT 1");
    $check->execute([$serviceId]);
    if (!$check->fetchColumn()) kareta_json(['ok'=>false,'error'=>'service_not_found'],404);

    $priceType = kareta_service_catalog_text($offer['priceType'] ?? $offer['price_type'] ?? 'fixed', 24);
    if (!in_array($priceType, ['fixed','from','range','agreement'], true)) $priceType = 'fixed';
    $price = max(0, min(999999999, (float)($offer['price'] ?? 0)));
    $priceMax = max(0, min(999999999, (float)($offer['priceMax'] ?? $offer['price_max'] ?? 0)));
    if ($priceType === 'agreement') { $price = 0; $priceMax = 0; }
    elseif ($priceType !== 'range') $priceMax = 0;
    elseif ($priceMax > 0 && $priceMax < $price) $priceMax = $price;
    $duration = max(0, min(10080, (int)($offer['durationMin'] ?? $offer['duration_min'] ?? 0)));
    $durationMax = max(0, min(10080, (int)($offer['durationMaxMin'] ?? $offer['duration_max_min'] ?? 0)));
    if ($durationMax > 0 && $durationMax < $duration) $durationMax = $duration;
    $warranty = max(0, min(3650, (int)($offer['warrantyDays'] ?? $offer['warranty_days'] ?? 0)));
    $availability = kareta_service_catalog_text($offer['availabilityStatus'] ?? $offer['availability_status'] ?? 'available', 24);
    if (!in_array($availability, ['available','busy','paused'], true)) $availability = 'available';
    $city = kareta_service_catalog_text($offer['city'] ?? $context['city'], 120);
    $notes = kareta_service_catalog_text($offer['notes'] ?? '', 500);
    $bookingEnabled = !array_key_exists('bookingEnabled', $offer) || (bool)$offer['bookingEnabled'] ? 1 : 0;
    $active = !array_key_exists('active', $offer) || (bool)$offer['active'] ? 1 : 0;
    $moderation = 'approved';

    $sql = "INSERT INTO `service_offers`
        (`service_id`,`owner_type`,`owner_user_id`,`owner_entity_id`,`city`,`price`,`price_type`,`price_max`,`duration_min`,`duration_max_min`,`warranty_days`,`availability_status`,`booking_enabled`,`notes`,`active`,`moderation_status`)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE `city`=VALUES(`city`),`price`=VALUES(`price`),`price_type`=VALUES(`price_type`),`price_max`=VALUES(`price_max`),`duration_min`=VALUES(`duration_min`),`duration_max_min`=VALUES(`duration_max_min`),`warranty_days`=VALUES(`warranty_days`),`availability_status`=VALUES(`availability_status`),`booking_enabled`=VALUES(`booking_enabled`),`notes`=VALUES(`notes`),`active`=VALUES(`active`),`moderation_status`=VALUES(`moderation_status`),`updated_at`=CURRENT_TIMESTAMP";
    $pdo->prepare($sql)->execute([
        $serviceId,$context['ownerType'],$context['ownerUserId'],$context['ownerEntityId'],$city,$price,$priceType,$priceMax,$duration,$durationMax,$warranty,$availability,$bookingEnabled,$notes,$active,$moderation,
    ]);

    $st = $pdo->prepare("SELECT * FROM `service_offers` WHERE service_id=? AND owner_type=? AND owner_user_id=? AND owner_entity_id=? LIMIT 1");
    $st->execute([$serviceId,$context['ownerType'],$context['ownerUserId'],$context['ownerEntityId']]);
    $saved = kareta_service_offer_normalize_row($st->fetch(PDO::FETCH_ASSOC) ?: []);
    kareta_log_audit($pdo, 'serviceOffers.save', ['serviceId'=>$serviceId,'ownerType'=>$context['ownerType'],'ownerEntityId'=>$context['ownerEntityId'],'price'=>$price,'priceType'=>$priceType]);
    return $saved;
}

function kareta_service_offer_delete(PDO $pdo, array $body): array
{
    $context = kareta_service_offer_actor_context($pdo);
    $serviceId = kareta_service_catalog_text($body['serviceId'] ?? $body['service_id'] ?? '', 64);
    if ($serviceId === '') kareta_json(['ok'=>false,'error'=>'service_id_required'],422);
    $st = $pdo->prepare("UPDATE `service_offers` SET active=0,booking_enabled=0,availability_status='paused',updated_at=CURRENT_TIMESTAMP WHERE service_id=? AND owner_type=? AND owner_user_id=? AND owner_entity_id=?");
    $st->execute([$serviceId,$context['ownerType'],$context['ownerUserId'],$context['ownerEntityId']]);
    if ($st->rowCount() === 0) kareta_json(['ok'=>false,'error'=>'service_offer_not_found'],404);
    kareta_log_audit($pdo, 'serviceOffers.delete', ['serviceId'=>$serviceId,'ownerType'=>$context['ownerType'],'ownerEntityId'=>$context['ownerEntityId']]);
    return ['serviceId'=>$serviceId,'deleted'=>true];
}

function kareta_service_offers_public(PDO $pdo): array
{
    kareta_service_catalog_ensure_schema($pdo);
    $sql = "SELECT so.*, CASE
        WHEN so.owner_type='master' THEN COALESCE(NULLIF(m.name,''),'Мастер')
        WHEN so.owner_type='sto' THEN COALESCE(NULLIF(sp.name,''),'СТО')
        ELSE 'KARETA.KZ' END AS owner_name
        FROM `service_offers` so
        LEFT JOIN `masters` m ON so.owner_type='master' AND m.id=so.owner_entity_id
        LEFT JOIN `sto_profiles` sp ON so.owner_type='sto' AND sp.id=so.owner_entity_id
        WHERE so.active=1 AND so.booking_enabled=1 AND so.moderation_status='approved' AND so.availability_status<>'paused'
        ORDER BY so.service_id,CASE WHEN so.price_type='agreement' THEN 1 ELSE 0 END,so.price,so.updated_at DESC";
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    return array_map(static function(array $row): array {
        $offer = kareta_service_offer_normalize_row($row);
        return [
            'id'=>$offer['id'],
            'serviceId'=>$offer['serviceId'],
            'ownerType'=>$offer['ownerType'],
            'ownerEntityId'=>$offer['ownerEntityId'],
            'ownerName'=>$offer['ownerName'],
            'city'=>$offer['city'],
            'price'=>$offer['price'],
            'priceType'=>$offer['priceType'],
            'priceMax'=>$offer['priceMax'],
            'durationMin'=>$offer['durationMin'],
            'durationMaxMin'=>$offer['durationMaxMin'],
            'warrantyDays'=>$offer['warrantyDays'],
            'availabilityStatus'=>$offer['availabilityStatus'],
            'notes'=>$offer['notes'],
        ];
    }, $rows);
}

/**
 * Независимая публичная выдача каталога услуг.
 * Не зависит от полной выгрузки db_pull: при проблемах других таблиц
 * услуги и категории всё равно возвращаются из проверенного JSON-источника.
 */
function kareta_service_catalog_public_payload(?PDO $pdo): array
{
    $services = [];
    $categories = [];
    $source = 'json';

    if ($pdo instanceof PDO) {
        try {
            kareta_service_catalog_ensure_available($pdo);
            $services = $pdo->query("SELECT id,icon,name,category_key AS cat,base_price AS basePrice,avg_time AS avgTime,price_label AS priceLabel,time_label AS timeLabel,short_desc AS shortDesc,why_text AS whyText,steps_json AS stepsJson,variants_json AS listJson,sort,active FROM `service_catalog` WHERE active=1 ORDER BY sort,name")
                ->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $categories = $pdo->query("SELECT category_key AS `key`,name,icon,sort,active FROM `service_categories` WHERE active=1 ORDER BY sort,name")
                ->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if ($services && $categories) $source = 'mysql';
        } catch (Throwable $e) {
            if (function_exists('kareta_log_error')) kareta_log_error('SERVICE_CATALOG_PUBLIC', $e->getMessage());
            $services = [];
            $categories = [];
        }
    }

    if (!$services || !$categories) {
        $raw = kareta_service_catalog_load_source();
        $services = kareta_service_catalog_legacy_rows();
        $categories = [];
        foreach (is_array($raw['categories'] ?? null) ? $raw['categories'] : [] as $category) {
            if (!is_array($category) || empty($category['active'])) continue;
            $categories[] = [
                'key'=>(string)($category['key'] ?? 'other'),
                'name'=>(string)($category['name'] ?? 'Другое'),
                'icon'=>(string)($category['icon'] ?? '🔧'),
                'sort'=>(int)($category['sort'] ?? 0),
                'active'=>true,
            ];
        }
        $source = 'json';
    }

    foreach ($services as &$service) {
        $service['basePrice'] = (int)($service['basePrice'] ?? $service['base_price'] ?? 0);
        $service['active'] = !isset($service['active']) || (bool)$service['active'];
        if (isset($service['stepsJson'])) {
            $service['steps'] = json_decode((string)$service['stepsJson'], true) ?: [];
            unset($service['stepsJson']);
        }
        if (isset($service['listJson'])) {
            $service['list'] = json_decode((string)$service['listJson'], true) ?: [];
            unset($service['listJson']);
        }
        $service['offerCount'] = (int)($service['offerCount'] ?? 0);
        $service['minOfferPrice'] = (float)($service['minOfferPrice'] ?? 0);
        $service['offerOwners'] = is_array($service['offerOwners'] ?? null) ? $service['offerOwners'] : [];
    }
    unset($service);

    return [
        'services'=>array_values($services),
        'serviceCategories'=>array_values($categories),
        'meta'=>[
            'source'=>$source,
            'services'=>count($services),
            'categories'=>count($categories),
            'fetchedAt'=>date(DATE_ATOM),
        ],
    ];
}
