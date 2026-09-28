'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const source=read('js/next/pages/work_feed.js');
const css=read('css/next/master_surface_contract.css');
const version=read('inc/asset_version.php');
const sw=read('sw.js');
const window={
  KaretaApiClient:{},
  KaretaCatalogCards:{},
  KaretaRoleAccess:{currentRole:()=> 'master'},
  KaretaPageUI:{masterPageHeader:(title,subtitle,opts={})=>`<header class="k-master-page-header" ${opts.attrs||''}><div class="k-master-page-header__copy"><small>${opts.eyebrow||''}</small><h1>${title}</h1><p>${subtitle}</p></div><div class="k-master-page-header__actions">${opts.actions||''}</div></header>`},
  KaretaUIIcons:{svg:()=>'<svg></svg>',icon:()=>''}
};
vm.runInNewContext(source,{window,console,Intl,Date,URLSearchParams,setTimeout,clearTimeout});
const html=window.KaretaWorkFeedPages.renderExchange();
const sections=[...html.matchAll(/data-exchange-section="([^"]+)"/g)].map(x=>x[1]);
expect(JSON.stringify(sections)===JSON.stringify(['header','toolbar','filters','list','pagination','empty']),'Exchange section order must be Header > Toolbar > Filters > List > Pagination > Empty');
expect(source.includes("pageUi.masterPageHeader(label,'Заявки по вашим услугам"),'Exchange does not use canonical masterPageHeader renderer');
expect(html.includes('class="k-master-page-header"'),'Exchange does not render Master Page Header');
expect(html.includes('k-exchange-r71-toolbar k-exchange-r131-toolbar'),'Exchange toolbar stopped reusing existing Master/Exchange UI language');
expect(html.includes('k-exchange-grid k-exchange-r71-grid'),'Exchange list stopped reusing existing card/grid system');
const toolbarStart=html.indexOf('data-exchange-section="toolbar"');
const filtersStart=html.indexOf('data-exchange-section="filters"');
const toolbarChunk=html.slice(toolbarStart,filtersStart);
expect(toolbarStart>=0&&filtersStart>toolbarStart,'Toolbar/Filters structural boundary missing');
expect(!toolbarChunk.includes('data-exchange-filter-panel'),'Filters are still nested inside Toolbar');
expect(html.includes('data-exchange-pagination')&&html.includes('data-exchange-load-more'),'Pagination/progressive-load block missing');
expect(html.includes('data-exchange-empty hidden'),'Dedicated Empty state block missing');
expect(source.includes('const EXCHANGE_PAGE_SIZE=12'),'Exchange page size contract missing');
expect(source.includes('items.slice(0,Math.max(EXCHANGE_PAGE_SIZE'),'Exchange list is not progressively sliced');
expect(source.includes('exchangeState.visibleCount+=EXCHANGE_PAGE_SIZE'),'Load-more does not advance progressive page');
expect(source.includes("exchangeState.visibleCount=EXCHANGE_PAGE_SIZE;paintExchange();"),'Filters/API reload do not reset pagination');
expect(css.includes('R188.5.5.6.84.109 — MASTER EXCHANGE STRUCTURE CONTRACT'),'Exchange CSS contract missing');
expect(css.includes('.k-exchange-r131-filters{\n  position:static;'),'Filters are not an independent in-flow section');
expect(version.includes("KARETA_ASSET_VERSION = '188.5.5.6.84.109'"),'Asset version not bumped to 84.109');
expect(sw.includes("RELEASE = '188.5.5.6.84.109'"),'Service worker release not bumped to 84.109');
console.log('OK MASTER EXCHANGE STRUCTURE 84.109');
