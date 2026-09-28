'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const request=read('js/next/pages/request.js');
const css=read('css/next/kflow_windows.css')+'\n'+read('css/next/request_5_steps.css');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const fail=[];const must=(v,m)=>{if(!v)fail.push(m)};
for(const marker of [
  'data-request-flow-version="8"','k-request-ref-topbar','k-request-ref-logo','k-request-main-steps',
  'data-request-panel="vehicle" data-step-index="0"','data-request-panel="offer" data-step-index="1"',
  'data-request-panel="schedule" data-step-index="2"','data-request-panel="problem" data-step-index="3"','data-request-panel="review" data-step-index="4"',
  'k-request-empty-state-hero','k-request-ref-service-row','k-request-ref-media-grid','k-request-rules-dialog',
  'data-request-head-back','data-request-terms-link','data-request-rules-close'
]) must(request.includes(marker),`missing request visual marker: ${marker}`);
for(const token of ['body.k-request-ref-active #k-shell-header','.k-request-ref-topbar','.k-request-empty-state-hero','.k-request-final-choice','.k-request-review-media','.k-request-rules-dialog','.k-request-problem-modes']) must(css.includes(token),`missing request visual CSS: ${token}`);
must(css.includes('body.k-request-ref-active #k-mobile-nav .k-nav-link[data-route-key="services"]'),'client request must visually keep Services active without mutating frozen shell');
const va=(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/.exec(asset)||[])[1]||'';
const vs=(/const RELEASE\s*=\s*'([^']+)'/.exec(sw)||[])[1]||'';
const rev=Number((va.match(/188\.5\.5\.6\.84\.(\d+)/)||[])[1]||0);
must(rev>=58&&vs===va,'84.58+ asset/sw version mismatch');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('KARETA request five-step reference visual OK');
