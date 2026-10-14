'use strict';
// Focused source contract; browser/device acceptance is tracked separately.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'js/next/pages/master_onboarding.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/next/master_onboarding.css'),'utf8');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
check('ES syntax',()=>{new Function(js);});
check('inner title replaces missing onboarding logo',()=>{
  assert.ok(!js.includes('/assets/onboarding/kareta_logo_full.png'));
  assert.ok(js.includes('data-kmo-header-title'));
  assert.ok(js.includes('data-kmo-back'));
});
check('header title and Back labels use RU/KK/EN',()=>{
  for(const lang of ['ru','kk','en'])assert.ok(js.includes(lang+':{title:'),lang);
  assert.ok(js.includes('function headerCopy()'));
  assert.ok(js.includes('copy.back'));
});
check('live language change has cleanup',()=>{
  assert.ok(js.includes('new MutationObserver(syncHeaderLanguage)'));
  assert.ok(js.includes("attributeFilter:['lang']"));
  assert.ok(js.includes('headerLocaleObserver?.disconnect()'));
});
check('2-column specialization is isolated from other modals',()=>{
  assert.ok(js.includes('data-kmo-modal-kind="${esc(model.modal)}"'));
  assert.ok(css.includes('.kmo-modal[data-kmo-modal-kind="specialization"] .kmo-modal-list'));
  assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
});
check('accent resolves to shared token',()=>{
  assert.ok(css.includes('--km-orange:var(--k-accent,#ff4b0a)'));
});
check('desktop shell branding stays off in wizard',()=>{
  assert.ok(css.includes('.k-master-onboarding-active #k-shell-header{display:none!important}'));
  assert.ok(css.includes('.k-master-onboarding-active #k-menu-toggle{display:none!important}'));
});
check('existing draft and modal lifecycle remains available',()=>{
  for(const name of ['function setDraft(','function flushDraft(','function mountMasterOnboarding(','function closeModal('])assert.ok(js.includes(name),name);
});
console.log('Master onboarding visual canon: '+checks+' focused checks passed.');
