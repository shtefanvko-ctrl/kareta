#!/usr/bin/env python3
import argparse, json, re, sys, time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]

def expected_release():
    text=(ROOT/'inc/asset_version.php').read_text(encoding='utf-8')
    m=re.search(r"KARETA_ASSET_VERSION\s*=\s*'([^']+)'",text)
    if not m:
        raise RuntimeError('KARETA_ASSET_VERSION not found')
    return m.group(1)

def fetch(url, accept='*/*', timeout=15):
    req=Request(url,headers={'Accept':accept,'User-Agent':'KARETA-Staging-Verify/1.0','Cache-Control':'no-cache'})
    with urlopen(req,timeout=timeout) as res:
        return res.status, res.headers, res.read()

def fail(msg):
    print('FAIL:',msg,file=sys.stderr)
    raise SystemExit(1)

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

        status,_,body=fetch(base+'/asset_manifest.php?'+urlencode({'runtime_probe':str(int(time.time()))}),'application/json')
        if status!=200: fail(f'asset manifest HTTP {status}')
        manifest=json.loads(body.decode('utf-8'))
        server_release=str(manifest.get('release') or manifest.get('assetVersion') or '')
        if server_release and server_release!=release: fail(f'manifest release={server_release} expected={release}')

        status,_,body=fetch(base+'/sw.js?v='+release,'application/javascript')
        if status!=200: fail(f'sw.js HTTP {status}')
        sw=body.decode('utf-8','replace')
        if f"const RELEASE = '{release}'" not in sw: fail('service worker release mismatch')

        status,_,body=fetch(base+'/?verify_release='+release,'text/html')
        if status!=200: fail(f'root HTTP {status}')
        html=body.decode('utf-8','replace')
        if release not in html: fail('root HTML does not advertise expected release')
    except (HTTPError,URLError,TimeoutError,OSError,json.JSONDecodeError) as exc:
        fail(f'network/protocol error: {exc}')

    print('STAGING_CURRENT: PASS release='+release)

if __name__=='__main__':
    main()
