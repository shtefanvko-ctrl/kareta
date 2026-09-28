'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

const registry=read('inc/asset_registry.php');
const css=read('css/next/kflow_primary_pages.css');
const home=read('js/next/pages/core.js');
const services=read('js/next/pages/services.js');
const community=read('js/next/pages/community.js');
const masters=read('js/next/pages/masters.js');
const parts=read('js/next/pages/parts.js');
const more=read('js/next/smart_action_hub.js');
const docs=read('docs/design/KFLOW_PRIMARY_PAGES.md');

assert(registry.includes("'css/next/kflow_primary_pages.css'"),'Primary page style is not registered');
assert(registry.indexOf('kflow_primary_pages.css')>registry.indexOf('kflow_windows.css'),'Primary page layer must load after K-Flow windows');
assert(!css.includes('.k-mobile-nav'),'Primary page CSS must not target the frozen bottom navigation');
assert(css.includes('--k-flow-field-h:48px'),'48px field token is missing');
assert(css.includes('--k-flow-action-h:50px'),'50px action token is missing');
assert(css.includes('--k-flow-content-max:1600px'),'Desktop content contract is missing');
assert(css.includes('@media(max-width:700px)'),'Mobile page adaptation is missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'Reduced motion handling is missing');

for(const [name,source,marker] of [
  ['home',home,'data-kflow-screen="home"'],
  ['services',services,'data-kflow-screen="services"'],
  ['community',community,'data-kflow-screen="community"'],
  ['masters',masters,'data-kflow-screen="masters"'],
  ['parts',parts,'data-kflow-screen="parts"'],
]) assert(source.includes(marker),`K-Flow marker missing: ${name}`);

assert(home.includes('k-home-ref-actions'),'Home reference quick actions are missing');
assert(services.includes('Добавить ещё услугу'),'Services multi-window continuation is missing');
assert(community.includes('k-flow-community-layout'),'Community feed/rail layout is missing');
assert(masters.includes('k-flow-map-preview') || masters.includes('k-master-reference-list'),'Masters primary reference surface is missing');
assert(parts.includes('k-flow-parts-cart'),'Parts cart rail is missing');
assert(more.includes("MORE_WINDOW_CONTRACT='KARETA_MORE_WINDOW_V1_2'")&&more.includes("layout:'honeycomb'"),'More V1.2 honeycomb contract is missing');
assert(docs.includes('Нижнее меню является частью shell приложения и заморожено'),'Frozen navigation rule is undocumented');
assert(docs.includes('Второе окно онбординга'),'Second onboarding window specification is missing');

console.log('K-Flow primary pages contract: OK');
