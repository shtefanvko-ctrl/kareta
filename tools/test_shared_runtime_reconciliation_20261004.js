'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(value,message)=>{if(!value){console.error('FAIL:',message);process.exit(1);}};

const registry=read('inc/asset_registry.php');
const routes=read('js/next/route_registry.js');
const nav=read('js/next/dynamic_navigation.js');
const role=read('js/next/role_access.js');
const communityApi=read('js/next/community/community_api.js');
const communityPage=read('js/next/pages/community.js');
const notifications=read('js/next/pages/notifications.js');
const identityBundle=read('js/boot/runtime_identity_bundle.js');
const assistant=read('js/next/electrician/electrician_assistant_runtime.js');
const assistantCss=read('css/next/electrician_assistant.css');
const domain=read('api/domain.php');
const db=read('api/db.php');
const capabilityRegistry=read('api/identity/capability_registry.php');

expect(routes.includes("assistant:Object.freeze({ path:'#/assistant', label:'Помощник электрика'"),
  'electrician assistant route presentation missing');
expect(nav.includes("{ key:'assistant', section:'work', menu:63.2, contextProfiles:['master'], allowOrganization:true }"),
  'electrician assistant navigation scope missing');
expect(registry.includes("'css/next/electrician_assistant.css'")&&registry.includes("'js/next/electrician/electrician_assistant_runtime.js'"),
  'electrician assistant lazy assets missing');
expect(assistant.includes('KaretaElectricianAssistant')&&assistant.includes('data-electrician-workflow')&&assistant.includes('SAFE_BLOCK'),
  'electrician assistant runtime/safety contract missing');
expect(assistantCss.includes('.k-electrician-mode')&&assistantCss.includes('.k-electrician-workflow'),
  'electrician assistant CSS contract missing');

expect(nav.includes("{ key:'notifications', section:'communication', menu:91, any:['notifications.manage']"),
  'notifications navigation does not use canonical capability');
expect(nav.includes("{ key:'following', section:'social', menu:110 }")&&!nav.includes("{ key:'following', section:'social', menu:110, public:true }"),
  'following remains public');
expect(role.includes("const SESSION_ONLY_ROUTES = new Set(['notifications','following']);")&&
       role.includes("if (SESSION_ONLY_ROUTES.has(key) && !hasProtectedSession()) return false;"),
  'session-only direct-route guard missing');
expect(communityApi.includes("if(!hasProtectedSession())return new Set();"),
  'Community may call protected following API without session');
expect(communityPage.includes("mode:hasProtectedSession()?'subscriptions':'recommended'")&&
       communityPage.includes("...(hasProtectedSession()?[['subscriptions','Подписки','#/community/subscriptions','heart']]:[])"),
  'Community subscription UI boundary missing');
expect(notifications.indexOf('if(!identityAuthenticated())')>=0&&
       notifications.indexOf("api/domain.php?action=notifications.list")>notifications.indexOf('if(!identityAuthenticated())'),
  'Notifications API request can happen before auth guard');
expect(notifications.includes("if(Number(error?.status||0)===401)")&&notifications.includes("window.clearInterval(pollTimer)"),
  'Notifications polling does not stop on expired session');
expect(notifications.includes('.k-notifications-canon-actions')&&notifications.includes('.k-notifications-canon-search'),
  'Auth guard is not adapted to canonical Notifications shell');

expect(domain.includes("kareta_require_capability($pdo,$user,'notifications.manageOwn');"),
  'server notification capability protection missing');
expect(capabilityRegistry.includes("'notifications.manageOwn' => 'notifications.manage'"),
  'notification capability canonicalization missing');
expect(db.includes("if ($action === 'masterSocial.following')")&&db.includes("kareta_require_any_role(['client','master','sto','seller','admin','owner'])"),
  'server following role protection missing');

expect(identityBundle.includes("label:'Помощник электрика'")&&
       identityBundle.includes("key:'assistant', section:'work', menu:63.2")&&
       identityBundle.includes("any:['notifications.manage']")&&
       identityBundle.includes("SESSION_ONLY_ROUTES = new Set(['notifications','following'])"),
  'runtime identity bundle is not synchronized');

console.log(JSON.stringify({
  status:'PASS',
  assistant:'ELECTRICIAN_MODE',
  authBoundaries:['notifications','following','community-subscriptions'],
  notificationsCapability:'notifications.manage',
  runtimeBundle:'SYNCED'
}));
