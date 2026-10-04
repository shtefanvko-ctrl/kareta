#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');

const readJson=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fail=m=>{console.error('ANALYSIS_RUNTIME_ALIGNMENT: FAIL — '+m);process.exit(1);};
const assert=(c,m)=>{if(!c)fail(m);};
const ids=rows=>rows.map(row=>String(row?.id||'')).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const unique=(rows,label)=>{
  const seen=new Set();
  for(const id of rows){assert(id!=='',label+' empty id');assert(!seen.has(id),label+' duplicate '+id);seen.add(id);}
  return seen;
};

const researchEquipment=readJson('Анализ/data/equipment.json');
const researchProfessions=readJson('Анализ/data/professions.json');
const researchLinks=readJson('Анализ/data/service_links.json');
const researchQueries=readJson('Анализ/data/query_dictionary.json');
const validation=readJson('Анализ/data/validation.json');

const runtimeEquipment=readJson('storage/catalog/master_equipment.json');
const runtimeProfessions=readJson('storage/catalog/master_professions.json');
const runtimeAdvisories=readJson('storage/catalog/master_service_advisories.json');
const servicesDoc=readJson('storage/catalog/services.json');
const services=Array.isArray(servicesDoc.services)?servicesDoc.services:(Array.isArray(servicesDoc.items)?servicesDoc.items:[]);

for(const [name,doc] of Object.entries({
  equipment:researchEquipment,
  professions:researchProfessions,
  service_links:researchLinks,
  query_dictionary:researchQueries
})){
  assert(doc.status==='DRAFT_NOT_RUNTIME_IMPORT',name+' research status changed');
  assert(doc.relations_are_proposals===true,name+' proposal flag changed');
  assert(doc.no_copy_of_services===true,name+' service-copy invariant changed');
}

assert(researchEquipment.groups.length===18,'research equipment groups != 18');
assert(researchEquipment.items.length===82,'research equipment items != 82');
assert(researchProfessions.items.length===21,'research professions != 21');
assert(researchLinks.items.length===109,'research service links != 109');
assert(researchQueries.items.length===52,'research query hypotheses != 52');
assert(researchQueries.clarifications.length===6,'research clarifications != 6');

assert(runtimeEquipment.status==='RUNTIME_CANDIDATE_NOT_VERIFIED','runtime equipment verification status changed');
assert(runtimeProfessions.status==='RUNTIME_CANDIDATE_NOT_VERIFIED','runtime professions verification status changed');
assert(runtimeProfessions.self_reported===true,'professions no longer self-reported');
assert(runtimeProfessions.skill_verification==='not_implied','profession skill verification changed');
assert(runtimeProfessions.matching_usage==='disabled','profession matching enabled');
assert(runtimeProfessions.service_auto_enable===false,'profession service auto-enable enabled');

assert(runtimeAdvisories.status==='RUNTIME_ADVISORY_NOT_EXPERT_VERIFIED','M2 advisory status changed');
assert(runtimeAdvisories.expert_review==='NOT_RUN','M2 expert review changed without contract update');
assert(runtimeAdvisories.relations_are_proposals===true,'M2 relations proposal flag changed');
assert(runtimeAdvisories.hard_filtering===false,'M2 hard filtering enabled');
assert(runtimeAdvisories.ranking_impact==='disabled','M2 ranking enabled');
assert(runtimeAdvisories.matching_usage==='disabled','M2 matching enabled');
assert(runtimeAdvisories.advisory_usage==='read_only','M2 advisory usage changed');

const researchEquipmentIds=ids(researchEquipment.items);
const runtimeEquipmentIds=ids(runtimeEquipment.items);
const researchProfessionIds=ids(researchProfessions.items);
const runtimeProfessionIds=ids(runtimeProfessions.items);
assert(same(researchEquipmentIds,runtimeEquipmentIds),'equipment ID set drift research/runtime');
assert(same(researchProfessionIds,runtimeProfessionIds),'profession ID set drift research/runtime');

const equipmentSet=unique(runtimeEquipmentIds,'equipment');
const professionSet=unique(runtimeProfessionIds,'profession');
const serviceIds=ids(services);
const serviceSet=unique(serviceIds,'service');
assert(serviceSet.size>0,'service catalog empty');

const linkByService=new Map();
for(const row of researchLinks.items){
  const serviceId=String(row?.service_id||'');
  assert(serviceSet.has(serviceId),'research relation unknown service '+serviceId);
  assert(!linkByService.has(serviceId),'research relation duplicate service '+serviceId);
  assert(row.equipment_rule==='recommendation_not_hard_requirement','research relation became hard '+serviceId);
  assert(row.relation_status==='DRAFT_FOR_EXPERT_REVIEW','research relation review status changed '+serviceId);
  assert(row.master_service_confirmation_required===true,'master service confirmation disabled '+serviceId);
  for(const id of row.profession_ids||[])assert(professionSet.has(id),'research relation unknown profession '+serviceId+' -> '+id);
  for(const id of row.suggested_equipment_ids||[])assert(equipmentSet.has(id),'research relation unknown equipment '+serviceId+' -> '+id);
  linkByService.set(serviceId,row);
}
assert(linkByService.size===109,'research relation unique count != 109');

const advisoryByService=new Map();
for(const row of runtimeAdvisories.items){
  const serviceId=String(row?.serviceId||'');
  assert(serviceSet.has(serviceId),'runtime advisory unknown service '+serviceId);
  assert(!advisoryByService.has(serviceId),'runtime advisory duplicate service '+serviceId);
  assert(row.expertReview==='NOT_RUN','runtime advisory expert review changed '+serviceId);
  assert(row.equipmentRule==='advisory_only','runtime advisory equipment rule changed '+serviceId);
  assert(row.hardRequirement===false,'runtime advisory hard requirement enabled '+serviceId);
  assert(row.matchingUsage==='disabled','runtime advisory matching enabled '+serviceId);
  assert(row.masterServiceConfirmationRequired===true,'runtime advisory service confirmation disabled '+serviceId);
  advisoryByService.set(serviceId,row);
}
assert(advisoryByService.size===109,'runtime advisory unique count != 109');

for(const [serviceId,source] of linkByService){
  const runtime=advisoryByService.get(serviceId);
  assert(runtime,'runtime advisory missing '+serviceId);
  assert(same(source.profession_ids||[],runtime.professionIds||[]),'profession relation drift '+serviceId);
  assert(same(source.suggested_equipment_ids||[],runtime.suggestedEquipmentIds||[]),'equipment relation drift '+serviceId);
  assert(String(source.category_ref||'')===String(runtime.categoryRef||''),'category relation drift '+serviceId);
  assert(JSON.stringify(source.compatibility_dimensions||[])===JSON.stringify(runtime.compatibilityDimensions||[]),'compatibility dimensions drift '+serviceId);
  assert(runtime.sourceRelationStatus===source.relation_status,'source relation status drift '+serviceId);
  assert(runtime.sourceEquipmentRule===source.equipment_rule,'source equipment rule drift '+serviceId);
}

for(const q of researchQueries.items){
  const qid=String(q?.id||'unknown');
  assert(q.evidence_status==='HYPOTHETICAL_QUERY','query promoted without measurement '+qid);
  assert(q.observed_count===null,'query observed_count must remain null until M5 '+qid);
  for(const sid of q.candidate_service_ids||[])assert(serviceSet.has(sid),'query unknown service '+qid+' -> '+sid);
}
for(const clarification of researchQueries.clarifications){
  for(const button of clarification.buttons||[]){
    for(const sid of button.service_ids||[])assert(serviceSet.has(sid),'clarification unknown service '+clarification.id+' -> '+sid);
  }
}

assert(validation.status==='PASS','research validation snapshot not PASS');
assert(validation.counts?.equipment===82,'validation equipment count drift');
assert(validation.counts?.professions===21,'validation profession count drift');
assert(validation.counts?.service_links===109,'validation service link count drift');
assert(validation.counts?.query_examples===52,'validation query count drift');
assert(validation.counts?.button_clarifications===6,'validation clarification count drift');
assert(validation.technical_relations_expert_review==='NOT RUN','expert review snapshot unexpectedly changed');
assert(validation.real_search_demand_measurement==='NOT RUN','demand measurement snapshot unexpectedly changed');

console.log(JSON.stringify({
  status:'PASS',
  research:{equipment:82,groups:18,professions:21,serviceLinks:109,queryHypotheses:52,clarifications:6},
  runtime:{equipmentIdsAligned:true,professionIdsAligned:true,serviceAdvisoriesAligned:true},
  safety:{expertReview:'NOT_RUN',hardFiltering:false,rankingImpact:'disabled',matchingUsage:'disabled',observedDemand:'NOT_RUN'}
}));
