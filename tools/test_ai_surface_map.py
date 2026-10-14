#!/usr/bin/env python3
"""Fail closed if KARETA AI surface ownership points at removed or moved paths."""

import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ai" / "SURFACE_MAP.json"


def validate():
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    surfaces = data.get("surfaces")
    if not isinstance(surfaces, dict) or not surfaces:
        raise ValueError("SURFACE_MAP.json must have nonempty surfaces")

    checked = 0
    for surface, definition in surfaces.items():
        if not isinstance(definition, dict):
            raise ValueError(f"{surface}: surface definition must be an object")
        for field in ("entry_points", "rules"):
            paths = definition.get(field)
            if not isinstance(paths, list) or not paths:
                raise ValueError(f"{surface}.{field}: expected nonempty path list")
            for item in paths:
                if not isinstance(item, str) or not item.strip():
                    raise ValueError(f"{surface}.{field}: invalid path {item!r}")
                posix_path = PurePosixPath(item)
                if (item.startswith("/") or "\\" in item or
                        ".." in posix_path.parts or "." in posix_path.parts):
                    raise ValueError(f"{surface}.{field}: unsafe path {item!r}")
                candidate = ROOT / item.rstrip("/")
                if not candidate.resolve().is_relative_to(ROOT):
                    raise ValueError(f"{surface}.{field}: path escapes repository: {item}")
                expected_directory = item.endswith("/")
                exists = candidate.is_dir() if expected_directory else candidate.is_file()
                if not exists:
                    kind = "directory" if expected_directory else "file"
                    raise FileNotFoundError(
                        f"{surface}.{field}: missing {kind}: {item}"
                    )
                checked += 1
    print(f"AI_SURFACE_MAP: PASS ({len(surfaces)} surfaces, {checked} paths)")


if __name__ == "__main__":
    validate()
