'use strict';
// E3 source + render contract. DB/live authorization/browser remain separate gates.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const api=fs.readFileSync(path.join(root,'api/admin_operations.php'),'utf8');
const js=fs.readFileSync(path.join(root,'js/next/pages/admin_workspaces.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/next/workspace_admin.css'),'utf8');
const esc=x=>String(x??'').replace(/[&<>"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
const document={documentElement:{lang:'ru'}};
const window={KaretaPageUI:{pageShell:(_ctx,_title,_subtitle,html)=>html},KaretaUIKit:{esc},KaretaUIIcons:{svg:()=>''}};
vm.runInNewContext(js,{window,document,URLSearchParams,AbortController,MutationObserver:undefined});
const render=(route)=>window.KaretaAdminWorkspacePages.render(route,{});
let n=0;function check(name,test){test();n++;console.log('PASS admin E3: '+name);}
check('source JS syntax',()=>new Function(js));
check('users render role, status, real search and pager',()=>{
 const html=render('adminUsers');
 for(const token of ['data-admin-page="users"','data-admin-search','data-admin-filter="role"','data-admin-filter="status"','data-admin-pager','data-admin-apply','data-admin-clear'])assert.ok(html.includes(token),token);
 assert.ok(html.includes('Без профиля мастера/продавца'));
 assert.ok(!html.includes('data-admin-filter="city"'));
});
check('organizations render type, status, city and pager',()=>{
 const html=render('adminOrganizations');
 for(const token of ['data-admin-page="organizations"','data-admin-filter="type"','data-admin-filter="status"','data-admin-filter="city"','value="parts_store"','value="service_station"','data-admin-pager'])assert.ok(html.includes(token),token);
});
check('localized new controls in all three languages without route replacement',()=>{
 for(const [lang,needle] of [['ru','Найти'],['kk','Іздеу'],['en','Search']]){
  document.documentElement.lang=lang;
  const html=render('adminUsers');
  assert.ok(html.includes(needle),lang);
  assert.ok(html.includes('data-admin-i18n="apply"'),lang);
 }
 assert.ok(js.includes("attributeFilter:['lang']"),'observable language change');
 assert.ok(js.includes('updateInventoryLocale(root)'),'scoped copy update');
 document.documentElement.lang='ru';
});
check('existing monitoring and management preserved',()=>{
 for(const key of ['adminMonitoring','adminManagement','setAccountStatus','revokeSessions','setOrganizationStatus','resolveModerationCase'])assert.ok(js.includes(key),key);
 assert.ok(render('adminMonitoring').includes('data-admin-page="monitoring"'));
 assert.ok(render('adminManagement').includes('data-admin-page="management"'));
});
check('bounded, deterministic keyset filters and no untrusted SQL sort',()=>{
 assert.ok(api.includes("return max(1,min(50,(int)$raw))"));
 assert.ok(api.includes("if(mb_strlen($q)>120)"));
 assert.ok(api.includes("if(mb_strlen($city)>120)"));
 for(const token of ['a.id<?','o.id<?','ORDER BY a.id DESC LIMIT','ORDER BY o.id DESC LIMIT',"$st=$pdo->prepare($sql);$st->execute($params)","'nextCursor'=>$next"])assert.ok(api.includes(token),token);
 assert.ok(!api.includes('ORDER BY o.updated_at DESC LIMIT 100'));
 assert.ok(!api.includes('ORDER BY a.id DESC LIMIT 100'));
});
check('client filter is a defined no-professional-profile segment',()=>{
 assert.ok(api.includes("if($role==='client')"));
 assert.ok(api.includes("pp2.profile_type IN ('master','seller')"));
 assert.ok(api.includes("elseif($role!=='')"));
 assert.ok(api.includes("['client','master','seller']"));
});
check('read-only routes remain behind existing server authorization entry point',()=>{
 const actor=api.indexOf('$actor=ao_admin($pdo)');
 const user=api.indexOf("if($method==='GET'&&$action==='users')");
 const org=api.indexOf("if($method==='GET'&&$action==='organizations')");
 assert.ok(actor>0&&actor<user&&user<org);
 assert.ok(api.includes("kareta_authorize($pdo,'*'"),'existing capability guard remains, not verified sufficient');
});
check('mobile filters keep touch-sized actions',()=>{
 for(const key of ['.k-admin-inventory-toolbar','.k-admin-pager','min-height:44px','@media(max-width:360px)'])assert.ok(css.includes(key),key);
 assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
});
console.log('Admin E3 source/render contracts '+n+' PASS; authenticated API negative tests, SQL execution and browser visual smoke NOT RUN.');
