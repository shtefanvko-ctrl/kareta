'use strict';
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');

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
function expect(v,m){if(!v){console.error('FAIL:',m);process.exit(1);}}

let s=run({KARETA_ENVIRONMENT:'staging'});
expect(s.environment==='staging','staging environment mismatch');
expect(s.autoUpgrade===true,'staging auto-upgrade must default ON');
expect(s.autoMigrate===true,'staging auto-upgrade must activate migration runner');
expect(s.window===false,'staging does not require production window');

s=run({KARETA_ENVIRONMENT:'staging',KARETA_DB_AUTO_UPGRADE:'0'});
expect(s.autoUpgrade===false,'staging explicit OFF ignored');
expect(s.autoMigrate===false,'staging explicit OFF must not auto-migrate');

s=run({KARETA_ENVIRONMENT:'production',KARETA_DB_AUTO_UPGRADE:'1'});
expect(s.autoUpgrade===false,'production auto-upgrade must be fail-closed without window');
expect(s.autoMigrate===false,'production migration must be fail-closed without window');
expect(s.window===false,'production window unexpectedly open');

s=run({
  KARETA_ENVIRONMENT:'production',
  KARETA_DB_AUTO_UPGRADE:'1',
  KARETA_DB_RUNTIME_MIGRATION_WINDOW:'1'
});
expect(s.autoUpgrade===true,'production approved maintenance window did not enable auto-upgrade');
expect(s.autoMigrate===true,'production approved maintenance window did not enable migration runner');
expect(s.window===true,'production maintenance window not detected');

console.log('DB_AUTO_UPGRADE_84_155: PASS');
