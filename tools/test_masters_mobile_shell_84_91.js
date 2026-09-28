#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('css/next/masters.css'),bundle=read('css/routes/providers_runtime.css');
const hero=read('css/next/unified_hero.css'),index=read('index.php');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};
for(const [label,css] of [['source',source],['providers bundle',bundle]]){
  expect(!/current-route=["']masters["'][\s\S]{0,180}#k-shell-header\s*\{\s*display\s*:\s*none/i.test(css),`${label} still hides Masters shell header`);
  expect(!/current-route=["']masters["'][\s\S]{0,180}\.k-page-outlet\s*\{[^}]*padding-top\s*:\s*0/i.test(css),`${label} still resets Masters outlet top spacing`);
}
expect(hero.includes('.k-page-hero.k-masters-hero')&&hero.includes('display: none !important'),'mobile Masters decorative hero must remain hidden');
expect(index.includes('id="k-shell-header"')&&index.includes('class="k-shell-header"'),'shared shell header contract missing');
const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=91,'asset version must be .84.91 or newer');
expect(Number(sv)>=91,'service worker release must be .84.91 or newer');
expect(gate.includes("'84.91' => 'tools/test_masters_mobile_shell_84_91.js'"),'release gate does not run .84.91 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.91] Masters mobile shell restoration regression passed.');
