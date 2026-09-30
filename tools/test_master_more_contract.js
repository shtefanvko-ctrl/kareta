'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=[];const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const hub=read('js/next/smart_action_hub.js');
const cabinet=read('js/next/pages/cabinet.js');
const messaging=read('api/messaging.php');

for(const token of [
  "{key:'cabinetGarage',label:'Гараж',icon:'car',action:'personalGarage'}",
  "{key:'cabinet',label:'Аккаунт',icon:'user'}",
  "{key:'cabinetSettings',label:'Подключения',icon:'chats',action:'connections'}",
  "{key:'masterSchedule',label:'Календарь',icon:'calendar'}",
  "{key:'orders',label:'Заявки',icon:'orders'}",
  "{key:'chats',label:'Чаты',icon:'chats',badge:'chat'}"
]) expect(hub.includes(token),`master More action missing: ${token}`);

const masterBlock=(hub.match(/master:Object\.freeze\(\[([\s\S]*?)\]\),\n    organization_service/)||[])[1]||'';
expect((masterBlock.match(/\{key:/g)||[]).length===6,'master More must contain exactly six actions');
expect(!masterBlock.includes('masterDashboard')&&!masterBlock.includes('following'),'legacy master More actions remain');
expect(hub.includes("function personalContext()")&&hub.includes("special==='personalGarage'"),'personal Garage context switch contract missing');
expect(hub.includes("sessionStorage.setItem('kareta.settings.focus','messaging')"),'connections focus handoff missing');
expect(cabinet.includes("sessionStorage.getItem('kareta.settings.focus')==='messaging'"),'cabinet does not consume messaging focus handoff');
expect(hub.includes('summary.hidden=masterMode'),'client Garage/Promos summary must be hidden for master');
expect(hub.includes("masterMode?'рейтинг':'авто'")&&hub.includes("masterMode?'статус':'акции'"),'master profile stats are not role-aware');
expect(!masterBlock.includes('SMS'),'master More must not advertise unsupported SMS messaging');
expect(messaging.includes("['telegram','whatsapp']"),'messaging backend provider contract changed unexpectedly');

if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('Master More contract regression: OK');
