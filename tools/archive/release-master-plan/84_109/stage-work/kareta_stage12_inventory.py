from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
p=root/'api/db.php'
text=p.read_text(encoding='utf-8', errors='replace')
print('DB_PHP_SIZE='+str(p.stat().st_size))
print('DB_PHP_LINES='+str(text.count('\n')+1))
names=[]
for pat in [r"case\s+['\"]([^'\"]+)['\"]", r"\$action\s*===\s*['\"]([^'\"]+)['\"]"]:
    names += re.findall(pat,text)
print('UNIQUE_ACTIONS='+str(len(set(names))))
for n in sorted(set(names)):
    print('ACTION '+n)
print('--- PHP FILES ---')
for f in sorted((root/'api').glob('*.php')):
    print(f'{f.name}\t{f.stat().st_size}')
print('--- REQUIRE INCLUDE ---')
for i,line in enumerate(text.splitlines(),1):
    if re.search(r'\b(require|include)(_once)?\b',line):
        print(f'{i}: {line.strip()}')
