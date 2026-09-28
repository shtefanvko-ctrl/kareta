from pathlib import Path
import re, json
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
auth_gate=re.compile(r'kareta_require_role\s*\(|kareta_require_any_role\s*\(')
manual_gate=re.compile(r'(?:role_required|admin_required|master_required|client_required|seller_required|sto_required|role_not_allowed)',re.I)
role_rows=[]
for p in (root/'api').rglob('*.php'):
    s=p.read_text(encoding='utf-8',errors='replace')
    for i,l in enumerate(s.splitlines(),1):
        if auth_gate.search(l) or manual_gate.search(l):
            role_rows.append((str(p.relative_to(root)),i,l.strip()))
print('AUTH_GATE_ROWS',len(role_rows))
for rel,i,l in role_rows:
    print(f'{rel}:{i}: {l[:300]}')

print('--- CAPABILITY SEEDS ---')
cap_rows=[]
key_rx=re.compile(r"['\"]([a-zA-Z0-9_.*-]+\.[a-zA-Z0-9_.*-]+)['\"]")
for p in list((root/'api/migrations').rglob('*.php'))+[root/'api/identity/capability_registry.php']:
    s=p.read_text(encoding='utf-8',errors='replace')
    for i,l in enumerate(s.splitlines(),1):
        if 'capabil' not in l.lower() and not key_rx.search(l): continue
        ks=key_rx.findall(l)
        if ks:
            cap_rows.append((str(p.relative_to(root)),i,l.strip(),ks))
for rel,i,l,ks in cap_rows:
    if any(k.startswith(('requests.','work_orders.','services.','profile.','market.','calendar.','finance.','vehicles.','parts.','chats.','notifications.','organization.')) for k in ks):
        print(f'{rel}:{i}: {l[:340]}')
