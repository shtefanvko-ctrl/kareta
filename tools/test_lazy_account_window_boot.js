'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const builder=read('tools/build_boot_js_bundles.js');
const core=read('js/boot/runtime_core_bundle.js');
const account=read('js/next/account_window.js');
const registry=read('inc/asset_registry.php');

const php=String.raw`require ${JSON.stringify(path.join(root,'inc/asset_registry.php'))};
$p=kareta_route_asset_plan();
$owners=[];
foreach($p as $name=>$bundle){
  if(!is_array($bundle)||empty($bundle['lazy']))continue;
  foreach(($bundle['scripts']??[]) as $script){
    if($script==='js/next/account_window.js')$owners[]=$name;
  }
}
echo json_encode(['cabinet'=>$p['cabinet']??null,'owners'=>$owners]);`;
const data=JSON.parse(cp.execFileSync('php',['-r',php],{encoding:'utf8'}));

assert(!builder.includes("'js/next/first_vehicle_flow.js','js/next/account_window.js'"),'account window still in core builder adjacency');
assert(!/runtime_core_bundle\.js'[\s\S]*?account_window\.js/.test(builder.split("});",1)[0]),'account window still declared in runtime core build group');
assert(core.includes('SOURCE: js/next/client/client_cabinet_api.js'),'cabinet API dependency missing from runtime core');
assert(!core.includes('SOURCE: js/next/account_window.js'),'account window still embedded in runtime core');
assert(!core.includes('window.KaretaAccountWindow=Object.freeze'),'account window global still embedded in boot core');
assert(account.includes('window.KaretaAccountWindow=Object.freeze'),'lazy account window source export missing');
assert.deepStrictEqual(data.owners,['cabinet'],'account window must have exactly one lazy owner');
assert.deepStrictEqual(data.cabinet.scripts.slice(0,2),['js/next/account_window.js','js/next/pages/cabinet.js'],'account window must load before cabinet page');
assert(data.cabinet.globals.includes('KaretaAccountWindow')&&data.cabinet.globals.includes('KaretaCabinetPages'),'cabinet lazy global guards incomplete');
assert(registry.includes("'js/next/account_window.js'"),'account window source must remain registered');
assert(core.length<115000,`runtime core still too large after account-window extraction: ${core.length}`);

cp.execFileSync(process.execPath,[path.join(root,'tools/build_boot_js_bundles.js'),'--check'],{stdio:'pipe'});
console.log('Lazy account window boot regression: OK');
