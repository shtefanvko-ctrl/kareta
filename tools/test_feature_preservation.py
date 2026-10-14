#!/usr/bin/env python3
"""Repository-only feature-preservation gate: no network, DB, or runtime probes."""
import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "ai" / "FEATURE_PRESERVATION_BASELINE.json"
ROUTE_FILE = ROOT / "js" / "next" / "route_registry.js"
LANDING_I18N = ROOT / "landing" / "i18n.json"
ROUTE_RE = re.compile(r"(?m)^\s*([A-Za-z]\w*):Object\.freeze\(\{\s*path:'([^']+)'")
LANGUAGES = ("ru", "kk", "en")
MIN_ROUTE_COUNT = 72


def require(condition, message):
    if not condition:
        raise ValueError(message)


def parse_routes(source):
    routes = {}
    for key, path in ROUTE_RE.findall(source):
        require(key not in routes, f"Duplicate route key: {key}")
        routes[key] = path
    return routes


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
    expected = baseline.get("routes")
    found = parse_routes(ROUTE_FILE.read_text(encoding="utf-8"))
    verify_route_contract(expected, found)
    verify_files(baseline.get("critical_files"))
    languages = baseline.get("required_languages")
    translations = json.loads(LANDING_I18N.read_text(encoding="utf-8"))
    verify_i18n(translations, languages)
    if args.self_test:
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
