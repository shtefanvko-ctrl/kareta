const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function must(c,m){if(!c){console.error('FAIL:',m);process.exit(1)}}
const nav=read('js/next/navigation_core.js');
const state=read('js/next/navigation_state.js');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
must(nav.includes('function preserveRouteAfterContextChange'),'route preservation helper exists');
must(nav.includes("navigation.canAccess(requested)"),'route is preserved only when allowed');
must(nav.includes("registry.keyFromHash(desiredHash) === requested"),'nested hash belongs to preserved route');
must(nav.includes("preserveRouteAfterContextChange(previousRoute, previousHash, 'account-context-switch')"),'manual context switch preserves current route');
must(nav.includes("preserveRouteAfterContextChange(localRoute, localHash, 'cross-tab-context-sync')"),'cross-tab context sync preserves local route');
must(nav.includes('restorePrevious(previous, previousRoute, previousHash)'),'rollback retains nested hash');
must(!nav.includes("const route = defaultRoute();\n      window.KaretaRouteRuntime?.navigate?.(route, { source:'cross-tab-context-sync'"),'cross-tab sync no longer forces default route');
must(state.includes("document.addEventListener('visibilitychange'") && state.includes('restore(current(),{replayActive:false,dispatchEvents:false')||state.includes("document.addEventListener('visibilitychange'") && state.includes('restore(current(), { replayActive:false, dispatchEvents:false'),'visibility resume restores current hash/page state without side effects');
must(asset.includes('r1885585-route-session-position-preservation') && sw.includes('r1885585-route-session-position-preservation'),'asset/service worker synchronized');
console.log('OK R188.5.5.6.25 route/session position preservation');
