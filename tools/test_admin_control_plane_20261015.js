'use strict';
// Admin E1 source-level regression. No network, DB, CI or deployment side effects.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/next/pages/admin_workspaces.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/next/workspace_admin.css'),'utf8');
const registry=fs.readFileSync(path.join(root,'js/next/route_registry.js'),'utf8');
const audit=fs.readFileSync(path.join(root,'docs/admin/ADMIN_AUDIT.md'),'utf8');
let passed=0;
function check(name,test){test();passed++;console.log('PASS admin E1: '+name);}
check('parse existing page module',()=>new Function(js));
check('exactly one admin-only shell',()=>{
  assert.equal((js.match(/data-admin-shell/g)||[]).length,1);
  assert.ok(js.includes('class="k-admin-control-plane" data-admin-shell'));
  assert.ok(js.includes('<aside class="k-admin-rail">'));
  assert.ok(js.includes('<div class="k-admin-work-area">'));
});
check('no new logo or Back in contextual wrapper',()=>{
  const shell=js.split('const shell=')[1]?.split('\n')[0]||'';
  for(const token of ['kareta_logo','k-mobile-back','k-shell-header','k-mobile-nav'])assert.ok(!shell.includes(token),token);
});
check('original admin workflows remain addressable',()=>{
  for(const key of ['adminUsers','adminOrganizations','adminMonitoring'])assert.ok(js.includes("key==='"+key+"'"),key);
  assert.ok(js.includes("return shell(ctx,'Управление и модерация'"));
  for(const action of ['setAccountStatus','revokeSessions','setOrganizationStatus','resolveModerationCase'])assert.ok(js.includes(action),action);
});
check('all six sidebar hashes still registered',()=>{
  for(const hash of ['#/admin/monitoring','#/admin/users','#/admin/organizations','#/admin/management','#/platform','#/core']) {
    assert.ok(registry.includes(hash),'route '+hash);
    assert.ok(js.includes(hash),'nav '+hash);
  }
});
check('responsive rail and safe touch sizes',()=>{
  for(const token of ['@media(min-width:1200px)','@media(max-width:1199px)','overflow-x:auto','min-height:48px','a:focus-visible'])assert.ok(css.includes(token),token);
  assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
});
check('24 reference rows inventoried',()=>{
  for(let i=1;i<=24;i++)assert.ok(new RegExp('\\| '+String(i).padStart(2,'0')+' \\|').test(audit),'reference '+i);
});
console.log('Admin E1 source contracts: '+passed+' passed; browser, authenticated API and visual E2E NOT RUN.');
