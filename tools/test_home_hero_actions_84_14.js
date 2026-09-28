const fs=require('fs');
function text(path){return fs.readFileSync(path,'utf8');}
const core=text('js/next/pages/core.js');
const home=text('css/next/home_simple.css');
const icons=text('js/next/ui_icons.js');
const version=text('inc/asset_version.php');
const errors=[];
const must=(cond,msg)=>{if(!cond)errors.push(msg);};

must(core.includes('<picture>')&&core.includes('/media/kareta_create_request_vehicle_background_r188_5_5_6_84_31.png'),'Home hero must render approved request vehicle art as a real picture');
must(core.includes('aria-label="4 шага заявки"')&&core.includes('<span>4</span>'),'Home hero must render the four-step request preview');
must(core.includes('fetchpriority="high"'),'Hero artwork should be requested eagerly/high priority');
must(home.includes('.k-home-ref-hero-art picture img'),'Hero image must be styled as an actual image layer');
const refCss=text('css/next/reference_client_pages.css');
must(refCss.includes('object-fit:contain!important')&&refCss.includes('object-position:right bottom!important'),'Reference hero art must remain uncropped and right-bottom aligned');
must(refCss.includes('.k-home-ref-hero-art::before{display:none!important}'),'Reference hero overlay must remain disabled');
must(!home.includes("background-image:linear-gradient(90deg,#fff 0%,rgba(255,255,255,.98) 39%,rgba(255,255,255,.28) 61%,rgba(255,255,255,0) 100%),url('/assets/onboarding/backgrounds/welcome/service-map/service-map-mobile.png')"),'Legacy CSS-background hero source must be removed');
must(core.includes("window.KaretaUIIcons?.svg?.(name,{className:'k-home-ref-action-svg'})"),'Quick action cards must use shared KaretaUIIcons');
must(icons.includes("diagnostics:'"),'Shared icon registry must contain diagnostics icon');
must(core.includes("icon:'truck'")&&core.includes("icon:'services'")&&core.includes("icon:'car'"),'Home actions must use shared semantic icon names');
must(home.includes('font-family:"Manrope"')&&home.includes('.k-home-ref-action b'),'Quick action typography must be one Manrope contract');
must(home.includes('font-size:14px!important'),'Quick action label must be reduced to 14px on phone');
must(home.includes('font-size:13.5px!important'),'Quick action label must remain compact on desktop');
must(/188\.5\.5\.6\.84\.(?:1[4-9]|[2-9]\d)/.test(version),'Asset version must be 84.14 or newer');

if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1);}console.log('home hero + action visual recovery 84.14 OK');
