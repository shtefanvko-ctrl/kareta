from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/api')
role_patterns=[
    re.compile(r'kareta_require_(?:any_)?role',re.I),
    re.compile(r'kareta_require_role',re.I),
    re.compile(r'in_array\([^\n]{0,220}(?:client|master|sto|seller|admin|owner)',re.I),
    re.compile(r"\[(?:'|\")(?:client|master|sto|seller|admin|owner)(?:'|\")")
]
cap_patterns=[
    re.compile(r'require[^\n]{0,80}capabil',re.I),
    re.compile(r'capabil[^\n]{0,80}require',re.I),
    re.compile(r'has_capabil',re.I),
    re.compile(r'effective_capabil',re.I)
]
rows=[]; caps=[]
for p in root.rglob('*.php'):
    s=p.read_text(encoding='utf-8',errors='replace')
    for n,line in enumerate(s.splitlines(),1):
        if any(rx.search(line) for rx in role_patterns):
            rows.append((str(p.relative_to(root.parent)),n,line.strip()))
        if any(rx.search(line) for rx in cap_patterns):
            caps.append((str(p.relative_to(root.parent)),n,line.strip()))
print('ROLE_COUNT',len(rows))
for r in rows[:700]:
    print(f'{r[0]}:{r[1]}: {r[2][:260]}')
print('CAP_COUNT',len(caps))
for r in caps[:500]:
    print(f'{r[0]}:{r[1]}: {r[2][:260]}')
