#!/usr/bin/env python3
"""Offline regression: feature preservation must check the PR HEAD, not a merge ref."""
import argparse
import re
import sys
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/feature-preservation.yml"
EXPECTED_REF = "ref: ${{ github.event.pull_request.head.sha || github.sha }}"


def verify_checkout(source):
    lines = source.splitlines()
    blocks = []
    for i, line in enumerate(lines):
        if not re.fullmatch(r"\s*- uses: actions/checkout@v4\s*", line):
            continue
        indent = len(line) - len(line.lstrip())
        block = []
        for next_line in lines[i + 1:]:
            next_indent = len(next_line) - len(next_line.lstrip())
            if next_line.strip() and next_indent <= indent:
                break
            block.append(next_line.strip())
        blocks.append(block)
    if len(blocks) != 1:
        raise ValueError("Expected exactly one actions/checkout@v4 step")
    if EXPECTED_REF not in blocks[0]:
        raise ValueError("Feature preservation checkout is not pinned to PR HEAD")


def rejects(source):
    try:
        verify_checkout(source)
    except ValueError:
        return
    raise AssertionError("Unsafe checkout passed the negative regression")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    source = WORKFLOW.read_text(encoding="utf-8")
    verify_checkout(source)
    if args.self_test:
        rejects(source.replace(EXPECTED_REF, "ref: ${{ github.sha }}"))
        rejects(source.replace(EXPECTED_REF, ""))
        rejects(source.replace("      - uses: actions/checkout@v4\n",
                               "      - uses: actions/checkout@v4\n      - uses: actions/checkout@v4\n"))
    print("FEATURE_CHECKOUT_CONTRACT: PASS (PR HEAD pinned; negative tests="
          + ("3/3" if args.self_test else "NOT RUN") + ")")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, AssertionError) as exc:
        print("FEATURE_CHECKOUT_CONTRACT: FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)
