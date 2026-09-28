from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/js/next')
role=re.compile(r"\b(role|currentRole\(\)|interfaceRole\(\))\b.*(?:===|!==|includes\(|Set\()",re.I)
security=re.compile(r"(return\s+false|throw\s+|disabled\s*=|\.request\(|\.dbPost\(|\.dbGet\(|fetch\(|navigate\(|canAccess\()",re.I)
rows=[]
for p in root.rglob('*.js'):
    s=p.read_text(encoding='utf-8',errors='replace')
    lines=s.splitlines()
    for i,l in enumerate(lines,1):
        if role.search(l) and security.search(l):
            rows.append((str(p.relative_to(root.parent.parent)),i,l.strip()))
print('NEXT_SECURITY_ROLE_CANDIDATES',len(rows))
for rel,i,l in rows[:800]:
    print(f'{rel}:{i}: {l[:420]}')
