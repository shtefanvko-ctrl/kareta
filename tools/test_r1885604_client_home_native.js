'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const core=read('js/next/pages/core.js'),registry=read('inc/asset_registry.php'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
for(const token of ['k-home-reference','k-home-ref-hero','k-home-ref-actions','data-home-nearby'])expect(core.includes(token),`reference home missing ${token}`);
expect(!fs.existsSync(path.join(root,'css/next/client_home_native.css')),'legacy client_home_native.css returned');
expect(!registry.includes('client_home_native.css'),'legacy client_home_native.css still registered');
for(const [file,hash] of Object.entries(manifest.files)){const p=path.join(root,file);if(!fs.existsSync(p)){if(file.startsWith('assets/'))continue;expect(false,`shell file missing ${file}`);continue;}const actual=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}console.log('R188.5.5.6.44 reference home + shell freeze: OK');
