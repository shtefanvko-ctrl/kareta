'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const page=read('js/next/pages/master_workplace.js');
const css=read('css/next/master_workplace_native.css');
const api=read('api/master_workplace.php');
const registry=read('inc/asset_registry.php');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
expect(page.includes("NATIVE_WORKPLACE_CONTRACT='R188.5.5.6.55'"),'native workplace contract marker missing');
const r71=page.includes("MASTER_UI_R71_CONTRACT='R188.5.5.6.71'");
const r81=page.includes("MASTER_WORKSPACE_R81_CONTRACT='R188.5.5.6.81'");
const uiTokens=r81?['k-master-r81-toolbar','k-master-r81-commandbar','k-master-r81-operations','k-master-r81-operation-list','data-master-workspace-settings-dialog','data-master-status-dialog','data-master-status-option']:(r71?['k-master-r71-toolbar','k-master-native-next','k-master-native-actions','k-master-native-queue','k-master-native-upcoming','data-master-status-dialog','data-master-status-option']:['k-master-native-head','k-master-native-availability','k-master-native-states','k-master-native-next','k-master-native-actions','k-master-native-queue','k-master-native-upcoming','data-master-status-dialog','data-master-status-option']);
for(const token of uiTokens)expect(page.includes(token),`native workplace UI missing ${token}`);
if(r71){expect(!page.includes('k-master-native-head'),'R71 must remove native workplace head');expect(!page.includes('k-master-native-states'),'R71 must remove native shift state cards');}
const copyTokens=r81?['ОПЕРАТИВНАЯ ЛЕНТА','Рабочий день','Записать клиента','Ремонты','Биржа','График','Запчасти','Чаты']:(r71?['СЛЕДУЮЩАЯ МАШИНА','Очередь автомобилей','Ближайшие записи','Записать клиента','Все ремонты','Биржа','Календарь','Запчасти','Рабочие чаты']:['Новые','В работе','Готово','Записано','СЛЕДУЮЩАЯ МАШИНА','Очередь автомобилей','Ближайшие записи','Записать клиента','Все ремонты','Биржа','Календарь','Запчасти','Рабочие чаты']);
for(const token of copyTokens)expect(page.toLowerCase().includes(token.toLowerCase()),`workplace copy/flow missing ${token}`);
for(const forbidden of ['k-master-business-metrics','k-master-exchange-panel','data-master-response-form','k-master-schedule-embedded','Мой профиль','Мои публикации','Мои работы','Готовность профиля','Выручка за месяц'])expect(!page.includes(forbidden),`workplace must not mix separate surface: ${forbidden}`);
expect(!page.includes('<select'),'workplace must not use select/dropdown');expect(!page.includes('Swiper'),'workplace must not use Swiper');
expect(r81?(page.includes("quickCommand('#/master/exchange'")&&page.includes("quickCommand('#/calendar'")&&page.includes("quickCommand('#/parts'")&&page.includes("quickCommand('#/chats'")):(page.includes("quickAction('#/master/exchange'")&&page.includes("quickAction('#/calendar'")&&page.includes("quickAction('#/parts'")&&page.includes("quickAction('#/chats'")),'separate work surfaces must be linked instead of embedded');
expect(page.includes('data-start-timer')&&page.includes('data-stop-timer')&&page.includes('apiModule.saveAvailability'),'workplace operational actions missing');
expect(api.includes("'todayOrders'=>$todayOrders")&&api.includes("'activeOrders'=>$active")&&api.includes("'waitingOrders'=>$waiting")&&api.includes("'completedToday'=>$completedToday")&&api.includes("'timers'=>$timers"),'server shift data missing');
expect(css.includes('@media(max-width:600px)')&&css.includes('height:100dvh'),'mobile status modal must become full-screen');
expect(!css.includes('scroll-snap-type'),'workplace CSS must not introduce horizontal sliders');
expect(registry.includes('css/next/master_workplace_native.css'),'R55 CSS not registered');
for(const f of ['inc/asset_version.php','sw.js'])expect(read(f).includes('r1885615-master-workplace-native'),`${f} release suffix missing`);
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('R188.5.5.6.55 Master workplace: shift-only Native UI + modal status + separate work surfaces + shell freeze OK');
