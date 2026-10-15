'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8');
const R='188.5.5.6.84.181';
const paths=['js/next/onboarding/pages/role_page.js','js/next/onboarding/onboarding_form_ui.js'];
const sources=paths.map(read);
for(const [i,s] of sources.entries()){
 assert(s.includes('window.KARETA_NEXT_ASSET_VERSION'),paths[i]+' must derive brand cache token from runtime release');
 assert(!/src="\/assets\/logo\/main\/kareta_logo_full\.png"/.test(s),paths[i]+' has unversioned CDN logo');
 assert(s.includes('src="${officialLogoUrl()}"'),paths[i]+' must render versioned logo');
}
const boot=read('js/boot/runtime_onboarding_bundle.js');
assert(boot.includes('SOURCE: '+paths[0])&&boot.includes('SOURCE: '+paths[1]));
assert(boot.includes('window.KARETA_NEXT_ASSET_VERSION'));
const ui={KARETA_NEXT_ASSET_VERSION:R};
vm.runInNewContext(sources[1],{window:ui,encodeURIComponent});
const out=ui.KaretaOnboardingFormUI.modalHeader({title:'Профиль'});
assert(out.includes('src="/assets/logo/main/kareta_logo_full.png?v='+R+'"'));
assert(read('index.php').includes('window.KARETA_NEXT_ASSET_VERSION'));
assert(read('inc/asset_version.php').includes("const KARETA_ASSET_VERSION = '"+R+"'"));
assert(read('sw.js').includes("const RELEASE = '"+R+"'"));
console.log('PASS versioned official logo on role/welcome/profile, bundle and release parity');
