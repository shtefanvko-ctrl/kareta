const fs=require('fs');
const css=fs.readFileSync('css/next/client_surface_layout.css','utf8');
const registry=fs.readFileSync('inc/asset_registry.php','utf8');
const version=fs.readFileSync('inc/asset_version.php','utf8');
const errors=[];
const must=(ok,msg)=>{if(!ok)errors.push(msg);};
must(css.includes('html[data-user-role="client"] #k-page-outlet'),'CLIENT outlet override must be explicitly role-scoped');
must(/html\[data-user-role="client"\] #k-page-outlet\s*\{[\s\S]*?padding:\s*0\s*!important;/m.test(css),'CLIENT page outlet padding must be exactly zero');
must(!/html\[data-user-role="master"\] #k-page-outlet\s*\{[\s\S]*?padding:\s*0\s*!important;/m.test(css),'MASTER outlet padding must not be zeroed by CLIENT override');
const clientPos=registry.indexOf("'css/next/client_surface_layout.css'");
const mobileBackPos=registry.indexOf("'css/next/mobile_back.css'");
const narrowPos=registry.indexOf("'css/next/narrow_mobile.css'");
must(clientPos>mobileBackPos && clientPos>narrowPos,'CLIENT outlet override CSS must load after shared mobile padding layers');
must(/188\.5\.5\.6\.84\.(\d+)/.test(version)&&Number(/188\.5\.5\.6\.84\.(\d+)/.exec(version)[1])>=16,'Asset version must be 84.16 or newer');
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1);}
console.log('CLIENT page outlet zero-padding 84.16 OK');
