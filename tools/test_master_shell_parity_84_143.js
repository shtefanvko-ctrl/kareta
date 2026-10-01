'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const css=read('css/next/master_shell_canonical_84_143.css');
const registry=read('inc/asset_registry.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(css.includes('@media(max-width:900px)'),'Master mobile breakpoint missing');
expect(css.includes('position:fixed!important')&&css.includes('--k-master-mobile-shell-h:68px'),'Master mobile header is not fixed 68px');
expect(!/master[^\n]{0,160}position:sticky!important/.test(css),'canonical Master shell must not use sticky header');
expect(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'Master six-slot bottom dock missing');
expect(css.includes('@media(min-width:1100px)'),'Client-parity desktop breakpoint missing');
expect(css.includes('--k-master-left-nav-w:210px'),'210px Client-parity desktop rail missing');
expect(css.includes('left:var(--k-master-left-nav-w)!important'),'desktop header is not offset by rail');
expect(css.includes('width:var(--k-master-left-nav-w)!important'),'desktop navigation rail width missing');
expect(css.includes('.k-shell-location-icon'),'real shell location control selector missing');
expect(css.includes('#k-shell-header.is-scroll-hidden')&&css.includes('transform:none!important'),'Master header can still scroll away');
expect(registry.includes("'css/runtime_boot_bundle.css',")&&registry.includes("'css/next/master_shell_canonical_84_143.css',"),'canonical Master shell is not eager');
expect(registry.includes("'css/routes/master_reference_final_84_130.css','css/next/master_shell_canonical_84_143.css'"),'canonical Master shell is not promoted after legacy route styles');

const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';
expect(va==='188.5.5.6.84.143','asset release is not 84.143');
expect(vs===va,'service worker / asset release mismatch');

console.log('MASTER_SHELL_PARITY_84_143: PASS mobile=fixed68 tablet=topnav desktop=left210 release='+va);
