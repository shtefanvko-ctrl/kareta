'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('DESIGN_CONTRACT_V1: FAIL — '+m);process.exit(1);};

const contract=read('css/next/design_contract.css');
const master=read('css/next/master_surfaces.css');
const build=read('tools/build_master_runtime_css.js');

for(const token of [
  '--k-z-base:0',
  '--k-z-sticky:20',
  '--k-z-shell:40',
  '--k-z-nav:50',
  '--k-z-fab:60',
  '--k-z-overlay:80',
  '--k-z-modal:100',
  '--k-z-toast:120',
  '--k-z-debug:200'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

if(!/const sources=\[\s*'css\/next\/design_contract\.css',\s*'css\/next\/master_surfaces\.css'/.test(build)){
  fail('design contract must be first master runtime source');
}
if(!master.includes('z-index:var(--k-z-sticky)')) fail('master sticky navigation must use canonical z token');
if(/z-index\s*:\s*-?\d+/i.test(master)) fail('raw numeric z-index remains in master surface owner');
if(!master.includes('MASTER / CLIENT VISUAL CANON')) fail('responsive master/client visual canon block missing');

console.log('DESIGN_CONTRACT_V1: PASS');
