from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
keys=['services.manage','profile.manage','market.products.manage','market.orders.manage','requests.create','requests.update','requests.read','work_orders.update','work_orders.update_status','work_orders.assign','calendar.manage','finance.manage','data_integrity','site_content','admin']
for key in keys:
    print('===',key,'===')
    n=0
    for base in [root/'api/migrations',root/'api',root/'tools']:
        for p in base.rglob('*.php') if base.name!='tools' else base.rglob('*'):
            if not p.is_file(): continue
            try:s=p.read_text(encoding='utf-8',errors='replace')
            except: continue
            if key.lower() in s.lower():
                for i,l in enumerate(s.splitlines(),1):
                    if key.lower() in l.lower():
                        print(f'{p.relative_to(root)}:{i}: {l.strip()[:260]}')
                        n+=1
                        if n>=80: break
            if n>=80: break
        if n>=80: break
