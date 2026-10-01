/* Geo platform core static contract. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const migration=read('api/migrations/137_geo_platform_core.php');
const api=read('api/geo.php');
const manifestPhp=read('api/migration_manifest.php');
const manifestJson=JSON.parse(read('api/migration_manifest.json'));
const workflow=read('.github/workflows/application-gates.yml');

assert(migration.includes("'version' => 137"),'geo migration version mismatch');
assert(migration.includes('CREATE TABLE IF NOT EXISTS `geo_points`'),'geo_points table missing');
assert(migration.includes('UNIQUE KEY `uq_geo_owner_kind`'),'geo owner/kind uniqueness missing');
assert(migration.includes('`visibility` VARCHAR(24)'), 'visibility boundary missing');
assert(migration.includes("CASE WHEN COALESCE(m.work_mode,'shop')='mobile' THEN 'mobile_origin' ELSE 'service' END"),'master geo backfill missing');
assert(migration.includes("WHEN COALESCE(m.work_mode,'shop')='mobile' THEN 'city'"),'mobile-master privacy backfill missing');

assert(api.includes("visibility='exact'"),'public nearby must expose exact-public points only');
assert(api.includes('min(100.0'), 'nearby radius must be bounded');
assert(api.includes('min(100,'), 'nearby result limit must be bounded');
assert(api.includes('LIMIT 300'), 'nearby database scan must be bounded');
assert(api.includes("geo_context_allows_owner"),'geo ownership guard missing');
assert(api.includes("'geo_owner_forbidden'"),'negative ownership path missing');
assert(api.includes("if ($kind==='warehouse') $visibility='hidden';"),'warehouse privacy guard missing');
assert(api.includes("exact_mobile_origin_requires_explicit_consent"),'mobile origin exact-public consent guard missing');
assert(api.includes("$pdo->prepare"),'geo API must use parameterized queries');
assert(!api.includes("visibility IN ('exact','approximate')"),'approximate private coordinates must not leak through public nearby');

assert.strictEqual(manifestJson.targetDbVersion,137,'JSON migration target must be 137');
assert(manifestJson.migrations.some(x=>x.version===137&&x.file==='137_geo_platform_core.php'),'JSON manifest geo migration missing');
assert(manifestPhp.includes("137 => ['file' => '137_geo_platform_core.php'"),'PHP manifest geo migration missing');
assert(workflow.includes('node tools/test_geo_platform_core.js'),'geo core contract not wired to application gates');
assert(workflow.includes('php -l api/geo.php'),'geo endpoint syntax gate missing');

console.log('GEO_PLATFORM_CORE: PASS');
