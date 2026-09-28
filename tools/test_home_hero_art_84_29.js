const fs=require('fs');
const core=fs.readFileSync('js/next/pages/core.js','utf8');
const css=fs.readFileSync('css/next/home_simple.css','utf8');
const fail=[];const expect=(v,m)=>{if(!v)fail.push(m)};
for(const key of ['mobile','desktopNarrow','desktopStandard','desktopUltrawide']) expect(core.includes(`${key}:`),`fallback source ${key} missing`);
expect(core.includes("mobile:['mobile','desktopNarrow','desktopStandard','desktopUltrawide']"),'mobile fallback order missing');
expect(core.includes("desktopStandard:['desktopStandard','desktopNarrow','desktopUltrawide','mobile']"),'desktop fallback order missing');
expect(core.includes('window.addEventListener(\'resize\',onResize,{passive:true})'),'hero source must react to viewport family changes');
expect(core.includes("art.dataset.heroSourceOrigin=candidate.origin"),'source origin diagnostics missing');
expect(core.includes("console.warn('[KARETA home hero] service-map artwork is unavailable after fallback chain')"),'all-source failure must be observable');
expect(css.includes('isolation:isolate')&&css.includes('z-index:0')&&css.includes('z-index:1!important'),'hero layer isolation missing');
expect(!core.includes('data-home-hero-image alt="" decoding="async" loading="eager" fetchpriority="high" onerror='),'hero must never permanently hide itself after one failed candidate');
if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.29 home hero source-chain regression: OK');
