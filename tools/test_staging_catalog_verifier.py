#!/usr/bin/env python3
import contextlib
import copy
import io
import json
import unittest
from unittest.mock import patch

import verify_staging_current as verifier

BASE='https://catalog-test.invalid'
RELEASE=verifier.expected_release()
PATH='/assets/catalog/garage/service_maintenance.json'
BODY=(verifier.ROOT/PATH.lstrip('/')).read_bytes()
ASSET={'group':'catalogs','path':PATH,'url':PATH+'?v='+RELEASE,'bundle':'cabinet','lazy':True,'exists':True}

class CatalogVerifierTests(unittest.TestCase):
    def verify(self,body=BODY,mime='application/json',status=200,asset=None):
        with patch.object(verifier,'fetch',return_value=(status,{'Content-Type':mime},body)):
            return verifier.verify_lazy_asset(BASE,RELEASE,asset or ASSET)

    def test_candidate_json_and_structured_mime(self):
        for mime in ['application/json; charset=utf-8','application/vnd.kareta+json']:
            self.assertIsNone(self.verify(mime=mime))

    def test_mime_status_and_html_negative_paths(self):
        for mime in ['', 'text/html','text/json']:
            self.assertIn('MIME',self.verify(mime=mime))
        self.assertIn('HTTP 404',self.verify(status=404))
        self.assertIn('HTML body',self.verify(body=b'<!doctype html>fallback'))

    def test_schema_id_json_and_exact_bytes(self):
        for field,value in [('schema',2),('schema','1'),('schema',True),('id','wrong')]:
            payload=json.loads(BODY);payload[field]=value
            self.assertIn('schema/id mismatch',self.verify(body=json.dumps(payload).encode()))
        self.assertIn('JSON/candidate read failed',self.verify(body=b'{invalid'))
        self.assertIn('SHA-256',self.verify(body=BODY+b'\n'))

    def test_path_origin_release_and_presence(self):
        for changes,expected in [
            ({'url':PATH+'?v=old'},'asset version'),
            ({'url':'https://other.invalid'+ASSET['url']},'path/origin'),
            ({'url':'http://catalog-test.invalid'+ASSET['url']},'path/origin'),
            ({'url':'/other.json?v='+RELEASE},'path/origin'),
            ({'path':'/assets/catalog/unknown.json'},'candidate registry'),
            ({'exists':False},'missing file'),
            ({'lazy':False},'not marked lazy'),
        ]:
            self.assertIn(expected,self.verify(asset={**ASSET,**changes}))

    def manifest(self):
        script={'group':'scripts','path':'/js/next/pages/cabinet.js','url':'/js/next/pages/cabinet.js?v='+RELEASE,'bundle':'cabinet','lazy':True,'exists':True}
        return {'ok':True,'release':RELEASE,'missing':[],'assets':[script,copy.copy(ASSET)],'assetMetrics':{'lazyScriptCount':1,'lazyCatalogCount':1}}

    def walk(self,manifest):
        def fetch(url,accept='*/*',timeout=15):
            if '/asset_manifest.php?' in url:
                return 200,{'Content-Type':'application/json','X-Kareta-Asset-Version':RELEASE},json.dumps(manifest).encode()
            if PATH in url:return 200,{'Content-Type':'application/json'},BODY
            return 200,{'Content-Type':'application/javascript'},b'/* test script */'
        with patch.object(verifier,'fetch',side_effect=fetch),contextlib.redirect_stdout(io.StringIO()) as out,contextlib.redirect_stderr(io.StringIO()):
            verifier.verify_lazy_assets(BASE,RELEASE)
            return out.getvalue()

    def test_full_walk_preserves_css_js_and_adds_catalog(self):
        out=self.walk(self.manifest())
        self.assertIn('LAZY_ASSETS: PASS total=1 styles=0 scripts=1',out)
        self.assertIn('LAZY_CATALOGS: PASS total=1',out)

    def test_omitted_duplicate_and_bad_metric_catalogs_fail_closed(self):
        for change in ['omit','duplicate','metric']:
            manifest=self.manifest()
            if change=='omit':manifest['assets'].pop();manifest['assetMetrics']['lazyCatalogCount']=0
            if change=='duplicate':manifest['assets'].append(copy.copy(ASSET))
            if change=='metric':manifest['assetMetrics']['lazyCatalogCount']=0
            with self.assertRaises(SystemExit):self.walk(manifest)

if __name__=='__main__':unittest.main()
