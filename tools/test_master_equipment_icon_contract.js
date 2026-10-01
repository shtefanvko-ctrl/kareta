'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/next/ui_icons.js'),'utf8');
const context={window:{},console}; vm.runInNewContext(source,context,{timeout:1000});
const api=context.window.KaretaUIIcons;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Snapshot existing menu/route/category output from release c20beb7; new thematic icons must preserve it.
const expected={"names":"e2a8d81ac207786c4a87325b5bce5d651bb1a117c724a440b34174434f822dde","svg":"34679ab510f210409cf8500d4289c130ac82182048e6bb2079450545965a1539","routes":"748e41249a2cc8acbc509bb6685f648162f5e2a8c9fb74ccf9197fa1bd8de40d","routeSvg":"9cd40ffbe04285998e445065b2df9018469baf27fcd9d41cae8501bbb27d14f4","aliases":"62c3d08b5c2eeb098b3a9b7c2568fa2fbacf5975c58ded75995a1c049b32162c","categories":"1ff5206c5c86d3fc7caeb579e20b8363085d7a22788e1b707f87ef89584d3d18","fallback":"9f8b88e754cf5730262258e5b54ba4fa30efdce3e61fef18e402ec623f2166c6","count":73};
const legacyNames=Array.from(api.names).slice(0,expected.count);
assert.equal(hash(legacyNames),expected.names,'legacy icon IDs changed');
assert.equal(hash(legacyNames.map(n=>api.svg(n))),expected.svg,'legacy SVG output changed');
assert.equal(hash(api.routeNames),expected.routes,'menu/route mapping changed');
assert.equal(hash(Object.keys(api.routeNames).map(k=>api.routeSvg(k))),expected.routeSvg,'menu SVG changed');
assert.equal(hash(["cabinet","tools","mechanic","garage","oilChange","shield","wrench","painting"].map(n=>api.normalize(n))),expected.aliases,'legacy aliases changed');
assert.equal(hash(["engine","diagnostics","maintenance","шиномонтаж","сварка","неизвестная услуга"].map(n=>api.categoryIcon(n))),expected.categories,'category canon changed');
assert.equal(hash(api.svg('nonexistent-icon')),expected.fallback,'unknown-icon fallback changed');
const pack=JSON.parse(fs.readFileSync(path.join(root,'assets/icons/tabler/index.json'),'utf8'));
const sprite=fs.readFileSync(path.join(root,'assets/icons/tabler',pack.sprite),'utf8');
assert.equal(pack.vendored_icons.length,39);
assert.equal(new Set(api.names).size,api.names.length,'duplicate canonical IDs');
assert.equal(api.names.length,expected.count+pack.vendored_icons.length);
for(const item of pack.vendored_icons){
  assert.equal(api.has(item.id),true,'missing '+item.id);
  const name=item.id.slice(7);
  assert.ok(sprite.includes('id="'+name+'"'),'missing symbol '+name);
  assert.ok(api.svg(item.id).includes('href="assets/icons/tabler/'+pack.sprite+'#'+name+'"'),'wrong lazy asset link');
  const original=fs.readFileSync(path.join(root,'assets/icons/tabler',item.file),'utf8');
  assert.ok(original.includes('<svg'),'missing source SVG');
  assert.ok(!/<script|foreignObject|\bon\w+\s*=|javascript:/i.test(original),'unsafe SVG');
}
assert.equal(api.has('tabler:unknown'),false);
assert.equal(api.svg('tabler:unknown'),api.svg('warning'));
assert.ok(!source.includes('available_upstream_names'),'full library loaded into boot');
assert.ok(!/fetch\(|XMLHttpRequest|document\./.test(source),'registry performs eager requests');
const bundle=fs.readFileSync(path.join(root,'js/boot/runtime_identity_bundle.js'),'utf8');
assert.equal(bundle.split(source.trimEnd()).length,2,'generated boot source drift');
console.log(JSON.stringify({status:'PASS',legacy_icons:expected.count,menu_routes:Object.keys(api.routeNames).length,thematic_icons:pack.vendored_icons.length,lazy_sprite:true}));
