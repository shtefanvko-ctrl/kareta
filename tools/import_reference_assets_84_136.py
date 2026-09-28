#!/usr/bin/env python3
from pathlib import Path
import json, sys, zipfile, shutil

ROOT=Path('/home/karetakz/sites/kareta.kz')
CANDIDATES=[
    Path('/mnt/c/Users/KARETA.KZ/Downloads/KARETA_REFERENCE_ASSETS_84_135.zip'),
    Path('/mnt/c/Users/KARETA.KZ/Desktop/KARETA_REFERENCE_ASSETS_84_135.zip'),
    Path('/home/karetakz/KARETA_REFERENCE_ASSETS_84_135.zip'),
]
EXPECTED_BRANDS=36
EXPECTED_AUTO=11

def locate():
    if len(sys.argv)>1:
        return Path(sys.argv[1]).expanduser()
    return next((p for p in CANDIDATES if p.is_file()),None)

src=locate()
if not src or not src.is_file():
    print('REFERENCE_ASSET_ZIP: MISSING')
    sys.exit(2)

with zipfile.ZipFile(src) as z:
    names=[n for n in z.namelist() if n and not n.endswith('/')]
    if 'manifest.json' not in names:
        raise SystemExit('manifest.json missing')
    manifest=json.loads(z.read('manifest.json').decode('utf-8'))
    brands=[n for n in names if n.startswith('brands/') and n.endswith('.webp')]
    autos=[n for n in names if n.startswith('automotive/') and n.endswith('.webp')]
    if len(brands)!=EXPECTED_BRANDS or len(autos)!=EXPECTED_AUTO:
        raise SystemExit(f'unexpected asset count: brands={len(brands)} automotive={len(autos)}')
    allowed={'manifest.json',*brands,*autos}
    if any(n not in allowed or '..' in Path(n).parts or Path(n).is_absolute() for n in names):
        raise SystemExit('unexpected or unsafe archive member')
    target=ROOT/'assets/reference'
    (target/'brands').mkdir(parents=True,exist_ok=True)
    (target/'automotive').mkdir(parents=True,exist_ok=True)
    for n in brands+autos:
        dst=target/n
        dst.parent.mkdir(parents=True,exist_ok=True)
        with z.open(n) as r, dst.open('wb') as w:
            shutil.copyfileobj(r,w)
    (target/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

print(f'REFERENCE_ASSET_ZIP: {src}')
print(f'BRANDS: {len(brands)}')
print(f'AUTOMOTIVE: {len(autos)}')
print('REFERENCE_ASSETS: INSTALLED')
