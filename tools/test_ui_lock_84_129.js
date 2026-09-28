'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const nav=read('js/next/navigation_core.js');
const access=read('js/next/role_access.js');
const registry=read('js/next/route_registry.js');
const shell=read('js/next/reference_client_shell.js');
const index=read('index.php');
const css=read('css/next/reference_client_pages.css');
const rules=read('docs/KARETA_UI_LOCK_RULES.md');

expect(nav.includes("personal: Object.freeze(['home','services','works','masters','parts','__more__'])"),'client bottom menu policy changed');
expect(nav.includes("function mobileLimit(kind=contextKind()){ return ['personal','master','seller','admin','organization_store'].includes(kind) ? 6 : 5; }"),'mobile limit changed');
expect(access.includes("mobile:['home','services','works','masters','parts','__more__']"),'client role mobile menu changed');
expect(registry.includes("const MOBILE_KEYS = Object.freeze(['home','parts','masters','orders','cabinet']);"),'registry mobile keys changed');
expect(!index.includes('k-brand-client-wordmark'),'header wordmark redesign still present');
expect(shell.includes('data-shell-location-icon'),'location icon missing');
expect(shell.includes("brand.insertAdjacentElement('afterend',button)"),'location icon is not adjacent to existing brand');
expect(css.includes('UI LOCK 84.129'),'UI lock CSS marker missing');
const locked=css.slice(css.indexOf('/* R188.5.5.6.84.129'));
expect(!locked.includes('#k-mobile-nav'),'locked page layer modifies bottom nav');
expect(!locked.includes('#k-mobile-fab-stack'),'locked page layer modifies mobile controls');
expect(!locked.includes('k-brand-client-wordmark'),'locked page layer modifies brand');
expect(rules.includes('Нижнее мобильное меню')&&rules.includes('Верхнюю шапку'),'UI lock documentation missing');

if(fail.length){console.error('UI_LOCK_84_129: FAIL\n- '+fail.join('\n- '));process.exit(1)}
console.log('UI_LOCK_84_129: PASS');
