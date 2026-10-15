#!/usr/bin/env python3
"""Offline regression for the generated mobile Back shell section."""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "js/next/mobile_back.js"
BUNDLE = ROOT / "js/boot/runtime_shell_bundle.js"
START = "\n/* SOURCE: js/next/mobile_back.js */\n"
END = "\n;\n\n/* SOURCE: js/next/mobile_filters.js */\n"


def verify(source, bundle):
    if bundle.count(START) != 1 or bundle.count(END) != 1:
        raise ValueError("Missing or duplicated mobile Back source boundary")
    embedded = bundle.split(START, 1)[1].split(END, 1)[0]
    if embedded != source.rstrip():
        raise ValueError("Generated shell has stale mobile Back code")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    source = SOURCE.read_text(encoding="utf-8")
    bundle = BUNDLE.read_text(encoding="utf-8")
    verify(source, bundle)
    if args.self_test:
        try:
            verify(source + "\n/* synthetic regression */", bundle)
        except ValueError:
            pass
        else:
            raise AssertionError("Stale mobile Back negative case passed")
    print("MOBILE_BACK_BUNDLE_SYNC: PASS (negative self-test=" +
          ("PASS" if args.self_test else "NOT RUN") + ")")


if __name__ == "__main__":
    main()
