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
const core=read('js/next/pages/core.js');
const geoCore=read('api/geo_core.php');
const bridge=read('js/mobile_native_bridge.js');
const masterOnboarding=read('api/master_onboarding.php');
const sellerApi=read('api/seller_shop.php');
const sellerPage=read('js/next/pages/seller.js');
const stoApi=read('api/sto_workplace.php');
const stoPage=read('js/next/pages/sto_workplace.js');
const parts=read('js/next/pages/parts.js');
const masters=read('js/next/pages/masters.js');

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
assert(core.includes('window.KaretaMobile'),'client home must prefer the native mobile bridge when available');
assert(bridge.includes('async function bestLocation'),'shared best-location bridge missing');
assert(bridge.includes('call("getLocation"'),'native location bridge command missing');
assert(bridge.includes('navigator.geolocation.getCurrentPosition'),'browser fallback missing from shared bridge');
assert(core.includes('mobile.bestLocation'),'client home must use shared best-location bridge');
assert(core.includes('api/geo.php?action=nearby'),'client home is not wired to Geo nearby API');
assert(core.includes('types=sto,master'),'client home nearby provider scope changed unexpectedly');
assert(core.includes('geoNearby=new Map()'),'client home Geo response index missing');

assert(geoCore.includes("if($kind==='warehouse')$visibility='hidden';"),'shared core must force warehouse hidden');
assert(geoCore.includes("if($kind==='mobile_origin'&&$visibility==='exact'"),'shared core mobile-origin privacy guard missing');
assert(geoCore.includes('kareta_geo_sync_legacy_address'),'legacy address synchronization missing');
assert(masterOnboarding.includes("'kind'=>'service'")&&masterOnboarding.includes("'visibility'=>'exact'"),'master onboarding must persist exact service point');
assert(masterOnboarding.includes("'kind'=>'mobile_origin'")&&masterOnboarding.includes("'visibility'=>'city'"),'master onboarding must keep mobile origin non-public');
assert(sellerApi.includes("'kind'=>'warehouse'")&&sellerApi.includes("'visibility'=>'hidden'"),'seller warehouse must stay hidden');
assert(sellerApi.includes("'kind'=>'pickup'")&&sellerApi.includes("'visibility'=>'exact'"),'seller public pickup point missing');
assert(sellerPage.includes('data-seller-geo-detect'),'seller GPS control missing');
assert(sellerPage.includes('pickupPublic'),'seller explicit pickup publication control missing');
assert(stoApi.includes("kareta_geo_owner_points($pdo,'sto'"),'STO workplace geo point read missing');
assert(stoPage.includes('data-sto-window-open="location"'),'STO location window missing');
assert(stoPage.includes("ownerType:'sto'")&&stoPage.includes("visibility:'exact'"),'STO point save contract missing');
assert(parts.includes('data-parts-nearby-detect'),'parts nearby shops trigger missing');
assert(parts.includes('types=shop&limit=20'),'parts nearby pickup query missing');
assert(parts.includes("String(row.kind||'')==='pickup'"),'parts must filter public pickup points');
assert(parts.includes('openBestMap'),'parts route action must use shared map opener');
assert(api.includes("$payload['publicId']=$sellerUserId"),'public shop point must expose safe storefront id only');
assert(masters.includes('const loadGeoNearby=async'),'masters nearby geo query missing');
assert(masters.includes("types='+encodeURIComponent(providerKind)"),'masters geo query provider type missing');
assert(masters.includes('if(af!==bf)return af?-1:1'),'masters nearby sort must prioritize rows with real distance');
assert(masters.includes('await requestLocation()'),'masters nearby click must explicitly request location when absent');

console.log('GEO_PLATFORM_CORE: PASS');
