#!/usr/bin/env python3
"""Conservative PR-only selector. Uncertain input always runs both gates."""
import os
import subprocess
import sys

GEO = ('js/next/geo_map.js', 'js/mobile_native_bridge.js',
       'js/next/onboarding/onboarding_selection_catalog.js',
       'tools/test_geo_map_runtime.js')
SCANNER = ('inc/asset_registry.php', 'tools/test_home_scanner_navigation.js',
           'tools/test_master_personal_qr.js', 'js/next/pages/scanner.js',
           'js/next/app_next.js', 'js/next/route_registry.js',
           'js/next/role_access.js', 'js/next/route_asset_loader.js')
SHARED = ('config.php', 'index.php', 'js/next/pages/core.js')
WORKFLOWS = ('.github/workflows/geo-runtime-reconcile.yml',
             '.github/workflows/home-scanner-navigation.yml')
SELECTOR = ('tools/ci_selective_gate.py', 'tools/test_ci_selective_gate.py')


def select(paths):
    if not paths:
        return True, True
    geo = scanner = False
    for path in paths:
        if path in SHARED or path in SELECTOR:
            return True, True
        if path == WORKFLOWS[0] or path in GEO or path.startswith(('api/geo', 'inc/geo', 'migrations/')):
            geo = True
        elif path == WORKFLOWS[1] or path in SCANNER:
            scanner = True
        elif path.startswith(('docs/', 'ai/', '.github/ISSUE_TEMPLATE/')) or path.endswith(('.md', '.txt')):
            continue
        else:
            return True, True  # unknown dependency: fail open to full QA
    return geo, scanner


def changed():
    if os.environ.get('GITHUB_EVENT_NAME') != 'pull_request':
        return None
    base = os.environ.get('PR_BASE_SHA', '')
    head = os.environ.get('GITHUB_SHA', '')
    if not base or not head:
        return None
    try:
        result = subprocess.run(
            ['git', 'diff', '--name-only', '--diff-filter=ACDMRTUXB', base, head, '--'],
            capture_output=True, text=True, check=True, timeout=20)
        return [p for p in result.stdout.splitlines() if p]
    except (OSError, subprocess.SubprocessError):
        return None


if __name__ == '__main__':
    paths = changed()
    geo, scanner = (True, True) if paths is None else select(paths)
    gate = sys.argv[1] if len(sys.argv) > 1 else ''
    if gate not in ('geo', 'scanner'):
        sys.exit('usage: ci_selective_gate.py geo|scanner')
    print('true' if (geo if gate == 'geo' else scanner) else 'false')
