'use strict';
// Positive/negative contract tests for DTC -> editable Community QUESTION handoff.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const diagnostic=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/diagnostics.js'),'utf8');
const community=fs.readFileSync(path.resolve(__dirname,'../js/next/pages/community.js'),'utf8');

function extract(src,start,end){
  const a=src.indexOf(start);
  assert(a>=0,`missing start: ${start}`);
  const b=src.indexOf(end,a+start.length);
  assert(b>a,`missing end: ${end}`);
  return src.slice(a,b);
}
assert.match(diagnostic,/data-obd-dtc-question/);
const handler=extract(diagnostic,
  "      const question=event.target.closest('[data-obd-dtc-question]');",
  "      const device=event.target.closest('[data-obd-address]');");
const sendQuestion=new Function('event','selectedVehicle','sessionStorage','location',handler);
const storage=new Map();
const store={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,String(v)),
  removeItem:k=>storage.delete(k)
};
const location={hash:'#/diagnostics'};
sendQuestion({
  target:{closest:sel=>sel==='[data-obd-dtc-question]'?{dataset:{obdDtcQuestion:'p0110'}}:null}
},{
  brand:'Peugeot',model:'308',year:2018,vin:'PRIVATE_VIN',plate:'PRIVATE_PLATE'
},store,location);
assert.equal(location.hash,'#/community/question/create?mode=help');
const draft=store.get('kareta.obd.communityDraft');
assert.match(draft,/P0110/);
assert.match(draft,/Peugeot 308 2018/);
assert.doesNotMatch(draft,/PRIVATE_VIN|PRIVATE_PLATE/);
assert.doesNotMatch(draft,/срочно заменить|купить датчик/i);

const prefill=extract(community,
  "    if(route.name==='question-create'){",
  "    const onClick=async e=>");
const applyDraft=new Function('route','sessionStorage','page',prefill);
const field={value:''};
const page={querySelector:selector=>selector==='form[data-community-create="QUESTION"] textarea[name="text"]'?field:null};
applyDraft({name:'question-create'},store,page);
assert.equal(field.value,draft);
assert.equal(store.getItem('kareta.obd.communityDraft'),null);
store.setItem('kareta.obd.communityDraft','NOT_FOR_FEED');
applyDraft({name:'feed'},store,page);
assert.equal(store.getItem('kareta.obd.communityDraft'),'NOT_FOR_FEED');
field.value='Мой собственный текст';
applyDraft({name:'question-create'},store,page);
assert.equal(field.value,'Мой собственный текст','existing user input must not be overwritten');
assert.equal(store.getItem('kareta.obd.communityDraft'),'NOT_FOR_FEED','draft is not consumed if field is already filled');
const locationInvalid={hash:'#/diagnostics'};
sendQuestion({target:{closest:sel=>sel==='[data-obd-dtc-question]'?{dataset:{obdDtcQuestion:'INVALID'}}:null}},null,store,locationInvalid);
assert.equal(locationInvalid.hash,'#/diagnostics','invalid DTC cannot navigate or overwrite draft');
console.log('DIAGNOSTICS_QUESTION_HANDOFF: PASS — user draft, no VIN/plate, no autopublish, negative paths');
