from pathlib import Path
import subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
release='188.5.5.6.84.109'
sh=ROOT/'tools'/'repair_staging_plesk_84_109.sh'
verify=ROOT/'tools'/'verify_staging_release_84_109.py'
doc=ROOT/'docs'/'release-baseline'/release/'STAGING_PLESK_REPAIR.md'
errors=[]
for p in (sh,verify,doc):
    if not p.is_file(): errors.append(f'missing: {p.relative_to(ROOT)}')
if sh.is_file():
    text=sh.read_text(encoding='utf-8')
    for needle in [release,'plesk bin subdomain --update','plesk bin subdomain --create','plesk repair web', 'KARETA_STAGING_DOCROOT']:
        if needle not in text: errors.append(f'repair script missing contract: {needle}')
    p=subprocess.run(['bash','-n',str(sh)],capture_output=True,text=True)
    if p.returncode: errors.append('bash syntax: '+p.stderr.strip())
if verify.is_file():
    text=verify.read_text(encoding='utf-8')
    for needle in ['https://s.kareta.kz/',release,'KARETA_STAGING_84_109: OK']:
        if needle not in text: errors.append(f'verifier missing contract: {needle}')
    p=subprocess.run([sys.executable,'-m','py_compile',str(verify)],capture_output=True,text=True)
    if p.returncode: errors.append('python syntax: '+p.stderr.strip())
if errors:
    print('STAGING_REPAIR_PACKAGE_84_109: NOT_OK')
    for e in errors: print('ERROR:',e)
    sys.exit(1)
print('STAGING_REPAIR_PACKAGE_84_109: OK')
