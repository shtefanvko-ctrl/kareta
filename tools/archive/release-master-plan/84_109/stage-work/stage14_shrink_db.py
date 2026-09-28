from pathlib import Path
p=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz/api/db.php')
lines=p.read_text(encoding='utf-8').splitlines()
keep_markers=[
    "masterExchange.feed",
    "masterExchange.getMine",
    "masterWorkplace.get",
    "'calendar.manage'",
    "'work_orders.update'",
    "'services.manageOwn'",
]
changed=0
out=[]
for line in lines:
    if 'kareta_require_api_capability(' in line and not any(m in line for m in keep_markers):
        line=line.replace('kareta_require_api_capability(', 'kcap(')
        changed+=1
    out.append(line)
p.write_text('\n'.join(out)+'\n',encoding='utf-8')
print('KCAP_REPLACED',changed)
