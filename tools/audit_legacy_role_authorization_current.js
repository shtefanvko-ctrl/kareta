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
console.log(JSON.stringify(result,null,2));
