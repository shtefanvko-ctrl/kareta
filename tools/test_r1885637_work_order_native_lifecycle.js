'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
const page=read('js/next/pages/work_order.js'),css=read('css/next/work_order_windows.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),windowEngine=read('js/next/window_engine.js'),config=read('config.php'),manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const dbv=Number((/KARETA_DB_VERSION',\s*(\d+)/.exec(config)||[])[1]||0);expect(dbv>=127,`R77 baseline requires DB version 127 or newer (got ${dbv})`);
for(const label of ['Диагностика','Смета','Допработы','Запчасти','Контроль','Выдача','Гарантия'])expect(page.includes(`'${label}'`)||page.includes(`>${label}<`),`missing R77 tab ${label}`);
for(const marker of ['k-work-tabs','data-work-tab','data-work-panel','k-work-action-zone','k-work-summary-r77','k-work-progress','k-work-modal-r77','showModal','choiceField'])expect(page.includes(marker)||css.includes(marker),`missing R77 marker ${marker}`);
expect(!/<select\b/i.test(page),'R77 work order must not contain active <select> controls');
for(const old of ['k-work-columns','k-lifecycle-console','k-work-section k-sto-workflow-panel'])expect(!page.includes(old),`legacy long-page surface remains: ${old}`);
for(const form of ['data-lifecycle-form="diagnostics"','data-lifecycle-form="quality"','data-lifecycle-form="handover"','data-lifecycle-form="delivery"','data-aftercare-form="claim-submit"','data-aftercare-form="finance-settings"','data-lifecycle-modal="inventory"'])expect(page.includes(form),`lifecycle backend bridge missing ${form}`);
expect(page.includes('<dialog class="k-work-modal k-work-modal-r77"')&&page.includes('modalEl.showModal()'),'second-level action window must use native dialog top layer');
expect(windowEngine.includes("key:'workOrder'")&&windowEngine.includes('KaretaWorkOrderPages'),'R76 entity Window Engine bridge lost');
expect(registry.includes('css/next/work_order_windows.css'),'R77 CSS missing from asset registry');
expect(asset.includes('r1885637-work-order-native-lifecycle')&&sw.includes('r1885637-work-order-native-lifecycle'),'R77 release suffix missing');
for(const token of ['.k-work-tab-panel[hidden]','.k-work-action-zone{position:sticky','.k-work-modal-r77::backdrop','.k-work-choice','.k-work-order-r77 select'])expect(css.includes(token),`R77 CSS contract missing ${token}`);
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}console.log('R188.5.5.6.77 Work Order Native Lifecycle: tabs + single action zone + native second-level dialogs + no selects + Shell Freeze 2 OK');
