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

for(const token of [
  '--k-z-base:0','--k-z-sticky:20','--k-z-shell:40','--k-z-nav:50',
  '--k-z-fab:60','--k-z-overlay:80','--k-z-modal:100','--k-z-toast:120','--k-z-debug:200'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

if(!/const sources=\[\s*'css\/next\/design_contract\.css',\s*'css\/next\/master_surfaces\.css'/.test(build)){
  fail('design contract must precede the master geometry owner');
}
if(!master.includes('MASTER / CLIENT VISUAL CANON')) fail('master geometry owner is missing responsive canon');
if(postlude.includes('MASTER / CLIENT VISUAL CANON')) fail('r84 postlude still owns shell geometry');
if(!master.includes('z-index:var(--k-z-sticky)')) fail('sticky workspace navigation is not on the canonical layer scale');
if(/z-index\s*:\s*-?\d+/i.test(master)) fail('raw numeric z-index remains in master geometry owner');
if(/z-index\s*:\s*-?\d+/i.test(postlude)) fail('raw numeric z-index remains in master r84 postlude');

for(const bp of ['@media(max-width:767px)','@media(min-width:768px) and (max-width:1199px)','@media(min-width:1200px)']){
  if(!master.includes(bp)) fail('missing responsive contract '+bp);
}

console.log('DESIGN_CANON_V1: PASS');
