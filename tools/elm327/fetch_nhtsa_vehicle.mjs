import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const argv=process.argv.slice(2);
const arg=(name)=>{const i=argv.indexOf(name); return i>=0?argv[i+1]:null;};

const make=arg('--make');
const model=arg('--model');
const year=arg('--year');
const outDir=path.resolve(arg('--out-dir')||path.join(root,'Анализ','elm327','staging','nhtsa'));
if(!make||!model||!year||!/^(19|20)\d{2}$/.test(String(year))){
  console.error('Usage: node fetch_nhtsa_vehicle.mjs --make Toyota --model Camry --year 2020 [--out-dir path]');
  process.exit(2);
}

const enc=encodeURIComponent;
const base='https://api.nhtsa.gov';
const urls={
  recalls:`${base}/recalls/recallsByVehicle?make=${enc(make)}&model=${enc(model)}&modelYear=${enc(year)}`,
  complaints:`${base}/complaints/complaintsByVehicle?make=${enc(make)}&model=${enc(model)}&modelYear=${enc(year)}`
};

async function getJson(url){
  const res=await fetch(url,{headers:{'User-Agent':'KARETA-ELM327-NHTSA-ingest'}});
  if(!res.ok) throw new Error(`NHTSA HTTP ${res.status}: ${url}`);
  return await res.json();
}
function rows(payload){
  if(Array.isArray(payload)) return payload;
  if(Array.isArray(payload?.results)) return payload.results;
  if(Array.isArray(payload?.Results)) return payload.Results;
  return [];
}
function first(row,names){
  for(const n of names) if(row && row[n]!==undefined && row[n]!==null && row[n]!=='') return row[n];
  return null;
}
function normalizeRecall(row){
  return {
    source_type:'NHTSA_RECALL',
    campaign_number:first(row,['NHTSACampaignNumber','nhtsaCampaignNumber','CampaignNumber']),
    manufacturer:first(row,['Manufacturer','manufacturer']),
    component:first(row,['Component','component']),
    report_received_date:first(row,['ReportReceivedDate','reportReceivedDate']),
    summary:first(row,['Summary','summary']),
    consequence:first(row,['Consequence','consequence']),
    remedy:first(row,['Remedy','remedy']),
    notes:first(row,['Notes','notes']),
    raw:row
  };
}
function normalizeComplaint(row){
  return {
    source_type:'NHTSA_COMPLAINT',
    odi_number:first(row,['odiNumber','ODINumber','odi_number']),
    incident_date:first(row,['dateOfIncident','DateOfIncident']),
    filed_date:first(row,['dateComplaintFiled','DateComplaintFiled']),
    components:first(row,['components','Components']),
    summary:first(row,['summary','Summary']),
    crash:first(row,['crash','Crash']),
    fire:first(row,['fire','Fire']),
    injuries:first(row,['numberOfInjuries','NumberOfInjuries']),
    deaths:first(row,['numberOfDeaths','NumberOfDeaths']),
    mileage:first(row,['mileage','Mileage']),
    raw:row
  };
}
function safeSlug(v){return String(v).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}

const [recallsPayload,complaintsPayload]=await Promise.all([getJson(urls.recalls),getJson(urls.complaints)]);
const recallRows=rows(recallsPayload);
const complaintRows=rows(complaintsPayload);
const slug=[year,make,model].map(safeSlug).filter(Boolean).join('_');
fs.mkdirSync(outDir,{recursive:true});
const output={
  schema_version:1,
  fetched_at:new Date().toISOString(),
  query:{make,model,year:Number(year)},
  policy:{
    external_evidence_only:true,
    proves_successful_repair:false,
    exact_vehicle_applicability_required:true
  },
  source_urls:urls,
  counts:{recalls:recallRows.length,complaints:complaintRows.length},
  recalls:recallRows.map(normalizeRecall),
  complaints:complaintRows.map(normalizeComplaint)
};
const file=path.join(outDir,`${slug}.json`);
fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({ok:true,file,counts:output.counts,query:output.query},null,2));
