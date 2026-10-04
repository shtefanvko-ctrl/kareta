#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const kb=path.join(root,'Анализ','elm327','data');
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const items=(name)=>read(path.join(kb,name)).items||[];
const errors=[];
const unique=(arr,label)=>{const s=new Set(); for(const x of arr){if(!x?.id){errors.push(label+': missing id');continue;} if(s.has(x.id)) errors.push(label+': duplicate '+x.id); s.add(x.id);} return s;};
const bilingual=(obj,label)=>{if(!obj||typeof obj.ru!=='string'||!obj.ru.trim()||typeof obj.en!=='string'||!obj.en.trim()) errors.push(label+': ru/en required');};

const dtcs=items('dtc_codes.json'), symptoms=items('symptoms.json'), causes=items('causes.json'), checks=items('checks.json'), repairs=items('repair_actions.json');
const src=read(path.join(kb,'source_registry.json')).sources||[];
const symptomIds=unique(symptoms,'symptoms'), causeIds=unique(causes,'causes'), checkIds=unique(checks,'checks'), repairIds=unique(repairs,'repairs'), sourceIds=unique(src,'sources'), dtcIds=unique(dtcs,'dtc');
for(const x of symptoms)bilingual(x.name,'symptom '+x.id);
for(const x of causes)bilingual(x.title,'cause '+x.id);
for(const x of checks)bilingual(x.title,'check '+x.id);
for(const x of repairs)bilingual(x.title,'repair '+x.id);
for(const d of dtcs){
  if(!/^[PBCU][0-3][0-9A-F]{3}$/.test(d.code||'')) errors.push('bad DTC code '+d.code);
  bilingual(d.title,'dtc '+d.id);
  if(d.diagnostic_rule)bilingual(d.diagnostic_rule,'dtc rule '+d.id);
  for(const id of d.symptom_ids||[]) if(!symptomIds.has(id)) errors.push(d.id+': missing symptom '+id);
  for(const id of d.cause_ids||[]) if(!causeIds.has(id)) errors.push(d.id+': missing cause '+id);
  for(const id of d.check_ids||[]) if(!checkIds.has(id)) errors.push(d.id+': missing check '+id);
  for(const id of d.repair_action_ids||[]) if(!repairIds.has(id)) errors.push(d.id+': missing repair '+id);
  for(const id of d.source_ids||[]) if(!sourceIds.has(id)) errors.push(d.id+': missing source '+id);
}
const eq=read(path.join(root,'Анализ','data','equipment.json'));
const eqIds=new Set((eq.items||[]).map(x=>x.id));
for(const c of checks) for(const id of c.equipment_ids||[]) if(!eqIds.has(id)) errors.push(c.id+': missing equipment '+id);
const prof=read(path.join(root,'Анализ','data','professions.json'));
const profIds=new Set((prof.items||[]).map(x=>x.id));
for(const row of items('profession_links.json')) for(const id of row.profession_ids||[]) if(!profIds.has(id)) errors.push('profession link missing '+id);
const svc=read(path.join(root,'Анализ','data','service_links.json'));
const svcIds=new Set((svc.items||svc.links||svc).map?.(x=>x.service_id).filter(Boolean)||[]);
for(const row of items('service_links.json')) for(const id of row.service_ids||[]) if(!svcIds.has(id)) errors.push('service link missing '+id);
if(errors.length){console.error(errors.join('\n')); process.exit(1);}
console.log(JSON.stringify({ok:true,dtc:dtcs.length,symptoms:symptoms.length,causes:causes.length,checks:checks.length,repairs:repairs.length,sources:src.length},null,2));
