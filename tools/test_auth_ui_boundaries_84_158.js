'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const nav=read('js/next/dynamic_navigation.js');
const role=read('js/next/role_access.js');
const communityApi=read('js/next/community/community_api.js');
const communityPage=read('js/next/pages/community.js');
const notifications=read('js/next/pages/notifications.js');
const identityBundle=read('js/boot/runtime_identity_bundle.js');
const domain=read('api/domain.php');
const db=read('api/db.php');

expect(nav.includes("{ key:'notifications', section:'communication', menu:91, any:['notifications.read']"),
  'notifications route is not capability-gated');
expect(nav.includes("{ key:'following', section:'social', menu:110 }"),
  'following route is not authenticated-only');
expect(!nav.includes("{ key:'following', section:'social', menu:110, public:true }"),
  'following remains public');

expect(role.includes("const SESSION_ONLY_ROUTES = new Set(['notifications','following']);"),
  'legacy/direct session-only route guard missing');
expect(role.includes("if (SESSION_ONLY_ROUTES.has(key) && !hasProtectedSession()) return false;"),
  'direct protected route guard not enforced');

expect(communityApi.includes("if(!hasProtectedSession())return new Set();"),
  'community subscriptions still call protected following API for guests');
expect(communityPage.includes("mode:hasProtectedSession()?'subscriptions':'recommended'"),
  'anonymous subscriptions deep-link is not downgraded');
expect(communityPage.includes("...(hasProtectedSession()?[['subscriptions','Подписки','#/community/subscriptions']]:[])"),
  'subscriptions tab remains visible to anonymous users');

const authGuard=notifications.indexOf("if(!identityAuthenticated())");
const listCall=notifications.indexOf("api/domain.php?action=notifications.list");
expect(authGuard>=0&&listCall>authGuard,'notifications API request occurs before auth guard');
expect(notifications.includes("if(Number(error?.status||0)===401)"),
  'notifications does not stop after session expiry');
expect(notifications.includes("disposed=true;window.clearInterval(pollTimer);"),
  'notifications keeps polling after 401');

expect(domain.includes("kareta_require_capability($pdo,$user,'notifications.read');"),
  'server notifications capability protection was weakened');
expect(db.includes("masterSocial.following') { if (!$pdo) _no_db(); kareta_require_any_role"),
  'server following role protection was weakened');

expect(identityBundle.includes("SESSION_ONLY_ROUTES = new Set(['notifications','following'])"),
  'identity boot bundle missing direct-route auth guard');
expect(identityBundle.includes("{ key:'following', section:'social', menu:110 }"),
  'identity boot bundle still exposes following as public');

console.log('AUTH_UI_BOUNDARIES_84_158: PASS');
