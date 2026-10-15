#!/usr/bin/env python3
"""Fail closed on stale governance references; repository-only, no runtime checks."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES = ("scaling", "domain-boundaries", "performance", "observability")


def check(root=ROOT):
    def load(path):
        target = root / path
        if not target.is_file():
            raise ValueError("required path missing: " + path)
        result = target.read_text(encoding="utf-8")
        if not result.strip():
            raise ValueError("required path empty: " + path)
        return result

    router = load("ai/CONTEXT_ROUTER.md")
    for rule in RULES:
        key = "ai/rules/" + rule + ".md"
        load(key)
        if "`" + key + "`" not in router:
            raise ValueError("rule not connected to context router: " + key)
    register = load("docs/product/FEATURE_REGISTRY.md")
    load("docs/architecture/ARCHITECTURE_DECISIONS.md")
    if "NOT FUNCTIONAL ACCEPTANCE" not in register:
        raise ValueError("registry may not represent a runtime acceptance proof")
    index = json.loads(load("ai/FEATURE_OWNER_INDEX.json"))
    if index.get("schema_version") != 1:
        raise ValueError("unsupported index schema")
    if index.get("routes_reference") != "ai/FEATURE_PRESERVATION_BASELINE.json":
        raise ValueError("route keys must reference canonical feature baseline")
    if index.get("surface_reference") != "ai/SURFACE_MAP.json":
        raise ValueError("owner surfaces must reference the canonical surface map")
    routes = json.loads(load(index["routes_reference"]))["routes"]
    owners = json.loads(load(index["surface_reference"]))["surfaces"]
    roles = set(index.get("roles", []))
    if roles != {"client", "master", "sto", "seller", "admin"}:
        raise ValueError("missing role-view categories")
    ids, count = set(), 0
    areas = index.get("areas", [])
    if len(areas) < 8:
        raise ValueError("too few covered areas")
    for item in areas:
        name = item.get("id")
        if not isinstance(name, str) or not name or name in ids:
            raise ValueError("empty/duplicate area id")
        ids.add(name)
        if item.get("owner") not in owners:
            raise ValueError("unknown owner surface for " + name)
        role_views = item.get("role_views")
        if not isinstance(role_views, list) or not role_views or len(role_views) != len(set(role_views)) or not set(role_views) <= roles:
            raise ValueError("invalid roles for " + name)
        keys = item.get("routes")
        if not isinstance(keys, list) or not keys or len(keys) != len(set(keys)):
            raise ValueError("missing/duplicate route keys for " + name)
        for key in keys:
            if key not in routes:
                raise ValueError("unknown canonical route key: " + str(key))
            count += 1
    for critical in ("garage", "work_orders", "parts", "diagnostics", "admin"):
        if critical not in ids:
            raise ValueError("missing critical area " + critical)
    print(f"SCALING_GOVERNANCE: PASS ({len(RULES)} rules, {len(ids)} areas, {count} area-route references)")


if __name__ == "__main__":
    check()
