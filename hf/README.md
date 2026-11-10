---
license: cc-by-4.0
language:
  - en
pretty_name: Open Clinical Conversations
size_categories:
  - 1K<n<10K
task_categories:
  - automatic-speech-recognition
  - summarization
  - text-generation
tags:
  - medical
  - clinical
  - healthcare
  - ambient-scribe
  - clinical-notes
  - doctor-patient-conversation
  - speech
configs:
  - config_name: encounters
    data_files: encounters.jsonl
    default: true
  - config_name: audio
    data_dir: audio
  - config_name: mts_dialog
    data_files: mts-dialog.jsonl
---

# Open Clinical Conversations

536 full doctor-patient encounters (329 with audio) and 1,701 short dialogue snippets for building and testing medical transcription and clinical note generation. Collected from four openly licensed research datasets and converted to one format.

Nothing here is real patient data. Every visit was role-played: clinicians with actors, trained patients or staff using case cards, recorded and transcribed by hand. It still sounds like a real visit, with filler words, interruptions, lay terms and people correcting themselves.

Maintained by [Sully.ai](https://sully.ai) as part of the open [Clinical Scribe Kit](https://github.com/aniquethaplawala/clinical-scribe-kit), which also includes 19 note templates and EHR write-back schemas for the top 10 US EHRs.

## Configs

| Config | Rows | What's in it |
|---|---:|---|
| `encounters` | 536 | Full transcript, speaker turns, the clinician's note (when the source has one), chief complaint, license |
| `audio` | 329 | 16 kHz mono MP3 for each recorded visit, with its transcript |
| `mts_dialog` | 1,701 | Short exchanges paired with the single note section they should produce |

```python
from datasets import load_dataset

enc = load_dataset("SullyHQ/open-clinical-conversations", "encounters", split="train")
audio = load_dataset("SullyHQ/open-clinical-conversations", "audio", split="train")
print(enc[0]["transcript"][:500])
```

## Sources

| Source | Encounters | Audio | Clinician note | License |
|---|---:|:---:|:---:|---|
| [ACI-Bench](https://github.com/wyim/aci-bench) | 207 | No | Full note | CC BY 4.0 |
| [PriMock57](https://github.com/babylonhealth/primock57) | 57 | Yes | Yes | CC BY 4.0 |
| [Fareez et al. OSCE interviews](https://doi.org/10.6084/m9.figshare.c.5545842.v1) | 272 | Yes | No | CC0 |
| [MTS-Dialog](https://github.com/abachaa/MTS-Dialog) | 1,701 snippets | No | One section each | CC BY 4.0 |

- **ACI-Bench**: US outpatient visits with full clinician-written notes. Best for transcript-to-note evaluation.
- **PriMock57**: UK remote primary-care consultations with audio, human transcripts and clinician notes. Best for end-to-end tests (audio to transcript to note).
- **Fareez OSCE**: Canadian history-taking interviews, mostly respiratory and musculoskeletal. Best for transcription accuracy at volume.
- **MTS-Dialog**: section-level note generation (HPI, history, medications, allergies, ROS and more).

## Changes from the originals

Speaker tags were normalized to `Clinician` / `Patient` / `Family member`, and back-to-back turns from the same speaker were merged. PriMock57 doctor and patient channels were merged by time and mixed to one audio track; uncertainty tags were removed and inaudible spans marked `[inaudible]`. ACI-Bench's tokenized lower-case text was lightly cleaned up. All audio was re-encoded to 16 kHz mono MP3. The full list of changes is in the [GitHub repo](https://github.com/aniquethaplawala/clinical-scribe-kit/tree/main/dataset#changes-made-to-the-source-data).

## License and citation

Each row carries its source license in the `license` field. Fareez et al. is CC0; everything else is CC BY 4.0, so this collection is distributed under CC BY 4.0. Please credit the original authors; see [ATTRIBUTION.md](ATTRIBUTION.md) and cite them with [CITATIONS.bib](CITATIONS.bib). No endorsement by the original authors is implied.

These are simulated conversations for software development and research. They are not medical advice.
