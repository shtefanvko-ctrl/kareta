'use strict';
const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};

const layout=read('css/next/client_surface_layout.css');
const density=read('css/next/client_surface_modernization_phase3.css');
const community=read('js/next/pages/community.js');
const css=read('css/next/community.css');
const runtimeCss=read('css/routes/community_runtime.css');
const api=read('api/community_posts.php');

expect(layout.includes('--k-client-page-bottom-gap: 43px'),'mobile page bottom contract missing');
expect(layout.includes('@media (min-width: 1100px)'),'desktop density breakpoint missing');
expect(layout.includes('--k-client-page-bottom-gap: 16px'),'desktop page bottom gap not compact');
expect(layout.includes('margin-bottom: var(--k-client-page-bottom-gap, 43px)'),'shared client page spacing not variable');
expect(density.includes('R188.5.5.6.84.126 — client desktop app-density contract'),'desktop density contract missing');
for(const cls of ['.k-page-shell--workspace','.k-masters-page.k-flow-primary-page','.k-parts-native-page.k-flow-primary-page','.k-client-orders-native','.k-client-cabinet-page','.k-chats-page','.k-profile-page']){
  expect(density.includes(cls),'desktop density missing '+cls);
}
expect(density.includes('gap:var(--k-client-desktop-block-gap)!important'),'desktop root gaps not normalized');

expect(community.includes("if(hash==='#/community/help')return {name:'help'}"),'repair help route missing');
expect(community.includes("help:'#/community/help'"),'desktop help nav still points to create form');
expect(community.includes('data-community-repair-feed'),'repair question feed missing');
expect(community.includes('Задать вопрос'),'ask question CTA missing');
expect(community.includes('function renderRepairQuestion'),'repair social card renderer missing');
expect(community.includes('data-community-repair-reply'),'inline reply missing');
expect(community.includes('hydrateRepairCommentPreviews'),'comment previews missing');
expect(community.includes("post.type==='QUESTION'?'Обсуждение':'Комментарии'"),'question discussion title missing');
expect(community.includes("location.hash=kind==='QUESTION'?'#/community/help':'#/community'"),'question publish does not return to help feed');
expect(!community.includes("help:'#/community/question/create?mode=help'"),'desktop Help still routes directly to form');
expect(api.includes("['POST','QUESTION','NEWS']"),'QUESTION server type contract missing');
expect(api.includes("commentsCount"),'question comments count missing');
expect(css.includes('R188.5.5.6.84.126 — Repair Help is a social question feed'),'repair social CSS source missing');
expect(runtimeCss.includes('R188.5.5.6.84.126 — Repair Help is a social question feed'),'repair social runtime CSS missing');
expect(css.includes('.k-community-repair-card'),'repair card CSS missing');
expect(css.includes('.k-community-repair-comment-preview'),'repair comment preview CSS missing');

if(fail.length){
  console.error('R188.5.5.6.84.126 FAIL');
  fail.forEach(x=>console.error('- '+x));
  process.exit(1);
}
console.log('R188.5.5.6.84.126 OK — desktop density + repair social question feed');
