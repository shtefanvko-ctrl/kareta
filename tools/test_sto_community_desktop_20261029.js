'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const source=read('js/next/pages/community.js');
function pageFor(role,hash){
  const window={
    KaretaCommunityApi:{getGroups:()=>[],avatarLetter:n=>String(n||'K')[0]},
    KaretaCommunityState:{snapshot:()=>({feedMode:'recommended',posts:[]})},
    KaretaApiClient:{},KaretaSocialState:{},
    KaretaNavigationCore:{contextKind:()=>role},
    KaretaIdentity:{snapshot:()=>({authenticated:true,context:{organizationName:'Проверенное СТО'}})},
    KaretaUIIcons:{svg:()=>''},matchMedia:q=>({matches:true})
  };
  const context={window,document:{documentElement:{dataset:{}}},location:{hash},URLSearchParams};
  vm.runInNewContext(source,context,{filename:'community.js'});
  return window.KaretaCommunityPages.renderCommunity();
}
const sto=pageFor('organization_service','#/community');
assert(sto.includes('data-community-sto-overview'),'STO default needs own-publications preview');
assert(sto.includes('Проверенное СТО'),'STO name from identity context');
assert(sto.includes('Лента KARETA'),'STO default must retain the public feed');
assert(sto.includes('#/community/my-sto'),'STO needs link to own feed');
assert(sto.includes('Публикация от имени СТО'),'STO publisher identity');
const mine=pageFor('organization_service','#/community/my-sto');
assert(mine.includes('data-community-feed-mode="sto"'),'Own-STO feed tab');
assert(!mine.includes('data-community-sto-overview'),'Own tab must not duplicate overview');
const client=pageFor('personal','#/community');
assert(!client.includes('data-community-sto-overview'),'Client must not see STO controls');
assert(!client.includes('data-community-feed-mode="sto"'),'Client must not see STO tab');
const style=read('css/next/community.css');
assert(style.includes('grid-template-areas:"community-nav community-aside" "community-feed community-aside"'),'Desktop community reclaims unused navigation column');
assert(style.includes('max-width:none!important;'),'Feed must not remain width-limited to 640px');
for(const path of ['css/next/home_simple.css','css/next/parts_native_marketplace.css']){
  assert(!read(path).includes('grid-template-columns:190px minmax(520px,640px) 260px'),'Duplicate legacy desktop grid must not override canonical rule');
}
const apiSource=read('js/next/community/community_api.js');
assert(apiSource.includes('scope=own_sto'),'Own feed must call restricted endpoint');
const server=read('api/community_posts.php');
assert(server.includes("$actor = kareta_community_actor($pdo)")&&server.includes('p.author_context_id=?')&&server.includes('p.author_entity_id=?'),'Server filters using authenticated context');
console.log('PASS — STO desktop community role, navigation, overview, canonical CSS and server scope contracts');
(async()=>{
  const calls=[];
  const client={request:async url=>{calls.push(url);return {ok:true,payload:{data:{items:[{id:'cp_test',authorRole:'sto',authorEntityId:'org_test',authorName:'СТО',type:'POST',title:'Ремонт',text:'Проверено',publishedAt:'2026-10-29T10:00:00Z'}]}}};}};
  const window={KaretaApiClient:client,KARETA_ENVIRONMENT:'production',KaretaNavigationCore:{contextKind:()=> 'organization_service'}};
  vm.runInNewContext(read('js/next/community/community_api.js'),{window,Date,Math,Promise},{filename:'community_api.js'});
  const result=await window.KaretaCommunityApi.getFeed({mode:'sto',limit:3});
  assert(result.ok&&result.data.items.length===1,'STO receives own server data');
  assert.equal(result.data.items[0].author.contextType,'STO');
  assert.deepEqual(calls,['api/db.php?action=communityPosts.list&scope=own_sto&limit=3'],'STO must not call the global/unscoped feed');
  console.log('PASS — isolated STO API request and normalization');
})().catch(err=>{console.error(err);process.exitCode=1;});
