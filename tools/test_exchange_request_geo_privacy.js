/* Exchange request geo/privacy contract. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const request=read('js/next/pages/request.js');
const dispatch=read('api/production_dispatch.php');

assert(request.includes('data-request-detect-point'),'field-service point action missing');
assert(request.includes('window.KaretaMobile?.bestLocation'),'request GPS must prefer shared native/browser bridge');
assert(request.includes("applyCity(cityOption.dataset.requestCityOption||'',{lat:null,lng:null})"),'manual city choice must clear stale exact coordinates');
assert(request.includes('applyCity(city,{lat:null,lng:null})'),'automatic city detection must not silently become the request point');
assert(request.includes("visit==='field'?text(latEl?.value):''"),'exact request latitude must be sent only for field service');
assert(request.includes("visit==='field'?text(lngEl?.value):''"),'exact request longitude must be sent only for field service');
assert(!request.includes('Адрес: ${text(addressEl?.value)}'),'exact field address must not be duplicated into exchange notes');
assert(request.includes('Точная точка скрыта до принятия заявки.'),'field point privacy copy missing');

assert(dispatch.includes('function kareta_dispatch_valid_coords'),'server coordinate validation missing');
assert(dispatch.includes("owner_type='master'"),'dispatch must read canonical master geo point');
assert(dispatch.includes("['mobile_origin','service']"),'mobile master origin priority missing');
assert(dispatch.includes('kareta_dispatch_master_order_distance'),'server-side master/request distance helper missing');
assert(!dispatch.includes("if($distance===null&&isset($order['distance_km'])"),'client supplied distance_km must not be trusted for matching');
assert(dispatch.includes("if($distanceMax>0&&($score['distanceKm']===null"),'distance filter must exclude requests without verified distance');
assert(dispatch.includes('if($distanceMax>0&&($distance===null||$distance>$distanceMax))continue'),'fallback distance filter must exclude unknown distance');
assert(dispatch.includes('kareta_master_exchange_sanitize_geo'),'exchange geo sanitizer missing');
assert(dispatch.includes("'precision'=>'hidden'"),'pre-accept geo precision must be hidden');
assert(dispatch.includes("$tab==='accepted'"),'exact geo reveal boundary must be accepted tab');
assert(dispatch.includes('kareta_master_exchange_safe_notes'),'legacy generated-address notes sanitizer missing');
assert(dispatch.includes("'distanceMode'=>'straight_line'"),'distance mode must be explicit');

console.log('EXCHANGE_REQUEST_GEO_PRIVACY: PASS');
