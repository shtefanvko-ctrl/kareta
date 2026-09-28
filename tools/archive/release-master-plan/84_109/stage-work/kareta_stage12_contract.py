from pathlib import Path
import re, json
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
db=root/'api/db.php'
text=db.read_text(encoding='utf-8')
patterns=[r"case\s+['\"]([^'\"]+)['\"]",r"\$action\s*===\s*['\"]([^'\"]+)['\"]"]
actions=[]
for p in patterns: actions += re.findall(p,text)
actions=sorted(set(actions))
extracted=[
 'auth.sendOtp','auth.verifyOtp','users.getAll','users.setRole','users.setActive',
 'users.upsert','users.upsertAdmin','profile.updateMine','config.get','config.save'
]
contract={
 'schema':'kareta.db-monolith-contract.v1',
 'baseline':'R188.5.5.6.84.109',
 'stage':12,
 'monolith':'api/db.php',
 'maxBytes':db.stat().st_size,
 'baselineActionCount':len(actions),
 'baselineActions':actions,
 'extractedActions':extracted,
 'domainFiles':{
   'api/domains/identity_admin.php':extracted[:8],
   'api/domains/runtime_config.php':extracted[8:]
 },
 'rule':'No new action router entries may be added to api/db.php. Add new actions to api/domains/* and route through a domain dispatcher.'
}
out=root/'tools/contracts'
out.mkdir(parents=True,exist_ok=True)
(out/'db_monolith_84_109.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('MAX_BYTES='+str(contract['maxBytes']))
print('BASELINE_ACTIONS='+str(contract['baselineActionCount']))
print('EXTRACTED='+str(len(extracted)))
