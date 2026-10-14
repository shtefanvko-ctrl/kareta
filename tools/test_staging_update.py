#!/usr/bin/env python3
import importlib.util, io, json, pathlib, shutil, subprocess, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location("updater", pathlib.Path(__file__).with_name("staging_update.py"))
u=importlib.util.module_from_spec(spec); spec.loader.exec_module(u)
class DeployTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        p=pathlib.Path(self.tmp.name)
        self.repo=p/"repo";self.site=p/"site"
        self.repo.mkdir();self.site.mkdir()
        self.old=(u.REPO,u.SITE,u.BACKUPS)
        u.REPO=self.repo;u.SITE=self.site;u.BACKUPS=p/"backups"
        u.BACKUPS.mkdir()
        self.git("init","-q")
        self.git("config","user.name","Test")
        self.git("config","user.email","test@localhost")
        self.put("js/app.js","const v = 1;")
        self.put("inc/asset_version.php","<?php const KARETA_ASSET_VERSION='1';")
        self.base=self.commit()
        for name in ("js/app.js","inc/asset_version.php"):
            p=self.site/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((self.repo/name).read_bytes())
        manifest=self.site/"storage/deployment_manifest.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text(json.dumps({"schema":1,"gitSha":self.base,"gitRef":"fixture","assetVersion":"1","builtAt":"2026-10-14T00:00:00Z","workflowRunId":""}))
        self.put("js/app.js","const v = 2;")
        self.put("inc/asset_version.php","<?php const KARETA_ASSET_VERSION='2';")
        self.target=self.commit()
    def tearDown(self):
        u.REPO,u.SITE,u.BACKUPS=self.old;self.tmp.cleanup()
    def git(self,*args):
        return subprocess.check_output(["git","-C",str(self.repo),*args],stderr=subprocess.DEVNULL).decode().strip()
    def put(self,name,text):
        p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
    def commit(self):
        self.git("add",".");self.git("commit","-qm","fixture");return self.git("rev-parse","HEAD")
    def test_apply_and_backup(self):
        with patch.object(u,"health",return_value={"health":"ready"}):
            r=u.deploy(self.base,self.target,True)
        self.assertEqual(r["status"],"DEPLOYED_CODE_ONLY")
        self.assertEqual((self.site/"js/app.js").read_text(),"const v = 2;")
        self.assertEqual((pathlib.Path(r["backup"])/"files/js/app.js").read_text(),"const v = 1;")
    def test_failed_health_rolls_back(self):
        with patch.object(u,"health",side_effect=[{},RuntimeError("failure")]):
            with self.assertRaisesRegex(RuntimeError,"ROLLED_BACK"):
                u.deploy(self.base,self.target,True)
        self.assertEqual((self.site/"js/app.js").read_text(),"const v = 1;")
        self.assertIn("'1'",(self.site/"inc/asset_version.php").read_text())
        self.assertEqual(json.loads((self.site/"storage/deployment_manifest.json").read_text())["gitSha"],self.base)
    def test_drift_blocks(self):
        (self.site/"js/app.js").write_text("local change")
        with self.assertRaisesRegex(RuntimeError,"overwritten"):
            u.plan(self.base,self.target)
        self.assertEqual((self.site/"js/app.js").read_text(),"local change")
    def test_private_config_blocks(self):
        self.put("config.private.php","not a credential");target=self.commit()
        with self.assertRaisesRegex(RuntimeError,"Protected"):
            u.plan(self.base,target)
    def test_database_change_blocks(self):
        self.put("api/migrations/999_fixture.php","<?php");target=self.commit()
        with self.assertRaisesRegex(RuntimeError,"Database contract"):
            u.plan(self.base,target)
    def test_symlink_blocks(self):
        p=self.site/"js/app.js";p.unlink();p.symlink_to(self.repo/"js/app.js")
        with self.assertRaisesRegex(RuntimeError,"Symlink"):
            u.plan(self.base,self.target)
    def test_noop_does_not_write(self):
        with patch.object(u,"health",return_value={}), patch.object(u,"atomic") as write:
            result=u.deploy(self.base,self.base,True)
        self.assertEqual(result["status"],"NO_RUNTIME_CHANGES");write.assert_not_called()

    def test_manifest_is_backed_up_and_matches_target(self):
        with patch.object(u,"health",return_value={}):
            result=u.deploy(self.base,self.target,True)
        current=json.loads((self.site/"storage/deployment_manifest.json").read_text())
        saved=json.loads((pathlib.Path(result["backup"])/"files/storage/deployment_manifest.json").read_text())
        self.assertEqual(current["gitSha"],self.target)
        self.assertEqual(current["assetVersion"],"2")
        self.assertEqual(saved["gitSha"],self.base)
    def test_stale_manifest_blocks_before_writes(self):
        (self.site/"storage/deployment_manifest.json").write_text('{"gitSha":"wrong"}')
        with patch.object(u,"health",return_value={}),patch.object(u,"atomic") as write:
            with self.assertRaisesRegex(RuntimeError,"Stored provenance"):
                u.deploy(self.base,self.target,True)
        write.assert_not_called()
    def test_partial_write_rolls_back(self):
        original=u.atomic
        def fail_js(path,data,mode=0o644):
            if path==self.site/"js/app.js":raise OSError("fixture write failure")
            return original(path,data,mode)
        with patch.object(u,"health",return_value={}),patch.object(u,"atomic",side_effect=fail_js):
            with self.assertRaisesRegex(RuntimeError,"ROLLED_BACK"):
                u.deploy(self.base,self.target,True)
        self.assertIn("'1'",(self.site/"inc/asset_version.php").read_text())
        self.assertEqual((self.site/"js/app.js").read_text(),"const v = 1;")
    def test_concurrent_edit_is_preserved(self):
        original=u.atomic
        def concurrent(path,data,mode=0o644):
            result=original(path,data,mode)
            if path==self.site/"inc/asset_version.php" and b"'2'" in data:
                (self.site/"js/app.js").write_text("concurrent edit")
            return result
        with patch.object(u,"health",return_value={}),patch.object(u,"atomic",side_effect=concurrent):
            with self.assertRaisesRegex(RuntimeError,"ROLLED_BACK"):
                u.deploy(self.base,self.target,True)
        self.assertEqual((self.site/"js/app.js").read_text(),"concurrent edit")
        self.assertIn("'1'",(self.site/"inc/asset_version.php").read_text())
    def test_health_rejects_wrong_provenance(self):
        ready={"ok":True,"status":"ready","assetVersion":"1"}
        provenance={"ok":True,"status":"provenance_ready","gitSha":"0"*40,"assetVersion":"1"}
        responses=[io.BytesIO(json.dumps(x).encode()) for x in (ready,ready,provenance)]
        with patch.object(u.urllib.request,"urlopen",side_effect=responses):
            with self.assertRaisesRegex(RuntimeError,"Runtime provenance"):
                u.health_once(self.base)
    def test_health_waits_for_cache_revalidation(self):
        with patch.object(u,"health_once",side_effect=[RuntimeError("old cached release"),{"gitSha":self.target}]) as read,patch.object(u.time,"sleep"):
            self.assertEqual(u.health(self.target),{"gitSha":self.target})
        self.assertEqual(read.call_count,2)
    def test_health_retries_are_bounded(self):
        with patch.object(u,"health_once",side_effect=RuntimeError("not ready")) as read,patch.object(u.time,"sleep"):
            with self.assertRaisesRegex(RuntimeError,"not ready"):
                u.health(self.target)
        self.assertEqual(read.call_count,10)
class CanonTests(unittest.TestCase):
    def test_canon_rejects_missing_geometry_or_phone_breakpoint(self):
        root=pathlib.Path(__file__).resolve().parents[1]
        files=["tools/test_design_canon_v1.js","tools/build_master_runtime_css.js","css/next/design_contract.css",
            "css/next/master_surfaces.css","css/next/master_responsive_shell.css","css/next/master_mobile_nav.css",
            "css/next/master_client_r84_postlude.css","css/routes/master_runtime.css","inc/asset_registry.php"]
        with tempfile.TemporaryDirectory() as tmp:
            dest=pathlib.Path(tmp)
            for name in files:
                target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,target)
            command=["node",str(dest/"tools/test_design_canon_v1.js")]
            positive=subprocess.run(command,capture_output=True,text=True)
            self.assertEqual(positive.returncode,0,positive.stderr)
            page=dest/"css/next/master_surfaces.css";source=page.read_text()
            start=source.index("/* 2026-10-04 — MASTER PAGE VISUAL CONTRACT.")
            end=source.index("/* KARETA MASTER PAGE VIEWPORT STABILITY.",start)
            page.write_text(source[:start]+source[end:])
            absent=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(absent.returncode,0)
            self.assertIn("missing responsive canon",absent.stderr)
            geometry=source[start:end].replace("@media(max-width:767px)","@media(max-width:766px)",1)
            page.write_text(source[:start]+geometry+source[end:])
            missing_phone=subprocess.run(command,capture_output=True,text=True)
            self.assertNotEqual(missing_phone.returncode,0)
            self.assertIn("missing page responsive contract @media(max-width:767px)",missing_phone.stderr)
if __name__=="__main__":unittest.main(verbosity=2)

