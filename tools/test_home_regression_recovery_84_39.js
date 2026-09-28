const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const css=read('css/next/reference_client_pages.css');
const core=read('js/next/pages/core.js');
const index=read('index.php');
const version=read('inc/asset_version.php');
const sw=read('sw.js');
const errors=[];
const must=(ok,msg)=>{if(!ok)errors.push(msg)};

must(css.includes('url("/media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png")'),'Home hero must use the approved request artwork as a background image');
must(css.includes('background-size:cover!important')||css.includes('background-size:auto 100%!important'),'Home hero artwork must visibly fill the hero');
must(css.includes('#k-shell-header>.k-brand{grid-column:1!important')||css.includes('.k-shell-header .k-brand{grid-column:1!important'),'Client brand must be fixed in the left header column');
must(css.includes('justify-self:start!important'),'Client brand must align to the left edge');
must(!/\.k-home-feed-section\s*\{\s*display\s*:\s*none\s*!important/.test(css),'Home feed sliders must not be hidden');
must(css.includes('.k-home-reference .k-home-feed-section{display:grid!important'),'Home feed sections must be explicitly restored');
must(css.includes('.k-home-reference .k-home-feed-rail{display:flex!important'),'Home feed rails must be visible horizontal sliders');
must(core.includes('data-home-feed="works"')&&core.includes('data-home-feed="community"'),'Both Works and News/Community home sliders must remain rendered');
must(core.includes('bindHomeSlider(worksRail)')&&core.includes('bindHomeSlider(communityRail)'),'Both home sliders must retain drag/touch slider behavior');
must(index.indexOf('class="k-brand"')<index.indexOf('id="k-desktop-nav"'),'Brand must remain the first shell-header item');
must(/188\.5\.5\.6\.84\.(\d+)/.test(version)&&Number((version.match(/188\.5\.5\.6\.84\.(\d+)/)||[])[1]||0)>=39,'Asset version must be at least 84.39');
must(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)';/.test(sw)&&Number((sw.match(/const RELEASE = '188\.5\.5\.6\.84\.(\d+)';/)||[])[1]||0)>=39,'Service worker release must be at least 84.39');
if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1)}
console.log('home regression recovery 84.39 OK');
