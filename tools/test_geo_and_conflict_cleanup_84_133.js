const fs=require('fs');
const root='/home/karetakz/sites/kareta.kz';
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const assert=(v,m)=>{if(!v)throw new Error(m)};

const geo=read('js/next/reference_client_shell.js');
const flow=read('js/next/client/first_vehicle_flow.js');
const db=read('api/db.php');
const cabinet=read('api/client_cabinet.php');
const shellCss=read('css/next/shell_84_109_restore.css');
const guardCss=read('css/routes/client_guard_postlude.css');
const version=read('inc/asset_version.php');

assert(geo.includes("const actions=header?.querySelector(':scope > .k-shell-actions')"),'geo does not resolve shell actions');
assert(geo.includes('actions.insertBefore(button,actions.firstChild);'),'geo is not inserted into shell actions');
assert(!geo.includes("brand.insertAdjacentElement('afterend',button)"),'legacy geo insertion beside brand remains');
assert(shellCss.includes('#k-shell-header>.k-shell-actions>.k-shell-location-icon'),'geo CSS does not scope to shell actions');
assert(guardCss.includes('#k-shell-header>.k-shell-actions>.k-shell-location-icon'),'route guard missing shell-actions geo contract');

assert(flow.includes('api.dismissFirstEntry({})'),'dismiss still sends a revision');
assert(!flow.includes('dismissFirstEntry({expectedRevision:state.serverRevision})'),'stale dismiss optimistic lock remains');
assert(cabinet.includes("array_key_exists('expectedRevision',$b)?"),'backend optional revision contract missing');

const globalGuard="if ($pdo) kareta_master_workplace_require_onboarding_completed($pdo);";
assert(!db.includes(globalGuard),'global Master onboarding guard still blocks db.php');
const masterEndpoint=(db.match(/masterWorkplace\.get[^\n]*kareta_master_workplace_require_onboarding_completed/g)||[]).length;
assert(masterEndpoint===1,'Master-specific onboarding guard must remain exactly once');

assert(/const KARETA_ASSET_VERSION = '188\.5\.5\.6\.84\.\d+';/.test(version),'version marker missing');
console.log('GEO_AND_CONFLICT_CLEANUP: PASS');
