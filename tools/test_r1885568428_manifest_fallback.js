const fs=require('fs');
const s=fs.readFileSync('api/bootstrap.php','utf8');
function expect(ok,msg){if(!ok){console.error('FAIL:',msg);process.exit(1);}}
expect(s.includes("$declaredVersion = defined('KARETA_DB_VERSION')"),'declared DB version not used in manifest fallback');
expect(s.includes('$fileVersion > $declaredVersion'),'future migration filename filter missing');
expect(s.includes("MIGRATION_FUTURE_FILES"),'future migration fallback audit missing');
expect(s.includes("Migration sequence gap before version"),'canonical prefix gap guard was removed');
console.log('R188.5.5.6.84.28 manifest fallback regression: OK');
