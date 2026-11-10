# Open clinical conversation dataset

536 full doctor-patient encounters and 1,701 short dialogue snippets, gathered from four openly licensed research datasets and converted into one format you can send straight to the [Sully API](https://docs.sully.ai/).

None of this is real patient data. Every encounter was role-played: clinicians talking with actors, trained patients or staff using case cards, then recorded and transcribed by hand. That is why it can be shared openly, and it still sounds like a real visit: filler words, interruptions, people correcting themselves, lay terms.

| Source | Encounters | Median length | Clinician note | Audio | License |
|---|---:|---:|:---:|:---:|---|
| [ACI-Bench](https://github.com/wyim/aci-bench) (Microsoft/Nuance, Univ. of Washington) | 207 | 1,082 words | Yes, full note | No | CC BY 4.0 |
| [PriMock57](https://github.com/babylonhealth/primock57) (Babylon Health) | 57 | 1,538 words | Yes | Yes | CC BY 4.0 |
| [Fareez et al. OSCE interviews](https://doi.org/10.6084/m9.figshare.c.5545842.v1) (Scientific Data, 2022) | 272 | 1,282 words | No | Yes | CC0 |
| [MTS-Dialog](https://github.com/abachaa/MTS-Dialog) (Microsoft) | 1,701 snippets | short | Yes, one section each | No | CC BY 4.0 |

About 680,000 words of transcript in total. 20 encounters ship with audio in this repo. To get all 329 recordings, either:

- load the full set from Hugging Face: [`SullyHQ/open-clinical-conversations`](https://huggingface.co/datasets/SullyHQ/open-clinical-conversations) (transcripts, notes and audio, with a browser player), or
- run `python3 scripts/download_audio.py`, which downloads from the original sources and saves `audio.mp3` into each encounter folder (about 2.6 GB download; needs ffmpeg).

## What each source is good for

- **ACI-Bench**: transcript-to-note testing. Full US outpatient visits with a complete clinician-written note (Chief Complaint, HPI, ROS, Exam, Results, Assessment and Plan). Three collection styles: `aci` (natural visit), `virtassist` (clinician talks to an assistant called "Dax" during the visit) and `virtscribe` (clinician dictates a summary after the conversation).
- **PriMock57**: end-to-end testing, audio to transcript to note. Remote primary-care consultations with separate doctor and patient audio channels, word timings, and the note the clinician wrote. UK practice, so expect "paracetamol", "GP" and UK spelling.
- **Fareez OSCE**: transcription testing at volume. 272 recorded history-taking interviews in Canadian English, mostly respiratory (213) and musculoskeletal (46), plus cardiac, GI, dermatology and general cases.
- **MTS-Dialog**: section-level tests. Each item is a short exchange paired with the single note section it should produce (HPI, Family and Social History, Medications, Allergies, ROS and more).

## Layout

```
dataset/
  manifest.jsonl                 one line per full encounter (source, license, chief complaint, word count, path)
  mts-dialog.jsonl               1,701 snippet -> note-section pairs
  CITATIONS.bib                  cite these if you publish results
  encounters/
    aci-bench/aci-D2N001/
    primock57/pm57-d1c01/
    fareez-osce/osce-RES0001/
      transcript.txt             "Clinician: ..." / "Patient: ..." lines, ready for POST /v3/notes
      transcript.json            speaker-labelled turns (PriMock57 turns include start/end seconds)
      reference-note.md          the clinician's note from the source dataset (ACI-Bench, PriMock57)
      metadata.json              source, license, citation key, chief complaint, patient age/gender when given
      audio.mp3                  16 kHz mono (starter set in the repo; run the download script for the rest)
```

Speaker labels are `Clinician`, `Patient` and `Family member`.

## Try it with Sully

Generate a note from an ACI-Bench visit and compare it with the clinician's note:

```bash
jq -n --rawfile t dataset/encounters/aci-bench/aci-D2N001/transcript.txt \
      --slurpfile tpl templates/outpatient-soap.json \
      '{transcript: $t, template: $tpl[0]}' |
curl -s "https://api.sully.ai/v3/notes" \
  -H "X-Account-Id: $SULLY_ACCOUNT_ID" \
  -H "X-Api-Key: $SULLY_API_KEY" \
  -H "Content-Type: application/json" \
  --data @- | jq -r .note

cat dataset/encounters/aci-bench/aci-D2N001/reference-note.md
```

Transcribe a PriMock57 recording, then compare it with the human transcript:

```bash
curl -s "https://api.sully.ai/v2/audio/transcriptions" \
  -H "X-Account-Id: $SULLY_ACCOUNT_ID" \
  -H "X-Api-Key: $SULLY_API_KEY" \
  -F "audio=@dataset/encounters/primock57/pm57-d1c01/audio.mp3" \
  -F "language=en"
```

## Encounters with audio in the repo

| Encounter | Topic |
|---|---|
| pm57-d1c01 | Diarrhea for 3 days |
| pm57-d1c02 | Sore, red skin |
| pm57-d1c03 | Severe headache |
| pm57-d1c09 | Pain when urinating |
| pm57-d2c03 | Hearing loss and facial numbness |
| pm57-d2c05 | Asthma not responding to inhalers |
| pm57-d2c07 | Chest discomfort |
| pm57-d3c01 | Lip swelling after eating |
| pm57-d4c08 | Low appetite and energy |
| pm57-d5c03 | Anxiety |
| osce-CAR0001, osce-CAR0003 | Chest pain |
| osce-DER0001 | Dermatology |
| osce-GAS0001, osce-GAS0004 | Gastrointestinal |
| osce-MSK0001, osce-MSK0010 | Musculoskeletal |
| osce-RES0001, osce-RES0050 | Respiratory |
| osce-GEN0001 | General |

## Changes made to the source data

We converted every source into the layout above. Text changes:

- **All sources**: speaker tags renamed to `Clinician` / `Patient` / `Family member`; back-to-back turns from the same speaker merged.
- **PriMock57**: doctor and patient TextGrid tiers merged by time; `<UNSURE>` tags removed (their text kept); `<UNIN/>` and `<INAUDIBLE_SPEECH/>` replaced with `[inaudible]`; audio channels mixed to one 16 kHz mono MP3.
- **ACI-Bench**: tokenized, lower-case text lightly cleaned up (spacing before punctuation, sentence capitals, "I", patient names and "Dax" capitalized). Other proper nouns may still be lower case.
- **Fareez OSCE**: `D:` / `P:` prefixes converted; two UTF-16 files re-encoded; audio re-encoded to 16 kHz mono.
- **MTS-Dialog**: `Doctor:` renamed to `Clinician:`; section codes mapped to readable titles (`GENHX` to History of Present Illness, etc.).

Rebuild from the original downloads at any time with `python3 scripts/build_dataset.py --src <folder>` (see the script header for the download commands).

## License and attribution

Each encounter keeps its source's license, recorded in its `metadata.json`. See [ATTRIBUTION.md](ATTRIBUTION.md). If you use this data in a paper, cite the original authors with [CITATIONS.bib](CITATIONS.bib).

These are simulated conversations for building and testing software. They are not medical advice and are not a substitute for validation on your own clinical data.
