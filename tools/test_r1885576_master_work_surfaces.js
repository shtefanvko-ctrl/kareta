'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const registry=read('inc/asset_registry.php');
assert(registry.includes("'css/next/master_surfaces.css'"),'master surface CSS is not registered');
const version=read('inc/asset_version.php');
const r84=version.includes('r1885644-global-ux-cleanup-legacy-removal');
if(r84){
  assert(!fs.existsSync(path.join(root,'js/next/master_surface_runtime.js')),'R84 must physically remove legacy master surface injector');
  assert(!registry.includes('master_surface_runtime.js'),'R84 must unregister legacy master surface injector');
}else{
  assert(registry.includes("'js/next/master_surface_runtime.js'"),'master surface runtime is not registered');
  const surface=read('js/next/master_surface_runtime.js');
  for(const route of ['masterDashboard','orders','requestNew','workflow','workOrder','serviceManagement','parts','chats','masterNews','cabinet'])assert(surface.includes(`'${route}'`)||surface.includes(`${route}:`),`master route is not covered: ${route}`);
  assert(surface.includes('MutationObserver'),'orders summary does not react to async order rendering');
  assert(surface.includes('role()!==\'master\''),'master surface is not isolated by role');
}

const workplace=read('js/next/pages/master_workplace.js');
const native55=workplace.includes("NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'");
if(native55){
  const r81=workplace.includes("MASTER_WORKSPACE_R81_CONTRACT='R188.5.5.6.81'");
  assert(workplace.includes(r81?'k-master-r81-commandbar':'k-master-native-actions'),'native master workplace quick actions are missing');
  assert(workplace.includes(r81?'k-master-r81-attention':'k-master-native-attention'),'native master workplace attention block is missing');
  assert(workplace.includes('data-master-status-dialog'),'native status dialog is missing');
  if(r81)assert(workplace.includes('data-master-workspace-settings-dialog'),'R81 workplace settings dialog is missing');
  assert(!workplace.includes('k-master-schedule-embedded'),'full schedule must not be embedded into native workplace');
}else{
  assert(workplace.includes('k-master-workplace-actions'),'master workplace quick actions are missing');
  assert(workplace.includes('k-master-operational-alerts'),'master operational alerts are missing');
  const masterWorks=fs.existsSync(path.join(root,'js/next/pages/master_works.js'))?read('js/next/pages/master_works.js'):'';
  assert(workplace.includes("'#/master/news/create'")||(workplace.includes("'#/master/works'")&&masterWorks.includes('data-master-work-publish')),'quick publication/portfolio access is missing');
}
assert(workplace.includes("catch(error)"),'master workplace actions do not handle network failures');

const schedule=read('js/next/pages/master_schedule.js');
assert(schedule.includes("window.KaretaToast?.error?.(error?.message"),'master schedule does not handle rejected API promises');

const cabinet=read('js/next/pages/cabinet.js');
assert(cabinet.includes("'Биржа и мои заказы'"),'master cabinet does not expose exchange and orders');
assert(cabinet.includes("'Запчасти'")||cabinet.includes("'Новые запчасти'"),'master cabinet parts card is missing');
assert(cabinet.includes("'Настройки интерфейса'"),'master cabinet settings card is missing');

const navigation=read('js/next/navigation_core.js');
assert(navigation.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"),'mobile master navigation regressed');
assert(!navigation.includes("master: Object.freeze(['home','orders','serviceManagement'"),'Services returned to k-mobile-nav');

assert(version.includes('r1885576-master-work-surfaces'),'asset marker is missing');
console.log('R188.5.5.6.16 master work surfaces tests OK');
