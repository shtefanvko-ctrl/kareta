'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};

const sw=read('sw.js');
const index=read('index.php');
const app=read('js/next/app_next.js');
const version=read('inc/asset_version.php');

expect(sw.includes("const SHELL_URLS = ['/', '/index.php', '/manifest.json'];"),'shell HTML is not precached');
expect(sw.includes("if (!shellReady) throw new Error('kareta_shell_precache_failed');"),'new worker can activate without a usable shell');
expect(sw.includes("data.includeShell === true || !String(key).startsWith('kareta-shell-')"),'generic cache clear still destroys shell fallback');
expect(index.includes("startsWith('kareta-static-')"),'index recovery still wipes all KARETA caches');
expect(!index.includes("keys.filter(k => k.startsWith('kareta-')).map(k => caches.delete(k))"),'legacy destructive manual cache wipe remains');
expect(app.includes("startsWith('kareta-static-')"),'app reconciliation still wipes shell cache');
expect(!app.includes("keys.filter(key=>String(key).startsWith('kareta-')).map(key=>caches.delete(key))"),'legacy destructive app cache wipe remains');

const va=(version.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1]||'';
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1]||'';
expect(va==='188.5.5.6.84.145','asset release is not 84.145');
expect(vs===va,'service worker / asset release mismatch');

console.log('OFFLINE_SHELL_RESILIENCE_84_145: PASS release='+va);
