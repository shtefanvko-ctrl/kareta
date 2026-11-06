'use strict';
// Read-only contract test. Does not perform browser QA or production calls.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const src=read('js/next/pages/services.js');
const css=read('css/next/reference_client_pages.css');
const manifest=JSON.parse(read('assets/icons/kareta-client-120/manifest_canon.json'));
const sprite=read('assets/icons/kareta-client-120/kareta-client-120-light-sprite.svg');
const assert=(ok,msg)=>{if(!ok)throw new Error('SERVICES_GROUP_120 FAIL: '+msg)};
const ids={care:'k120-019',clean:'k120-043',powertrain:'k120-028',control:'k120-024',electric:'k120-025',comfort:'k120-029',body:'k120-027'};
assert(manifest.count===120&&manifest.icon_entries.length===120,'source count');
const symbols=new Set(manifest.icon_entries.map(e=>e.sprite_symbol));
for(const [category,id] of Object.entries(ids)){
 assert(src.includes(category+":'"+id+"'")||src.includes(category+": '"+id+"'"),'source mapping '+category);
 assert(symbols.has(id),'unknown manifest ID '+id);
 assert(sprite.includes('id="'+id+'"'),'missing sprite symbol '+id);
}
assert(src.includes('function referenceGroupArt(groupKey)'),'art helper absent');
assert(src.includes('k-services-ref-card__icon--illustrated'),'root category artwork absent');
assert(src.includes('href="${groupUrl(group.key)}"'),'group route changed');
assert(src.includes('referenceServiceIcon(categoryIconKind(key))'),'leaf category icons changed');
assert(src.includes('function referenceTabs()'),'navigation modified');
assert(css.includes('.k-services-reference-layout .k-services-ref-grid--groups .k-services-ref-card__icon--illustrated'),'unscoped card styling');
assert(css.includes('width:52px;height:52px'),'large icon sizing');
assert(!css.includes('svg.k-services-ref-card__large-glyph{display:none'),'invisible artwork');
console.log('SERVICES_GROUP_120: PASS (7 mapping IDs, route contracts, CSS scope). Browser/CI: NOT RUN.');
