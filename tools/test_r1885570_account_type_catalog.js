'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const listeners={};
const host={
  dataset:{}, hidden:true, innerHTML:'', clickHandler:null,
  addEventListener(type,handler){ if(type==='click')this.clickHandler=handler; },
  querySelector(){ return null; }
};
const clientContext={id:41,key:'personal:15',type:'personal',label:'Личный кабинет'};
let identitySnapshot={
  loaded:true,loading:false,authenticated:true,contexts:[clientContext],accountTypes:[
    {role:'client',label:'Клиент',status:'active',description:'Личный кабинет'},
    {role:'master',label:'Мастер',status:'available',description:'Добавить к текущему номеру телефона'},
    {role:'sto',label:'СТО',status:'pending',description:'Заявка отправлена администратору'},
    {role:'seller',label:'Магазин',status:'available',description:'Добавить к текущему номеру телефона'}
  ],context:clientContext,capabilities:[],deniedCapabilities:[],error:''
};
let requested=null;
const context={
  console,
  document:{documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null},
  CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  fetch:async(url,options)=>{
    requested={url,options,body:JSON.parse(options.body)};
    return {ok:true,status:200,json:async()=>({ok:true,request:{created:true},contexts:[clientContext],accountTypes:identitySnapshot.accountTypes,currentContext:clientContext,capabilities:[],deniedCapabilities:[]})};
  },
  window:{
    addEventListener(type,handler){(listeners[type]||(listeners[type]=[])).push(handler);},
    dispatchEvent(){},
    KaretaUIIcons:{svg:name=>`<svg data-icon="${name}"></svg>`},
    KaretaIdentity:{snapshot:()=>identitySnapshot,load:async()=>identitySnapshot,has:()=>false},
    KaretaToast:{success(){},error(){}},
    KaretaShellMenu:{close(){}},
  }
};
context.window.window=context.window;
context.window.document=context.document;
context.window.fetch=context.fetch;
context.window.CustomEvent=context.CustomEvent;
vm.runInNewContext(read('js/next/context_manager.js'),context,{filename:'context_manager.js'});
for(const handler of listeners['kareta:identity-ready']||[])handler({detail:identitySnapshot});

for(const label of ['Клиент','Мастер','СТО','Магазин'])assert(host.innerHTML.includes(label),`missing ${label}`);
assert(host.innerHTML.includes('data-context-type-request="master"'),'master add action missing');
assert(host.innerHTML.includes('data-context-type-request="seller"'),'seller add action missing');
assert(host.innerHTML.includes('На проверке'),'pending state missing');
assert(!host.innerHTML.includes('Доступен один рабочий режим'),'old one-context message remains');
assert(!host.innerHTML.includes('#role:client:role'),'broken generic client add link remains');
assert(host.innerHTML.includes('Клиент, Мастер, СТО и Магазин'),'four-type summary missing');

(async()=>{
  identitySnapshot={...identitySnapshot,accountTypes:identitySnapshot.accountTypes.map(item=>item.role==='master'?{...item,status:'pending',description:'Заявка отправлена администратору'}:item)};
  await context.window.KaretaContextManager.requestType('master');
  assert.strictEqual(requested.url,'/api/context.php?action=request-type');
  assert.strictEqual(requested.body.role,'master');
  assert(host.innerHTML.includes('Заявка отправлена администратору'),'request result not rendered');
  assert(host.innerHTML.includes('На проверке'),'new pending state not rendered');
  console.log('R188.5.5.6.10 account type catalog tests OK');
})().catch(error=>{console.error(error);process.exit(1);});
