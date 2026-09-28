'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const index=read('index.php'),r24=read('css/next/shell_session_stability.css'),css=read('css/next/shell_burger_recovery.css'),registry=read('inc/asset_registry.php'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const t of ['id="k-menu-toggle"','id="k-menu-drawer"','id="k-menu-backdrop"','class="k-shell-actions"'])expect(index.includes(t),`burger DOM missing ${t}`);
expect(r24.includes('@media (min-width:861px) and (max-width:1100px)'),'historical responsive trigger missing');
for(const t of ['grid-template-columns:minmax(138px,170px) minmax(0,1fr) auto','#k-shell-header > .k-shell-actions','grid-column:3','display:flex!important','#k-menu-toggle.k-menu-toggle','min-width:44px','@media (max-width:860px)','grid-column:2'])expect(css.includes(t),`recovery CSS missing ${t}`);
expect(registry.indexOf('shell_burger_recovery.css')>registry.indexOf('shell_session_stability.css'),'recovery stylesheet must load after R24');
expect(!css.includes('#k-mobile-nav')&&!css.includes('.k-nav-link'),'burger hotfix must not rewrite navigation items');
for(const f of ['index.php','css/next/app_next.css','css/next/shell_burger_recovery.css'])expect(Boolean(manifest.files[f]),`Shell Freeze 2 missing ${f}`);
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
for(const f of ['inc/asset_version.php','sw.js'])expect(read(f).includes('r1885617-shell-burger-recovery'),`${f} suffix missing`);
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('R188.5.5.6.57 burger: 861-1100 three-column shell + mobile visibility + Shell Freeze 2 OK');
