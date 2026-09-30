'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const apiRoot=path.join(root,'api');

function walk(dir){
  const out=[];
  for(const name of fs.readdirSync(dir)){
    const file=path.join(dir,name);
    const st=fs.statSync(file);
    if(st.isDirectory())out.push(...walk(file));
    else if(file.endsWith('.php'))out.push(file);
  }
  return out;
}
function directRoleGateCount(text){
  let count=0;
  for(const line of text.split(/\r?\n/)){
    if(/function\s+kareta_require_(?:any_)?role\s*\(/.test(line))continue;
    count+=(line.match(/kareta_require_role\s*\(/g)||[]).length;
    count+=(line.match(/kareta_require_any_role\s*\(/g)||[]).length;
  }
  return count;
}
const counts={};
let total=0;
for(const file of walk(apiRoot)){
  const rel=path.relative(root,file).replace(/\\/g,'/');
  const count=directRoleGateCount(fs.readFileSync(file,'utf8'));
  if(count){counts[rel]=count;total+=count;}
}
const ordered=Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));
const result={schema:'kareta.legacy-role-inventory.v2',total,files:Object.keys(ordered).length,dbPhp:ordered['api/db.php']||0,remainingByFile:ordered};
const budgetPath=path.join(root,'docs','architecture','LEGACY_ROLE_BUDGET_CURRENT.json');
const baseline=JSON.parse(fs.readFileSync(budgetPath,'utf8'));
const failures=[];
if(total>Number(baseline.budget?.total||0))failures.push('total '+total+' > '+baseline.budget.total);
if(result.dbPhp>Number(baseline.budget?.dbPhp||0))failures.push('api/db.php '+result.dbPhp+' > '+baseline.budget.dbPhp);
for(const [file,count] of Object.entries(ordered)){
  const allowed=Number(baseline.remainingByFile?.[file]??0);
  if(count>allowed)failures.push(file+' '+count+' > '+allowed);
}
console.log(JSON.stringify(result,null,2));
if(failures.length){
  console.error('LEGACY_ROLE_NO_GROWTH: FAIL '+failures.join('; '));
  process.exit(1);
}
console.log('LEGACY_ROLE_NO_GROWTH: PASS total='+total+'/'+baseline.budget.total+' db='+result.dbPhp+'/'+baseline.budget.dbPhp);
