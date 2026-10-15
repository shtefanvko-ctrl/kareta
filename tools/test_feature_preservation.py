#!/usr/bin/env python3
"""Repository-only feature-preservation gate: no network, DB, or runtime probes."""
import argparse
import json
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "ai" / "FEATURE_PRESERVATION_BASELINE.json"
ROUTE_FILE = ROOT / "js" / "next" / "route_registry.js"
LANDING_I18N = ROOT / "landing" / "i18n.json"
ROUTE_RE = re.compile(r"(?m)^\s*([A-Za-z]\w*):Object\.freeze\(\{\s*path:'([^']+)'")
LANGUAGES = ("ru", "kk", "en")
MIN_ROUTE_COUNT = 72

# Historical floor: the original 72 route URLs and 19 critical entry points.
# Reviewed additions may extend the JSON baseline, but must not replace this floor.
HISTORICAL_ROUTES = dict(line.split("=", 1) for line in """\
home=#/home
masterQr=#/master/qr
scanner=#/scan
scannerQr=#/scan/qr
scannerDocument=#/scan/document
platform=#/platform
corePlatform=#/core
calendarBooking=#/calendar
finance=#/finance
market=#/market
crm=#/crm
identityMigration=#/admin/identity-migration
adminUsers=#/admin/users
adminOrganizations=#/admin/organizations
adminMonitoring=#/admin/monitoring
adminManagement=#/admin/management
services=#/services
news=#/news
masterNews=#/master/news
masterNewsCreate=#/master/news/create
masterNewsEdit=#/master/news/edit
works=#/works
profile=#/profile
following=#/following
realWorks=#/real-works
workDetail=#/works/item
serviceManagement=#/services/manage
masters=#/masters
masterOnboarding=#/onboarding/master
masterDashboard=#/master
masterSchedule=#/master/schedule
masterProfileOwner=#/master/profile
masterWallOwner=#/master/wall
masterWorks=#/master/works
masterReviews=#/master/reviews
masterExchange=#/master/exchange
community=#/community
stoDashboard=#/sto
parts=#/parts
usedParts=#/parts/used
seller=#/seller
sellerProducts=#/seller/products
sellerOrders=#/seller/orders
orders=#/orders
workflow=#/workflow
requestNew=#/orders/new
workOrder=#/orders/item
vehicle=#/garage/car
chats=#/chats
notifications=#/notifications
cabinet=#/cabinet
cabinetGarage=#/cabinet/garage
cabinetData=#/cabinet/data
cabinetHistory=#/cabinet/history
cabinetDocuments=#/cabinet/documents
cabinetPromos=#/cabinet/promotions
cabinetTariff=#/cabinet/tariff
cabinetSettings=#/cabinet/settings
about=#/about
rules=#/rules
help=#/help
assistant=#/assistant
diagnostics=#/diagnostics
privacy=#/privacy
contacts=#/contacts
lawyer=#/lawyer
towTruck=#/tow-truck
productDetail=#/parts/item
serviceDetail=#/services/item
providerDetail=#/masters/profile
providerBooking=#/masters/book
providerReviews=#/masters/reviews
""".splitlines())
HISTORICAL_FILES = set("""\
js/next/route_registry.js
js/next/route_asset_loader.js
js/next/pages/core.js
js/next/pages/masters.js
js/next/pages/cabinet.js
js/next/pages/master_schedule.js
js/next/pages/master_onboarding.js
js/next/pages/work_feed.js
js/next/pages/parts.js
js/next/pages/notifications.js
js/next/pages/scanner.js
js/next/pages/diagnostics.js
js/next/onboarding/onboarding_api.js
js/mobile_native_bridge.js
api/geo.php
api/obd.php
sw.js
landing/index.html
landing/i18n.json
""".splitlines())

# Immutable 70-key landing translation floor from PR #133 HEAD b01b8981fdc4ce273dfa063a3131d6ccd2cf0483.
# Equal language dictionaries alone cannot detect deleting the same key in all locales.
HISTORICAL_LANDING_TRANSLATION_KEYS = frozenset("""\
_meta.description
_meta.title
available
comingSoon
downloadApp
downloadBrandText
downloadKicker
downloadLead
downloadTitle
eyebrow
f1Text
f1Title
f2Text
f2Title
f3Text
f3Title
f4Text
f4Title
f5Text
f5Title
f6Text
f6Title
featuresKicker
featuresLead
featuresTitle
footerText
heroA
heroB
heroLead
howKicker
howTitle
navDownload
navFeatures
navHow
navProduct
openBrowser
openWeb
openWebVersion
productKicker
productLead
productTitle
proof1
proof2
proof3
realUi
roleClientText
roleClientTitle
roleMasterText
roleMasterTitle
roleStoText
roleStoTitle
rolesKicker
rolesLead
rolesTitle
showcaseText
showcaseTitle
skip
step1Text
step1Title
step2Text
step2Title
step3Text
step3Title
step4Text
step4Title
strip1
strip2
strip3
strip4
webVersion
""".splitlines())


def translation_leaf_paths(node, prefix=""):
    if isinstance(node, dict):
        paths = set()
        for key, value in node.items():
            paths.update(translation_leaf_paths(value, f"{prefix}.{key}" if prefix else key))
        return paths
    return {prefix}



def require(condition, message):
    if not condition:
        raise ValueError(message)


def parse_routes(source):
    routes = {}
    for key, path in ROUTE_RE.findall(source):
        require(key not in routes, f"Duplicate route key: {key}")
        routes[key] = path
    return routes


def verify_historical_baseline(baseline):
    """Detect baseline substitution even when the route/file counts stay unchanged."""
    routes = baseline.get("routes")
    files = baseline.get("critical_files")
    require(len(HISTORICAL_ROUTES) == MIN_ROUTE_COUNT and len(HISTORICAL_FILES) == 19,
            "Historical feature anchor is incomplete")
    require(isinstance(routes, dict), "Baseline routes missing")
    require(isinstance(files, list) and all(isinstance(f, str) for f in files),
            "Baseline critical files missing or invalid")
    missing = sorted(set(HISTORICAL_ROUTES) - set(routes))
    changed = sorted(k for k in HISTORICAL_ROUTES.keys() & routes.keys()
                     if HISTORICAL_ROUTES[k] != routes[k])
    missing_files = sorted(HISTORICAL_FILES - set(files))
    require(not missing and not changed and not missing_files,
            "Historical feature floor weakened: missing_routes=" + repr(missing)
            + ", changed_routes=" + repr(changed)
            + ", missing_files=" + repr(missing_files))


def verify_route_contract(expected, found):
    require(isinstance(expected, dict) and len(expected) >= MIN_ROUTE_COUNT,
            f"Baseline route count below protected floor of {MIN_ROUTE_COUNT}")
    missing = sorted(set(expected) - set(found))
    changed = sorted(k for k in expected.keys() & found.keys() if expected[k] != found[k])
    untracked = sorted(set(found) - set(expected))
    require(not missing, "Removed routes: " + ", ".join(missing))
    require(not changed, "Changed route URLs: " + ", ".join(changed))
    require(not untracked, "New routes require baseline review: " + ", ".join(untracked))


def verify_files(names):
    require(isinstance(names, list) and len(names) >= 19,
            "Critical-file inventory was unexpectedly reduced")
    require(len(names) == len(set(names)), "Duplicate critical-file paths")
    for name in names:
        require(isinstance(name, str) and bool(name.strip()), "Invalid critical-file path")
        parts = PurePosixPath(name).parts
        require(not name.startswith("/") and "\\" not in name and ".." not in parts,
                "Unsafe critical-file path: " + name)
        candidate = ROOT / name
        require(candidate.resolve().is_relative_to(ROOT.resolve()),
                "Critical-file path escapes repository: " + name)
        require(candidate.is_file(), "Missing critical feature entry point: " + name)
        require(bool(candidate.read_bytes().strip()), "Empty critical feature entry point: " + name)


def self_test_file_contents():
    """Exercise real files in isolation; never mutate the repository fixtures."""
    global ROOT
    original_root = ROOT
    try:
        with tempfile.TemporaryDirectory(prefix="kareta-feature-files-") as directory:
            ROOT = Path(directory)
            names = [f"entry-{i}.js" for i in range(19)]
            for name in names:
                (ROOT / name).write_bytes(b"// preserved entry\n")
            verify_files(names)
            entry = ROOT / names[0]
            entry.write_bytes(b"")
            assert_rejects(lambda: verify_files(names), "empty critical entry point")
            entry.write_bytes(b" \t\r\n")
            assert_rejects(lambda: verify_files(names), "whitespace-only critical entry point")
    finally:
        ROOT = original_root



def verify_translation_tree(reference, candidate, path):
    """Fail closed on blank values or missing nested translation keys."""
    if isinstance(reference, dict):
        require(isinstance(candidate, dict), f"Translation section missing: {path}")
        missing = sorted(set(reference) - set(candidate))
        extra = sorted(set(candidate) - set(reference))
        require(not missing and not extra,
                f"Nested translation keys differ at {path}: missing={missing}, extra={extra}")
        for key, value in reference.items():
            verify_translation_tree(value, candidate[key], f"{path}.{key}")
        return
    require(isinstance(reference, str) and bool(reference.strip()),
            f"Empty or invalid RU translation value: {path}")
    require(isinstance(candidate, str) and bool(candidate.strip()),
            f"Empty or invalid translation value: {path}")


def verify_i18n(data, languages):
    require(languages == list(LANGUAGES), "Protected language inventory changed")
    require(all(isinstance(data.get(lang), dict) for lang in LANGUAGES),
            "RU/KK/EN language dictionary missing")
    keys = set(data["ru"])
    require(bool(keys), "Empty RU translation dictionary")
    for lang in ("kk", "en"):
        missing = sorted(keys - set(data[lang]))
        extra = sorted(set(data[lang]) - keys)
        require(not missing and not extra,
                f"{lang} translation keys differ: missing={missing}, extra={extra}")
    for lang in LANGUAGES:
        verify_translation_tree(data["ru"], data[lang], lang)
    require(len(HISTORICAL_LANDING_TRANSLATION_KEYS) == 70,
            "Historical landing translation anchor is incomplete")
    for lang in LANGUAGES:
        missing = sorted(HISTORICAL_LANDING_TRANSLATION_KEYS - translation_leaf_paths(data[lang]))
        require(not missing, f"Removed historical {lang} translation keys: {missing}")


def assert_rejects(fn, label):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError("Negative regression case unexpectedly passed: " + label)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    require(baseline.get("schema_version") == 1, "Unknown feature baseline schema")
    verify_historical_baseline(baseline)
    expected = baseline.get("routes")
    found = parse_routes(ROUTE_FILE.read_text(encoding="utf-8"))
    verify_route_contract(expected, found)
    verify_files(baseline.get("critical_files"))
    languages = baseline.get("required_languages")
    translations = json.loads(LANDING_I18N.read_text(encoding="utf-8"))
    verify_i18n(translations, languages)
    if args.self_test:
        self_test_file_contents()
        # A weakened JSON baseline previously let matching route/file removals pass.
        swapped_route = json.loads(json.dumps(baseline))
        swapped_route["routes"].pop("home")
        swapped_route["routes"]["replacement"] = "#/replacement"
        assert_rejects(lambda: verify_historical_baseline(swapped_route),
                       "historical home route substituted in baseline")
        changed_route = json.loads(json.dumps(baseline))
        changed_route["routes"]["parts"] = "#/unapproved-parts"
        assert_rejects(lambda: verify_historical_baseline(changed_route),
                       "historical parts URL changed in baseline")
        swapped_file = json.loads(json.dumps(baseline))
        swapped_file["critical_files"].remove("js/mobile_native_bridge.js")
        swapped_file["critical_files"].append("tools/test_feature_preservation.py")
        assert_rejects(lambda: verify_historical_baseline(swapped_file),
                       "historical native bridge substituted in baseline")
        extended = json.loads(json.dumps(baseline))
        extended["routes"]["futureApprovedRoute"] = "#/future-approved-route"
        extended["critical_files"].append("tools/test_feature_preservation.py")
        verify_historical_baseline(extended)
        reduced = dict(found)
        reduced.pop("home")
        assert_rejects(lambda: verify_route_contract(expected, reduced), "deleted home route")
        altered = dict(found)
        altered["parts"] = "#/unapproved-route"
        assert_rejects(lambda: verify_route_contract(expected, altered), "changed parts URL")
        broken_locale = {key: dict(value) for key, value in translations.items()}
        first_key = next(iter(broken_locale["kk"]))
        del broken_locale["kk"][first_key]
        assert_rejects(lambda: verify_i18n(broken_locale, languages), "missing KK translation")
        blank_locale = {key: dict(value) for key, value in translations.items()}
        blank_locale["kk"]["navProduct"] = " "
        assert_rejects(lambda: verify_i18n(blank_locale, languages), "blank KK translation")
        nested_locale = {key: dict(value) for key, value in translations.items()}
        nested_locale["en"]["_meta"] = dict(nested_locale["en"]["_meta"])
        del nested_locale["en"]["_meta"]["description"]
        assert_rejects(lambda: verify_i18n(nested_locale, languages), "missing nested EN metadata")
        # Removing a key in ALL locales used to bypass language parity checks.
        deleted_all = json.loads(json.dumps(translations))
        for lang in LANGUAGES:
            del deleted_all[lang]["navProduct"]
        assert_rejects(lambda: verify_i18n(deleted_all, languages),
                       "coordinated removal of historical navigation translation")
        deleted_nested_all = json.loads(json.dumps(translations))
        for lang in LANGUAGES:
            del deleted_nested_all[lang]["_meta"]["description"]
        assert_rejects(lambda: verify_i18n(deleted_nested_all, languages),
                       "coordinated removal of historical nested translation")
        added_all = json.loads(json.dumps(translations))
        for lang in LANGUAGES:
            added_all[lang]["futureApprovedTranslation"] = "New translation"
        verify_i18n(added_all, languages)
    print(f"FEATURE_PRESERVATION: PASS ({len(found)} routes, "
          f"{len(baseline['critical_files'])} files, 3 languages; "
          f"negative self-test={'PASS' if args.self_test else 'NOT RUN'})")
    print("NOTE: Static guard only; role flows, themes, booking, real devices and UI remain NOT RUN.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, json.JSONDecodeError, AssertionError) as exc:
        print("FEATURE_PRESERVATION: FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)

