#!/usr/bin/env python3
"""Check note templates against the Sully Note Generation v3 template contract.

    python3 scripts/validate_templates.py                # every file under templates/
    python3 scripts/validate_templates.py my-template.json

Checks structure and limits only (https://docs.sully.ai/note-generation-v3.md#request-fields).
It cannot tell you whether a template produces clinically good notes; test that on real encounters.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check(path: Path) -> list[str]:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"invalid JSON: {e}"]
    errs = []
    if not isinstance(d, dict):
        return ["top level must be an object"]
    extra = set(d) - {"instructions", "sections"}
    if extra:
        errs.append(f"unknown keys {sorted(extra)} (the API rejects unknown fields)")
    if not isinstance(d.get("instructions", ""), str) or len(d.get("instructions", "")) > 10_000:
        errs.append("instructions must be a string of at most 10,000 characters")
    secs = d.get("sections")
    if not isinstance(secs, list) or not 1 <= len(secs) <= 50:
        return errs + ["sections must be an array of 1 to 50 items"]
    seen = set()
    for i, s in enumerate(secs):
        if not isinstance(s, dict) or set(s) != {"title", "instructions"}:
            errs.append(f"section {i}: needs exactly 'title' and 'instructions'")
            continue
        t = s["title"].strip() if isinstance(s["title"], str) else ""
        if not 1 <= len(t) <= 200:
            errs.append(f"section {i}: title must be 1 to 200 characters")
        if t in seen:
            errs.append(f"section {i}: duplicate title '{t}'")
        seen.add(t)
        if not isinstance(s["instructions"], str) or len(s["instructions"]) > 10_000:
            errs.append(f"section '{t}': instructions must be a string of at most 10,000 characters")
    total = len(d.get("instructions", "")) + sum(len(s.get("title", "")) + len(s.get("instructions", "")) for s in secs if isinstance(s, dict))
    if total > 100_000:
        errs.append(f"{total} characters; template plus clinical context may not exceed 100,000")
    return errs


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]] or sorted((ROOT / "templates").rglob("*.json"))
    bad = 0
    for f in files:
        errs = check(f)
        bad += bool(errs)
        print(("FAIL " if errs else "ok   ") + str(f.relative_to(ROOT) if f.is_absolute() else f))
        for e in errs:
            print("     -", e)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
