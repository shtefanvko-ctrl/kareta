from __future__ import annotations
import argparse, hashlib, json, re, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REL='188.5.5.6.84.109'
BASE=ROOT/'docs'/'release-baseline'/REL
parser=argparse.ArgumentParser()
parser.add_argument('--integrity-only', action='store_true', help='Verify immutable baseline artifacts without requiring reachable external staging.')
args=parser.parse_args()
errors=[]

def sha256(p:Path):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def fail(msg): errors.append(msg)

required=['baseline_manifest.json','file_hashes.sha256','key_file_hashes.sha256','routes.json','asset_plan.json','staging_check.json','README.md']
for name in required:
    if not (BASE/name).is_file(): fail(f'missing baseline artifact: {name}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
manifest=json.loads((BASE/'baseline_manifest.json').read_text(encoding='utf-8'))
routes=json.loads((BASE/'routes.json').read_text(encoding='utf-8'))
assets=json.loads((BASE/'asset_plan.json').read_text(encoding='utf-8'))
staging=json.loads((BASE/'staging_check.json').read_text(encoding='utf-8'))
if manifest.get('release')!=REL: fail('manifest release mismatch')
if manifest.get('sourceFileCount')!=1009: fail('source file count mismatch')
# Verify immutable source files. Extra QA files are allowed.
rows=[]
for line in (BASE/'file_hashes.sha256').read_text(encoding='utf-8').splitlines():
    if not line.strip(): continue
    h,rel=line.split('  ',1); rows.append((h,rel))
if len(rows)!=1009: fail(f'file hash rows={len(rows)}, expected 1009')
for expected,rel in rows:
    p=ROOT/rel
    if not p.is_file(): fail(f'source file missing: {rel}'); continue
    actual=sha256(p)
    if actual!=expected: fail(f'source file changed: {rel}')
normalized=''.join(f'{h}  {rel}\n' for h,rel in rows)
if hashlib.sha256(normalized.encode()).hexdigest()!=manifest.get('sourceTreeSha256'): fail('source tree hash mismatch')
# Key hashes are a strict subset and must still match.
keyrows=[line for line in (BASE/'key_file_hashes.sha256').read_text(encoding='utf-8').splitlines() if line.strip()]
if len(keyrows)!=manifest.get('keyFileCount'): fail('key file count mismatch')
for line in keyrows:
    h,rel=line.split('  ',1)
    p=ROOT/rel
    if not p.is_file() or sha256(p)!=h: fail(f'key hash mismatch: {rel}')
# Version markers.
for rel in ['inc/asset_version.php','sw.js']:
    text=(ROOT/rel).read_text(encoding='utf-8',errors='replace')
    if REL not in text: fail(f'release marker missing: {rel}')
# Route registry contract.
if routes.get('counts',{}).get('routeKeys')!=67: fail('route key count mismatch')
if routes.get('counts',{}).get('legacyAliases')!=39: fail('legacy alias count mismatch')
if routes.get('counts',{}).get('dynamicPatterns')!=17: fail('dynamic route count mismatch')
if not routes.get('uxAudit',{}).get('ok'): fail('route UX audit failed')
if set(routes.get('routes',{}))!=set(routes.get('uxSurfaces',{})): fail('route/surface key mismatch')
# Asset plan contract.
summary=assets.get('summary',{})
if summary.get('lazyBundles')!=56: fail('lazy bundle count mismatch')
if summary.get('routeKeysWithLazyAssets')!=67: fail('lazy asset route coverage mismatch')
if summary.get('missingRuntimeCodeAssets')!=0: fail('missing runtime CSS/JS/PHP assets')
if summary.get('missingImageAssets')!=22: fail('NO_ASSETS image count changed')
if assets.get('release')!=REL: fail('asset release mismatch')
# Staging evidence. Full stage completion requires a verified external staging check.
if staging.get('localStagingEquivalent',{}).get('status')!='PASS': fail('local staging-equivalent smoke check missing')
ext=staging.get('externalStaging',{})
ext_status=ext.get('status')
if ext_status not in {'PASS','BLOCKED_BY_EXECUTION_ENVIRONMENT','FAIL_WRONG_APPLICATION'}: fail('external staging status invalid')
if ext_status=='PASS' and not ext.get('releaseVerified'): fail('external staging PASS without release verification')
if not args.integrity_only and (ext_status!='PASS' or not ext.get('releaseVerified')):
    fail('required external staging verification is incomplete')
# Syntax check the baseline-critical runtime sources.
checks=[
    ['php','-l',str(ROOT/'index.php')],
    ['php','-l',str(ROOT/'inc/asset_registry.php')],
    ['php','-l',str(ROOT/'inc/asset_version.php')],
    ['php','-l',str(ROOT/'api/db.php')],
    ['php','-l',str(ROOT/'api/identity_session.php')],
    ['node','--check',str(ROOT/'js/next/route_registry.js')],
    ['node','--check',str(ROOT/'js/next/route_asset_loader.js')],
    ['node','--check',str(ROOT/'js/next/route_runtime.js')],
    ['node','--check',str(ROOT/'js/next/app_next.js')],
]
for cmd in checks:
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if p.returncode!=0: fail(f'syntax failed: {" ".join(cmd)} :: {p.stdout.strip()}')
if errors:
    print('RELEASE_BASELINE_84_109: NOT_OK')
    for e in errors: print('ERROR:',e)
    sys.exit(1)
print('RELEASE_BASELINE_84_109: '+('INTEGRITY_OK' if args.integrity_only else 'OK'))
print('source_files=1009')
print('route_keys=67 aliases=39 dynamic_patterns=17')
print('lazy_bundles=56 missing_runtime_code_assets=0 no_assets_images=22')
print('external_staging='+staging['externalStaging']['status'])
print('local_staging_equivalent=PASS')
