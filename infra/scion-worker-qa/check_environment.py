#!/usr/bin/env python3
"""Fail-closed GHCR QA environment gate.

Read-only GitHub public REST API. Requires a protected environment before any
GHCR login or image push. No auth token, no secrets, no deployment or writes.
"""
from __future__ import annotations

import json
import sys
import urllib.request

REPOSITORY = "shtefanvko-ctrl/kareta"
ENVIRONMENT = "scion-qa-ghcr-approval"
BASE = f"https://api.github.com/repos/{REPOSITORY}/environments/{ENVIRONMENT}"

class EnvironmentNotReady(Exception):
    pass


def validate(environment: dict, branch_rules: dict) -> None:
    if not isinstance(environment, dict) or environment.get("name") != ENVIRONMENT:
        raise EnvironmentNotReady("wrong_or_missing_environment")
    if environment.get("can_admins_bypass") is not False:
        raise EnvironmentNotReady("administrator_bypass_not_disabled")
    if environment.get("deployment_branch_policy") != {
        "protected_branches": False,
        "custom_branch_policies": True,
    }:
        raise EnvironmentNotReady("branch_policy_not_exact")
    if not isinstance(branch_rules, dict) or branch_rules.get("total_count") != 1:
        raise EnvironmentNotReady("branch_policy_count_not_one")
    policies = branch_rules.get("branch_policies")
    if not isinstance(policies, list) or len(policies) != 1 or policies[0].get("name") != "main":
        raise EnvironmentNotReady("main_only_branch_required")

    protection_rules = environment.get("protection_rules")
    if not isinstance(protection_rules, list):
        raise EnvironmentNotReady("missing_protection_rules")
    required = [x for x in protection_rules
                if isinstance(x, dict) and x.get("type") == "required_reviewers"]
    if len(required) != 1 or required[0].get("prevent_self_review") is not True:
        raise EnvironmentNotReady("required_independent_review_missing")
    reviewers = required[0].get("reviewers")
    if not isinstance(reviewers, list):
        raise EnvironmentNotReady("no_reviewers")
    if not any(isinstance(x, dict) and x.get("type") == "User"
               and isinstance(x.get("reviewer"), dict)
               and isinstance(x["reviewer"].get("login"), str)
               and x["reviewer"]["login"].lower() != "shtefanvko-ctrl"
               and x["reviewer"]["login"].strip() and
               type(x["reviewer"].get("id")) is int and x["reviewer"]["id"] > 0
               for x in reviewers):
        raise EnvironmentNotReady("no_independent_reviewer")


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.github+json",
                 "User-Agent": "carat-scion-qa-ghcr-readiness/1.0",
                 "X-GitHub-Api-Version": "2022-11-28"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        if response.status != 200 or response.headers.get("Content-Type", "").split(";")[0] not in ("application/json", "application/vnd.github+json"):
            raise EnvironmentNotReady("github_api_invalid_response")
        body = response.read(131073)
        if len(body) > 131072:
            raise EnvironmentNotReady("github_api_response_too_large")
        result = json.loads(body)
        if not isinstance(result, dict):
            raise EnvironmentNotReady("github_api_invalid_json")
        return result


def main() -> int:
    try:
        validate(fetch_json(BASE), fetch_json(BASE + "/deployment-branch-policies?per_page=100"))
        print("PASS: Independent GitHub QA environment protection and main-only branch verified.")
        print("This check does NOT approve Scion Worker release or GHCR publication.")
        return 0
    except (EnvironmentNotReady, ValueError, KeyError, TypeError, OSError) as exc:
        # Never echo arbitrary API response or account credentials.
        reason = str(exc) if isinstance(exc, EnvironmentNotReady) else type(exc).__name__
        print(f"DENY: GHCR QA environment is not independently protected ({reason}).", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
