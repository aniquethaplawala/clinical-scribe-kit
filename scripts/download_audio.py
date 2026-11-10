#!/usr/bin/env python3
"""Download the full audio for PriMock57 and the Fareez OSCE set.

The repo ships audio for 20 starter encounters. This script fetches the rest
(about 2.6 GB of downloads) and writes `audio.mp3` (16 kHz mono) into each
encounter folder. Requires ffmpeg.

    python3 scripts/download_audio.py --source primock57      # ~1.6 GB of WAV, mixed to MP3
    python3 scripts/download_audio.py --source fareez-osce    # ~1 GB zip from figshare
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENC = ROOT / "dataset" / "encounters"
FAREEZ_ARTICLE = "https://api.figshare.com/v2/articles/16550013"


def fetch(url: str, dest: Path) -> None:
    # curl avoids the missing-certificate problem of python.org builds on macOS
    if shutil.which("curl"):
        subprocess.run(["curl", "-sSfL", "-o", str(dest), url], check=True)
        return
    with urllib.request.urlopen(url) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def fetch_json(url: str):
    if shutil.which("curl"):
        return json.loads(subprocess.run(["curl", "-sSfL", url], check=True, capture_output=True, text=True).stdout)
    return json.load(urllib.request.urlopen(url))


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def primock(tmp: Path) -> None:
    for meta_path in sorted((ENC / "primock57").glob("*/metadata.json")):
        out = meta_path.parent / "audio.mp3"
        if out.exists():
            continue
        meta = json.loads(meta_path.read_text())
        doc, pat = tmp / "doctor.wav", tmp / "patient.wav"
        fetch(meta["audio"]["doctor"], doc)
        fetch(meta["audio"]["patient"], pat)
        ffmpeg("-i", str(doc), "-i", str(pat), "-filter_complex",
               "amix=inputs=2:duration=longest:normalize=0", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(out))
        print("wrote", out.relative_to(ROOT))


def fareez(tmp: Path) -> None:
    files = fetch_json(FAREEZ_ARTICLE)["files"]
    zpath = tmp / "Data.zip"
    print("downloading", files[0]["name"], f"({files[0]['size'] / 1e9:.1f} GB)")
    fetch(files[0]["download_url"], zpath)
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            if not name.lower().endswith(".mp3"):
                continue
            stem = Path(name).stem
            folder = ENC / "fareez-osce" / f"osce-{stem}"
            out = folder / "audio.mp3"
            if not folder.exists() or out.exists():
                continue
            raw = tmp / "in.mp3"
            raw.write_bytes(z.read(name))
            ffmpeg("-i", str(raw), "-ac", "1", "-ar", "16000", "-b:a", "48k", str(out))
            print("wrote", out.relative_to(ROOT))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["primock57", "fareez-osce", "all"], default="all")
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as t:
        if a.source in ("primock57", "all"):
            primock(Path(t))
        if a.source in ("fareez-osce", "all"):
            fareez(Path(t))


if __name__ == "__main__":
    main()
