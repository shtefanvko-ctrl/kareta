'use strict';
// Run from repository root: node tools/test_kareta_brandbook_v3.js
// Data and SVG validation only. Browser visual QA is a separate requirement.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const tokens=JSON.parse(read('docs/design/color_tokens_v3.json'));
const src=tokens.source;
const t=tokens.semantic;
const derived=tokens.derived;
const rgb=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255);
const lum=x=>rgb(x).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const cr=(a,b)=>{const [low,high]=[lum(a),lum(b)].sort((a,b)=>a-b);return (high+.05)/(low+.05)};
const fail=x=>{throw new Error('KARETA_BRANDBOOK_V3 FAIL: '+x)};
const pass=(name,foreground,background,min)=>{const c=cr(foreground,background);if(c+1e-9<min)fail(`${name}: ${c.toFixed(3)} < ${min}`)};
if(src.orange!=='#FC6606'||src.white!=='#FFFFFF'||src.graphite!=='#474747')fail('canonical landing colors drifted');
if(cr(src.white,src.orange)>=4.5)fail('negative-test failed: bright brand with white must not be ordinary-AA');
pass('light CTA white label',t.primary_action_light_text,t.primary_action_light_bg,4.5);
pass('light CTA on subtle surface',t.primary_action_light_bg,src.soft,3);
pass('dark CTA dark label',t.primary_action_dark_text,t.primary_action_dark_bg,4.5);
pass('light primary',t.text_light_primary,src.white,4.5);
pass('light secondary',t.text_light_secondary,src.soft,4.5);
pass('dark primary',t.text_dark_primary,src.dark_card,4.5);
pass('dark secondary',t.text_dark_secondary,src.dark_card,4.5);
for(const key of Object.keys(derived.on_light)){
 pass(key+' / light',derived.on_light[key],src.white,5.25);
 pass(key+' / soft',derived.on_light[key],src.soft,4.5);
 pass(key+' / dark',derived.on_dark[key],src.dark_card,5.25);
}
const keys=['client','auto-service','auto-services','auto-goods'];
for(const name of keys){
 const p=`assets/icons/kareta/${name}.svg`;
 const svg=read(p);
 for(const term of ['<svg','viewBox="0 0 24 24"','fill="none"','stroke="currentColor"','stroke-width="1.9"','</svg>'])if(!svg.includes(term))fail(`${name} missing ${term}`);
 if(/<script|onload\s*=|<foreignObject|https?:\/\//i.test(svg.replace('http://www.w3.org/2000/svg','')))fail(`${name} unsafe or remote markup`);
}
const guide=read('docs/design/KARETA_BRANDBOOK_V3.md');
for(const k of ['#FC6606','contrast_matrix_v3.csv','js/next/ui_icons.js','assets/icons/tabler'])if(!guide.includes(k))fail('guide missing '+k);
console.log('KARETA_BRANDBOOK_V3: PASS (contrast, canonical tokens, SVG, guide). Visual QA: NOT RUN.');