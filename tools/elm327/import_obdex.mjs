import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const manifestPath=path.join(root,'Анализ','elm327','data','obdex_import_manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));

const argv=process.argv.slice(2);
const getArg=(name)=>{
  const i=argv.indexOf(name);
  return i>=0 ? argv[i+1] : null;
};
const verifyOnly=argv.includes('--verify-only');
const sourceDir=getArg('--source-dir');
const outDir=path.resolve(getArg('--out-dir')||path.join(root,'Анализ','elm327','staging','obdex'));

function gitBlobSha(buffer){
  const head=Buffer.from(`blob ${buffer.length}\0`,'utf8');
  return crypto.createHash('sha1').update(head).update(buffer).digest('hex');
}
function rawUrl(rel){
  return `https://raw.githubusercontent.com/${manifest.source.repository}/${manifest.source.commit}/${rel}`;
}
async function readPinned(entry){
  let buffer;
  if(sourceDir){
    buffer=fs.readFileSync(path.join(path.resolve(sourceDir),entry.source_path));
  }else{
    const res=await fetch(rawUrl(entry.source_path),{headers:{'User-Agent':'KARETA-ELM327-importer'}});
    if(!res.ok) throw new Error(`download failed ${entry.source_path}: HTTP ${res.status}`);
    buffer=Buffer.from(await res.arrayBuffer());
  }
  const sha=gitBlobSha(buffer);
  if(sha!==entry.blob_sha) throw new Error(`blob sha mismatch ${entry.source_path}: ${sha} != ${entry.blob_sha}`);
  if(buffer.length!==entry.bytes) throw new Error(`byte size mismatch ${entry.source_path}: ${buffer.length} != ${entry.bytes}`);
  const parsed=parse(buffer.toString('utf8'));
  if(!Array.isArray(parsed)) throw new Error(`upstream root is not array: ${entry.source_path}`);
  if(parsed.length!==entry.records) throw new Error(`record count mismatch ${entry.source_path}: ${parsed.length} != ${entry.records}`);
  return parsed;
}
function lang(en){
  return {ru:null,en:typeof en==='string'?en:null};
}
function genericRecord(row,entry){
  return {
    id:`dtc_${String(row.code||'').toLowerCase()}`,
    code:row.code||null,
    category:row.category||null,
    scope:'generic',
    title:lang(row.title?.en),
    description:lang(row.description?.en),
    affected_components:Array.isArray(row.affected_components)?row.affected_components:[],
    common_causes:(Array.isArray(row.common_causes)?row.common_causes:[]).map(c=>({
      id:c.id||null,
      likelihood:c.likelihood||null,
      label:lang(c.label?.en)
    })),
    upstream_repair:row.repair||null,
    flags:row.flags||null,
    related_codes:Array.isArray(row.related_codes)?row.related_codes:[],
    upstream_sources:Array.isArray(row.sources)?row.sources:[],
    provenance:{
      source_id:'obdex_cc0',
      upstream_repo:manifest.source.repository,
      upstream_commit:manifest.source.commit,
      upstream_blob:entry.blob_sha,
      upstream_path:entry.source_path
    },
    translation_status:'PENDING_RU',
    evidence_status:'STRUCTURED_UPSTREAM'
  };
}
function pidRecord(row,entry){
  return {
    id:`pid_${entry.mode}_${String(row.pid||'').toLowerCase()}`,
    mode:entry.mode,
    pid:row.pid||null,
    bytes:row.bytes??null,
    formula:row.formula??null,
    unit:row.unit??null,
    range:row.range??null,
    name:lang(row.name?.en),
    provenance:{
      source_id:'obdex_cc0',
      upstream_repo:manifest.source.repository,
      upstream_commit:manifest.source.commit,
      upstream_blob:entry.blob_sha,
      upstream_path:entry.source_path
    },
    translation_status:'PENDING_RU',
    evidence_status:'STRUCTURED_UPSTREAM'
  };
}
function writeJson(file,payload){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(payload,null,2)+'\n');
}

const stats={generic:{},pids:{},total_generic:0,total_pids:0};
const translationQueue=[];

for(const entry of manifest.generic){
  const rows=await readPinned(entry);
  stats.generic[entry.family]=rows.length;
  stats.total_generic+=rows.length;
  if(!verifyOnly){
    const items=rows.map(r=>genericRecord(r,entry));
    for(const x of items) translationQueue.push({
      type:'dtc',id:x.id,code:x.code,title_en:x.title.en,description_en:x.description.en,
      source_id:'obdex_cc0',upstream_commit:manifest.source.commit
    });
    writeJson(path.join(outDir,`generic_${entry.family}.json`),{
      schema_version:1,stage:'UPSTREAM_EN_PENDING_RU',family:entry.family,
      upstream_commit:manifest.source.commit,items
    });
  }
}
for(const entry of manifest.pids){
  const rows=await readPinned(entry);
  stats.pids[entry.mode]=rows.length;
  stats.total_pids+=rows.length;
  if(!verifyOnly){
    const items=rows.map(r=>pidRecord(r,entry));
    for(const x of items) translationQueue.push({
      type:'pid',id:x.id,mode:x.mode,pid:x.pid,title_en:x.name.en,
      source_id:'obdex_cc0',upstream_commit:manifest.source.commit
    });
    writeJson(path.join(outDir,`pids_mode${entry.mode}.json`),{
      schema_version:1,stage:'UPSTREAM_EN_PENDING_RU',mode:entry.mode,
      upstream_commit:manifest.source.commit,items
    });
  }
}
if(stats.total_generic!==manifest.totals.generic_dtc) throw new Error('total generic count mismatch');
if(stats.total_pids!==manifest.totals.pids) throw new Error('total PID count mismatch');

if(!verifyOnly){
  writeJson(path.join(outDir,'translation_queue_ru.json'),{
    schema_version:1,
    rule:'Entries are not canonical until RU fields are completed and validation passes.',
    upstream_commit:manifest.source.commit,
    items:translationQueue
  });
  writeJson(path.join(outDir,'import_evidence.json'),{
    schema_version:1,
    imported_at:new Date().toISOString(),
    upstream:manifest.source,
    stats,
    state:'STAGING_ONLY_PENDING_RU'
  });
}
console.log(JSON.stringify({ok:true,verifyOnly,sourceDir:sourceDir||null,outDir,stats},null,2));
