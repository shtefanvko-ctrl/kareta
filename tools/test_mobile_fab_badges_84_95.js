#!/usr/bin/env node
'use strict';

const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('js/next/mobile_back.js');
const bundle=read('js/boot/runtime_shell_bundle.js');
const index=read('index.php');
const asset=read('inc/asset_version.php'),sw=read('sw.js'),gate=read('tools/release_gate.php');
const fail=[];const expect=(ok,label)=>{if(!ok)fail.push(label);};

for(const [label,js] of [['source',source],['runtime bundle',bundle]]){
  expect(js.includes('function isProtectedContentSurface(hashValue)')&&js.includes('parts(?:\\/|$)|masters(?:\\/|$)|cabinet\\/garage'),`${label}: protected content route guard missing`);
  expect(js.includes('chatButton.hidden = protectContent || !shouldShowChat(hash)'),`${label}: chat FAB still overlays protected content`);
  expect(js.includes('ordersButton.hidden = protectContent || !shouldShowOrders(hash)'),`${label}: orders FAB still overlays protected content`);
  expect(js.includes("hideZeroBadge('k-mobile-chat-badge')")&&js.includes("hideZeroBadge('k-mobile-orders-badge')"),`${label}: zero badge cleanup missing`);
  expect(js.includes('badge.hidden = true')&&js.includes("badge.textContent = ''"),`${label}: empty badge state is not normalized`);
}
expect(index.includes('id="k-mobile-chat-badge"')&&index.includes('id="k-mobile-orders-badge"'),'FAB badge markup contract missing');
const version=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const swVersion=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:9[5-9]|[1-9]\d{2,})$/.test(version)&&version===swVersion,'asset/SW .84.95+ parity missing');
expect(gate.includes("'84.95' => 'tools/test_mobile_fab_badges_84_95.js'"),'release gate does not run .84.95 regression');
if(fail.length){console.error(fail.join('\n'));process.exit(1);}
console.log('[84.95] Mobile FAB and zero-badge regression passed.');
