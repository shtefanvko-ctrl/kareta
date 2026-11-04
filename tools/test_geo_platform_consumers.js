/* Geo platform consumer integration diagnostic.
 * This remains a follow-up gate after the recovery core is merged.
 */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const masterOnboarding=read('api/master_onboarding.php');
const sellerApi=read('api/seller_shop.php');
const sellerClientApi=read('js/next/seller/seller_api.js');
const sellerPage=read('js/next/pages/seller.js');
const stoApi=read('api/sto_workplace.php');
const stoPage=read('js/next/pages/sto_workplace.js');
const parts=read('js/next/pages/parts.js');
const masters=read('js/next/pages/masters.js');

assert(masterOnboarding.includes("'kind'=>'service'")&&masterOnboarding.includes("$servicePoint['visibility']='exact'"),'master onboarding must conditionally persist owner-consented exact service point');
assert(masterOnboarding.includes("'kind'=>'mobile_origin'")&&masterOnboarding.includes("'visibility'=>'city'"),'master onboarding must keep mobile origin non-public');
assert(sellerApi.includes('function kareta_public_pickup_address_expr')&&sellerApi.includes("g.kind='pickup'")&&sellerApi.includes("g.visibility='exact'")&&sellerApi.includes('COALESCE({$pickupExpr}'),'public shop addresses must come only from exact pickup points');
assert(sellerClientApi.includes('api/geo.php?action=upsert')&&sellerPage.includes("kind==='warehouse'?'hidden'"),'seller private warehouse Geo write path missing');
assert(sellerPage.includes("kind==='warehouse'?'hidden':(publicExact?'exact':'hidden')")&&sellerPage.includes('publishExact:publicExact'),'seller pickup publication must require explicit consent');
assert(sellerPage.includes('data-seller-geo-detect'),'seller GPS control missing');
assert(sellerPage.includes('pickupPublic'),'seller explicit pickup publication control missing');
assert(stoApi.includes("kareta_geo_owner_points($pdo,'sto'"),'STO workplace geo point read missing');
assert(stoPage.includes('data-sto-window-open="location"'),'STO location window missing');
assert(stoPage.includes("ownerType:'sto'")&&stoPage.includes("visibility:'exact'"),'STO point save contract missing');
assert(parts.includes('data-parts-nearby-detect'),'parts nearby shops trigger missing');
assert(parts.includes('types=shop&limit=20'),'parts nearby pickup query missing');
assert(parts.includes("String(row.kind||'')==='pickup'"),'parts must filter public pickup points');
assert(parts.includes('openBestMap'),'parts route action must use shared map opener');
assert(masters.includes('const loadGeoNearby=async'),'masters nearby geo query missing');
assert(masters.includes("types='+encodeURIComponent(providerKind)"),'masters geo query provider type missing');
assert(masters.includes('if(af!==bf)return af?-1:1'),'masters nearby sort must prioritize rows with real distance');
assert(masters.includes('await requestLocation()'),'masters nearby click must explicitly request location when absent');

console.log('GEO_PLATFORM_CONSUMERS: PASS');
