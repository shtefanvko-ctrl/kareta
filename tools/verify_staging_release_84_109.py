from __future__ import annotations
import re
import sys
import urllib.request

URL = "https://s.kareta.kz/"
RELEASE = "188.5.5.6.84.109"

req = urllib.request.Request(URL, headers={"User-Agent": "KARETA-release-verifier/84.109"})
try:
    with urllib.request.urlopen(req, timeout=30) as response:
        body = response.read().decode("utf-8", "replace")
        status = getattr(response, "status", 200)
except Exception as exc:
    print("KARETA_STAGING_84_109: NOT_OK")
    print(f"ERROR: fetch failed: {exc}")
    sys.exit(2)

title_match = re.search(r"<title[^>]*>(.*?)</title>", body, flags=re.I | re.S)
title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
is_kareta = bool(re.search(r"KARETA(?:\.KZ)?", body, flags=re.I))
has_release = RELEASE in body

print(f"http={status}")
print(f"title={title}")
print(f"application={'KARETA.KZ' if is_kareta else 'OTHER'}")
print(f"release_token={'YES' if has_release else 'NO'}")
if status == 200 and is_kareta and has_release:
    print("KARETA_STAGING_84_109: OK")
    sys.exit(0)
print("KARETA_STAGING_84_109: NOT_OK")
sys.exit(1)
