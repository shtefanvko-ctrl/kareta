#!/usr/bin/env node
'use strict';
// Read-only exact-byte CDN gate. No cache purges, no env mutation, no production.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const fileNames=['js/next/pages/diagnostics.js','css/next/diagnostics.css'];
const opts=Object.fromEntries(process.argv.slice(2).map(x=>x.replace(/^--/,'').split('=',2)).filter(x=>x.length===2));
const version=opts.version||'';
const origin=opts['origin-root']||'';
const host=opts.host||'https://s.kareta.kz';
const gitBlob=body=>crypto.createHash('sha1').update('blob '+body.length+'\0').update(body).digest('hex');
const mimeMatches=(file,mime)=>file.endsWith('.js')?/javascript/i.test(mime):/text\/css/i.test(mime);
async function get(url){
  const resp=await fetch(url,{signal:AbortSignal.timeout(13000),headers:{accept:'*/*'}});
  const data=Buffer.from(await resp.arrayBuffer());
  return {status:resp.status,blob:gitBlob(data),mime:resp.headers.get('content-type')||'',cache:resp.headers.get('cf-cache-status')||'',asset:resp.headers.get('x-kareta-asset-version')||''};
}
async function main(){
  if(!version)throw Error('USAGE: node tools/check_diagnostics_staging_cdn_20261015.js --version=YOUR_CURRENT_RELEASE [--origin-root=/real/staging/root]');
  const endpoint=new URL(host);
  if(endpoint.protocol!=='https:'||endpoint.hostname!=='s.kareta.kz'||endpoint.port||endpoint.username||endpoint.password||endpoint.pathname!=='/')throw Error('Only https://s.kareta.kz/ may be checked');
  const report={releaseVersion:version,target:endpoint.origin,checkedAt:new Date().toISOString(),entries:[]};
  let failed=false;
  for(const name of fileNames){
    const candidate=fs.readFileSync(path.join(root,name));
    const expected=gitBlob(candidate);
    const localOrigin=origin?gitBlob(fs.readFileSync(path.join(origin,name))):null;
    const url=new URL('/'+name,endpoint.origin);
    const normal=new URL(url);normal.searchParams.set('v',version);
    const fresh=new URL(url);fresh.searchParams.set('audit','diag-'+expected.slice(0,12)+'-'+Date.now());
    let release=null,bypass=null,error='';
    try{[release,bypass]=await Promise.all([get(normal),get(fresh)]);}
    catch(err){error=String(err?.message||err);failed=true;}
    const matched=Boolean(release&&bypass&&release.status===200&&bypass.status===200&&mimeMatches(name,release.mime)&&mimeMatches(name,bypass.mime)&&release.blob===expected&&bypass.blob===expected&&(!localOrigin||localOrigin===expected));
    if(!matched)failed=true;
    report.entries.push({file:name,gitCandidate:expected,origin:localOrigin,releaseScoped:release,cacheBusted:bypass,pass:matched,error});
  }
  report.result=failed?'BLOCKED':'PASS';
  console.log(JSON.stringify(report,null,2));
  if(failed)process.exitCode=1;
}
main().catch(err=>{console.error('CDN_CHECK_FAILED: '+String(err?.message||err));process.exitCode=2});
