'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const listeners=new Map();const hostListeners=new Map();let closed=0,selectedTarget='';
const host={hidden:true,innerHTML:'',dataset:{},addEventListener(name,handler){hostListeners.set(name,handler);},querySelector(){return null;}};
let identity={loaded:true,loading:false,authenticated:true,account:{id:7},contexts:[
  {id:1,key:'personal:7',type:'personal',label:'Личный кабинет'},
  {id:2,key:'profile:master:9',type:'profile',profileType:'master',label:'Работаю как мастер'},
  {id:3,key:'organization:sto_1',type:'organization',organizationType:'service_station',label:'СТО KARETA'}
],context:{id:1,key:'personal:7',type:'personal',label:'Личный кабинет'},capabilities:[],deniedCapabilities:[],error:''};
global.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
global.document={documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null};
global.window={
  addEventListener(name,handler){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(handler);},
  dispatchEvent(event){(listeners.get(event.type)||[]).forEach(handler=>handler(event));},
  KaretaIdentity:{snapshot:()=>identity,load:async()=>identity,reset:()=>identity,has:()=>false},
  KaretaNavigationCore:{switchContext:async target=>{selectedTarget=String(target);identity={...identity,context:identity.contexts.find(item=>String(item.id)===String(target))};return identity;}},
  KaretaShellMenu:{close:()=>{closed++;}},KaretaToast:{success(){},error(){}},KaretaUIIcons:{svg:name=>`<svg data-icon="${name}"></svg>`}
};
vm.runInThisContext(read('js/next/context_manager.js'),{filename:'context_manager.js'});
window.dispatchEvent(new CustomEvent('kareta:identity-ready',{detail:identity}));
assert(host.hidden===false,'persistent context switcher stayed hidden');
assert(host.innerHTML.includes('data-context-switch-select="1"')&&host.innerHTML.includes('data-context-switch-select="2"')&&host.innerHTML.includes('data-context-switch-select="3"'),'available context buttons are incomplete');
assert(host.innerHTML.includes('Клиент')&&host.innerHTML.includes('Мастер')&&host.innerHTML.includes('СТО'),'context role labels missing');
assert(host.innerHTML.includes('aria-current="true" disabled'),'active context state missing');
const target={closest(selector){if(selector==='[data-context-switch-select]')return {dataset:{contextSwitchSelect:'2'}};return null;}};
hostListeners.get('click')({target});
setTimeout(()=>{
  try{
    assert(selectedTarget==='2','context click did not call Navigation Core');
    assert(window.KaretaContextManager.getState().selected.id===2,'selected context did not synchronize');
    assert(closed===1,'burger did not close after context switch');
    const index=read('index.php');assert((index.match(/id="k-context-switcher"/g)||[]).length===1,'context switcher must have one persistent host');
    const menu=read('js/next/shell_menu.js');assert(!menu.includes('`<div id="k-context-switcher"'),'shell render still recreates context switcher');assert(menu.includes("account.keys.push('cabinetSettings')"),'Settings fallback missing from burger');
    const identityFrontend=read('js/next/identity_frontend.js');assert(identityFrontend.includes("'legacy-context-bridge'")&&identityFrontend.includes('allowLegacyBridge'),'legacy session context bridge missing');
    const preferences=read('api/account_ui_preferences.php');assert(preferences.includes('$auth instanceof KaretaAuthResolution'),'account preference authorization is incorrect');
    const hub=read('js/next/smart_action_hub.js');assert(hub.includes("MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2'")&&hub.includes("layout:'honeycomb'"),'More V1.2 contract missing');assert(!hub.includes('class="k-smart-action-'+'center"'),'duplicate More-center is still created inside the panel');
    const settings=read('js/next/pages/cabinet.js');assert(settings.includes('value="honeycomb"')&&!settings.includes('Вариант №1')&&!settings.includes('Полукруг'),'legacy More layout chooser returned');assert(settings.includes("savePreference?.(payload.more_menu_layout)"),'client compatibility preference save is missing');
    const css=read('css/next/smart_action_hub.css');assert(css.includes('.k-more-window-hub')&&css.includes('.k-more-window-action--6'),'More V1.2 CSS missing');assert(!css.includes('[data-layout="arc"]'),'legacy arc CSS returned');
    const config=read('config.php');assert(/KARETA_DB_VERSION',\s*(99|[1-9][0-9]{2,})/.test(config),'database version 99 or newer missing');
    console.log('R188.5.4 context/layout tests OK');
  }catch(error){console.error(error.message);process.exitCode=1;}
},0);
