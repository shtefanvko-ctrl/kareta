const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/onboarding/onboarding_lifecycle.js'),'utf8');
function must(c,m){if(!c){console.error('FAIL:',m);process.exit(1)}}
function scenario(role,hash){
  const winListeners={}; const docListeners={}; const writes=[]; const transitions=[]; const navRefresh=[];
  const flow={role:'client',entryRole:'client',pending:false,stage:'done',onboardingCompleted:true,serverConfirmed:true};
  const window={
    KaretaOnboardingState:{
      FLOW_KEY:'flow', DONE_KEYS:['done'], ROLES:['client','master','sto','seller'],
      role(v){v=String(v||'').toLowerCase();return ['client','master','sto','seller'].includes(v)?v:'client'},
      isDone(){return true},
      write(p){Object.assign(flow,p);writes.push({...p});return {...flow}},
      markComplete(){throw new Error('markComplete must not run for completed flow')}
    },
    KaretaOnboardingProfileDraft:{read(){return {...flow}},patch(){return {...flow}},currentRole(){return flow.role}},
    KaretaOnboardingRouter:{parse(v){const x=String(v===undefined?location.hash:v||'');return x.startsWith('#/onboarding/')?{role:'client',step:'role'}:null},isOnboarding(v){return !!this.parse(v)},canonical(r,s){return `#/onboarding/${r}/${s}`}},
    KaretaOnboardingApp:{targetForRole(r){return r==='master'?'#/master':r==='sto'?'#/sto':r==='seller'?'#/seller':'#/home'},setActive(){}},
    KaretaOnboardingProfilePages:{openFromRoute(){return true}},
    KaretaOnboardingNavigation:{audit(){return {ok:true}}},
    KaretaIdentity:{snapshot(){return {authenticated:true,compatibilityRole:role}}},
    KaretaNext:{state:{user:{role}}},
    KaretaRoleAccess:{refresh(){},defaultRoute(r){return r==='master'?'masterDashboard':r==='sto'?'stoDashboard':r==='seller'?'seller':'home'}},
    KaretaShellNav:{refresh(o){navRefresh.push(o)}},
    KaretaRouteRegistry:{keyFromHash(h){const x=String(h||''); if(x.startsWith('#/master/exchange'))return 'masterExchange'; if(x.startsWith('#/master'))return 'masterDashboard'; if(x.startsWith('#/orders'))return 'orders'; if(x.startsWith('#/sto'))return 'stoDashboard'; if(x.startsWith('#/seller'))return 'seller'; if(x.startsWith('#/home'))return 'home'; return ''}},
    KaretaRouteRuntime:{transition(k,o){transitions.push(['transition',k,o])},navigate(k,o){transitions.push(['navigate',k,o])}},
    addEventListener(n,cb){(winListeners[n]||(winListeners[n]=[])).push(cb)},
    dispatchEvent(){},
    OnboardingV2:null,
  };
  const location={hash};
  const history={replaceState(_a,_b,target){location.hash=target;transitions.push(['replace',target])}};
  const document={visibilityState:'visible',getElementById(){return null},addEventListener(n,cb){(docListeners[n]||(docListeners[n]=[])).push(cb)},documentElement:{classList:{toggle(){}},},body:{classList:{toggle(){}}}};
  const ctx={window,location,history,document,sessionStorage:{getItem(){return null},removeItem(){}},localStorage:{getItem(){return null}},CustomEvent:function(){},console,setTimeout,clearTimeout};
  vm.createContext(ctx); vm.runInContext(source,ctx,{filename:'onboarding_lifecycle.js'});
  window.KaretaOnboardingLifecycle.boot();
  must(location.hash===hash,`${role}: boot preserves route`);
  (docListeners.visibilitychange||[]).forEach(cb=>cb());
  must(location.hash===hash,`${role}: visibility preserves hash`);
  must(transitions.length===0,`${role}: visibility causes no route transition`);
  (winListeners['kareta:session-confirmed']||[]).forEach(cb=>cb({detail:{identity:{authenticated:true,compatibilityRole:role},user:{role,phone:'+77000000000'}}}));
  must(location.hash===hash,`${role}: session-confirmed preserves hash`);
  must(transitions.length===0,`${role}: session-confirmed causes no route transition`);
  must(writes.some(x=>x.role===role&&x.entryRole===role),`${role}: completed onboarding metadata syncs live role`);
  return {writes,navRefresh};
}
scenario('master','#/master/exchange');
scenario('client','#/orders');
scenario('sto','#/finance');
console.log('OK R188.5.5.6.28 tab resume route authority');
