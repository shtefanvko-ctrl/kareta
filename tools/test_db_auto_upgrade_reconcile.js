'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m);};

function run(envPatch){
  const php=[
    "require 'config.php';",
    "echo json_encode([",
    "'environment'=>KARETA_ENVIRONMENT,",
    "'autoUpgrade'=>KARETA_DB_AUTO_UPGRADE,",
    "'autoMigrate'=>KARETA_DB_AUTO_MIGRATE,",
    "'window'=>KARETA_DB_RUNTIME_MIGRATION_WINDOW,",
    "'dbVersion'=>KARETA_DB_VERSION",
    "], JSON_UNESCAPED_SLASHES);"
  ].join('');
  const env={...process.env,
    KARETA_ENVIRONMENT:'staging',
    KARETA_DB_NAME:'kareta_test',
    KARETA_DB_USER:'kareta_test',
    KARETA_DB_PASS:'test-password',
    KARETA_DB_AUTO_UPGRADE:'',
    KARETA_DB_AUTO_MIGRATE:'',
    KARETA_DB_RUNTIME_MIGRATION_WINDOW:'',
    ...envPatch
  };
  const result=spawnSync('php',['-r',php],{cwd:root,env,encoding:'utf8'});
  if(result.status!==0) throw new Error('php config probe failed: '+result.stderr);
  return JSON.parse(result.stdout);
}

let s=run({KARETA_ENVIRONMENT:'staging'});
expect(s.environment==='staging','staging environment mismatch');
expect(s.autoUpgrade===true,'staging auto-upgrade must default ON');
expect(s.autoMigrate===true,'staging auto-upgrade must activate migration runner');
expect(s.window===false,'staging does not require production window');

s=run({KARETA_ENVIRONMENT:'staging',KARETA_DB_AUTO_UPGRADE:'0'});
expect(s.autoUpgrade===false,'staging explicit OFF ignored');
expect(s.autoMigrate===false,'staging explicit OFF must not auto-migrate');

s=run({KARETA_ENVIRONMENT:'production',KARETA_DB_AUTO_UPGRADE:'1'});
expect(s.autoUpgrade===false,'production auto-upgrade must fail closed without window');
expect(s.autoMigrate===false,'production migration must fail closed without window');
expect(s.window===false,'production window unexpectedly open');

s=run({KARETA_ENVIRONMENT:'production',KARETA_DB_AUTO_UPGRADE:'1',KARETA_DB_RUNTIME_MIGRATION_WINDOW:'1'});
expect(s.autoUpgrade===true,'approved production window did not enable auto-upgrade');
expect(s.autoMigrate===true,'approved production window did not enable migration runner');
expect(s.window===true,'production maintenance window not detected');

const bootstrap=read('api/bootstrap.php');
const diagnostics=read('api/runtime_diagnostics.php');
expect(bootstrap.includes("db_upgrade.log"),'DB upgrade audit log missing');
expect(bootstrap.includes("kareta_db_auto_upgrade_log('START'"),'START audit missing');
expect(bootstrap.includes("kareta_db_auto_upgrade_log('PASS'"),'PASS audit missing');
expect(bootstrap.includes("kareta_db_auto_upgrade_log('FAIL'"),'FAIL audit missing');
expect(bootstrap.includes("SELECT GET_LOCK"),'serialized schema advisory lock missing');
expect(bootstrap.includes("afterVersion !== $targetVersion"),'post-upgrade version check missing');
expect(diagnostics.includes("'dbAutoUpgrade'")&&diagnostics.includes("'dbAutoMigrate'")&&diagnostics.includes("'dbTargetVersion'"),'DB upgrade diagnostics missing');

if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('DB_AUTO_UPGRADE_RECONCILE: PASS stagingDefault=1 productionFailClosed=1 audit=1');
