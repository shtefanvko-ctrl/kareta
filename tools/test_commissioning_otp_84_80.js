'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const fail=[]; const expect=(v,m)=>{if(!v)fail.push(m)};
const challenge=read('api/identity/challenge_service.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');
const va=(asset.match(/KARETA_ASSET_VERSION\s*=\s*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(/^188\.5\.5\.6\.84\.(?:8[0-9]|9[0-9]|\d{3,})$/.test(va)&&vs===va,'84.80+ asset/SW release parity missing');
expect(challenge.includes("if($until==='')return true;"),'manual-off empty deadline is still treated as disabled');

function phpProbe(extraEnv={}){
  const code=`
    $_SERVER['HTTP_HOST']='kareta.kz';
    require ${JSON.stringify(path.join(root,'config.php'))};
    require ${JSON.stringify(path.join(root,'api/identity/challenge_service.php'))};
    $r=new ReflectionClass('KaretaChallengeService');
    $o=$r->newInstanceWithoutConstructor();
    $m=$r->getMethod('temporaryStaticMode');$m->setAccessible(true);
    echo json_encode([
      'transport'=>KARETA_OTP['transport']??'',
      'testCode'=>KARETA_OTP['test_code']??'',
      'temporaryStatic'=>(bool)(KARETA_OTP['temporary_static']??false),
      'temporaryStaticUntil'=>KARETA_OTP['temporary_static_until']??'',
      'serviceTemporaryStatic'=>(bool)$m->invoke($o),
    ],JSON_UNESCAPED_SLASHES);
  `;
  const out=cp.execFileSync('php',['-r',code],{cwd:root,env:{...process.env,KARETA_ENVIRONMENT:'production',...extraEnv},encoding:'utf8'});
  return JSON.parse(out);
}

const manual=phpProbe({KARETA_OTP_TEMP_STATIC_ENABLED:'1',KARETA_OTP_TEMP_STATIC_UNTIL:''});
expect(manual.transport==='test_static','manual commissioning transport is not test_static');
expect(manual.testCode==='0000','manual commissioning test code is not 0000');
expect(manual.temporaryStatic===true,'config manual commissioning flag is false');
expect(manual.temporaryStaticUntil==='','manual commissioning unexpectedly has a deadline');
expect(manual.serviceTemporaryStatic===true,'challenge service rejects manual-off commissioning mode');

const disabled=phpProbe({KARETA_OTP_TEMP_STATIC_ENABLED:'0',KARETA_OTP_TEMP_STATIC_UNTIL:''});
expect(disabled.transport==='webhook','disabled commissioning mode does not fail closed to webhook');
expect(disabled.testCode==='','disabled commissioning mode still exposes 0000');
expect(disabled.temporaryStatic===false,'disabled commissioning flag remains true');
expect(disabled.serviceTemporaryStatic===false,'challenge service still considers disabled mode active');

const expired=phpProbe({KARETA_OTP_TEMP_STATIC_ENABLED:'1',KARETA_OTP_TEMP_STATIC_UNTIL:'2020-01-01T00:00:00+00:00'});
expect(expired.transport==='webhook'&&expired.temporaryStatic===false&&expired.serviceTemporaryStatic===false,'expired commissioning deadline remains active');

if(fail.length){console.error(fail.join('\n'));process.exit(1)}
console.log('R188.5.5.6.84.80 commissioning OTP executable regression OK');
