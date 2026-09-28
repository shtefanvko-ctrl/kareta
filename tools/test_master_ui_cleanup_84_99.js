'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exit(1);}};

const version=read('inc/asset_version.php');
const nav=read('js/next/navigation_core.js');
const more=read('js/next/smart_action_hub.js');
const workplace=read('js/next/pages/master_workplace.js');
const cabinet=read('js/next/pages/cabinet.js');
const exchange=read('js/next/pages/work_feed.js');
const services=read('js/next/pages/service_management.js');
const bundle=read('js/boot/runtime_shell_bundle.js');

expect(/188\.5\.5\.6\.84\.(?:99|1\d{2,})/.test(version),'release is older than 84.99 cleanup');
expect(nav.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"),'master mobile navigation contract changed');

const moreBlock=(more.match(/master:Object\.freeze\(\[([\s\S]*?)\]\),\n\s*organization_service:/)||[])[1]||'';
for(const label of ['Рабочее место','Календарь','Чаты','Мои заказы','Подписки','Настройки']) expect(moreBlock.includes(`label:'${label}'`),`More missing ${label}`);
expect(!moreBlock.includes("label:'Помощь'"),'Master More still contains Help instead of Subscriptions');
const positions=['Рабочее место','Календарь','Чаты','Мои заказы','Подписки','Настройки'].map(x=>moreBlock.indexOf(`label:'${x}'`));
expect(positions.every((v,i)=>i===0||v>positions[i-1]),'Master More order is inconsistent');
expect(bundle.includes("{key:'following',label:'Подписки',icon:'following'}"),'boot shell bundle was not rebuilt with master More');

const renderData=(workplace.match(/function renderData\(data\)\{([\s\S]*?)\n  \}\n\n  function mountMasterWorkplace/)||[])[1]||'';
expect(renderData.length>0,'renderData extraction failed');
expect(!renderData.includes('windows.quickActions?'),'duplicate quick-action strip is still rendered on master home');
expect(!renderData.includes('if(windows.exchange)'),'Exchange cards are still duplicated into master home');
expect(!renderData.includes('href="#/master/exchange"'),'Exchange shortcut is still duplicated in master home toolbar');
expect(!renderData.includes('href="#/calendar"'),'Calendar shortcut is still duplicated in master home toolbar/header');
expect(renderData.includes('href="#/orders/new"'),'direct client booking action missing from master home');
expect(workplace.includes('quickActions:false,exchange:false'),'legacy duplicate windows are not hard-disabled');

const account=(cabinet.match(/function renderMasterCabinet\(\)\{([\s\S]*?)\n  function renderStoCabinet/)||[])[1]||'';
expect(account.length>0,'master account extraction failed');
expect((account.match(/staffCard\(/g)||[]).length===4,'master account should contain exactly four account-specific cards');
for(const text of ['Публичный профиль','Тариф и лимиты','Мои публикации','Настройки']) expect(account.includes(text),`master account missing ${text}`);
for(const duplicate of ['Рабочее место','Биржа и мои заказы','Мои услуги','Новые запчасти','Биржа БУ','Рабочие чаты']) expect(!account.includes(duplicate),`master account still duplicates ${duplicate}`);

const exchangeRender=(exchange.match(/function renderExchange\(\)\{([\s\S]*?)\n  function /)||[])[1]||'';
expect(exchangeRender.length>0,'exchange render extraction failed');
expect(!exchangeRender.includes('href="#/services/manage"'),'Exchange page still duplicates Services navigation');

const masterServices=(services.match(/function renderMasterServiceManagement\(context=\{\}\)\{([\s\S]*?)\n  function updateMasterMatrix/)||[])[1]||'';
expect(masterServices.length>0,'master service render extraction failed');
expect(!masterServices.includes('href="#/cabinet/settings"'),'Services page still duplicates workplace Settings navigation');

console.log('OK master UI cleanup 84.99');
