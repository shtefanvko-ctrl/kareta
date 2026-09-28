'use strict';
const fs=require('fs');const vm=require('vm');const path=require('path');const root=path.resolve(__dirname,'..');
const assert=(value,message)=>{if(!value)throw new Error(message);};
global.window={};global.location={hash:'#/home'};
vm.runInThisContext(fs.readFileSync(path.join(root,'js/next/ui_icons.js'),'utf8'),{filename:'ui_icons.js'});
vm.runInThisContext(fs.readFileSync(path.join(root,'js/next/route_registry.js'),'utf8'),{filename:'route_registry.js'});
const icons=window.KaretaUIIcons;
const uncovered=Object.keys(window.KaretaRouteRegistry.routes).filter(key=>icons.routeName(key)==='warning');assert(uncovered.length===0,'route icon map incomplete: '+uncovered.join(','));
for(const key of ['home','services','works','masters','parts','orders','seller','stoDashboard','adminMonitoring','cabinet']){
  const markup=icons.routeSvg(key);assert(markup.startsWith('<svg'),'route SVG missing: '+key);assert(!markup.includes('&lt;'),'route SVG escaped: '+key);
}
const nav=fs.readFileSync(path.join(root,'js/next/shell_nav.js'),'utf8');
assert(nav.includes('${route.iconHtml}'),'navigation does not insert trusted icon markup');
assert(!nav.includes('${esc(route.icon)}'),'navigation still escapes SVG markup');
const menu=fs.readFileSync(path.join(root,'js/next/shell_menu.js'),'utf8');assert(menu.includes('KaretaUIIcons?.routeSvg?.(key)'),'drawer does not use the central route icon map');
const css=fs.readFileSync(path.join(root,'css/next/app_next.css'),'utf8');assert(css.includes('nth-child(n+7)')&&!css.includes('nth-child(n+6)'),'sixth mobile navigation item is hidden');
const standard=fs.readFileSync(path.join(root,'css/next/icon_standard.css'),'utf8');assert(standard.includes('.k-nav-icon svg')&&standard.includes('.k-menu-link>span:first-child svg'),'navigation SVG style contract missing');
console.log('R188.5.1 icon rendering tests OK');
