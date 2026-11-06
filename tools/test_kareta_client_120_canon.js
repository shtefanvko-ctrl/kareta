'use strict';
// Repo-local passive reference check, not browser QA or runtime wiring.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const fail = m => {throw Error('KARETA_CLIENT120_CANON: '+m)};
const j = JSON.parse(read('assets/icons/kareta-client-120/manifest_canon.json'));
const entries = j.icon_entries;
if(j.count!==120 || entries.length!==120 || !j.original_unchanged)fail('count or provenance');
if(j.source_sha256!=='efecaa740ccbe9b1d48b9967fbb38a541dd97cf11009c432c984220ca43cd599')fail('source SHA');
if(j.source_palette.orange!=='#EC5E27'||j.themes.light.accent!=='#B84902'||j.themes.dark.accent!=='#FC6606')fail('color roles');
const rgb = c => [1,3,5].map(i => parseInt(c.slice(i,i+2),16)/255);
const lum = h => rgb(h).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const [lo,hi]=[lum(a),lum(b)].sort((x,y)=>x-y);return (hi+.05)/(lo+.05)};
for(const role of ['light','dark']){for(const type of ['fill','accent']){const ratio=contrast(j.themes[role][type],j.themes[role].background);if(ratio<4.5)fail(`contrast ${role}/${type} ${ratio}`)}}
const seen=new Set();
for(const e of entries){if(e.id<1||e.id>120||seen.has(e.id))fail('duplicate/out of range');seen.add(e.id);
 for(const t of ['light','dark']){if(!e.variant_svg[t]||!e.variant_png_1024[t])fail('missing variant '+e.id)}
 if(!e.sprite_symbol || e.sprite_symbol!==`k120-${String(e.id).padStart(3,'0')}`)fail('sprite mapping '+e.id);
 if(e.outline_menu_compatible!==false)fail('illegal outline claim '+e.id);
}
const sprite=read('assets/icons/kareta-client-120/kareta-client-120-mono-sprite.svg');
const symbols=[...sprite.matchAll(/<symbol\b[^>]*\bid="(k120-\d{3})"/g)].map(x=>x[1]);
if(symbols.length!==120 || new Set(symbols).size!==120)fail('sprite symbols not unique or missing');
if(/<script|onload\s*=|<foreignObject|<image\b|href="https?:/i.test(sprite))fail('unsafe or remote sprite');
for(const id of seen)if(!symbols.includes(`k120-${String(id).padStart(3,'0')}`))fail('unmapped symbol '+id);
const guide=read('docs/design/LANDING_CANON_V2_ADDENDUM.md');
if(!guide.includes('120 SVG/PNG') || !guide.includes('Font Awesome Free'))fail('icon addendum missing');
console.log('KARETA_CLIENT_120_CANON: PASS (120 IDs, sprite, contrast, provenance, license/guide). ZIP and browser QA separately.');