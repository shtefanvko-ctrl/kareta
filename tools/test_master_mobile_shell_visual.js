'use strict';
const {read}=require('./master_route_contract_utils');
const expect=(v,m)=>{if(!v){console.error('FAIL:',m);process.exit(1)}};
const css=read('css/next/master_mobile_nav.css'),nav=read('js/next/navigation_core.js'),shell=read('js/next/shell_nav.js');
expect(css.includes('@media (max-width:700px)'),'Master mobile breakpoint missing');
expect(css.includes('--k-mobile-nav-count:6;'),'Master mobile nav count is not fixed to six');
expect(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'Master mobile nav grid is not six stable slots');
expect(css.includes('bottom:max(8px,env(safe-area-inset-bottom,0px))'),'Master mobile nav safe-area missing');
expect(css.includes('flex:0 0 22px')&&css.includes('height:22px'),'Master mobile icons do not have stable geometry');
expect(css.includes('font-size:10px')&&css.includes('font-size:9px'),'Master mobile label scale missing');
expect(!css.includes('font-size:8px')&&!css.includes('!important'),'Master mobile nav contains legacy density/override rules');
expect(css.includes(':is(.k-nav-badge,.k-nav-unread){')&&css.includes('position:absolute'),'Master badge can still move icon geometry');
expect(css.includes('.is-active,[aria-current="page"]'),'Master active-state contract missing');
expect(nav.includes("master: Object.freeze(['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__'])"),'Master mobile navigation composition changed');
expect(shell.includes("kind==='master'&&key==='masterDashboard'?'Главная':baseLabel"),'Master shell label contract missing');
for(const width of [360,375,390,412,430]){
  const navOuter=width-16, usable=navOuter-10-(5*2), slot=usable/6;
  expect(slot>=54,`viewport ${width}: six-slot Master nav would collapse below 54px (${slot.toFixed(1)}px)`);
}
console.log('OK master_mobile_shell_visual_test 360/375/390/412/430');
