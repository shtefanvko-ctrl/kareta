'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('js/next/ui_icons.js');
const sandbox={window:{}};
vm.runInNewContext(source,sandbox,{timeout:1500});
const icons=sandbox.window.KaretaUIIcons;
assert(icons,'shared icon API unavailable');
for(const name of ['arrowRight','externalLink','eyeOff','flag','undo','x','map','elm327','arduino','obd']){
  assert.equal(icons.has(name),true,'missing canonical SVG: '+name);
  assert.equal(icons.svg(name).startsWith('<svg'),true,'invalid SVG for '+name);
  assert.notEqual(icons.svg(name),icons.svg('warning'),'warning fallback for '+name);
}
for(const name of ['map','elm327','arduino','obd']){
  assert.equal(icons.routeName(name),name,'missing route icon binding: '+name);
}
const pages=['community.js','masters.js','parts.js','master_workplace.js'];
let calls=0;
for(const page of pages){
  const content=read('js/next/pages/'+page);
  assert(content.includes('KaretaUIIcons'),'expected shared icon wrapper in '+page);
  const re=/\b(?:icon|uiIcon|uiSvg)\(\s*['"]([a-zA-Z0-9:_-]+)['"]/g;
  for(const match of content.matchAll(re)){
    calls++;
    assert(icons.has(match[1]),page+' uses undefined icon '+match[1]);
  }
}
const bundle=read('js/boot/runtime_identity_bundle.js');
assert(bundle.includes('SOURCE: js/next/ui_icons.js'),'source section not bundled');
assert(bundle.includes(source.trimEnd()),'built identity bundle stale vs source');
console.log('UI_ICON_REGISTRY: PASS',calls,'literal icon calls in shared-icon pages');
