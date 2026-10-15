'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const root=path.resolve(__dirname,'..');
let ok=0,fail=0;
function expect(name,cond,detail=''){if(cond){ok++;console.log('PASS',name);}else{fail++;console.error('FAIL',name,detail);}}

const jsonPath=path.join(root,'api','migration_manifest.json');
const phpPath=path.join(root,'api','migration_manifest.php');
expect('JSON migration mirror exists',fs.existsSync(jsonPath));
expect('PHP canonical migration manifest exists',fs.existsSync(phpPath));

const manifest=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
const php=fs.readFileSync(phpPath,'utf8');
const config=fs.readFileSync(path.join(root,'config.php'),'utf8');
const declared=Number(config.match(/KARETA_DB_VERSION',\s*(\d+)/)?.[1]||0);
expect('JSON target equals declared DB version',manifest.targetDbVersion===declared,`json=${manifest.targetDbVersion}, declared=${declared}`);

const phpVersion=Number(php.match(/'version'\s*=>\s*(\d+)/)?.[1]||0);
expect('PHP manifest version equals declared DB version',phpVersion===declared,`php=${phpVersion}, declared=${declared}`);

const phpRows=new Map();
for(const match of php.matchAll(/^\s*(\d+)\s*=>\s*\['file'\s*=>\s*'([^']+)'\s*,\s*'checksum'\s*=>\s*'([0-9a-f]{64})'\],?\s*$/gmi)){
  phpRows.set(Number(match[1]),{file:match[2],checksum:match[3]});
}
expect('PHP manifest count equals declared DB version',phpRows.size===declared,String(phpRows.size));
expect('JSON manifest count equals declared DB version',Array.isArray(manifest.migrations)&&manifest.migrations.length===declared,String(manifest.migrations?.length));

let names=true,hashes=true,mirror=true;
for(let i=1;i<=declared;i++){
  const row=manifest.migrations[i-1]||{};
  const canonical=phpRows.get(i);
  const file=String(row.file||'');
  if(Number(row.version)!==i||!/^\d{3}_[A-Za-z0-9_]+\.php$/.test(file)||Number(file.slice(0,3))!==i) names=false;
  if(!canonical||canonical.file!==file||canonical.checksum!==String(row.sha256||'').toLowerCase()) mirror=false;
  const full=path.join(root,'api','migrations',file);
  if(!fs.existsSync(full)){hashes=false;continue;}
  const sha=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(sha!==String(row.sha256||'').toLowerCase()) hashes=false;
}
expect('manifest canonical names',names);
expect('JSON checksums match package',hashes);
expect('JSON mirror matches PHP canonical manifest',mirror);

const bootstrap=fs.readFileSync(path.join(root,'api','bootstrap.php'),'utf8');
const a=bootstrap.indexOf('function kareta_discover_migrations(): array');
const b=bootstrap.indexOf('function kareta_get_max_applied_migration',a);
const discovery=bootstrap.slice(a,b);
expect('runtime uses PHP canonical manifest',discovery.includes("migration_manifest.php"));
expect('canonical branch verifies checksum before require',discovery.indexOf("hash_file('sha256', $file)")<discovery.indexOf('require $file'));
expect('stale migration files are explicitly ignored when manifest is present',discovery.includes('Ignored stale migration files'));
expect('legacy fallback remains bounded by declared DB version',discovery.includes('Legacy fallback')&&discovery.includes('fileVersion > $declaredVersion'));

console.log(`RESULT ${ok}/${ok+fail}`);
process.exit(fail?1:0);
