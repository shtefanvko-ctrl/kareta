#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const page=read('js/next/pages/community.js');
const source=read('css/next/community.css');
const bundle=read('css/routes/community_runtime.css');
const index=read('index.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};

expect(!page.includes('<header class="k-community-header">'),'feed still renders a duplicate Community header');
expect(index.includes('id="k-shell-header"')&&index.includes('class="k-shell-header"'),'shared shell header contract missing');
expect(page.includes('k-community-inner-header'),'Community subpage back-navigation header was removed');
expect(page.includes('<h2>Комментарии</h2>'),'comments sheet title missing');

for(const [label,css] of [['source',source],['runtime bundle',bundle]]){
  expect(/\.k-community-v2 \.k-community-comments-panel>header>h2\s*\{[^}]*grid-column\s*:\s*2[^}]*white-space\s*:\s*nowrap[^}]*overflow-wrap\s*:\s*normal!important[^}]*word-break\s*:\s*normal!important/s.test(css),`${label} does not protect the comments title from letter-by-letter wrapping`);
}

const av=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
const sv=(sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)'/)||[])[1];
expect(Number(av)>=92,'asset version must be .84.92 or newer');
expect(Number(sv)>=92,'service worker release must be .84.92 or newer');
expect(gate.includes("'84.92' => 'tools/test_community_single_header_84_92.js'"),'release gate does not run .84.92 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.92] Community single-header and comments-title regression passed.');
