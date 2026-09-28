const fs=require('fs');
const read=p=>fs.readFileSync(p,'utf8');
const page=read('js/next/pages/master_onboarding.js');
const css=read('css/next/master_onboarding.css');
const ver=read('inc/asset_version.php');
const must=(ok,msg)=>{if(!ok){console.error('FAIL:',msg);process.exit(1);}};
for(const token of [
  "const raw=params.get('step')",
  "step:Number.isFinite(parsed)?Math.max(1,Math.min(4,parsed)):null",
  'function isStepValid(step,d=model.draft)',
  'function maxReachableStep()',
  "model.draft.returnTarget==='review'",
  "model.draft.returnTarget='review'",
  'function applyServerValidation(fields={})',
  "if(key.startsWith('profile.'))return 1",
  "if(key.startsWith('services'))return 2",
  "if(key.startsWith('workLocation.'))return 3",
  "{kmoModal:true}",
  'closeModal(true)',
  "role=\"alert\" aria-live=\"assertive\"",
  "aria-busy=\"true\""
]) must(page.includes(token),'MASTER 84.19 page missing '+token);
for(const token of [
  'MASTER First Entry final interaction / production QA pass',
  ':focus-visible',
  'overflow-wrap:anywhere',
  '@media (min-width:900px) and (max-width:1099px)',
  '@media (forced-colors:active)'
]) must(css.includes(token),'MASTER 84.19 CSS missing '+token);
must(!page.includes('model.returnToReview=true'),'legacy volatile returnToReview flag must not drive review editing');
must(/188\.5\.5\.6\.84\.(\d+)/.test(ver)&&Number(/188\.5\.5\.6\.84\.(\d+)/.exec(ver)[1])>=19,'asset version must be 84.19+');
console.log('MASTER First Entry final interaction / production QA 84.19 OK');
