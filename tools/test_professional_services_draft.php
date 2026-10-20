<?php
declare(strict_types=1);

/**
 * Read-only preflight for candidate professional service descriptions.
 * No database, API, deployment, pricing, or publication side effects.
 */
require_once dirname(__DIR__) . '/api/catalog/service_catalog.php';
require_once dirname(__DIR__) . '/api/master_service_advisories.php';

function check_professional(bool $ok, string $reason): void {
    if (!$ok) throw new RuntimeException('FAIL: ' . $reason);
}
function load_professional_json(string $filename): array {
    $path = dirname(__DIR__) . '/storage/catalog/' . $filename;
    $result = json_decode((string)file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    check_professional(is_array($result), 'invalid file ' . $filename);
    return $result;
}
try {
    $published = kareta_service_catalog_load_source();
    $advisories = kmob_service_advisory_catalog();
    $professions = load_professional_json('master_professions.json');
    $equipment = load_professional_json('master_equipment.json');
    $draft = load_professional_json('professional_services_draft.json');

    check_professional(count($published['services']) === 109, 'published catalog baseline changed');
    check_professional(count($advisories['items']) === 109, 'old advisory baseline changed');
    check_professional(($draft['status'] ?? '') === 'DRAFT_ONLY_NOT_IMPORTED', 'draft status');
    check_professional(($draft['published'] ?? null) === false, 'publishing forbidden');
    check_professional(($draft['matchingEnabled'] ?? null) === false, 'matching forbidden');
    check_professional(($draft['technicalRelationsVerified'] ?? null) === false, 'expert verification not done');
    check_professional(($draft['priceIsIndicative'] ?? null) === false, 'no invented prices');
    check_professional(count($draft['items'] ?? []) >= 100, 'insufficient draft candidates');

    $validCategories = array_fill_keys(array_column($published['categories'], 'key'), true);
    $validProfessions = array_fill_keys(array_column($professions['items'], 'id'), true);
    $validEquipment = array_fill_keys(array_column($equipment['items'], 'id'), true);
    $existingIds = array_fill_keys(array_column($published['services'], 'id'), true);
    $existingNames = [];
    foreach ($published['services'] as $row) {
        $existingNames[$row['category'] . '/' . mb_strtolower(trim($row['name']))] = true;
    }
    $candidateIds = $candidateNames = $coverage = $professionCoverage = [];
    foreach ($draft['items'] as $index => $row) {
        $id = (string)($row['serviceId'] ?? '');
        $name = trim((string)($row['nameRu'] ?? ''));
        $cat = (string)($row['categoryKey'] ?? '');
        check_professional((bool)preg_match('/^pro_[a-z0-9_]{4,60}$/D', $id), "invalid service ID {$index}");
        check_professional(!isset($existingIds[$id]) && !isset($candidateIds[$id]), "duplicate ID {$id}");
        check_professional(strlen($id) <= 32, "legacy services.id field overflow {$id}");
        $candidateIds[$id] = true;
        check_professional(isset($validCategories[$cat]), "unknown category {$id}");
        check_professional(mb_strlen($name) >= 8 && mb_strlen($name) <= 191, "invalid title {$id}");
        $nameKey = $cat . '/' . mb_strtolower($name);
        check_professional(!isset($existingNames[$nameKey]) && !isset($candidateNames[$nameKey]), "duplicate title {$name}");
        $candidateNames[$nameKey] = true;
        check_professional(($row['status'] ?? '') === 'DRAFT_ONLY', "incorrect status {$id}");
        check_professional(($row['availableForBooking'] ?? null) === false, "booking enabled {$id}");
        check_professional(($row['autoEnableForMasters'] ?? null) === false, "auto enable {$id}");
        check_professional(($row['hardEquipmentFilter'] ?? null) === false, "hard equipment restriction {$id}");
        check_professional(array_key_exists('basePrice', $row) && $row['basePrice'] === null, "unverified price {$id}");
        check_professional(in_array($row['serviceKind'] ?? null, ['diagnostics','repair','installation','maintenance'], true), "kind {$id}");
        check_professional(is_array($row['professionIds'] ?? null) && count($row['professionIds']) > 0, "missing professions {$id}");
        check_professional(count($row['professionIds']) === count(array_unique($row['professionIds'])), "repeated professions {$id}");
        foreach ($row['professionIds'] as $prof) {check_professional(isset($validProfessions[$prof]), "unknown profession {$prof} in {$id}");$professionCoverage[$prof] = true;}
        check_professional(is_array($row['suggestedEquipmentIds'] ?? null), "missing suggested equipment {$id}");
        foreach ($row['suggestedEquipmentIds'] as $eq) check_professional(isset($validEquipment[$eq]), "unknown equipment {$eq} in {$id}");
        check_professional(is_array($row['aliasesRu'] ?? null), "missing aliases {$id}");
        $coverage[$cat] = ($coverage[$cat] ?? 0) + 1;
    }
    check_professional(count($coverage) === count($validCategories), 'not all existing categories covered');
    check_professional(count($professionCoverage) === count($validProfessions), 'not all existing professions covered');
    ksort($coverage);
    echo "PASS: published 109 + candidate " . count($candidateIds) . "; categories " . count($coverage)
        . "; professions verified; equipment IDs verified; no duplicate names/IDs\n";
    echo "PASS: no database writes; no new prices; no booking; no service auto-enablement; no matching changes\n";
    foreach ($coverage as $category => $count) echo "{$category}: {$count}\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
