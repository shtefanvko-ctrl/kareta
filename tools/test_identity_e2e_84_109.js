'use strict';
const fs=require('fs');
const path=require('path');
const http=require('http');
const https=require('https');
const crypto=require('crypto');

const root=path.resolve(__dirname,'..');
const BASELINE='R188.5.5.6.84.109';
const args=process.argv.slice(2);
const arg=name=>{const i=args.indexOf(name);return i>=0?String(args[i+1]||''):'';};
const has=name=>args.includes(name);
const assert=(value,message)=>{if(!value)throw new Error(message);};
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

function maskPhone(phone){
  const digits=String(phone||'').replace(/\D+/g,'');
  return digits.length>=4?'***'+digits.slice(-4):'***';
}
function phoneHash(phone){
  return crypto.createHash('sha256').update(String(phone||'')).digest('hex').slice(0,16);
}
class HttpSession{
  constructor(baseUrl){this.base=String(baseUrl).replace(/\/$/,'');this.cookies=new Map();}
  cookieHeader(){return [...this.cookies].map(([k,v])=>k+'='+v).join('; ');}
  absorb(setCookie){
    for(const raw of [].concat(setCookie||[])){
      const pair=String(raw).split(';',1)[0];
      const pos=pair.indexOf('=');
      if(pos<1)continue;
      const key=pair.slice(0,pos).trim(),value=pair.slice(pos+1).trim();
      if(value==='')this.cookies.delete(key);else this.cookies.set(key,value);
    }
  }
  request(method,urlPath,body=null){
    return new Promise((resolve,reject)=>{
      const target=new URL(this.base+urlPath);
      const transport=target.protocol==='https:'?https:http;
      const payload=body==null?null:JSON.stringify(body);
      const headers={Accept:'application/json','User-Agent':'KARETA-Identity-E2E/84.109'};
      const cookie=this.cookieHeader();if(cookie)headers.Cookie=cookie;
      if(payload!=null){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(payload);}
      const req=transport.request({
        protocol:target.protocol,hostname:target.hostname,
        port:target.port||(target.protocol==='https:'?443:80),
        path:target.pathname+target.search,method,headers,timeout:15000
      },res=>{
        const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{
          this.absorb(res.headers['set-cookie']);
          const text=Buffer.concat(chunks).toString('utf8');
          let json=null;try{json=JSON.parse(text);}catch(_){}
          resolve({status:res.statusCode||0,headers:res.headers,text,json});
        });
      });
      req.on('timeout',()=>req.destroy(new Error('request_timeout')));
      req.on('error',reject);
      if(payload!=null)req.write(payload);req.end();
    });
  }
}

function requireJson(res,label){
  assert(res&&res.json&&typeof res.json==='object',label+' must return JSON');
  return res.json;
}
function requireStatus(res,status,label){
  assert(res.status===status,label+' HTTP '+res.status+' expected '+status);
}
async function otpStart(session,phone){
  const res=await session.request('POST','/api/auth_session.php',{action:'onboarding.requestCode',phone});
  requireStatus(res,200,'requestCode');
  const data=requireJson(res,'requestCode');
  assert(data.ok===true&&data.sent===true,'requestCode contract mismatch');
  assert(data.testMode===true,'E2E refuses non-test OTP transport');
  const code=String(data.testCode||data.devCode||'');
  assert(/^\d{4,8}$/.test(code),'test OTP code not exposed in staging test mode');
  return code;
}
async function otpVerify(session,phone,code,expectExisting){
  const res=await session.request('POST','/api/auth_session.php',{
    action:'onboarding.verifyCode',phone,code,entryRole:'client'
  });
  requireStatus(res,200,'verifyCode');
  const data=requireJson(res,'verifyCode');
  assert(data.ok===true&&data.verified===true,'verifyCode contract mismatch');
  assert(Boolean(data.existingAccount)===Boolean(expectExisting),'existingAccount mismatch');
  return data;
}
async function loginExisting(session,phone){
  const code=await otpStart(session,phone);
  return otpVerify(session,phone,code,true);
}
async function registerClient(session,phone){
  const code=await otpStart(session,phone);
  await otpVerify(session,phone,code,false);
  const res=await session.request('POST','/api/auth_session.php',{
    action:'onboarding.complete',
    profile:{
      phone,name:'KARETA E2E '+new Date().toISOString(),
      role:'client',entry_role:'client',city:'Ust-Kamenogorsk',
      profile:{specialization:'identity-e2e'},vehicle:{}
    }
  });
  requireStatus(res,200,'onboarding.complete');
  const data=requireJson(res,'onboarding.complete');
  assert(data.ok===true&&data.confirmed===true,'registration completion mismatch');
  assert(String(data.user&&data.user.role||'')==='client','registered role must be client');
  return data;
}
async function logout(session){
  const res=await session.request('POST','/api/auth_session.php',{action:'logout'});
  requireStatus(res,200,'logout');
  const data=requireJson(res,'logout');
  assert(data.ok===true&&data.loggedOut===true,'logout contract mismatch');
}
async function adminMutation(admin,action,body){
  const res=await admin.request('POST','/api/db.php?action='+encodeURIComponent(action),body);
  requireStatus(res,200,action);
  const data=requireJson(res,action);
  assert(data.ok===true,action+' returned ok=false');
  return data;
}
async function verifyAdmin(admin,phone){
  await loginExisting(admin,phone);
  const res=await admin.request('GET','/api/auth_session.php');
  requireStatus(res,200,'admin session');
  const data=requireJson(res,'admin session');
  const role=String(data.user&&data.user.role||'').toLowerCase();
  assert(role==='admin'||role==='owner','E2E admin phone is not admin/owner');
  return role;
}
async function blockedLogin(baseUrl,phone){
  const blocked=new HttpSession(baseUrl);
  const code=await otpStart(blocked,phone);
  const res=await blocked.request('POST','/api/auth_session.php',{
    action:'onboarding.verifyCode',phone,code,entryRole:'client'
  });
  requireStatus(res,403,'blocked login');
  const data=requireJson(res,'blocked login');
  assert(data.ok===false&&String(data.error||data.code||'').toLowerCase().includes('blocked'),'blocked login contract mismatch');
}
function contractOnly(){
  const auth=read('api/auth_session.php');
  const context=read('api/context.php');
  const admin=read('api/domains/identity_admin.php');
  const required=[
    [auth,"onboarding.requestCode"],[auth,"onboarding.verifyCode"],[auth,"onboarding.complete"],
    [auth,"$action === 'logout'"],[context,"$action === 'request-type'"],
    [context,"$action === 'select'"],[admin,"case 'users.setRole'"],[admin,"case 'users.setActive'"]
  ];
  for(const [src,needle] of required)assert(src.includes(needle),'missing lifecycle contract '+needle);
  assert(read('api/identity/challenge_service.php').includes("'testMode'=>$transport==='test_static'"),'test OTP fail-closed contract missing');
  console.log('IDENTITY_E2E_CONTRACT_84_109: PASS');
}

async function main(){
  const requestedBase=arg('--base-url')||process.env.KARETA_E2E_BASE_URL||'';
  if(has('--contract-only')||requestedBase===''){contractOnly();return;}
  const baseUrl=requestedBase;
  const adminPhone=arg('--admin-phone')||process.env.KARETA_E2E_ADMIN_PHONE||'';
  const targetPhone=arg('--target-phone')||process.env.KARETA_E2E_TARGET_PHONE||'';
  const reportPath=arg('--json')||path.join(root,'docs/release-master-plan/stage_0017_identity_e2e_staging.json');
  const report={schema:'kareta.identity-e2e.staging.v1',baseline:BASELINE,baseUrl,
    checkedAt:new Date().toISOString(),target:{masked:maskPhone(targetPhone),hash:phoneHash(targetPhone)},steps:[]};
  const step=async(name,fn)=>{
    const started=Date.now();
    try{const detail=await fn();report.steps.push({name,status:'PASS',ms:Date.now()-started,detail:detail||null});return detail;}
    catch(error){report.steps.push({name,status:'FAIL',ms:Date.now()-started,error:String(error&&error.message||error)});throw error;}
  };
  try{
    await step('preflight.runtime',async()=>{
      const s=new HttpSession(baseUrl);
      const res=await s.request('GET','/api/runtime_health.php');
      requireStatus(res,200,'runtime_health');
      const data=requireJson(res,'runtime_health');
      assert(String(data.version||'')==='188.5.5.6.84.109','wrong staging release '+String(data.version||''));
      return {status:data.status,version:data.version};
    });
    await step('preflight.config',async()=>{
      assert(adminPhone,'KARETA_E2E_ADMIN_PHONE or --admin-phone is required before mutation');
      assert(targetPhone,'KARETA_E2E_TARGET_PHONE or --target-phone is required before mutation');
      assert(String(adminPhone)!==String(targetPhone),'admin and target phones must differ');
      return {adminConfigured:true,target:maskPhone(targetPhone)};
    });
    const admin=new HttpSession(baseUrl);
    await step('preflight.admin',async()=>({role:await verifyAdmin(admin,adminPhone)}));

    const target=new HttpSession(baseUrl);
    await step('registration',async()=>{await registerClient(target,targetPhone);return {role:'client'};});
    await step('logout.after_registration',async()=>{await logout(target);});
    const loginTarget=new HttpSession(baseUrl);
    await step('login',async()=>{await loginExisting(loginTarget,targetPhone);return {existingAccount:true};});

    const upgrade=await step('upgrade',async()=>{
      const res=await loginTarget.request('POST','/api/context.php?action=request-type',{
        role:'master',profile:{specialization:'identity-e2e'}
      });
      requireStatus(res,200,'request-type');
      const data=requireJson(res,'request-type');
      assert(data.ok===true,'request-type ok=false');
      return {approvalMode:data.approvalMode,autoApproved:Boolean(data.autoApproved),status:data.request&&data.request.status||null};
    });
    await step('approval',async()=>{
      if(upgrade&&upgrade.autoApproved)return {mode:'auto'};
      await adminMutation(admin,'users.setRole',{phone:targetPhone,role:'master'});
      return {mode:'admin'};
    });
    await step('context_switch',async()=>{
      const list=await loginTarget.request('GET','/api/context.php?action=list');
      requireStatus(list,200,'context.list');
      const data=requireJson(list,'context.list');
      const contexts=Array.isArray(data.contexts)?data.contexts:[];
      const master=contexts.find(c=>String(c.type||'')==='profile'&&String(c.profileType||c.profile_type||'').toLowerCase()==='master');
      assert(master,'approved master context not materialized');
      const body=master.id?{contextId:Number(master.id)}:{contextKey:String(master.key||'')};
      const selected=await loginTarget.request('POST','/api/context.php?action=select',body);
      requireStatus(selected,200,'context.select');
      const payload=requireJson(selected,'context.select');
      assert(payload.ok===true&&payload.contextChanged===true,'context select mismatch');
      assert(Number(payload.currentContext&&payload.currentContext.id||0)===Number(master.id||0),'wrong current context');
      return {type:'profile',profileType:'master'};
    });
    await step('logout',async()=>{await logout(loginTarget);});
    await step('block',async()=>{await adminMutation(admin,'users.setActive',{phone:targetPhone,active:false});});
    await step('blocked_login',async()=>{await blockedLogin(baseUrl,targetPhone);return {expectedHttp:403};});
    report.status='PASS';
  }catch(error){
    report.status='FAIL';
    report.failure=String(error&&error.message||error);
    process.exitCode=1;
  }finally{
    report.finishedAt=new Date().toISOString();
    report.passed=report.steps.filter(s=>s.status==='PASS').length;
    report.failed=report.steps.filter(s=>s.status==='FAIL').length;
    fs.mkdirSync(path.dirname(reportPath),{recursive:true});
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
    console.log('IDENTITY_E2E_84_109: '+report.status+' steps='+report.passed+'/'+report.steps.length+' report='+reportPath);
  }
}
main().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});
