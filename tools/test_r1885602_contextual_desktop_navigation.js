const fs=require('fs');
const core=fs.readFileSync('js/next/navigation_core.js','utf8');
const shell=fs.readFileSync('js/next/shell_nav.js','utf8');
const fail=m=>{throw new Error(m)};
const expect=(cond,m)=>{if(!cond)fail(m)};

expect(core.includes('const DESKTOP_TEMPLATES = Object.freeze({'),'desktop templates missing');
expect(/personal:\s*Object\.freeze\(\['home','services','community','masters','parts','orders','chats','cabinet'\]\)/.test(core),'client desktop template mismatch');
expect(/master:\s*Object\.freeze\(\['masterDashboard','masterExchange','orders','community','parts','serviceManagement','chats','cabinet'\]\)/.test(core),'master desktop template mismatch');
expect(core.includes('function desktopItems(kind=contextKind())'),'context desktop resolver missing');
expect(core.includes('desktop:desktopItems()'),'navigation snapshot must expose context desktop items');
expect(core.includes('DESKTOP_TEMPLATES, ACTIONS'),'desktop templates must be exported');
expect(shell.includes("window.KaretaNavigationCore?.desktopItems?.()||navigation.items('desktop')"),'shell must render context-owned desktop navigation');
expect(!shell.includes("const desktop=navigation.items('desktop');const mobile="),'shell still renders generic desktop navigation');
expect(shell.includes("personal:{orders:'Заявки',cabinet:'Аккаунт'}"),'client desktop labels missing');
expect(shell.includes("master:{masterDashboard:'Рабочее место',masterExchange:'Биржа',orders:'Заявки'"),'master desktop labels missing');
expect(shell.includes("kind==='personal'&&key==='serviceDetail'"),'client service detail active mapping missing');
expect(shell.includes("kind==='personal'&&key==='providerDetail'"),'client provider detail active mapping missing');
console.log('R188.5.5.6.42 contextual desktop navigation: OK');
