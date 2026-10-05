'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('DESIGN_CANON_V2: FAIL — '+m);process.exit(1);};

const contract=read('css/next/design_contract.css');
const clientSurface=read('css/next/client_surface_layout.css');
const master=read('css/next/master_surfaces.css');
const shell=read('css/next/master_responsive_shell.css');
const navSkin=read('css/next/master_mobile_nav.css');
const postlude=read('css/next/master_client_r84_postlude.css');
const build=read('tools/build_master_runtime_css.js');
const runtime=read('css/routes/master_runtime.css');
const registry=read('inc/asset_registry.php');

const walkCss=(dir)=>{
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walkCss(full));
    else if(entry.isFile()&&entry.name.endsWith('.css')) out.push(full);
  }
  return out;
};

for(const token of [
  '--k-radius-xs:5px','--k-radius-control:10px','--k-radius-card:18px','--k-radius-dialog:24px',
  '--k-layout-page-max:1440px','--k-layout-workspace-gutter:clamp(18px,2vw,32px)',
  '--k-control-height:44px','--k-radius-action:12px','--k-radius-panel:20px',
  '--k-line-soft:#e5e7eb','--k-surface-soft:#f7f8fa','--k-text-strong:#171a1f',
  '--k-muted-ui:#747b84','--k-accent:#ff4b0a','--k-accent-hover:#e74308',
  '--k-shadow-surface:0 8px 24px rgba(15,23,42,.055)',
  '--k-z-base:0','--k-z-local-raised:3','--k-z-sticky:20','--k-z-shell:40','--k-z-nav:50',
  '--k-z-fab:60','--k-z-overlay:80','--k-z-modal:100','--k-z-toast:120','--k-z-shell-brand:161','--k-z-debug:200'
]){
  if(!contract.includes(token)) fail('missing '+token);
}

for(const alias of [
  '--k-ui-page-max:var(--k-layout-page-max)',
  '--k-ui-page-gutter:var(--k-layout-workspace-gutter)',
  '--k-ui-control-h:var(--k-control-height)',
  '--k-ui-control-radius:var(--k-radius-action)',
  '--k-ui-card-radius:var(--k-radius-card)',
  '--k-ui-panel-radius:var(--k-radius-panel)',
  '--k-ui-line:var(--k-line-soft)',
  '--k-ui-soft:var(--k-surface-soft)',
  '--k-ui-text:var(--k-text-strong)',
  '--k-ui-muted:var(--k-muted-ui)',
  '--k-ui-accent:var(--k-accent)',
  '--k-ui-accent-hover:var(--k-accent-hover)',
  '--k-ui-shadow:var(--k-shadow-surface)'
]){
  if(!contract.includes(alias)) fail('missing compatibility alias '+alias);
}

if(/--k-ui-[a-z0-9-]+\s*:/i.test(clientSurface)){
  fail('client_surface_layout.css still owns --k-ui-* values');
}

const uiAliasOwners=walkCss(path.join(root,'css')).filter(file=>{
  const rel=path.relative(root,file).replaceAll('\\','/');
  if(rel==='css/next/design_contract.css'||rel==='css/runtime_boot_bundle.css') return false;
  return /--k-ui-[a-z0-9-]+\s*:/i.test(fs.readFileSync(file,'utf8'));
});
if(uiAliasOwners.length){
  fail('legacy source --k-ui-* values declared outside design_contract.css: +uiAliasOwners.map(file=>path.relative(root,file).replaceAll('\\','/')).join(', '));
}

const generatedBoot=read('css/runtime_boot_bundle.css');
for(const token of ['--k-ui-page-max:1440px','--k-ui-control-h:44px','--k-ui-card-radius:18px','--k-ui-panel-radius:20px']){
  if(!generatedBoot.includes(token)) fail('generated boot bundle is not aligned with canonical compatibility values: '+token);
}
if(!registry.includes("'css/next/design_contract.css'")) fail('shared design contract must be eager');
if(!registry.includes("'css/next/master_responsive_shell.css'")) fail('master responsive shell must be eager');
if(!master.includes('MASTER PAGE VISUAL CONTRACT')) fail('master geometry owner is missing responsive canon');
if(!master.includes('KARETA MASTER PAGE VIEWPORT STABILITY')) fail('master geometry owner is missing viewport stability rules');
for(const duplicate of [
  '--k-master-content-max:var(--k-layout-content-max)',
  '--k-master-canon-gutter',
  '--k-master-canon-card-radius',
  '--k-master-canon-control-radius',
  '--k-master-canon-mobile-shadow'
]){
  if(master.includes(duplicate)) fail('duplicate master token ownership remains: '+duplicate);
}
if(postlude.includes('MASTER PAGE VISUAL CONTRACT')) fail('r84 postlude still duplicates responsive canon');
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
if(!runtime.includes('MASTER PAGE VISUAL CONTRACT')) fail('generated master runtime misses canonical responsive geometry');
if(!runtime.trimEnd().endsWith(master.trimEnd())) fail('master_surfaces.css must be final generated CSS owner');

console.log('DESIGN_CANON_V2: PASS');
