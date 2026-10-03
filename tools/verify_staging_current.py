#!/usr/bin/env python3
import argparse, json, re, sys, time
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

def fetch_any_status(url, accept='*/*', timeout=15):
    req=Request(url,headers={
        'Accept':accept,
        'User-Agent':'KARETA-Staging-Verify/1.1',
        'Cache-Control':'no-cache',
    })
    try:
        with urlopen(req,timeout=timeout) as res:
            return res.status, res.headers, res.read()
    except HTTPError as exc:
        return exc.code, exc.headers, exc.read()

def fail(msg):
    print('FAIL:',msg,file=sys.stderr)
    raise SystemExit(1)

def expected_mime(group):
    if group=='styles':
        return ('text/css',)
    if group=='scripts':
        return ('javascript','ecmascript')
    return ()

def verify_lazy_asset(base,release,asset):
    group=str(asset.get('group') or '')
    path=str(asset.get('path') or '')
    asset_url=str(asset.get('url') or '')
    bundle=str(asset.get('bundle') or '')
    label=f'{bundle}:{group}:{path}'

    if group not in ('styles','scripts'):
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
    accept='text/css,*/*;q=0.1' if group=='styles' else 'application/javascript,text/javascript,*/*;q=0.1'
    try:
        status,headers,body=fetch(target,accept)
    except (HTTPError,URLError,TimeoutError,OSError) as exc:
        return f'{label}: fetch failed: {exc}'

    if status!=200:
        return f'{label}: HTTP {status}'

    content_type=str(headers.get('Content-Type') or '').lower()
    if not any(token in content_type for token in expected_mime(group)):
        return f'{label}: MIME {content_type or "<missing>"}'

    prefix=body[:256].lstrip().lower()
    if prefix.startswith(b'<!doctype html') or prefix.startswith(b'<html'):
        return f'{label}: HTML body returned for {group} asset'

    return None

def verify_lazy_assets(base,release):
    probe=urlencode({'route_loader':'1','v':release,'verify':str(int(time.time()))})
    status,headers,body=fetch(base+'/asset_manifest.php?'+probe,'application/json')
    if status!=200:
        fail(f'route asset manifest HTTP {status}')

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

    errors=[]
    workers=min(12,max(1,len(assets)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures=[pool.submit(verify_lazy_asset,base,release,row) for row in assets]
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
    return manifest

def _js_declares_lazy_key(source,key):
    match=re.search(r'KNOWN_LAZY_ROUTE_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\)',source)
    if not match:
        return False
    return re.search(r"['\"]"+re.escape(key)+r"['\"]",match.group(1)) is not None

def _fetch_js_text(base,path,release):
    target=base+'/'+path.lstrip('/')+'?'+urlencode({'v':release,'verify':str(int(time.time()))})
    status,headers,body=fetch(target,'application/javascript,text/javascript,*/*;q=0.1')
    if status!=200:
        fail(f'{path} HTTP {status}')
    content_type=str(headers.get('Content-Type') or '').lower()
    if 'javascript' not in content_type and 'ecmascript' not in content_type:
        fail(f'{path} MIME {content_type or "<missing>"}')
    prefix=body[:256].lstrip().lower()
    if prefix.startswith(b'<!doctype html') or prefix.startswith(b'<html'):
        fail(f'{path} returned HTML instead of JavaScript')
    return body.decode('utf-8','replace')

def verify_not_found_contract(base,release,manifest):
    bundles=manifest.get('routeBundles') or {}
    matches=[]
    for name,bundle in bundles.items():
        if not isinstance(bundle,dict) or bundle.get('lazy') is not True:
            continue
        keys=[str(value) for value in (bundle.get('routeKeys') or [])]
        if 'notFound' in keys:
            matches.append((str(name),bundle))
    if not matches:
        fail('notFound lazy bundle is missing from route manifest')

    expected_script='js/next/pages/not_found.js'
    expected_global='KaretaNotFoundPages'
    contract_bundle=None
    for name,bundle in matches:
        scripts=[str(value) for value in (bundle.get('scripts') or [])]
        globals_=[str(value) for value in (bundle.get('globals') or [])]
        if expected_script in scripts and expected_global in globals_:
            contract_bundle=(name,bundle)
            break
    if contract_bundle is None:
        fail('notFound bundle does not declare not_found.js + KaretaNotFoundPages')

    not_found_assets=[
        row for row in (manifest.get('assets') or [])
        if str(row.get('group') or '')=='scripts'
        and str(row.get('path') or '')==expected_script
    ]
    if not_found_assets:
        asset_error=verify_lazy_asset(base,release,not_found_assets[0])
        if asset_error:
            fail('notFound route asset invalid: '+asset_error)

    page_source=_fetch_js_text(base,expected_script,release)
    if expected_global not in page_source:
        fail('not_found.js does not export KaretaNotFoundPages')

    for path in ('js/next/route_asset_loader.js','js/boot/runtime_shell_bundle.js'):
        source=_fetch_js_text(base,path,release)
        if not _js_declares_lazy_key(source,'notFound'):
            fail(f'{path} does not declare notFound as a known lazy route')

    probe_path='/__kareta_staging_verify_not_found__'
    probe_url=base+probe_path+'?'+urlencode({'verify':str(int(time.time()))})
    status,headers,body=fetch_any_status(probe_url,'text/html')
    if status!=404:
        fail(f'clean notFound probe HTTP {status} expected=404')
    content_type=str(headers.get('Content-Type') or '').lower()
    if 'text/html' not in content_type:
        fail(f'clean notFound probe MIME {content_type or "<missing>"}')
    html=body.decode('utf-8','replace')
    if release not in html:
        fail('clean notFound shell does not advertise expected release')
    if 'KARETA_HTTP_NOT_FOUND_PATH' not in html:
        fail('clean notFound shell is missing HTTP fallback path bootstrap')

    print(f'NOT_FOUND_ROUTE: PASS release={release} bundle={contract_bundle[0]} http=404')

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

        route_manifest=verify_lazy_assets(base,release)
        verify_not_found_contract(base,release,route_manifest)
    except (HTTPError,URLError,TimeoutError,OSError,json.JSONDecodeError) as exc:
        fail(f'network/protocol error: {exc}')

    print('STAGING_CURRENT: PASS release='+release)

if __name__=='__main__':
    main()
