/* KARETA Landing Canon v2 ADDENDUM: offline computational rules.
 * Run: node tools/test_kareta_brandbook_addendum.js
 * Browser visual QA and release checks are NOT covered here.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const cfg=JSON.parse(read('docs/design/canon_v2_addendum_tokens.json'));
const err=m=>{throw new Error('KARETA_CANON_V2_ADDENDUM: '+m)};
const linear=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);
const lum=h=>[1,3,5].map(i=>linear(parseInt(h.substring(i,i+2),16)/255)).reduce((t,x,i)=>t+x*[.2126,.7152,.0722][i],0);
const cr=(a,b)=>{const [lo,hi]=[lum(a),lum(b)].sort((x,y)=>x-y);return(hi+.05)/(lo+.05)};
const ge=(a,b,min,msg)=>{if(cr(a,b)+1e-8<min)err(msg+' '+cr(a,b).toFixed(3)+'<'+min)};
const close=(a,b,value)=>Math.abs(cr(a,b)-value)<.003;
if(cfg.source_brand_colors.orange!=='#FC6606'||cfg.source_brand_colors.graphite!=='#474747')err('canonical colors replaced');
if(!close('#FFFFFF','#FC6606',2.982)||!close('#FFFFFF','#B84902',5.261)||!close('#0B1220','#FC6606',6.279))err('contrast reference drift');
if(cr('#FFFFFF','#FC6606')>=4.5)err('negative test expected orange+white normal text to fail AA');
ge('#FFFFFF','#B84902',4.5,'light CTA');ge('#0B1220','#FC6606',4.5,'dark CTA');
ge('#474747','#FFFFFF',4.5,'graphite');ge('#667085','#F7F7F5',4.5,'muted');
for(const [k,x] of Object.entries(cfg.calculated_accessible_variants)){ge(x.light_text,'#FFFFFF',5.25,k+' light');ge(x.light_text,'#F7F7F5',4.5,k+' soft');ge(x.dark_text,'#1B1F26',5.25,k+' dark')}
for(const f of ['LANDING_CANON_V2_ADDENDUM.md','LANDING_CANON_V2_SOURCE.md','contrast_matrix_v2_addendum.csv','contrast_pairs_v2_addendum.csv','hue_compatibility_v2_addendum.csv']){
 if(!read('docs/design/'+f).length)err('missing '+f)
}
const a=read('docs/design/LANDING_CANON_V2_SOURCE.md'),b=read('docs/design/LANDING_CANON_V2_ADDENDUM.md');
if(!a.includes('Слайд 12')||!a.includes('#FC6606')||!b.includes('design drift'))err('missing original or addendum');
for(const k of ['client','auto-service','auto-services','auto-goods']){
 const svg=read('assets/icons/kareta/'+k+'.svg');
 for(const term of ['<svg','viewBox="0 0 24 24"','stroke="currentColor"','stroke-width="1.9"','</svg>']) if(!svg.includes(term))err('SVG invalid: '+k+' '+term);
 if(/<script|onload\s*=|<foreignObject|xlink:href=/i.test(svg))err('unsafe SVG: '+k);
}
const agents=read('AGENTS.md'), router=read('ai/CONTEXT_ROUTER.md'),rules=read('ai/rules/design-system.md');
for(const s of [agents,router,rules]) if(!s.includes('design-system.md')&&!s.includes('LANDING_CANON_V2_ADDENDUM.md'))err('agent link missing');
console.log('KARETA_CANON_V2_ADDENDUM: PASS - reference/contrast/SVG. Browser/CI/production: NOT RUN.');