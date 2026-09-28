const fs=require('fs');
const root='/home/karetakz/sites/kareta.kz';
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const a=(v,m)=>{if(!v)throw new Error(m)};
const shell=read('css/next/shell_84_109_restore.css');
const boot=read('css/runtime_boot_bundle.css');
const guard=read('css/routes/client_guard_postlude.css');
const reg=read('inc/asset_registry.php');
const home=read('css/routes/home_responsive_84_134.css');
const providers=read('css/routes/providers_runtime.css');
const parts=read('css/routes/parts_runtime.css');
const details=read('css/routes/details_runtime.css');
const ver=read('inc/asset_version.php');

a(shell.includes('@media(min-width:600px)'), '600+ right rail breakpoint missing');
a(shell.includes('--k-client-right-nav-w:88px'), 'tablet rail width missing');
a(shell.includes('--k-client-right-nav-w:132px'), 'desktop rail width missing');
a(shell.includes('right:var(--k-client-right-nav-w)!important'), 'header does not stop before right rail');
a(shell.includes('position:fixed!important;top:0!important;right:0!important;bottom:0!important'), 'desktop nav is not fixed to right edge');
a(shell.includes('flex-direction:column!important'), 'right nav is not vertical');
a(shell.includes('@media(max-width:599px)'), 'mobile breakpoint missing');
a(shell.includes('#k-mobile-nav{display:grid!important}'), 'mobile bottom nav not restored');
a(shell.includes('#k-mobile-nav{display:none!important}'), 'tablet/desktop bottom nav not disabled');

a(boot.includes('R188.5.5.6.84.134 — <600 bottom nav; >=600 right navigation rail.'), 'boot shell not synchronized');
a(guard.includes('R188.5.5.6.84.134 — <600 bottom nav; >=600 right navigation rail.'), 'late route guard shell not synchronized');

a(!reg.includes("'cssHomeResponsive84134'"), 'obsolete Home lazy responsive asset is still registered');
const homeSource=read('css/next/home_simple.css');
a(homeSource.includes('R188.5.5.6.84.135 — Client Home responsive composition with right rail.'), 'Home responsive contract missing from canonical source');
a(homeSource.includes('@media (min-width:600px) and (max-width:899px)'), 'home tablet layout missing');
a(homeSource.includes('@media (min-width:900px)'), 'home desktop layout missing');

a(providers.includes('R188.5.5.6.84.134 — tablet/desktop adaptation with right navigation rail.'), 'providers responsive bundle stale');
a(parts.includes('R188.5.5.6.84.134 — Parts responsive grids after right-rail shell.'), 'parts responsive bundle stale');
a(details.includes('R188.5.5.6.84.134 — provider/profile/booking adaptation for tablet + desktop right rail.'), 'details responsive bundle stale');

a(/const KARETA_ASSET_VERSION = '188\.5\.5\.6\.84\.\d+';/.test(ver), 'release marker missing');
console.log('RIGHT_RAIL_RESPONSIVE: PASS');