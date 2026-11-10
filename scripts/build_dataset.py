#!/usr/bin/env python3
"""Normalize the open clinical-conversation datasets into one Sully-ready format.

Usage:
    python3 scripts/build_dataset.py --src /path/to/sources

`--src` must contain the original downloads:
    primock57/    git clone https://github.com/babylonhealth/primock57
    aci-bench/    git clone https://github.com/wyim/aci-bench
    MTS-Dialog/   git clone https://github.com/abachaa/MTS-Dialog
    fareez/       unzipped Data.zip from https://doi.org/10.6084/m9.figshare.c.5545842.v1

Output (written into ./dataset):
    encounters/<source>/<id>/transcript.json   speaker-labelled turns (with timings when the source has them)
    encounters/<source>/<id>/transcript.txt    "Clinician: ..." / "Patient: ..." string for POST /v3/notes
    encounters/<source>/<id>/reference-note.md clinician-written note from the source (when it has one)
    encounters/<source>/<id>/metadata.json     source, license, citation key, chief complaint, counts
    mts-dialog.jsonl                           1,701 short dialogue -> note-section pairs
    manifest.jsonl                             one line per full encounter
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
from pathlib import Path

csv.field_size_limit(10**9)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dataset"

SOURCES = {
    "primock57": {
        "name": "PriMock57",
        "license": "CC-BY-4.0",
        "url": "https://github.com/babylonhealth/primock57",
        "citation": "korfiatis2022primock57",
    },
    "aci-bench": {
        "name": "ACI-Bench",
        "license": "CC-BY-4.0",
        "url": "https://github.com/wyim/aci-bench",
        "citation": "yim2023acibench",
    },
    "fareez-osce": {
        "name": "Simulated patient-physician medical interviews (Fareez et al.)",
        "license": "CC0-1.0",
        "url": "https://doi.org/10.6084/m9.figshare.c.5545842.v1",
        "citation": "fareez2022dataset",
    },
    "mts-dialog": {
        "name": "MTS-Dialog",
        "license": "CC-BY-4.0",
        "url": "https://github.com/abachaa/MTS-Dialog",
        "citation": "benabacha2023mtsdialog",
    },
}

# Audio files committed to git (whitelisted in .gitignore); the rest come from download_audio.py / Hugging Face
STARTER_AUDIO = {l[1:].strip() for l in (ROOT / ".gitignore").read_text().splitlines() if l.startswith("!")} \
    if (ROOT / ".gitignore").exists() else set()

ROLE_LABEL = {"clinician": "Clinician", "patient": "Patient", "family": "Family member", "other": "Other"}


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def to_txt(turns: list[dict]) -> str:
    return "\n".join(f"{t['label']}: {t['text']}" for t in turns if t["text"]) + "\n"


def word_count(turns: list[dict]) -> int:
    return sum(len(t["text"].split()) for t in turns)


def merge_turns(turns: list[dict]) -> list[dict]:
    """Join back-to-back turns from the same speaker into one turn."""
    out: list[dict] = []
    for t in turns:
        if out and out[-1]["label"] == t["label"]:
            out[-1]["text"] = (out[-1]["text"] + " " + t["text"]).strip()
            if "end" in t:
                out[-1]["end"] = t["end"]
        else:
            out.append(dict(t))
    return out


def emit(source: str, enc_id: str, turns: list[dict], meta: dict, note: str | None) -> dict:
    turns = merge_turns(turns)
    d = OUT / "encounters" / source / enc_id
    d.mkdir(parents=True, exist_ok=True)
    for f in ("transcript.json", "transcript.txt", "reference-note.md", "metadata.json"):
        (d / f).unlink(missing_ok=True)
    speakers = sorted({(t["role"], t["label"]) for t in turns})
    write_json(d / "transcript.json", {
        "encounterId": enc_id,
        "speakers": [{"role": r, "label": l} for r, l in speakers],
        "turns": turns,
    })
    (d / "transcript.txt").write_text(to_txt(turns), encoding="utf-8")
    if note:
        (d / "reference-note.md").write_text(note.strip() + "\n", encoding="utf-8")
    src = SOURCES[source]
    meta = {
        "encounterId": enc_id,
        "source": src["name"],
        "sourceUrl": src["url"],
        "license": src["license"],
        "citation": src["citation"],
        **meta,
        "turns": len(turns),
        "wordCount": word_count(turns),
        "hasReferenceNote": bool(note),
        "audioInRepo": str((d / "audio.mp3").relative_to(ROOT)) in STARTER_AUDIO,
        "hasAudio": source in ("primock57", "fareez-osce"),
        "simulated": True,
    }
    write_json(d / "metadata.json", meta)
    return {**meta, "path": str(d.relative_to(ROOT))}


# ---------------------------------------------------------------- PriMock57
def parse_textgrid(path: str) -> list[tuple[float, float, str]]:
    text = Path(path).read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"xmin = ([\d.]+)\s*\n\s*xmax = ([\d.]+)\s*\n\s*text = \"(.*?)\"\s*\n", text, re.S):
        s, e, t = float(m.group(1)), float(m.group(2)), m.group(3).replace('""', '"')
        if t.strip():
            out.append((s, e, t))
    return out


def clean_primock(t: str) -> str:
    t = re.sub(r"</?UNSURE>", "", t)
    t = re.sub(r"<UNIN/>|<INAUDIBLE_SPEECH/>", "[inaudible]", t)
    t = re.sub(r"(\[inaudible\]\s*)+", "[inaudible] ", t)
    return re.sub(r"\s+", " ", t).strip()


def build_primock(src: Path) -> list[dict]:
    rows = []
    for note_path in sorted(glob.glob(str(src / "primock57/notes/day*_consultation*.json"))):
        note = json.loads(Path(note_path).read_text(encoding="utf-8"))
        base = Path(note_path).stem  # day1_consultation01
        turns = []
        for role, suffix in (("clinician", "doctor"), ("patient", "patient")):
            for s, e, t in parse_textgrid(str(src / f"primock57/transcripts/{base}_{suffix}.TextGrid")):
                t = clean_primock(t)
                if t and t != "[inaudible]":
                    turns.append({"role": role, "label": ROLE_LABEL[role], "start": round(s, 2), "end": round(e, 2), "text": t})
        turns.sort(key=lambda x: x["start"])
        enc_id = "pm57-d{}c{:02d}".format(note["day"], note["consultation"])
        rows.append(emit("primock57", enc_id, turns, {
            "originalId": base,
            "setting": "primary care (UK, remote consultation)",
            "chiefComplaint": note.get("presenting_complaint"),
            "durationSeconds": round(max(t["end"] for t in turns), 1),
            "audio": {
                "doctor": f"https://media.githubusercontent.com/media/babylonhealth/primock57/main/audio/{base}_doctor.wav",
                "patient": f"https://media.githubusercontent.com/media/babylonhealth/primock57/main/audio/{base}_patient.wav",
            },
        }, note.get("note")))
    return rows


# ---------------------------------------------------------------- ACI-Bench
def detok(t: str) -> str:
    """Light cleanup of ACI-Bench's tokenized, lower-cased dialogue."""
    t = re.sub(r"\s+([,.?!;:%)])", r"\1", t)
    t = re.sub(r"([($])\s+", r"\1", t)
    t = re.sub(r"\s+'\s*(s|re|ve|ll|d|m|t)\b", r"'\1", t)
    t = re.sub(r"\s+n't\b", "n't", t)
    t = re.sub(r"\bi\b", "I", t)
    t = re.sub(r"(^|[.?!]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), t)
    return re.sub(r"\s+", " ", t).strip()


ACI_ROLE = {"doctor": "clinician", "patient": "patient", "patient_guest": "family", "guest_family": "family",
            "guest_clinician": "clinician", "nurse": "clinician"}


def build_aci(src: Path) -> list[dict]:
    rows, seen = [], set()
    files = ["train", "valid", "clinicalnlp_taskB_test1", "clinicalnlp_taskC_test2", "clef_taskC_test3"]
    for split in files:
        data = list(csv.DictReader(open(src / f"aci-bench/data/challenge_data/{split}.csv", encoding="utf-8")))
        meta = {m["encounter_id"]: m for m in csv.DictReader(open(src / f"aci-bench/data/challenge_data/{split}_metadata.csv", encoding="utf-8"))}
        for r in data:
            eid = r["encounter_id"]
            if eid in seen:
                continue
            seen.add(eid)
            turns = []
            for line in r["dialogue"].splitlines():
                m = re.match(r"\s*\[([a-z_]+)\]\s*(.*)", line)
                if not m:
                    if turns and line.strip():
                        turns[-1]["text"] += " " + detok(line)
                    continue
                tag, text = m.group(1), detok(m.group(2))
                role = ACI_ROLE.get(tag, "other")
                label = {"doctor": "Clinician", "patient": "Patient"}.get(tag) or ROLE_LABEL.get(role, tag.replace("_", " ").title())
                turns.append({"role": role, "label": label, "text": text})
            md = meta.get(eid, {})
            names = [n for n in (md.get("patient_firstname"), md.get("patient_familyname"), "dax") if n]
            for t in turns:
                for n in names:
                    t["text"] = re.sub(rf"\b{re.escape(n.lower())}\b", n.capitalize(), t["text"])
            rows.append(emit("aci-bench", f"aci-{eid}", turns, {
                "originalId": eid,
                "split": split,
                "collectionMode": md.get("dataset"),
                "chiefComplaint": md.get("cc"),
                "secondaryComplaints": [c for c in (md.get("2nd_complaints") or "").split(";") if c],
                "patient": {"age": int(md["patient_age"]) if (md.get("patient_age") or "").isdigit() else None,
                            "gender": md.get("patient_gender") or None},
            }, r["note"]))
    return rows


# ---------------------------------------------------------------- Fareez OSCE
FAREEZ_CAT = {"RES": "Respiratory", "MSK": "Musculoskeletal", "CAR": "Cardiac", "GAS": "Gastrointestinal",
              "DER": "Dermatology", "GEN": "General"}


def build_fareez(src: Path) -> list[dict]:
    rows = []
    tx = sorted(glob.glob(str(src / "fareez/**/*.txt"), recursive=True))
    for p in tx:
        stem = Path(p).stem  # e.g. RES0001
        cat = FAREEZ_CAT.get(re.sub(r"\d+", "", stem).upper(), "Other")
        turns = []
        raw = Path(p).read_bytes()
        enc = "utf-16" if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else "utf-8-sig"
        for line in raw.decode(enc, errors="replace").splitlines():
            line = line.strip()
            m = re.match(r"^(D|P|Doctor|Patient)\s*:\s*(.*)$", line, re.I)
            if m:
                role = "clinician" if m.group(1).lower().startswith("d") else "patient"
                turns.append({"role": role, "label": ROLE_LABEL[role], "text": m.group(2).strip()})
            elif line and turns:
                turns[-1]["text"] += " " + line
        if not turns:
            continue
        audio = Path(f"{stem}.mp3")
        rows.append(emit("fareez-osce", f"osce-{stem}", turns, {
            "originalId": stem,
            "setting": "simulated OSCE interview (Canada)",
            "category": cat,
            "audioSource": "figshare Data.zip: Audio Recordings/" + audio.name,
        }, None))
    return rows


# ---------------------------------------------------------------- MTS-Dialog
MTS_SECTIONS = {
    "GENHX": "History of Present Illness", "CC": "Chief Complaint", "PASTMEDICALHX": "Past Medical History",
    "PASTSURGICAL": "Past Surgical History", "FAM/SOCHX": "Family and Social History", "MEDICATIONS": "Medications",
    "ALLERGY": "Allergies", "ROS": "Review of Systems", "EXAM": "Physical Exam", "ASSESSMENT": "Assessment",
    "PLAN": "Plan", "DIAGNOSIS": "Diagnosis", "DISPOSITION": "Disposition", "PROCEDURES": "Procedures",
    "IMAGING": "Imaging", "LABS": "Labs", "IMMUNIZATIONS": "Immunizations", "GYNHX": "Gynecologic History",
    "EDCOURSE": "ED Course", "OTHER_HISTORY": "Other History",
}


def build_mts(src: Path) -> int:
    n = 0
    with open(OUT / "mts-dialog.jsonl", "w", encoding="utf-8") as fh:
        for f in sorted(glob.glob(str(src / "MTS-Dialog/Main-Dataset/*.csv"))):
            split = Path(f).stem.replace("MTS-Dialog-", "")
            for r in csv.DictReader(open(f, encoding="utf-8-sig")):
                lines = [l.strip() for l in r["dialogue"].splitlines() if l.strip()]
                txt = "\n".join(re.sub(r"^Doctor:", "Clinician:", l) for l in lines)
                header = r["section_header"].strip().upper()
                fh.write(json.dumps({
                    "id": f"mts-{split}-{r['ID']}",
                    "split": split,
                    "sectionHeader": header,
                    "sectionTitle": MTS_SECTIONS.get(header, header.title()),
                    "transcript": txt,
                    "referenceSectionText": r["section_text"].strip(),
                    "license": "CC-BY-4.0",
                    "citation": "benabacha2023mtsdialog",
                }, ensure_ascii=False) + "\n")
                n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, type=Path)
    ap.add_argument("--only", nargs="*", default=["primock57", "aci-bench", "fareez-osce", "mts-dialog"])
    a = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    rows: list[dict] = []
    if "primock57" in a.only:
        rows += build_primock(a.src)
    if "aci-bench" in a.only:
        rows += build_aci(a.src)
    if "fareez-osce" in a.only and (a.src / "fareez").exists():
        rows += build_fareez(a.src)
    mts = build_mts(a.src) if "mts-dialog" in a.only else 0
    with open(OUT / "manifest.jsonl", "w", encoding="utf-8") as fh:
        for r in sorted(rows, key=lambda r: r["encounterId"]):
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    by = {}
    for r in rows:
        by.setdefault(r["source"], []).append(r["wordCount"])
    for k, v in by.items():
        print(f"{k}: {len(v)} encounters, median {sorted(v)[len(v)//2]} words")
    print(f"MTS-Dialog: {mts} snippets")


if __name__ == "__main__":
    main()
