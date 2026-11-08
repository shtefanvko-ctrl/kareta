from ci_selective_gate import select

cases = [
    (['docs/readme.md'], (False, False)),
    (['js/next/geo_map.js'], (True, False)),
    (['js/next/pages/scanner.js'], (False, True)),
    (['js/next/geo_map.js', 'js/next/pages/scanner.js'], (True, True)),
    (['config.php'], (True, True)),
    (['unknown/new_dependency.php'], (True, True)),
    (['.github/workflows/geo-runtime-reconcile.yml'], (True, False)),
    (['.github/workflows/home-scanner-navigation.yml'], (False, True)),
    (['tools/ci_selective_gate.py'], (True, True)),
    ([], (True, True)),
]
for paths, expected in cases:
    actual = select(paths)
    assert actual == expected, (paths, actual, expected)
print('selector matrix PASS:', len(cases))
