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
    print('STAGING_INVENTORY_TESTS: PASS 5/5')


if __name__ == '__main__':
    run()
