'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function identityHarness(reply, withLegacyApp = true) {
  const calls = [], events = [], legacy = [], invalidations = [];
  const storage = () => {
    const values = new Map();
    return { values, removeItem:key => values.delete(key), setItem:(key,value) => values.set(key,value) };
  };
  const localStorage = storage(), sessionStorage = storage();
  const document = { documentElement:{ dataset:{} } };
  const window = {
    dispatchEvent:event => events.push(event.type),
    KaretaApiClient:{ invalidate:prefix => invalidations.push(prefix) },
    KaretaNext:{ state:{ user:{phone:'70000000000'}, identityReady:true, context:{id:4} } },
    KaretaOnboardingState:{ reset:() => legacy.push('onboarding-reset') },
    KaretaOnboardingLifecycle:{ resume:() => legacy.push('onboarding-resume') },
  };
  if (withLegacyApp) window.App = { logout:options => legacy.push(options) };
  const fetch = async (url, options) => {
    calls.push({url,options});
    const response = reply();
    return { status:response.status, ok:response.status < 400, text:async () => JSON.stringify(response.payload), headers:{get:()=>'application/json'} };
  };
  vm.runInNewContext(read('js/next/identity_frontend.js'), {
    window, document, localStorage, sessionStorage, fetch,
    CustomEvent:class { constructor(type, init){this.type=type;this.detail=init.detail;} },
  });
  window.KaretaIdentity.bootstrapSession({authenticated:true,account:{id:7,phone:'70000000000'},currentContext:{id:4,type:'personal'},capabilities:['client.read']});
  return {window,document,calls,events,legacy,invalidations,localStorage,sessionStorage};
}

async function checkIdentityLogout() {
  const success = identityHarness(() => ({status:200,payload:{ok:true,loggedOut:true}}));
  const first = success.window.KaretaIdentity.logout(), second = success.window.KaretaIdentity.logout();
  assert.equal(first, second, 'double tap must share one logout request');
  await first;
  assert.equal(success.calls.length,1);
  assert.equal(success.calls[0].url,'/api/identity_session.php?action=logout');
  assert.equal(success.calls[0].options.method,'POST');
  assert.equal(success.calls[0].options.credentials,'same-origin');
  assert.equal(success.window.KaretaIdentity.snapshot().authenticated,false);
  assert.equal(success.window.KaretaNext.state.user,null);
  assert.equal(success.invalidations.length,1);
  assert.equal(success.legacy.length,1,'legacy shell must clear its local auth state');
  assert.ok(success.events.includes('kareta:session-anonymous'));

  const failure = identityHarness(() => ({status:503,payload:{ok:false,error:'database_unavailable'}}));
  await assert.rejects(failure.window.KaretaIdentity.logout(),/database_unavailable/);
  assert.equal(failure.window.KaretaIdentity.snapshot().authenticated,true,'failed server logout must retain local session');
  assert.equal(failure.legacy.length,0);
  assert.equal(failure.invalidations.length,0);
  assert.equal(failure.calls.length,1);

  const fallback = identityHarness(() => ({status:200,payload:{ok:true,loggedOut:true}}),false);
  fallback.localStorage.setItem('kareta.auth.user','old-account');
  fallback.sessionStorage.setItem('kareta.profile.current','old-profile');
  await fallback.window.KaretaIdentity.logout();
  assert.equal(fallback.localStorage.values.has('kareta.auth.user'),false);
  assert.equal(fallback.sessionStorage.values.has('kareta.profile.current'),false);
  assert.deepEqual(fallback.legacy,['onboarding-reset','onboarding-resume']);
}

async function checkMoreLogout() {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector,{
      hidden:false, disabled:false, textContent:'', innerHTML:'', classList:{toggle(){}},
      querySelector:child => node(`${selector} ${child}`), focus(){},
    });
    return nodes.get(selector);
  };
  const rootElement = { hidden:true, dataset:{}, classList:{add(){},remove(){}},
    addEventListener(name,fn){this[name]=fn;}, querySelector:node };
  const document = { body:{contains:el=>el===rootElement,appendChild(){}},
    createElement:() => rootElement, querySelectorAll:()=>[], documentElement:{classList:{add(){},remove(){}}}, activeElement:null };
  const identity = {authenticated:true,account:{name:'Тест',phone:'70000000000'}};
  let calls = 0;
  const window = { addEventListener(){},setTimeout:fn=>fn(),
    KaretaIdentity:{snapshot:()=>identity,logout:async()=>{calls += 1;}},
    KaretaNavigationCore:{contextKind:()=>identity.authenticated?'personal':'anonymous'},
    KaretaNext:{state:{user:{phone:'70000000000'}}},
  };
  vm.runInNewContext(read('js/next/smart_action_hub.js'),{window,document,requestAnimationFrame:fn=>fn()});
  await window.KaretaSmartActionHub.open();
  const button=node('[data-more-logout]');
  assert.equal(button.hidden,false,'signed-in More must show logout');
  assert.ok(rootElement.innerHTML.includes('data-more-logout'));
  await rootElement.click({target:{closest:selector=>selector==='[data-more-logout]'?button:null}});
  assert.equal(calls,1,'More must call Identity logout');
  assert.equal(window.KaretaSmartActionHub.snapshot().open,false);
  identity.authenticated=false;
  window.KaretaNext.state.user=null;
  await window.KaretaSmartActionHub.open();
  assert.equal(button.hidden,true,'anonymous More must hide logout');
}

async function main() {
  await checkIdentityLogout();
  await checkMoreLogout();
  const cabinet=read('js/next/pages/cabinet.js');
  const account=read('js/next/account_window.js');
  const picker=read('js/next/client/first_vehicle_flow.js');
  assert.ok(cabinet.includes('!ui||!api||!firstVehicleFlow'));
  assert.ok(cabinet.includes("startStep:2,data:data||{},mode:'manual'"));
  assert.ok(cabinet.includes("mode:'edit',vehicle"),'passport edit must use the visual picker');
  assert.ok(!cabinet.includes('k-vehicle-create-form')&&!cabinet.includes('data-vehicle-passport-form')&&!cabinet.includes("open('add')"),'legacy vehicle form returned');
  assert.ok(cabinet.includes("addEventListener('kareta:session-anonymous'"));
  assert.ok(picker.includes('data-fv-brand=') && picker.includes('k-fv-model-tile'));
  assert.ok(picker.includes("addEventListener('kareta:session-anonymous'"),'next account must be offered its own first-vehicle flow');
  assert.ok(account.includes('await window.KaretaIdentity.logout()'));
  assert.ok(read('css/runtime_boot_bundle.css').includes('.k-more-window-logout[hidden]'));
  console.log('WEBVIEW_LOGOUT_GARAGE_84_151: PASS server logout, failure, More, picker');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
