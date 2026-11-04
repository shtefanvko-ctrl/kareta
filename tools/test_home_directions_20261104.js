'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),core=fs.readFileSync(root+'/js/next/pages/core.js','utf8'),bundle=fs.readFileSync(root+'/js/boot/runtime_core_bundle.js','utf8');
assert(bundle.includes('/* SOURCE: js/next/pages/core.js */\n'+core.trimEnd()+'\n;\n'),'boot is stale');
for(const [hash,stored,want] of [['#/home',null,'auto'],['#/home','all','all'],['#/home?direction=all','auto','all'],['#/home?direction=auto','all','auto'],['#/home?direction=home','all','auto']]){
 const ctx={window:{},location:{hash},localStorage:{getItem:()=>stored,setItem:()=>{}},URLSearchParams};vm.runInNewContext(core,ctx);
 const html=ctx.window.KaretaCorePages.renderHome({state:{user:{}}});
 assert(html.includes('data-home-direction="'+want+'" aria-current="page"'),hash);
 assert(!html.includes('href="#/home?direction=home"'));
 assert(html.includes('data-home-feed="community"'));
}
const css=fs.readFileSync(root+'/css/runtime_boot_bundle.css','utf8');
assert(css.includes('.k-home-directions')&&css.includes('overflow-x:auto'));
console.log('HOME_DIRECTIONS: PASS');
