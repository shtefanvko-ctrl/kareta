'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const php=String.raw`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))};
$p=kareta_route_asset_plan();
$owners=[];
foreach($p as $name=>$bundle){
  if(!is_array($bundle)||empty($bundle['lazy']))continue;
  foreach(($bundle['scripts']??[]) as $script){
    if($script==='js/next/messaging_settings.js')$owners[]=$name;
  }
}
echo json_encode([
  'cabinet'=>$p['cabinet']??null,
  'messaging'=>$p['cabinetMessagingSettings']??null,
  'owners'=>$owners,
  'lazyJs'=>count(kareta_route_asset_paths('scripts'))
]);`;
const data=JSON.parse(cp.execFileSync('php',['-r',php],{encoding:'utf8'}));

assert.deepStrictEqual(data.cabinet.scripts,['js/next/pages/cabinet.js'],'general cabinet bundle must not load messaging settings');
assert.deepStrictEqual(data.cabinet.globals,['KaretaCabinetPages'],'general cabinet globals must stay cabinet-only');
assert.deepStrictEqual(data.messaging.routeKeys,['cabinetSettings'],'messaging bundle must be settings-only');
assert.deepStrictEqual(data.messaging.routes,['#/cabinet/settings'],'messaging bundle route path mismatch');
assert.deepStrictEqual(data.messaging.scripts,['js/next/messaging_settings.js'],'messaging settings script missing from dedicated bundle');
assert.deepStrictEqual(data.messaging.globals,['KaretaMessagingSettings'],'messaging global guard missing');
assert.deepStrictEqual(data.owners,['cabinetMessagingSettings'],'messaging settings must have exactly one lazy owner');
assert(data.lazyJs>=59,'lazy script inventory unexpectedly shrank');

const loader=read('js/next/route_asset_loader.js');
assert(loader.includes('if(keys.includes(routeKey))out.push([name,bundle])'),'route loader must aggregate all bundles for one route');
assert(loader.includes('for(const [name,bundle] of bundles)'),'route loader must execute aggregated bundles sequentially');

const cabinet=read('js/next/pages/cabinet.js');
assert(cabinet.includes('window.KaretaMessagingSettings?.mount?.(messagingHost)'),'cabinet settings must still mount messaging module when available');

console.log('Cabinet settings lazy messaging regression: OK');
