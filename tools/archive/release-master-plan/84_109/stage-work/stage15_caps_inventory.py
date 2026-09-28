from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
terms=[r'KaretaRoleAccess',r'capabilities',r'deniedCapabilities',r'canCapability',r'hasCapability',r'capability']
for term in terms:
 print('===',term,'===')
 rx=re.compile(term,re.I)
 n=0
 for base in [root/'js/next',root/'js']:
  if not base.exists(): continue
  for p in base.rglob('*.js'):
   if '/js/next/' not in str(p).replace('\\','/') and base.name=='next': pass
   try:s=p.read_text(encoding='utf-8',errors='replace')
   except: continue
   for i,l in enumerate(s.splitlines(),1):
    if rx.search(l):
     print(f'{p.relative_to(root)}:{i}: {l.strip()[:360]}')
     n+=1
     if n>=500: break
   if n>=500: break
  if n>=500: break
