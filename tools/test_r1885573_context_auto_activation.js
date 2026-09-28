'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
let host={dataset:{},hidden:false,innerHTML:'',addEventListener(){},querySelector(){return null;}};
let selectedCalls=[];
let toasts=[];
const initial={loaded:true,loading:false,authenticated:true,contexts:[{id:1,key:'personal:1',type:'personal',label:'Личный кабинет'}],accountTypes:[{role:'client',status:'active',contextId:1},{role:'master',status:'available'}],context:{id:1,key:'personal:1',type:'personal',label:'Личный кабинет'},capabilities:[],deniedCapabilities:[]};
const afterCreate={...initial,contexts:[...initial.contexts,{id:2,key:'profile:master:2',type:'profile',profileType:'master',label:'Работаю как мастер'}],accountTypes:[{role:'client',status:'active',contextId:1},{role:'master',status:'active',contextId:2}],context:initial.context};
const listeners={};
const window={
  __KARETA_CONTEXT_MANAGER_MODULE__:null,
  KaretaIdentity:{load:async()=>afterCreate,snapshot:()=>initial,has:()=>false,reset(){},select:async id=>{selectedCalls.push(id);return {...afterCreate,context:afterCreate.contexts[1]};}},
  KaretaNavigationCore:{switchContext:async id=>{selectedCalls.push(id);return {...afterCreate,context:afterCreate.contexts[1]};}},
  KaretaShellMenu:{close(){}},
  KaretaToast:{success:m=>toasts.push(m),error:m=>toasts.push(`ERR:${m}`)},
  KaretaUIIcons:{svg:()=>'<svg></svg>'},
  addEventListener:(n,cb)=>{listeners[n]=cb;},dispatchEvent(){},
};
const context={window,document:{documentElement:{dataset:{}},getElementById:id=>id==='k-context-switcher'?host:null},CustomEvent:function(n,o){this.type=n;this.detail=o?.detail;},fetch:async()=>({ok:true,status:200,json:async()=>({ok:true,authenticated:true,contexts:afterCreate.contexts,accountTypes:afterCreate.accountTypes,currentContext:initial.context,request:{created:true,autoApproved:true,targetContextId:2}})}),console,Set,Object,Array,String,Number,Boolean,Promise,Error};
window.window=window;
vm.runInNewContext(fs.readFileSync(path.join(root,'js/next/context_manager.js'),'utf8'),context,{filename:'context_manager.js'});
(async()=>{
  listeners['kareta:identity-ready']({detail:initial});
  const result=await window.KaretaContextManager.requestType('master');
  assert.deepStrictEqual(selectedCalls,[2],'new master context must be selected automatically');
  assert.strictEqual(result.selected?.id,2);
  assert(toasts.some(message=>message.includes('добавлен для тестирования и включён')),'auto activation toast missing');
  assert(!fs.readFileSync(path.join(root,'js/next/context_manager.js'),'utf8').includes("addEventListener('click',()=>load(true))"),'duplicate retry listener remains');
  console.log('R188.5.5.6.13 context auto activation tests OK');
})().catch(error=>{console.error(error);process.exit(1);});
