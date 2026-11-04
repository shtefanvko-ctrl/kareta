'use strict';
// Transactional Geo persistence after the existing owner's verified onboarding.
// This is a static gate; HTTP Identity/Android QA remains a separate gate.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','api','master_onboarding.php'),'utf8');
for(const [needle,meaning] of [
  ["require_once __DIR__.'/geo_core.php'","single canonical Geo core"],
  ["kareta_geo_upsert_point($pdo,$servicePoint)","service upsert"],
  ["'kind'=>'mobile_origin'","mobile point"],
  ["'visibility'=>'city'","mobile private by default"],
  ["$servicePoint['visibility']='exact'","exact requires explicit condition"],
  ["!empty($address['isPublic'])","public toggle"],
  ["kareta_geo_set_owner_kind_active($pdo,'master',$masterId,'service',false)","deactivate service"],
  ["kareta_geo_set_owner_kind_active($pdo,'master',$masterId,'mobile_origin',false)","deactivate mobile"],
  ["$pdo->commit()","same transaction"],
])assert(source.includes(needle),meaning);
const geoStart=source.indexOf("// Persist the already validated locations");
const commit=source.indexOf("$pdo->commit()",geoStart);
assert(geoStart>source.indexOf("if($method==='POST'&&$action==='complete')") && commit>geoStart,
  'Geo write must be inside onboarding completion transaction');
console.log('GEO_MASTER_ONBOARDING: PASS');
