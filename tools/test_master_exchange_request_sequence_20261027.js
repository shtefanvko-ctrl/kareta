'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/next/pages/work_feed.js'), 'utf8');
const pending = [];
const handlers = new Map();
const windowEvents = new Map();
const grid = {innerHTML: '', setAttribute() {}};
const result = {textContent: ''};
const load = {textContent: '', classList: {toggle() {}}};
const empty = {hidden: true};
const pagination = {hidden: true};
const paginationStatus = {textContent: ''};
const elements = new Map([
  ['[data-exchange-grid]', grid],
  ['[data-exchange-result]', result],
  ['[data-exchange-load]', load],
  ['[data-exchange-pagination]', pagination],
  ['[data-exchange-pagination-status]', paginationStatus],
  ['[data-exchange-empty]', empty]
]);
const page = {
  querySelector: selector => elements.get(selector) || null,
  querySelectorAll: () => [],
  addEventListener: (event, fn) => handlers.set(event, fn),
  removeEventListener: event => handlers.delete(event)
};
const identity = {authenticated:true,compatibilityRole:'master',context:{id:42}};
const api = {
  getMasterExchangeFeed(params) {
    return new Promise(resolve => pending.push({params: {...params}, resolve}));
  }
};
const window = {
  KaretaApiClient: api,
  KaretaCatalogCards: {},
  KaretaRoleAccess: {currentRole:()=> 'master'},
  KaretaPageUI: {masterPageHeader:()=>'<header></header>'},
  KaretaUIIcons: {svg:()=>'<svg></svg>', icon:()=>''},
  KaretaIdentity: {snapshot:()=>identity},
  addEventListener(event,fn) {windowEvents.set(event,fn);},
  removeEventListener(event) {windowEvents.delete(event);}
};
const document = {querySelector: selector => selector==='.k-exchange-page' ? page : null};
const ctx = {window,document,location:{hash:'#/master/exchange'},URLSearchParams,console,Date,Intl,setTimeout,clearTimeout,CSS:{escape:String},FormData};
vm.runInNewContext(source,ctx,{filename:'work_feed.js'});
const reply = (item) => ({ok:true,payload:{data:{items:[{id:item,serviceNames:item,vehicleTitle:'Авто'}],kpi:{available:1},state:{},tabCounts:{new:1},load:{}}}});
const event = (selector, dataset) => ({
  target:{closest: query => query===selector ? {dataset} : null}
});
async function flush() {await Promise.resolve();await Promise.resolve();await new Promise(resolve=>setImmediate(resolve));}

(async()=>{
  const unmount = window.KaretaWorkFeedPages.mountExchange();
  assert.equal(pending.length,1,'initial fetch must start');
  const changed = handlers.get('click')(event('[data-exchange-scope]',{exchangeScope:'mine'}));
  assert.equal(pending.length,2,'scope selection must launch the next fetch');
  assert.equal(pending[1].params.service_scope,'mine');
  pending[1].resolve(reply('CURRENT_SCOPE'));
  await changed;
  assert.match(grid.innerHTML,/CURRENT_SCOPE/);
  pending[0].resolve(reply('STALE_SCOPE'));
  await flush();
  assert.match(grid.innerHTML,/CURRENT_SCOPE/,'late previous response must not replace current scope');
  assert.doesNotMatch(grid.innerHTML,/STALE_SCOPE/);

  // A role switch must fail closed even if the prior master's request is pending.
  const refresh = handlers.get('click')(event('[data-exchange-refresh]',{}));
  assert.equal(pending.length,3,'refresh must fetch again');
  identity.authenticated=false;
  windowEvents.get('kareta:context-changed')();
  assert.match(grid.innerHTML,/Подтвердите вход/,'role change must clear master data');
  pending[2].resolve(reply('PRIVATE_AFTER_LOGOUT'));
  await refresh;
  assert.doesNotMatch(grid.innerHTML,/PRIVATE_AFTER_LOGOUT/,'old master reply must not appear after logout');

  // Navigating away must invalidate an in-flight result.
  identity.authenticated=true;
  windowEvents.get('kareta:identity-ready')();
  assert.equal(pending.length,4,'re-entry must refetch');
  unmount();
  const priorMarkup = grid.innerHTML;
  pending[3].resolve(reply('AFTER_UNMOUNT'));
  await flush();
  assert.equal(grid.innerHTML,priorMarkup,'unmounted page must not be repainted');
  // A slow workplace fallback must not overwrite a newer primary API result.
  const fallbackPending=[];
  api.request=()=>new Promise(resolve=>fallbackPending.push(resolve));
  const unmountAgain=window.KaretaWorkFeedPages.mountExchange();
  assert.equal(pending.length,5);
  pending[4].resolve({ok:false,status:503,payload:{error:'db_unavailable'}});
  await flush();
  assert.equal(fallbackPending.length,1,'503 must enter guarded fallback');
  const newer = handlers.get('click')(event('[data-exchange-scope]',{exchangeScope:'all'}));
  assert.equal(pending.length,6);
  pending[5].resolve(reply('FRESH_PRIMARY'));
  await newer;
  fallbackPending[0]({ok:true,payload:{data:{business:{exchange:{leads:[{id:'STALE_FALLBACK',serviceNames:'STALE_FALLBACK',serviceMatched:true}]}}}}});
  await flush();
  assert.match(grid.innerHTML,/FRESH_PRIMARY/,'fallback must not overwrite a newer primary response');
  assert.doesNotMatch(grid.innerHTML,/STALE_FALLBACK/);
  unmountAgain();
  console.log('PASS master exchange: out-of-order responses, auth, fallback and unmount');
})().catch(error=>{console.error('FAIL master exchange:',error.message);process.exitCode=1;});
