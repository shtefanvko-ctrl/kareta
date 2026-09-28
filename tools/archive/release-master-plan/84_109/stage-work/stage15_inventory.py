from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
targets=[root/'js', root/'app', root/'assets']
patterns=[
 re.compile(r'\brole\s*===?\s*[\'\"](client|master|sto|seller|admin|owner)[\'\"]',re.I),
 re.compile(r'[\'\"](client|master|sto|seller|admin|owner)[\'\"]\s*===?\s*\brole\b',re.I),
 re.compile(r'\b(?:user|session|identity|ctx|context)\??\.role\b',re.I),
 re.compile(r'\b(?:allowedRoles|roles|roleGuard|requireRole|hasRole|isRole)\b',re.I),
]
rows=[]
for base in targets:
 if not base.exists(): continue
 for p in base.rglob('*.js'):
  try:s=p.read_text(encoding='utf-8',errors='replace')
  except: continue
  for i,l in enumerate(s.splitlines(),1):
   if any(rx.search(l) for rx in patterns):
    rows.append((str(p.relative_to(root)),i,l.strip()))
print('JS_ROLE_CANDIDATES',len(rows))
for r in rows[:1200]:
 print(f'{r[0]}:{r[1]}: {r[2][:320]}')
