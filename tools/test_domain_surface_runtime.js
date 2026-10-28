'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'../js/next/domain_surface.js'),'utf8');
function testContext(snapshot){
  const listeners={};let replacements=[], selected=[], changedHash='#/home';
  const outlet={children:['protected-page'],replaceChildren(...items){this.children=[...items]}};
  const body={children:[],appendChild(node){this.children.push(node)}};
  function createElement(tag){
    const node={tag,children:[],className:'',textContent:'',id:'',href:'',disabled:false,handlers:{},setAttribute(){},append(...items){this.children.push(...items)},appendChild(item){this.children.push(item)},replaceChildren(...items){this.children=[...items]},addEventListener(event,fn){this.handlers[event]=fn},remove(){const index=body.children.indexOf(this);if(index>=0)body.children.splice(index,1);}};
    return node;
  }
  const location={pathname:'/',search:'',get hash(){return changedHash},set hash(value){changedHash=value}};
  const history={replaceState(_state,_title,url){replacements.push(url);changedHash=url.slice(url.indexOf('#'))}};
  const window={KaretaRouteRuntime:{navigate(key,opts){window.__navigated={key,opts};changedHash='#/'+key;}},KARETA_DOMAIN_SURFACE:{host:'work.kareta.kz',role:'master',route:'masterDashboard',label:'Кабинет мастера'},KaretaIdentity:{snapshot:()=>snapshot,async select(id){selected.push(id);snapshot.context=snapshot.contexts.find(c=>c.id===id);snapshot.compatibilityRole='master';return snapshot;}},addEventListener(name,fn){listeners[name]=fn;}};
  vm.runInNewContext(code,{window,document:{body,createElement,querySelector(selector){return selector==='#k-page-outlet'?outlet:null;}},history,location,console});
  const gate=window.KaretaDomainSurface;
  assert(gate,'domain runtime missing');return {gate,body,outlet,location,history,replacements,selected,listeners,window};
}
async function run(){
  let t=testContext({authenticated:false,mode:'anonymous'});
  assert.strictEqual(t.gate.enforce().state,'anonymous');assert.strictEqual(t.body.children.length,0);
  console.log('PASS anonymous sign-in flow unchanged');
  t=testContext({authenticated:true,mode:'identity',context:{type:'profile',profileType:'master',id:2}});
  assert.strictEqual(t.gate.enforce({initial:true}).state,'matched');assert.strictEqual(t.location.hash,'#/masterDashboard');assert.strictEqual(t.body.children.length,0);
  console.log('PASS matching master opens master dashboard without reload');
  const clientContext={type:'personal',id:1},masterContext={type:'profile',profileType:'master',id:2,label:'Мастер'};
  t=testContext({authenticated:true,mode:'identity',context:clientContext,contexts:[clientContext,masterContext],compatibilityRole:'client'});
  assert.strictEqual(t.gate.enforce().blocked,true);assert.strictEqual(t.body.children.length,1);assert.strictEqual(t.outlet.children.length,0);
  const card=t.body.children[0].children[0];const buttons=card.children.find(node=>node.className==='k-domain-surface-gate__actions').children;
  assert.strictEqual(buttons[0].tag,'button');assert.strictEqual(buttons[0].textContent,'Переключить: Мастер');
  await buttons[0].handlers.click();
  assert.strictEqual(t.selected[0],2);assert.strictEqual(t.body.children.length,0);assert.strictEqual(t.location.hash,'#/masterDashboard');assert.strictEqual(t.window.__navigated?.key,'masterDashboard');
  console.log('PASS role mismatch blocked and server-side context selection invoked');
  t=testContext({authenticated:true,mode:'identity',context:clientContext,contexts:[clientContext],compatibilityRole:'client'});
  assert.strictEqual(t.gate.enforce().blocked,true);
  assert(!t.body.children[0].children[0].children[2].children.some(item=>item.tag==='button'));
  console.log('PASS no unauthorized role creation or forced switch');
  t=testContext({authenticated:true,mode:'identity',context:{type:'organization',organizationType:'parts_store'},contexts:[]});
  assert.strictEqual(t.gate.roleOf({type:'organization',organizationType:'parts_store'}),'seller');
  assert.strictEqual(t.gate.roleOf({type:'organization',organizationType:'sto'}),'sto');
  assert.strictEqual(t.gate.roleOf({type:'personal'}),'client');
  assert.strictEqual(t.gate.roleOf({type:'profile',profileType:'unknown'}),'');
  console.log('PASS context mapping seller/sto/client');
}
run().catch(error=>{console.error(error);process.exit(1)});
