'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('DESIGN_CANON_V1: FAIL — '+m);process.exit(1);};

const contract=read('css/next/design_contract.css');
const master=read('css/next/master_surfaces.css');
const postlude=read('css/next/master_client_r84_postlude.css');
const build=read('tools/build_master_runtime_css.js');
const runtime=read('css/routes/master_runtime.css');

for(const token of [
  '--k-radius-xs:5px','--k-radius-control:10px','--k-radius-card:18px','--k-radius-dialog:24px',
  '--k-z-base:0','--k-z-sticky:20','--k-z-shell:40','--k-z-nav:50',
  '--k-z-fab:60','--k-z-overlay:80','--k-z-modal:100','--k-z-toast:120','--k-z-debug:200'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

if(!/const sources=\[\s*'css\/next\/design_contract\.css',\s*'css\/next\/master_surfaces\.css'/.test(build)){
  fail('design contract must precede the master geometry owner');
}
if(!master.includes('MASTER / CLIENT VISUAL CANON')) fail('master geometry owner is missing responsive canon');
if(postlude.includes('MASTER / CLIENT VISUAL CANON')) fail('r84 postlude still duplicates responsive canon');
if(!master.includes('z-index:var(--k-z-sticky)')) fail('workspace sticky navigation is not on canonical layer scale');
if(/z-index\s*:\s*-?\d+/i.test(master)) fail('raw numeric z-index remains in master geometry owner');
if(!postlude.includes('z-index:var(--k-z-sticky)')) fail('exchange sticky toolbar is not on canonical layer scale');

for(const bp of ['@media(max-width:767px)','@media(min-width:768px) and (max-width:1199px)','@media(min-width:1200px)']){
  if(!master.includes(bp)) fail('missing responsive contract '+bp);
}
if(!runtime.includes('SOURCE: css/next/design_contract.css')) fail('generated master runtime misses design contract');
if(!runtime.includes('MASTER / CLIENT VISUAL CANON')) fail('generated master runtime misses canonical responsive geometry');

console.log('DESIGN_CANON_V1: PASS');
