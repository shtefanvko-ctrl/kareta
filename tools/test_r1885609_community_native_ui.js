'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const failures=[];const expect=(v,m)=>{if(!v)failures.push(m)};
const js=read('js/next/pages/community.js');
const css=read('css/next/community.css');
const manifest=JSON.parse(read('tools/shell_freeze_manifest_r1885603.json'));
const asset=read('inc/asset_version.php');
if(asset.includes('r188568449-community-social-platform-v2')){
  for(const token of ['k-community-stories','k-community-feed-tabs','k-community-composer','renderCommunityPost','#/community/groups','#/community/question/create','data-community-comments-sheet'])expect(js.includes(token),`community V2 missing ${token}`);
  for(const token of ['k-community-v2','k-community-comments-sheet','k-community-story-overlay','k-community-media-grid'])expect(css.includes(token),`community V2 CSS missing ${token}`);
  for(const [file,hash] of Object.entries(manifest.files)){const full=path.join(root,file);if(!fs.existsSync(full))continue;const actual=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
  if(failures.length){console.error(failures.join('\n'));process.exit(1)}
  console.log('R188.5.5.6.84.49 community social platform supersedes R188.5.5.6.49 catalog-only contract: OK');
  process.exit(0);
}

for(const token of ['k-community-native-section','k-community-group-grid','data-community-filter-open','data-community-filter-dialog','Фильтры сообщества'])expect(js.includes(token),`community native missing ${token}`);
for(const token of ['new window.Swiper','window.Swiper','data-community-group-slider','swiper-wrapper','swiper-pagination','k-community-stories','data-community-story-strip'])expect(!js.includes(token),`community active slider token forbidden: ${token}`);
expect(!js.includes('<select'),'community must not render select/dropdown');
expect(js.includes("api.getWorkPosts({limit:20}"),'real work posts source must remain');
expect(js.includes("api.getNews({limit:20}"),'real news source must remain');
expect(js.includes("api.getShopCatalog({limit:16}"),'real parts source must remain');
expect(js.includes('api.addWorkPostComment'),'real work comment API must remain');
expect(js.includes('api.likeWorkPost'),'real work like API must remain');
expect(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'desktop catalog card grid missing');
expect(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'),'desktop group card grid missing');
expect(css.includes('@media (max-width:900px)'),'mobile community contract missing');
expect(css.includes('.k-community-feed{grid-template-columns:1fr!important}'),'mobile feed must be vertical');
expect(css.includes('.k-community-categories{grid-template-columns:repeat(2,minmax(0,1fr))}'),'mobile catalog must be 2-column cards');
expect(css.includes('.k-community-group-grid,.k-community-group-strip{grid-template-columns:repeat(2,minmax(0,1fr))}'),'mobile group grid must be 2 columns');
for(const [file,hash] of Object.entries(manifest.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');expect(actual===hash,`SHELL FREEZE VIOLATION: ${file}`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('R188.5.5.6.49 community native UI + real sources + shell freeze: OK');
