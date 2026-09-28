const fs=require('fs');
function text(path){return fs.readFileSync(path,'utf8');}
const core=text('js/next/pages/core.js');
const css=text('css/next/home_simple.css');
const version=text('inc/asset_version.php');
const errors=[];
const must=(cond,msg)=>{if(!cond)errors.push(msg);};

must(core.includes('class="k-home-ref-hero-art"'),'Client Home must render hero art container');
must(core.includes('service-map-desktop-narrow.png'),'Compact Home hero must use landscape/narrow service-map instead of portrait welcome crop');
must(!core.includes('<img src="/assets/onboarding/backgrounds/welcome/service-map/service-map-mobile.png"'),'Portrait mobile welcome source must not be the compact Home hero fallback');
must(core.includes("classList.add('is-image-ready')"),'Hero must expose image-ready state');
must(core.includes("classList.add('is-image-missing')"),'Hero must expose image-missing state');
must(css.includes('isolation:isolate'),'Hero must isolate its local stacking context');
must(css.includes('.k-home-ref-hero-art{')&&css.includes('z-index:1'),'Artwork must sit above the card background');
must(css.includes('.k-home-ref-hero__copy{position:relative;z-index:2}'),'Copy must stay above artwork');
must(css.includes('object-position:63% 56%'),'Default crop must bias artwork into visible right side');
must(css.includes('rgba(255,255,255,.16) 54%')&&css.includes('rgba(255,255,255,0) 66%'),'White copy fade must release early enough for artwork to remain visible');
must(css.includes('.k-home-ref-hero-art.is-image-missing::before'),'Missing image must have an explicit fallback state instead of silently looking blank');
must(/188\.5\.5\.6\.84\.(?:28|2[9-9]|[3-9]\d)/.test(version),'Asset version must be 84.28 or newer');

if(errors.length){console.error(errors.map(x=>'FAIL: '+x).join('\n'));process.exit(1);}
console.log('KARETA Client Home hero visibility 84.28 OK');
