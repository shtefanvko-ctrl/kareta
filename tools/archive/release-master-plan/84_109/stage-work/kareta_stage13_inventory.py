from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
print('--- RELEASE CHECKLIST API ---')
txt=(root/'tools/release_checklist.sh').read_text(encoding='utf-8',errors='replace').splitlines()
start=None
for i,l in enumerate(txt):
    if 'section "API"' in l: start=i
if start is not None:
    for l in txt[start:start+25]: print(l)
print('--- API FILES ---')
for p in sorted((root/'api').rglob('*.php')):
    print(p.relative_to(root))
print('--- KEY REFERENCES ---')
patterns=[re.compile(x,re.I) for x in ['idempot','schema','status','auth\\.','api/db.php','requestId','x-kareta-request-id']]
for base in [root/'api',root/'tools']:
    for p in base.rglob('*'):
        if p.is_file() and p.suffix in {'.php','.js','.sh','.json'}:
            try:s=p.read_text(encoding='utf-8',errors='replace')
            except:continue
            for n,line in enumerate(s.splitlines(),1):
                if any(r.search(line) for r in patterns):
                    print(f'{p.relative_to(root)}:{n}: {line[:220]}')
