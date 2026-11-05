#!/usr/bin/env python3
"""Synthetic, hermetic checks for read-only staging inventory."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

AUDIT = Path(__file__).with_name('audit_staging_inventory.py')


def git(*args):
    return subprocess.check_output(['git', *map(str, args)], text=True).strip()


def audit(repo, sha, stage):
    p = subprocess.run([sys.executable, str(AUDIT), str(repo), sha, str(stage)],
                       capture_output=True, text=True)
    return p.returncode, json.loads(p.stdout)


def run():
    with tempfile.TemporaryDirectory(prefix='kareta-audit-') as tmp:
        repo = Path(tmp) / 'repo'
        stage = Path(tmp) / 'stage'
        repo.mkdir()
        stage.mkdir()
        for rel in ('index.php', 'landing/index.html', 'docs/spec.md'):
            for root in (repo, stage):
                file = root / rel
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(rel)
        git('-C', repo, 'init', '-q')
        git('-C', repo, 'add', '.')
        git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
            'commit', '-qm', 'fixture')
        sha = git('-C', repo, 'rev-parse', 'HEAD')
        rc, result = audit(repo, sha, stage)
        assert rc == 0 and result['counts']['matched'] == 3
        print('[PASS] matching tree')
        (stage / 'landing/index.html').write_text('changed')
        rc, result = audit(repo, sha, stage)
        assert rc == 1 and result['counts']['different'] == 1
        print('[PASS] changed blob rejected')
        (stage / 'docs/spec.md').unlink()
        rc, result = audit(repo, sha, stage)
        assert rc == 1 and result['counts']['missing'] == 1
        print('[PASS] missing tracked file rejected')
        (stage / 'docs/spec.md').symlink_to(repo / 'docs/spec.md')
        rc, result = audit(repo, sha, stage)
        assert rc == 1 and result['counts']['symlink'] == 1
        print('[PASS] symlink rejected')
        rc, result = audit(repo, 'bad', stage)
        assert rc == 2 and result['result'] == 'ERROR'
        print('[PASS] invalid SHA rejected')
        # Restore matching files so only the unverified gitlink can cause FAIL.
        (stage / 'landing/index.html').write_text('landing/index.html')
        (stage / 'docs/spec.md').unlink()
        (stage / 'docs/spec.md').write_text('docs/spec.md')
        # Inject a synthetic gitlink entry into ls-tree without touching a submodule.
        import contextlib
        import importlib.util
        import io
        from unittest.mock import patch
        spec = importlib.util.spec_from_file_location('inventory_under_test', AUDIT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        original = subprocess.check_output
        def fake_tree(args, **kwargs):
            data = original(args, **kwargs)
            if 'ls-tree' in args:
                data += b'160000 commit ' + sha.encode() + b'\tvendor/external\0'
            return data
        with patch.object(module.subprocess, 'check_output', side_effect=fake_tree):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                rc = module.run(repo, sha, stage)
        result = json.loads(output.getvalue())
        assert rc == 1 and result['counts']['matched'] == 3
        assert result['counts']['different'] == 0 and result['counts']['missing'] == 0
        assert result['counts']['symlink'] == 0 and result['counts']['unsupported'] == 1
        print('[PASS] gitlink is not silently skipped')
    print('STAGING_INVENTORY_TESTS: PASS 6/6')


if __name__ == '__main__':
    run()
