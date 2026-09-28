const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8');}
function expect(ok,msg){if(!ok){console.error('FAIL:',msg);process.exit(1);}}
const db=read('api/db.php');
const social=read('api/master_social.php');
const getHandler="if ($action === 'masterSocial.following')";
expect(db.includes(getHandler),'GET masterSocial.following handler missing');
expect(db.indexOf(getHandler) < db.indexOf("kareta_json(['ok'=>false,'error'=>'unknown_action'],400)"),'GET handler is after unknown_action');
expect(social.includes("$payload['stos'] ?? $payload['stations'] ?? []"),'STO payload compatibility key missing');
console.log('R188.5.5.6.84.28 community following GET regression: OK');
