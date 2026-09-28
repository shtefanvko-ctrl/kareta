'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const workplace=read('js/next/pages/master_workplace.js');
const css=read('css/next/master_workplace_native.css');
const version=read('inc/asset_version.php');
const sw=read('sw.js');
const expected="Object.freeze(['header','status','quick-actions','my-requests','notes','paused','today'])";
expect(workplace.includes("const MASTER_HOME_STRUCTURE_CONTRACT='R188.5.5.6.84.107'"),'Master home structure contract missing');
expect(workplace.includes(expected),'Master home block order is not fixed to the approved 7-block sequence');
for(const key of ['header','status','quick-actions','my-requests','notes','paused','today']){
  expect(workplace.includes(`masterHomeBlock('${key}'`),`Required Master home block missing: ${key}`);
}
expect(workplace.includes("MASTER_HOME_BLOCK_ORDER.map(key=>blocks[key]).join('')"),'Master home is not rendered from the immutable order contract');
const render=(workplace.match(/function renderData\(data\)\{([\s\S]*?)\n  \}\n\n  function mountMasterWorkplace/)||[])[1]||'';
expect(render.length>0,'renderData body not found');
expect(!render.includes('windows.status?'),'Status block is still conditionally removed by API preferences');
expect(!render.includes('windows.todayQueue'),'Today block is still conditionally removed by API preferences');
expect(!/MASTER_HOME_BLOCK_ORDER\.(sort|reverse|splice|push|unshift)/.test(workplace),'Master home order can be mutated at runtime');
expect(css.includes('R188.5.5.6.84.107 — fixed Master home block order'),'Master home structure CSS contract missing');
expect(version.includes("KARETA_ASSET_VERSION = '188.5.5.6.84.107'"),'Asset version not bumped to 84.107');
expect(sw.includes("RELEASE = '188.5.5.6.84.107'"),'Service worker release not bumped to 84.107');
console.log('OK MASTER HOME STRUCTURE 84.107');
