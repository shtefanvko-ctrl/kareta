'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('DESIGN_CANON_V1: FAIL — '+m);process.exit(1);};

const contract=read('css/next/design_contract.css');
const master=read('css/next/master_surfaces.css');
const shell=read('css/next/master_responsive_shell.css');
const navSkin=read('css/next/master_mobile_nav.css');
const postlude=read('css/next/master_client_r84_postlude.css');
const build=read('tools/build_master_runtime_css.js');
const runtime=read('css/routes/master_runtime.css');
const registry=read('inc/asset_registry.php');

for(const token of [
  '--k-radius-xs:5px','--k-radius-control:10px','--k-radius-card:18px','--k-radius-dialog:24px',
  '--k-z-base:0','--k-z-local-raised:3','--k-z-sticky:20','--k-z-shell:40','--k-z-nav:50',
  '--k-z-fab:60','--k-z-overlay:80','--k-z-modal:100','--k-z-toast:120','--k-z-shell-brand:161','--k-z-debug:200'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

if(!registry.includes("'css/next/design_contract.css'")) fail('shared design contract must be eager');
if(!registry.includes("'css/next/master_responsive_shell.css'")) fail('master responsive shell must be eager');
if(!master.includes('MASTER / CLIENT VISUAL CANON')) fail('master geometry owner is missing responsive canon');
if(!master.includes('KARETA MASTER PAGE VIEWPORT STABILITY')) fail('master geometry owner is missing viewport stability rules');
if(postlude.includes('MASTER / CLIENT VISUAL CANON')) fail('r84 postlude still duplicates responsive canon');
if(postlude.includes('MASTER LAYOUT STABILITY GUARD')) fail('legacy stability guard still lives in postlude');
if(postlude.includes('k-master-services-toolbar')) fail('dead service toolbar selector remains in postlude');
if(postlude.includes('k-master-workplace-page')||postlude.includes('k-master-dashboard-page')) fail('dead master page selector remains in postlude');

if(!shell.includes('Master Responsive Shell Contract')) fail('canonical master shell owner missing');
if(!shell.includes('z-index:var(--k-z-shell-brand)')) fail('master shell brand layer is not tokenized');
if(/z-index\s*:\s*-?\d+/i.test(master)) fail('raw numeric z-index remains in master geometry owner');
if(/z-index\s*:\s*-?\d+/i.test(shell)) fail('raw numeric z-index remains in master shell owner');
if(!navSkin.includes('@media (max-width:767px)')) fail('mobile nav skin must follow phone breakpoint <=767');
for(const forbidden of ['.k-app-shell','#k-shell-header','#k-desktop-nav']){
  if(navSkin.includes(forbidden)) fail('mobile nav skin still owns shell geometry: '+forbidden);
}


const sourceArray=(build.match(/const sources=\[([\s\S]*?)\]/)||[])[1]||'';
const sourceLines=[...sourceArray.matchAll(/'([^']+\.css)'/g)].map(m=>m[1]);
if(sourceLines[sourceLines.length-1]!=='css/next/master_surfaces.css') fail('master_surfaces.css must be the final route geometry owner');
if(sourceLines.includes('css/next/design_contract.css')) fail('design contract must not be duplicated inside master runtime');
if(sourceLines.includes('css/next/master_responsive_shell.css')) fail('eager master shell must not be duplicated inside master runtime');
if(sourceLines.includes('css/next/master_client_r84_postlude.css')) fail('legacy master postlude must be retired from runtime builder');

for(const bp of ['@media(max-width:767px)','@media(min-width:768px) and (max-width:1199px)','@media(min-width:1200px)']){
  if(!master.includes(bp)) fail('missing page responsive contract '+bp);
  if(!shell.includes(bp)) fail('missing shell responsive contract '+bp);
}

for(const legacy of [
  '@media(max-width:699px)','@media(max-width:700px)',
  '@media (min-width:1100px)','@media (max-width:1099px)',
  '@media(min-width:1180px)','@media(min-width:600px) and (max-width:899px)'
]){
  if(master.includes(legacy)) fail('legacy layout breakpoint remains: '+legacy);
}
if(runtime.includes('SOURCE: css/next/design_contract.css')) fail('generated master runtime duplicates design contract');
if(runtime.includes('SOURCE: css/next/master_responsive_shell.css')) fail('generated master runtime duplicates responsive shell');
if(runtime.includes('SOURCE: css/next/master_client_r84_postlude.css')) fail('generated master runtime still contains legacy postlude');
if(!runtime.includes('MASTER / CLIENT VISUAL CANON')) fail('generated master runtime misses canonical responsive geometry');
if(!runtime.trimEnd().endsWith(master.trimEnd())) fail('master_surfaces.css must be final generated CSS owner');

console.log('DESIGN_CANON_V1: PASS');
