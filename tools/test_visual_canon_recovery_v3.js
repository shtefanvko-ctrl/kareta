'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const image=fs.readFileSync(path.join(root,'assets/logo/main/kareta_logo_full.png'));
assert.deepEqual(image.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),'binary PNG not base64 text');
assert(image.readUInt32BE(16)>100&&image.readUInt32BE(20)>50);
assert(read('index.php').includes("asset_ver('assets/logo/main/kareta_logo_full.png')"));
const core=read('js/next/pages/core.js');
assert(core.includes("{ title:'Диагностика ЭБУ', route:'#/diagnostics', icon:'diagnostics' }"));
assert(read('js/next/pages/vehicle.js').includes("location.hash='#/diagnostics'"));
const nav=read('js/next/mobile_back.js');
assert(nav.includes('header.dataset.karetaHeaderMode = mode'));
assert(nav.includes('cleanHash !== HOME'));
for(const name of ['css/next/master_responsive_shell.css','css/runtime_boot_bundle.css']){
  const css=read(name);
  for(const key of ['#k-shell-header[data-kareta-header-mode="inner"] > .k-brand',
  '#k-shell-header[data-kareta-header-mode="inner"] > #k-shell-page-title',
  '#k-shell-header[data-kareta-header-mode="inner"] > #k-mobile-back'])
  assert(css.includes(key),name+' missing '+key);
}
const parts=read('js/next/pages/parts.js');
assert(parts.includes('Object.hasOwn(fallbackCategories,id)?fallback.icon:categoryIcon(name,fallback.icon)'));
assert(parts.includes("audio_speaker:{name:'Динамики',icon:'parts'}"));
const scan=read('js/next/pages/scanner.js'),css=read('css/next/scanner.css');
assert(scan.includes("let step='front'"));
assert(scan.includes("3</div>"));
assert(scan.includes('k-document-preview__icon'));
assert(css.includes('max-height:240px'));
for(const v of ['kk:', 'en:', 'ru:'])assert(scan.includes(v));
assert(scan.includes('KaretaFirstVehicleFlow?.offerDocumentPrefill'));
console.log('PASS visual canon v3: binary PNG, home diagnostics, header, floats, categories and scanner');
