#!/usr/bin/env python3
import argparse, hashlib, json, re, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]

def expected_release():
    text=(ROOT/'inc/asset_version.php').read_text(encoding='utf-8')
    m=re.search(r"KARETA_ASSET_VERSION\s*=\s*'([^']+)'",text)
    if not m:
        raise RuntimeError('KARETA_ASSET_VERSION not found')
    return m.group(1)

def fetch(url, accept='*/*', timeout=15):
    req=Request(url,headers={
        'Accept':accept,
        'User-Agent':'KARETA-Staging-Verify/1.1',
        'Cache-Control':'no-cache',
    })
    with urlopen(req,timeout=timeout) as res:
        return res.status, res.headers, res.read()

def fail(msg):
    print('FAIL:',msg,file=sys.stderr)
    raise SystemExit(1)

def expected_mime(group):
    if group=='styles':
        return ('text/css',)
    if group=='scripts':
        return ('javascript','ecmascript')
    return ()

def is_json_mime(value):
    media_type=str(value or '').split(';')[0].strip().lower()
    return re.fullmatch(r'application/(?:[a-z0-9!#$&^_.+-]+\+)?json',media_type) is not None

def expected_catalog_paths():
    registry=(ROOT/'inc/asset_registry.php').read_text(encoding='utf-8')
    return {'/'+path for path in re.findall(r"['\"](assets/catalog/[A-Za-z0-9_./-]+\.json)['\"]",registry)}

def verify_lazy_asset(base,release,asset):
    group=str(asset.get('group') or '')
    path=str(asset.get('path') or '')
    asset_url=str(asset.get('url') or '')
    bundle=str(asset.get('bundle') or '')
    label=f'{bundle}:{group}:{path}'

    if group not in ('styles','scripts','catalogs'):
        return f'{label}: unexpected group'
    if asset.get('lazy') is not True:
        return f'{label}: route-loader asset is not marked lazy'
    if asset.get('exists') is not True:
        return f'{label}: manifest reports missing file'
    if not asset_url:
        return f'{label}: manifest URL missing'

    parsed=urlparse(asset_url)
    version=(parse_qs(parsed.query).get('v') or [''])[0]
    if version!=release:
        return f'{label}: asset version={version or "<missing>"} expected={release}'

    target=urljoin(base+'/',asset_url)
    if group=='catalogs':
        if path not in expected_catalog_paths() or '..' in path:
            return f'{label}: catalog is not in candidate registry'
        target_parts,base_parts=urlparse(target),urlparse(base)
        if (target_parts.scheme,target_parts.netloc)!=(base_parts.scheme,base_parts.netloc) or target_parts.path!=path:
            return f'{label}: catalog URL does not match candidate path/origin'
    accept={'styles':'text/css,*/*;q=0.1','scripts':'application/javascript,text/javascript,*/*;q=0.1','catalogs':'application/json'}[group]
    try:
        status,headers,body=fetch(target,accept)
    except (HTTPError,URLError,TimeoutError,OSError) as exc:
        return f'{label}: fetch failed: {exc}'

    if status!=200:
        return f'{label}: HTTP {status}'

    content_type=str(headers.get('Content-Type') or '').lower()
    mime_ok=is_json_mime(content_type) if group=='catalogs' else any(token in content_type for token in expected_mime(group))
    if not mime_ok:
        return f'{label}: MIME {content_type or "<missing>"}'

    prefix=body[:256].lstrip().lower()
    if prefix.startswith(b'<!doctype html') or prefix.startswith(b'<html'):
        return f'{label}: HTML body returned for {group} asset'

    if group=='catalogs':
        try:
            payload=json.loads(body.decode('utf-8'))
            candidate=(ROOT/path.lstrip('/')).read_bytes()
            expected=json.loads(candidate.decode('utf-8'))
        except (UnicodeError,json.JSONDecodeError,OSError) as exc:
            return f'{label}: JSON/candidate read failed: {exc}'
        if not isinstance(payload,dict) or type(payload.get('schema')) is not int or payload.get('schema')!=expected.get('schema') or payload.get('id')!=expected.get('id'):
            return f'{label}: catalog schema/id mismatch'
        if hashlib.sha256(body).digest()!=hashlib.sha256(candidate).digest():
            return f'{label}: catalog SHA-256 differs from candidate'

    return None

def verify_lazy_assets(base,release):
    probe=urlencode({'route_loader':'1','v':release,'verify':str(int(time.time()))})
    status,headers,body=fetch(base+'/asset_manifest.php?'+probe,'application/json')
    if status!=200:
        fail(f'route asset manifest HTTP {status}')
    if not is_json_mime(headers.get('Content-Type')):
        fail('route asset manifest MIME is not JSON')

    manifest=json.loads(body.decode('utf-8'))
    manifest_release=str(manifest.get('release') or manifest.get('assetVersion') or '')
    if manifest_release!=release:
        fail(f'route manifest release={manifest_release or "<missing>"} expected={release}')
    if str(headers.get('X-Kareta-Asset-Version') or '')!=release:
        fail('route manifest X-Kareta-Asset-Version mismatch')

    missing=manifest.get('missing') or []
    if missing:
        fail('route manifest missing assets: '+', '.join(map(str,missing[:20])))
    if manifest.get('ok') is not True:
        fail('route asset manifest reports ok=false')

    assets=[
        row for row in (manifest.get('assets') or [])
        if str(row.get('group') or '') in ('styles','scripts')
    ]
    if not assets:
        fail('route asset manifest contains no lazy CSS/JS assets')

    metrics=manifest.get('assetMetrics') or {}
    expected_count=int(metrics.get('lazyStyleCount') or 0)+int(metrics.get('lazyScriptCount') or 0)
    if expected_count and expected_count!=len(assets):
        fail(f'route asset count={len(assets)} manifest metrics={expected_count}')

    catalogs=[row for row in (manifest.get('assets') or []) if row.get('group')=='catalogs']
    required_catalogs=expected_catalog_paths()
    delivered_catalogs={str(row.get('path') or '') for row in catalogs}
    if delivered_catalogs!=required_catalogs or len(catalogs)!=len(required_catalogs):
        fail(f'route catalog inventory differs from candidate: delivered={sorted(delivered_catalogs)} expected={sorted(required_catalogs)}')
    if int(metrics.get('lazyCatalogCount') or 0)!=len(catalogs):
        fail('route catalog count differs from manifest metrics')

    errors=[]
    workers=min(12,max(1,len(assets)+len(catalogs)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures=[pool.submit(verify_lazy_asset,base,release,row) for row in assets+catalogs]
        for future in as_completed(futures):
            error=future.result()
            if error:
                errors.append(error)

    if errors:
        for error in sorted(errors):
            print('ASSET_FAIL:',error,file=sys.stderr)
        fail(f'{len(errors)} lazy route asset(s) failed HTTP/MIME/release verification')

    styles=sum(1 for row in assets if row.get('group')=='styles')
    scripts=sum(1 for row in assets if row.get('group')=='scripts')
    print(f'LAZY_ASSETS: PASS total={len(assets)} styles={styles} scripts={scripts}')
    print(f'LAZY_CATALOGS: PASS total={len(catalogs)} SHA-256=candidate')

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--base-url',required=True)
    ap.add_argument('--expected-release',default='')
    args=ap.parse_args()
    base=args.base_url.rstrip('/')
    release=args.expected_release or expected_release()
    print('KARETA staging verification',base,'expected',release)

    try:
        status,_,body=fetch(base+'/api/db.php?'+urlencode({'action':'ping','identity_probe':'1','verify':str(int(time.time()))}),'application/json')
        if status!=200: fail(f'ping HTTP {status}')
        payload=json.loads(body.decode('utf-8'))
        if payload.get('ok') is not True or payload.get('dbReady') is not True: fail('database ping is not ready')
        if str(payload.get('assetVersion',''))!=release: fail(f"server assetVersion={payload.get('assetVersion')} expected={release}")

        status,headers,body=fetch(base+'/asset_manifest.php?'+urlencode({'runtime_probe':str(int(time.time()))}),'application/json')
        if status!=200: fail(f'asset manifest HTTP {status}')
        manifest=json.loads(body.decode('utf-8'))
        server_release=str(manifest.get('release') or manifest.get('assetVersion') or '')
        if server_release and server_release!=release: fail(f'manifest release={server_release} expected={release}')
        if str(headers.get('X-Kareta-Asset-Version') or '')!=release: fail('runtime manifest release header mismatch')

        status,_,body=fetch(base+'/sw.js?v='+release,'application/javascript')
        if status!=200: fail(f'sw.js HTTP {status}')
        sw=body.decode('utf-8','replace')
        if f"const RELEASE = '{release}'" not in sw: fail('service worker release mismatch')

        status,_,body=fetch(base+'/?verify_release='+release,'text/html')
        if status!=200: fail(f'root HTTP {status}')
        html=body.decode('utf-8','replace')
        if release not in html: fail('root HTML does not advertise expected release')

        verify_lazy_assets(base,release)
    except (HTTPError,URLError,TimeoutError,OSError,json.JSONDecodeError) as exc:
        fail(f'network/protocol error: {exc}')

    print('STAGING_CURRENT: PASS release='+release)

if __name__=='__main__':
    main()
