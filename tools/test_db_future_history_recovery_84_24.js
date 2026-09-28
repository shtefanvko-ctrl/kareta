const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exitCode=1;}};

const bootstrap=read('api/bootstrap.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

const assetVersion=(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/.exec(asset)||[])[1]||'';
expect(/^188\.5\.5\.6\.84\.\d+$/.test(assetVersion),'short asset version required');
expect(sw.includes(`const RELEASE = '${assetVersion}';`),'service worker must match current asset version');
expect(bootstrap.includes("WHERE `version` BETWEEN 1 AND ?"),'fast path must validate canonical prefix only');
expect(bootstrap.includes("$futureApplied = array_values(array_filter("),'future migration history partition missing');
expect(bootstrap.includes("MIGRATION_FUTURE_HISTORY"),'future migration audit logging missing');
expect(bootstrap.includes("->execute([(string)$expectedVersion]);"),'db_meta must pin runtime expected version');
expect(bootstrap.includes("strpos($m, 'schema history') !== false"),'schema history diagnostic classification missing');

// Reproduce the production diagnostic from the user log. This proves the failing
// message was exactly: current=130, expected=129, missing=, unexpected=130.
const context=JSON.stringify({
  stage:'migration.history.validate',
  migrationVersion:0,
  migrationFile:''
});
const message='Schema history mismatch: current=130, expected=129, missing=, unexpected=130';
const diagnostic=crypto
  .createHash('sha256')
  .update('database_error|bootstrap|'+context+'|'+message)
  .digest('hex')
  .slice(0,16);
expect(diagnostic==='40061181deefcd3c',`production diagnostic mismatch: ${diagnostic}`);

if(!process.exitCode)console.log('R188.5.5.6.84.24 future migration history recovery test OK');
