<?php
declare(strict_types=1);

/**
 * Offline behavioural regression for the existing public shop address SQL.
 * The production SQL fragment is exercised with an SQLite-compatible BINARY
 * comparison. No KARETA bootstrap, HTTP requests or real MySQL access.
 */
if (!extension_loaded('pdo_sqlite')) {
    fwrite(STDERR, "BLOCKED: pdo_sqlite is required for the offline privacy contract\n");
    exit(2);
}
require_once dirname(__DIR__) . '/api/seller_shop.php';

function kareta_table_exists(PDO $pdo, string $table): bool {
    $q = $pdo->prepare("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?");
    $q->execute([$table]);
    return (bool)$q->fetchColumn();
}
function assertPublic(bool $value, string $message): void {
    if (!$value) throw new RuntimeException('FAIL: ' . $message);
}
function publicPickupAddress(PDO $pdo, int $sellerId): string {
    $fragment = kareta_public_pickup_address_expr($pdo, 'sp');
    // SQLite accepts the same SELECT/WHERE but lacks MySQL's BINARY keyword.
    $fragment = preg_replace('/\bBINARY\s+/', '', $fragment);
    $fragment = str_replace(' AS CHAR', ' AS TEXT', (string)$fragment);
    $stmt = $pdo->prepare("SELECT COALESCE({$fragment}, '') FROM seller_profiles sp WHERE sp.id=?");
    $stmt->execute([$sellerId]);
    return (string)$stmt->fetchColumn();
}
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE seller_profiles (id INTEGER PRIMARY KEY, warehouse_address TEXT NOT NULL)');
$pdo->exec("INSERT INTO seller_profiles(id, warehouse_address) VALUES
    (11, 'PRIVATE_WAREHOUSE_11'), (22, 'PRIVATE_WAREHOUSE_22')");
assertPublic(publicPickupAddress($pdo, 11) === '', 'missing geo_points must not fall back to a private warehouse');

$pdo->exec('CREATE TABLE geo_points (
    id TEXT PRIMARY KEY, owner_type TEXT, owner_id TEXT, kind TEXT,
    active INTEGER, visibility TEXT, latitude REAL, longitude REAL, address TEXT
)');
assertPublic(publicPickupAddress($pdo, 11) === '', 'no published point must return a blank address');
$stmt = $pdo->prepare('INSERT INTO geo_points
    (id, owner_type, owner_id, kind, active, visibility, latitude, longitude, address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute(['g1','shop','11','warehouse',1,'exact',49.95,82.63,'PRIVATE_GEO_WAREHOUSE']);
assertPublic(publicPickupAddress($pdo, 11) === '', 'warehouse point must remain private even if erroneously marked exact');
$pdo->exec("UPDATE geo_points SET kind='pickup',visibility='hidden',address='HIDDEN_PICKUP' WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === '', 'hidden pickup must not be published');
$pdo->exec("UPDATE geo_points SET visibility='city' WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === '', 'city-only pickup must not reveal an exact address');
$pdo->exec("UPDATE geo_points SET visibility='exact',active=0 WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === '', 'inactive exact pickup must not be published');
$pdo->exec("UPDATE geo_points SET active=1,latitude=NULL WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === '', 'pickup with no latitude must not be published');
$pdo->exec("UPDATE geo_points SET latitude=49.95,longitude=NULL WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === '', 'pickup with no longitude must not be published');
$pdo->exec("UPDATE geo_points SET longitude=82.63,address='PUBLIC_PICKUP_11' WHERE id='g1'");
assertPublic(publicPickupAddress($pdo, 11) === 'PUBLIC_PICKUP_11', 'only active exact pickup is public');
assertPublic(publicPickupAddress($pdo, 22) === '', 'another seller must not see the first pickup');
$stmt->execute(['g2','shop','22','pickup',1,'exact',49.95,82.64,'PUBLIC_PICKUP_22']);
assertPublic(publicPickupAddress($pdo, 11) === 'PUBLIC_PICKUP_11', 'seller ID isolation for first pickup');
assertPublic(publicPickupAddress($pdo, 22) === 'PUBLIC_PICKUP_22', 'seller ID isolation for second pickup');

$sellerSource = (string)file_get_contents(dirname(__DIR__) . '/api/seller_shop.php');
$detailSource = (string)file_get_contents(dirname(__DIR__) . '/api/catalog_details.php');
assertPublic(substr_count($sellerSource, 'COALESCE({$pickupExpr}') >= 2, 'public storefront and search must use the pickup expression');
assertPublic(str_contains($detailSource, 'COALESCE({$pickupExpr}'), 'public product detail must use the pickup expression');
echo "GEO_PUBLIC_PICKUP_PRIVACY: PASS missing_schema, warehouse, hidden, city, inactive, missing_coords, exact, tenant_isolation, public_consumers\n";
