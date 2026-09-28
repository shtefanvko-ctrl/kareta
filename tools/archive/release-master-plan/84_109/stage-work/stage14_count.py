from pathlib import Path
import re, collections
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/api')
rx1=re.compile(r'(?<!function\s)kareta_require_role\s*\(')
rx2=re.compile(r'(?<!function\s)kareta_require_any_role\s*\(')
counts=collections.Counter()
rows=[]
for p in root.rglob('*.php'):
    rel=str(p.relative_to(root.parent))
    s=p.read_text(encoding='utf-8',errors='replace')
    for i,l in enumerate(s.splitlines(),1):
        c=len(rx1.findall(l))+len(rx2.findall(l))
        if c:
            counts[rel]+=c; rows.append((rel,i,c,l.strip()))
print('TOTAL_DIRECT_ROLE_GATES',sum(counts.values()))
for f,c in counts.most_common():
    print(c,f)
print('DB_DIRECT_ROLE_GATES',counts.get('api/db.php',0))
