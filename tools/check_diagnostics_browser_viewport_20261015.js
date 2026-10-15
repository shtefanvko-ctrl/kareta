#!/usr/bin/env node
'use strict';
// Read-only browser smoke using Chrome DevTools Protocol. Intended for local fixture or guest-accessible staging.
// Not a substitute for authenticated Android device, nor does this bypass the staging tester gate.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const url=process.argv[2],outDir=process.argv[3]||path.join(os.tmpdir(),'kareta-diagnostics-viewport');
const chrome=process.env.CHROME_BINARY||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if(!url||!/^file:\/\/\/|^https:\/\/s\.kareta\.kz\//.test(url)){console.error('Usage: node tools/check_diagnostics_browser_viewport_20261015.js <file:///fixture|https://s.kareta.kz/#/diagnostics> [output-dir]');process.exit(2)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kareta-cdp-'));
let child=null,ws=null;
async function main(){
  fs.mkdirSync(outDir,{recursive:true});
  child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--remote-allow-origins=*','--user-data-dir='+profile,'--allow-file-access-from-files','about:blank'],{stdio:'ignore'});
  const debuggerFile=path.join(profile,'DevToolsActivePort');
  let port=null;
  for(let attempt=0;attempt<80;attempt++){if(fs.existsSync(debuggerFile)){port=Number(fs.readFileSync(debuggerFile,'utf8').split(/\r?\n/)[0]);break} await sleep(150)}
  if(!port)throw new Error('Chrome DevTools port not available');
  let target;
  for(let i=0;i<20;i++){
    const pages=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json()).catch(()=>[]);
    target=pages.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
    if(target)break;
    await sleep(120);
  }
  if(!target)throw new Error('Chrome page target missing');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let sequence=0;
  const waiting=new Map();
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data),p=waiting.get(data.id);
    if(!p)return;
    waiting.delete(data.id);
    if(data.error)p.reject(Error(JSON.stringify(data.error)));
    else p.resolve(data.result||{});
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;
    const timeout=setTimeout(()=>{waiting.delete(id);reject(Error(method+' timed out'))},13000);
    waiting.set(id,{resolve:value=>{clearTimeout(timeout);resolve(value)},reject:e=>{clearTimeout(timeout);reject(e)}});
    ws.send(JSON.stringify({id,method,params}));
  });
  await cdp('Page.enable');await cdp('Runtime.enable');
  const report={target:url,origin:'local CDP browser, not a user-authenticated WebView',viewports:[]};
  for(const width of [320,390]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:844});
    await cdp('Page.navigate',{url});
    await sleep(1500);
    const expression='JSON.stringify({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,route:location.hash,title:document.title,hasDiagnostics:!!document.querySelector("[data-page=diagnostics]"),hasOnboarding:!!document.querySelector("[class*=onb2-welcome]")})';
    const evalResult=await cdp('Runtime.evaluate',{expression,returnByValue:true});
    const metrics=JSON.parse(evalResult.result?.value||'{}');
    const picture=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    const out=path.join(outDir,'diagnostics-'+width+'.png');
    fs.writeFileSync(out,Buffer.from(picture.data||'','base64'));
    report.viewports.push({requestedWidth:width,...metrics,horizontalOverflow:metrics.scrollWidth>width,screenshot:out});
  }
  const isFixture=url.startsWith('file:');
  report.result=report.viewports.some(v=>v.horizontalOverflow||(isFixture&&!v.hasDiagnostics))?'FAIL':isFixture?'PASS':'GUEST_ONLY';
  console.log(JSON.stringify(report,null,2));
  if(report.result==='FAIL')process.exitCode=1;
}
main().catch(error=>{console.error('CDP_VIEWPORT_FAIL '+String(error?.stack||error));process.exitCode=2}).finally(async()=>{
  try{ws?.close()}catch(_){}
  try{child?.kill()}catch(_){}
});
