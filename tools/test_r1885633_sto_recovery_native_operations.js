const fs=require('fs'),crypto=require('crypto'),path=require('path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),fail=[],expect=(v,m)=>{if(!v)fail.push(m)};
const page=read('js/next/pages/sto_workplace.js'),apiClient=read('js/next/work_orders/sto_workplace_api.js'),backend=read('api/sto_workplace.php'),db=read('api/db.php'),css=read('css/next/sto_recovery_native_operations.css'),registry=read('inc/asset_registry.php'),asset=read('inc/asset_version.php'),sw=read('sw.js'),config=read('config.php');
const dbv=Number((/define\('KARETA_DB_VERSION',\s*(\d+)\)/.exec(config)||[])[1]||0);expect(dbv>=125,'R73 requires DB version at least 125');
for(const fn of ['kareta_sto_recovery_preview_data','kareta_sto_recovery_apply','kareta_sto_recovery_protect','kareta_sto_recovery_notify_resend','kareta_sto_order_master_candidates','kareta_sto_order_bay_candidates','kareta_sto_joint_schedule'])expect(backend.includes(`function ${fn}`),`missing backend ${fn}`);
for(const route of ['stoRecovery.preview','stoRecovery.apply','stoRecovery.protect','stoRecovery.notifyResend','stoOrders.masterCandidates','stoBays.candidates'])expect(db.includes(route),`missing route ${route}`);
for(const method of ['masterCandidates','bayCandidates','recoveryPreview','recoveryApply','recoveryProtect','recoveryNotifyResend'])expect(apiClient.includes(method),`missing api client ${method}`);
expect(!page.includes('<select'),'active STO workplace still renders select');
for(const marker of ['k-sto-r73-joint','k-sto-r73-recovery','data-sto-master-open','data-sto-bay-open','data-sto-recovery-apply-selected','data-sto-recovery-protect','Совместный график','Диспетчеризация производства'])expect(page.includes(marker),`missing UI marker ${marker}`);
expect(backend.includes("BINARY o.sto_id=BINARY ?")&&backend.includes('scope_blocked'),'STO recovery scope guard missing');
expect(backend.includes("error'=>'bay_busy")&&backend.includes("status='active' LIMIT 1 FOR UPDATE"),'server-side active bay guard missing');
expect(css.includes('#k-sto-workplace .k-sto-master-assign')&&css.includes('.k-sto-r73-candidate')&&css.includes('.k-sto-r73-order-row'),'R73 flat/native CSS contract missing');
expect(registry.includes('css/next/sto_recovery_native_operations.css'),'R73 stylesheet missing from registry');
expect(asset.includes('r1885633-sto-recovery-native-operations'),'R73 asset tag missing');expect(sw.includes('r1885633-sto-recovery-native-operations'),'R73 SW tag missing');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`Shell Freeze 2 hash changed: ${file}`)}
if(fail.length){console.error(fail.join('\n'));process.exit(1)}console.log('R188.5.5.6.73 STO recovery + native assignments + flat operations + Shell Freeze 2 OK');
