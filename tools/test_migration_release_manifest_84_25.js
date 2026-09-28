'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
let ok=0,fail=0;
function expect(name,cond,detail=''){if(cond){ok++;console.log('PASS',name);}else{fail++;console.error('FAIL',name,detail);}}
const manifestPath=path.join(root,'api','migration_manifest.json');
expect('migration manifest exists',fs.existsSync(manifestPath));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
expect('manifest schemaVersion 1',manifest.schemaVersion===1);
const config=fs.readFileSync(path.join(root,'config.php'),'utf8');
const match=config.match(/KARETA_DB_VERSION',\s*(\d+)/);
const declared=Number(match?.[1]||0);
expect('manifest target equals declared DB version',manifest.targetDbVersion===declared,`manifest=${manifest.targetDbVersion}, declared=${declared}`);
expect('manifest count equals declared DB version',Array.isArray(manifest.migrations)&&manifest.migrations.length===declared,String(manifest.migrations?.length));
const versions=(manifest.migrations||[]).map(x=>Number(x.version));
expect('manifest versions continuous 1..target',versions.every((v,i)=>v===i+1)&&versions.at(-1)===declared,versions.slice(-5).join(','));
let hashes=true,names=true;
for(const m of manifest.migrations||[]){
  const file=String(m.file||'');
  if(!/^\d{3}_[A-Za-z0-9_]+\.php$/.test(file)||Number(file.slice(0,3))!==Number(m.version)){names=false;continue;}
  const full=path.join(root,'api','migrations',file);
  if(!fs.existsSync(full)){hashes=false;continue;}
  const sha=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(sha!==String(m.sha256||'').toLowerCase()) hashes=false;
}
expect('manifest canonical names',names);
expect('manifest checksums match package',hashes);
expect('DB version equals manifest target',declared===manifest.targetDbVersion);
const bootstrap=fs.readFileSync(path.join(root,'api','bootstrap.php'),'utf8');
const a=bootstrap.indexOf('function kareta_discover_migrations(): array');
const b=bootstrap.indexOf('function kareta_get_max_applied_migration',a);
const discovery=bootstrap.slice(a,b);
expect('discovery uses release manifest',discovery.includes('migration_manifest.json'));
expect('discovery does not glob arbitrary migration PHP',!discovery.includes("glob($dir . '/*.php')"));
expect('file context set before require',discovery.indexOf('migration.discovery.load')<discovery.indexOf('require $file'));
expect('manifest checksum verified before require',discovery.indexOf("hash_file('sha256', $file)")<discovery.indexOf('require $file'));
expect('extra stale PHP explicitly ignored',discovery.includes('Extra PHP files are intentionally ignored'));
expect('manifest mismatch reason is public-safe',bootstrap.includes('migration_manifest_invalid')&&bootstrap.includes('migration_file_load_failed')&&bootstrap.includes('migration_package_checksum_mismatch'));
const diagnostics=fs.readFileSync(path.join(root,'api','runtime_diagnostics.php'),'utf8');
expect('safe runtime diagnostics expose manifest state',diagnostics.includes('migrationManifestStatus')&&diagnostics.includes('migrationManifestTarget')&&diagnostics.includes('migrationIgnoredPhpFiles'));
expect('safe runtime diagnostics expose PHP and PDO driver availability',diagnostics.includes('phpVersion')&&diagnostics.includes('pdoMysqlDriverAvailable'));
console.log(`RESULT ${ok}/${ok+fail}`); process.exit(fail?1:0);
