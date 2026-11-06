#!/usr/bin/env python3
"""Build PRIVATE KARETA STO directory import preview from already-researched public business candidates.

Never writes MySQL, creates users, verifies a source, or publishes a profile.
Requires manual current-source/duplicate review before directory_visible can be set.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

STATE_ROOT = Path.home() / ".local/state/kareta/master_claims"


def clean(value: object, maximum: int) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value or ""))).strip()[:maximum]


def norm(value: object) -> str:
    return clean(value, 255).casefold().replace("ё", "е")


def record(name: str, address: str, sources: list[str]) -> dict | None:
    name, address = clean(name, 191), clean(address, 255)
    city = "Усть-Каменогорск"
    src = next((url for url in sources
                if isinstance(url, str) and urlparse(url).scheme == "https"
                and urlparse(url).netloc and len(url) <= 512), "")
    if not name or not address or not src:
        return None
    fingerprint = hashlib.sha256(f"{norm(name)}|{norm(city)}|{norm(address)}".encode()).hexdigest()
    review = ["source_currentness_not_checked", "mysql_duplicates_not_checked"]
    if re.search(r"\bИП\s+[А-ЯЁ]", name):  # Personal names can occur in legal sole-proprietor titles.
        review.append("sole_proprietor_personal_data_review")
    return {
        "id": "sto_discovered_" + fingerprint[:20], "fingerprint": fingerprint,
        "name": name, "city": city, "address": address,
        "source_url": src, "source_checked_at": None, "description": "",
        "status": "unclaimed", "directory_visible": 0,
        "owner_account_id": None, "requires_manual_review": review,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(STATE_ROOT / "sto_claim_import_preview_20261104.json"))
    args = parser.parse_args()
    first = json.loads((STATE_ROOT / "proposals_20261102.json").read_text())
    second = json.loads((STATE_ROOT / "new_businesses_20261104.json").read_text())
    unique: dict[str, dict] = {}
    no_source = 0
    for item in first.get("profiles", []):
        row = record(item.get("display_name_draft"), item.get("address_business"),
                     item.get("source_urls") or [])
        if row:
            unique.setdefault(row["fingerprint"], row)
        else:
            no_source += 1
    for item in second.get("records", []):
        row = record(item.get("name"), item.get("address"), [item.get("source")])
        if row:
            unique.setdefault(row["fingerprint"], row)
        else:
            no_source += 1
    output = Path(args.output).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "kareta.sto.claim.candidate.preview.v1",
        "publication_status": "PRIVATE_REVIEW_ONLY",
        "input_candidates": len(first.get("profiles", [])) + len(second.get("records", [])),
        "deduplicated_candidates": len(unique),
        "skipped_missing_basic_source": no_source,
        "mysql_duplicates_checked": False,
        "current_source_verified": False,
        "imported_into_mysql": False,
        "publicly_visible": False,
        "candidates": list(unique.values()),
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    output.chmod(0o600)
    print(json.dumps({k: v for k, v in payload.items() if k != "candidates"},
                     ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
