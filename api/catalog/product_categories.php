<?php
declare(strict_types=1);

function kareta_product_categories_source_path(): string {
    return dirname(__DIR__, 2) . '/storage/catalog/product_categories.json';
}

function kareta_product_categories_load_source(): array {
    $path = kareta_product_categories_source_path();
    if (!is_file($path)) throw new RuntimeException('product_categories_source_missing');
    $decoded = json_decode((string)file_get_contents($path), true);
    if (!is_array($decoded) || !is_array($decoded['categories'] ?? null)) {
        throw new RuntimeException('product_categories_source_invalid');
    }
    return $decoded;
}

function kareta_product_categories_ensure_schema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `product_categories` (
        `category_key` VARCHAR(64) NOT NULL,
        `name` VARCHAR(191) NOT NULL,
        `icon` VARCHAR(24) NOT NULL DEFAULT '',
        `group_key` VARCHAR(64) NOT NULL DEFAULT 'other',
        `group_name` VARCHAR(191) NOT NULL DEFAULT 'Прочее',
        `sort` INT NOT NULL DEFAULT 0,
        `active` TINYINT(1) NOT NULL DEFAULT 1,
        `source_key` VARCHAR(64) NOT NULL DEFAULT 'kareta-platform',
        `source_hash` CHAR(64) NOT NULL DEFAULT '',
        `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`category_key`),
        KEY `idx_product_categories_active_sort` (`active`,`sort`),
        KEY `idx_product_categories_group` (`group_key`,`sort`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function kareta_product_categories_import(PDO $pdo): array {
    kareta_product_categories_ensure_schema($pdo);
    $source = kareta_product_categories_load_source();
    $groups = [];
    foreach (($source['groups'] ?? []) as $group) {
        if (!is_array($group)) continue;
        $key = trim((string)($group['key'] ?? ''));
        if ($key === '') continue;
        $groups[$key] = trim((string)($group['name'] ?? $key)) ?: $key;
    }
    $sourceKey = trim((string)($source['source'] ?? 'kareta-platform')) ?: 'kareta-platform';
    $upsert = $pdo->prepare("INSERT INTO `product_categories`
        (`category_key`,`name`,`icon`,`group_key`,`group_name`,`sort`,`active`,`source_key`,`source_hash`)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE `name`=VALUES(`name`),`icon`=VALUES(`icon`),`group_key`=VALUES(`group_key`),`group_name`=VALUES(`group_name`),`sort`=VALUES(`sort`),`active`=VALUES(`active`),`source_key`=VALUES(`source_key`),`source_hash`=VALUES(`source_hash`),`updated_at`=CURRENT_TIMESTAMP");
    $seen = [];
    foreach ($source['categories'] as $category) {
        if (!is_array($category)) continue;
        $key = trim((string)($category['key'] ?? ''));
        if ($key === '') continue;
        $groupKey = trim((string)($category['group'] ?? 'other')) ?: 'other';
        $canonical = json_encode($category, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
        $upsert->execute([
            $key,
            trim((string)($category['name'] ?? $key)) ?: $key,
            trim((string)($category['icon'] ?? '')),
            $groupKey,
            $groups[$groupKey] ?? $groupKey,
            (int)($category['sort'] ?? 0),
            !empty($category['active']) ? 1 : 0,
            $sourceKey,
            hash('sha256', $canonical),
        ]);
        $seen[] = $key;
    }
    return ['count'=>count($seen), 'keys'=>$seen];
}

function kareta_product_categories_ensure_available(PDO $pdo): void {
    kareta_product_categories_ensure_schema($pdo);
    $source = kareta_product_categories_load_source();
    $expected = count(array_filter($source['categories'] ?? [], static fn($row) => is_array($row) && !empty($row['active'])));
    $count = (int)($pdo->query("SELECT COUNT(*) FROM `product_categories` WHERE `active`=1")->fetchColumn() ?: 0);
    if ($count < $expected) kareta_product_categories_import($pdo);
}

function kareta_product_categories_rows(PDO $pdo, bool $activeOnly = true): array {
    kareta_product_categories_ensure_available($pdo);
    $where = $activeOnly ? 'WHERE `active`=1' : '';
    return $pdo->query("SELECT `category_key` AS `key`,`name`,`icon`,`group_key` AS `groupKey`,`group_name` AS `groupName`,`sort`,`active` FROM `product_categories` {$where} ORDER BY `sort`,`name`")->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function kareta_product_category_is_active(PDO $pdo, string $key): bool {
    kareta_product_categories_ensure_available($pdo);
    $st = $pdo->prepare("SELECT 1 FROM `product_categories` WHERE `category_key`=? AND `active`=1 LIMIT 1");
    $st->execute([$key]);
    return (bool)$st->fetchColumn();
}
