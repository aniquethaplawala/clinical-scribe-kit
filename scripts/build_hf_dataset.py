#!/usr/bin/env python3
"""Package dataset/ for the Hugging Face Hub.

    python3 scripts/build_hf_dataset.py --out /tmp/hf-clinical-conversations

Produces three configs the Hub viewer understands:
    encounters   encounters.jsonl      536 full encounters (transcript, clinician note, metadata)
    audio        audio/*.mp3 + audio/metadata.jsonl   recordings with their transcripts (audiofolder)
    mts_dialog   mts-dialog.jsonl      1,701 snippet -> note-section pairs
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DS = ROOT / "dataset"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    a = ap.parse_args()
    out: Path = a.out
    (out / "audio").mkdir(parents=True, exist_ok=True)

    enc_rows, audio_rows = [], []
    for line in (DS / "manifest.jsonl").read_text().splitlines():
        m = json.loads(line)
        d = ROOT / m["path"]
        note = d / "reference-note.md"
        row = {
            "encounter_id": m["encounterId"],
            "source": m["source"],
            "license": m["license"],
            "chief_complaint": m.get("chiefComplaint") or m.get("category"),
            "transcript": (d / "transcript.txt").read_text(encoding="utf-8"),
            "reference_note": note.read_text(encoding="utf-8") if note.exists() else None,
            "turns": json.loads((d / "transcript.json").read_text(encoding="utf-8"))["turns"],
            "word_count": m["wordCount"],
            "has_audio": m.get("hasAudio", False),
            "metadata": json.dumps({k: v for k, v in m.items() if k not in ("path",)}, ensure_ascii=False),
        }
        enc_rows.append(row)
        if (d / "audio.mp3").exists():
            fn = f"{m['encounterId']}.mp3"
            shutil.copyfile(d / "audio.mp3", out / "audio" / fn)
            audio_rows.append({"file_name": fn, "encounter_id": m["encounterId"], "source": m["source"],
                               "license": m["license"], "transcript": row["transcript"]})

    with open(out / "encounters.jsonl", "w", encoding="utf-8") as fh:
        for r in enc_rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(out / "audio" / "metadata.jsonl", "w", encoding="utf-8") as fh:
        for r in audio_rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    shutil.copyfile(DS / "mts-dialog.jsonl", out / "mts-dialog.jsonl")
    for f in ("ATTRIBUTION.md", "CITATIONS.bib"):
        shutil.copyfile(DS / f, out / f)
    print(f"{len(enc_rows)} encounters, {len(audio_rows)} audio files -> {out}")


if __name__ == "__main__":
    main()
