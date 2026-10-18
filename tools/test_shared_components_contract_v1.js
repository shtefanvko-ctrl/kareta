'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('SHARED_COMPONENTS_V1: FAIL — '+m);process.exit(1);};

const contract=read('css/next/design_contract.css');
const boot=read('css/runtime_boot_bundle.css');
const registry=read('inc/asset_registry.php');
const uiKit=read('js/next/core/ui_kit.js');
const bootBuilder=read('tools/build_boot_js_bundles.js');

for(const token of [
  '--k-component-control-h:var(--k-control-height)',
  '--k-component-button-radius:var(--k-radius-action)',
  '--k-component-button-gap:7px',
  '--k-component-button-font-size:12.5px',
  '--k-component-button-font-weight:800',
  '--k-component-button-icon-size:18px',
  '--k-component-button-accent:var(--k-accent)',
  '--k-component-button-accent-hover:var(--k-accent-hover)',
  '--k-component-field-h:42px',
  '--k-component-field-radius:var(--k-radius-action)',
  '--k-component-field-line:var(--k-line-soft)',
  '--k-component-field-surface:var(--k-surface-card)',
  '--k-component-field-text:var(--k-text-strong)',
  '--k-component-field-muted:var(--k-muted-ui)',
  '--k-component-state-radius:16px',
  '--k-component-state-line:#dde1e6',
  '--k-component-state-surface:var(--k-surface-card)',
  '--k-component-state-text:var(--k-muted-ui)'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

if(/\.k-(?:btn|button|field|state)\b/.test(contract)){
  fail('design_contract.css must own tokens, not component selectors');
}

const walkCss=dir=>{
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walkCss(full));
    else if(entry.isFile()&&entry.name.endsWith('.css')) out.push(full);
  }
  return out;
};

const owners=walkCss(path.join(root,'css')).filter(file=>{
  const rel=path.relative(root,file).replaceAll('\\','/');
  if(rel==='css/next/design_contract.css'||rel==='css/runtime_boot_bundle.css') return false;
  return /--k-component-[a-z0-9-]+\s*:/i.test(fs.readFileSync(file,'utf8'));
});
if(owners.length){
  fail('shared component tokens declared outside design_contract.css: '+owners.map(file=>path.relative(root,file).replaceAll('\\','/')).join(', '));
}

for(const helper of ['const button=','const card=','const empty=','const error=','const skeleton=','const tabs=']){
  if(!uiKit.includes(helper)) fail('KaretaUIKit missing helper '+helper);
}
if(!bootBuilder.includes("'js/next/core/ui_kit.js'")) fail('KaretaUIKit is not part of runtime_ui_bundle.js');
if(!registry.includes("'css/next/design_contract.css'")) fail('design contract must remain eager');

const marker='/* ===== SOURCE: css/next/design_contract.css ===== */';
const start=boot.indexOf(marker);
if(start<0) fail('design contract marker missing from runtime_boot_bundle.css');
const bodyStart=start+marker.length+1;
const next=boot.indexOf('\n/* ===== SOURCE:',bodyStart);
const body=(next<0?boot.slice(bodyStart):boot.slice(bodyStart,next)).trim();
if(body!==contract.trim()) fail('runtime boot copy of design_contract.css is stale');

console.log('SHARED_COMPONENTS_V1: PASS — semantic tokens owned by design contract');
