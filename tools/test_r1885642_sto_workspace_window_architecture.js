'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const page=read('js/next/pages/sto_workplace.js');
const css=read('css/next/sto_workspace_windows.css');
const reg=read('inc/asset_registry.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const config=read('config.php');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);
expect(dbv>=127,`R82 is UX-only and baseline requires DB 127 or newer (got ${dbv})`);
for(const marker of ["STO_WORKSPACE_R82_CONTRACT='R188.5.5.6.82'",'k-sto-r82-workspace','k-sto-r82-commandbar','k-sto-r82-operations','k-sto-r82-operation-list','stoOperationRows','operationsFeed','workspaceDialogs','data-sto-workspace-window="${type}"',"shell('schedule'","shell('recovery'","shell('capacity'",'data-sto-window-open="schedule"','data-sto-window-open="recovery"','data-sto-window-open="capacity"','data-sto-ops-filter'])expect(page.includes(marker),`R82 workplace missing ${marker}`);
const render=/function renderData\(d\)\{([\s\S]*?)\n  \}\n\n  function renderMasterCandidates/.exec(page);const body=render?render[1]:'';
expect(body.includes('${operationsFeed(d)}${workspaceDialogs(d)}${dialogs()}'),'R82 main render must be dispatcher feed + dialogs');
for(const forbidden of ['KaretaDashboardEngine?.render','k-sto-quick-nav','${scheduleCommand(d)}${recoveryControl(d)}','<h2>Ремзона</h2>','<h2>Очередь</h2>','<h2>Мои мастера</h2>','<h2>Последние заказы</h2>'])expect(!body.includes(forbidden),`R82 main render still contains long STO surface ${forbidden}`);
expect(!page.includes('<select'),'R82 STO workspace must not render select/dropdown');
for(const oldGuard of ['apiModule.assignMaster','apiModule.assignPair','apiModule.incidentPreview','apiModule.incidentApply','apiModule.recoveryApply','apiModule.release'])expect(page.includes(oldGuard),`R82 lost existing guarded action ${oldGuard}`);
for(const token of ['.k-sto-r82-workspace','.k-sto-r82-operation','.k-sto-r82-window','.k-sto-r82-toggle-grid','#k-sto-workplace .k-sto-r73-picker','height:100dvh'])expect(css.includes(token),`R82 CSS missing ${token}`);
for(const frozen of ['#k-mobile-nav','#k-desktop-nav','#k-shell-header','.k-menu-drawer','.k-context-switch'])expect(!css.includes(frozen),`R82 CSS targets frozen shell ${frozen}`);
expect(reg.includes('css/next/sto_workspace_windows.css'),'R82 CSS not registered');
expect(asset.includes('r1885642-sto-workspace-window-architecture')&&sw.includes('r1885642-sto-workspace-window-architecture'),'R82 release suffix missing');
expect(asset.includes('r1885641-master-workspace-window-architecture'),'R81 must precede R82');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.82 STO Workspace Window Architecture: one dispatcher feed + large schedule/recovery/capacity windows + guarded assignments + Shell Freeze 2 OK');
