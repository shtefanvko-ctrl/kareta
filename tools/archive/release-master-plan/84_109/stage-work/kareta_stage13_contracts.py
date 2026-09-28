from pathlib import Path
import re
root=Path('/mnt/c/Users/KARETA.KZ/Desktop/kareta.kz')
targets=['api/bootstrap.php','api/db.php','api/auth_session.php','api/client_error.php','api/runtime_health.php','api/release_status.php','api/schema_health.php']
for rel in targets:
    p=root/rel
    s=p.read_text(encoding='utf-8',errors='replace')
    print('===== '+rel+' =====')
    for pat in ['idempot','requestId','KARETA_REQUEST_ID','method_not_allowed','auth.sendOtp','auth.verifyOtp','invalid_action','unknown_action','schema']:
        hits=[(i+1,l) for i,l in enumerate(s.splitlines()) if re.search(pat,l,re.I)]
        if hits:
            print('--- '+pat+' ---')
            for i,l in hits[:80]: print(f'{i}: {l[:240]}')
