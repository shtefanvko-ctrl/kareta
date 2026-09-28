'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const index=read('index.php');const fail=[];const ok=(v,m)=>{if(!v)fail.push(m)};
ok(index.includes('async function injectRuntime()'),'serial injectRuntime missing');
ok(index.includes('for(let index=0;index<scripts.length;index+=1)'),'runtime is not loaded sequentially');
ok(index.includes('await loadRuntimeScript(item,index)'),'next runtime script is not gated by prior load');
ok(index.includes('runtime_script_timeout:${index+1}/${state.total}:${item.path}'),'per-script timeout diagnostics missing');
ok(index.includes('runtime_script_execution_failed:${index+1}/${state.total}:${item.path}'),'execution failure diagnostics missing');
ok(index.includes("url.searchParams.delete('kareta_atomic')")&&index.includes("url.searchParams.delete('kareta_recovery')"),'atomic recovery params are not cleaned');
ok(!index.includes("url.searchParams.set('kareta_atomic',release)"),'release token still leaks into recovery URL');
ok(!index.includes('runtime_load_timeout:${state.loaded}/${state.total}'),'legacy global runtime timeout returned');
ok(index.includes('$cacheEpoch = $assetVersion;'),'cache epoch is not the short current asset token');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('Atomic runtime serial boot: OK');
