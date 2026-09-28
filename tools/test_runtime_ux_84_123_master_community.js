'use strict';
const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const expect=(cond,msg)=>{if(!cond)fail.push(msg);};

const nav=read('js/next/navigation_core.js');
const access=read('js/next/role_access.js');
const shell=read('js/next/shell_nav.js');
const community=read('js/next/pages/community.js');
const communityCss=read('css/next/community.css');
const master=read('js/next/pages/master_workplace.js');
const masterCss=read('css/next/master_surfaces.css');
const bundle=read('js/boot/runtime_shell_bundle.js');
const masterRuntime=read('css/routes/master_runtime.css');

expect(nav.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','community','__more__'])"),'master mobile community contract missing');
expect(nav.includes("master: Object.freeze(['masterDashboard','masterExchange','orders','masterSchedule','serviceManagement','parts','community','chats','cabinet'])"),'master desktop expanded contract missing');
expect(access.includes("desktop:['masterDashboard','masterExchange','orders','masterSchedule','serviceManagement','parts','community','chats','cabinet']"),'legacy master desktop contract missing');
expect(access.includes("mobile:['masterDashboard','masterExchange','serviceManagement','parts','community','__more__']"),'legacy master mobile community contract missing');
expect(bundle.includes("master: Object.freeze(['masterDashboard','masterExchange','orders','masterSchedule','serviceManagement','parts','community','chats','cabinet'])"),'runtime shell bundle missing expanded master desktop menu');
expect(shell.includes("community:'Сообщество'"),'master community shell label missing');

expect(community.includes("data-community-desktop-view"),'community desktop view controls missing');
expect(community.includes("data-community-desktop-main"),'community desktop main host missing');
expect(community.includes("async function switchDesktopView"),'community desktop switch controller missing');
expect(community.includes("main.innerHTML=desktopMain"),'community desktop nav does not replace primary content');
expect(community.includes("history.replaceState"),'community desktop URL state sync missing');
expect(community.includes("(min-width: 1180px)"),'community desktop breakpoint must start at 1180px');
expect(communityCss.includes("R188.5.5.6.84.123 — community desktop workspace navigation"),'community desktop workspace CSS missing');

expect(master.includes("data-master-workspace-view"),'master desktop workspace tabs missing');
expect(master.includes("masterKpiPanel"),'master KPI panel missing');
expect(master.includes("masterStatisticsPanel"),'master statistics panel missing');
expect(master.includes("applyMasterWorkspaceView"),'master workspace switching missing');
expect(master.includes("Выручка за месяц"),'master KPI revenue missing');
expect(master.includes("Конверсия биржи"),'master KPI exchange conversion missing');
expect(master.includes("Рабочих дней / 14"),'master statistics schedule metric missing');
expect(masterCss.includes("k-master-desktop-workspace-nav"),'master desktop workspace CSS missing');
expect(masterCss.includes("@media (min-width:1100px)"),'master desktop workspace breakpoint missing');
expect(masterRuntime.includes("k-master-desktop-workspace-nav"),'master runtime CSS not rebuilt');

if(fail.length){
  console.error('R188.5.5.6.84.123 FAIL');
  fail.forEach(x=>console.error('- '+x));
  process.exit(1);
}
console.log('R188.5.5.6.84.123 OK — community desktop switching + master desktop KPI/navigation');
