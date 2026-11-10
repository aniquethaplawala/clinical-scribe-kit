# Clinical Scribe Kit

Open resources for building an AI medical scribe with the [Sully API](https://docs.sully.ai/): real-sounding test conversations, clinical note templates, and schemas for getting notes into the top 10 US EHRs.

| | What you get |
|---|---|
| [**Dataset**](dataset/) | 536 openly licensed doctor-patient encounters (329 with audio) and 1,701 short dialogue snippets, from ACI-Bench, PriMock57, MTS-Dialog and the Fareez OSCE set. No real patient data. |
| [**Templates**](templates/) | 19 note templates ready for `POST /v3/notes`: SOAP, H&P, progress note and 16 specialties. |
| [**EHR schemas**](ehr-schemas/) | Epic, Oracle Health, MEDITECH, athenahealth, eClinicalWorks, NextGen, Veradigm, Greenway, ModMed and TruBridge: which ones accept notes from outside apps, how, and a Text to JSON schema for each. |
| [**Scripts**](scripts/) | Rebuild the dataset, download full audio, validate templates, build FHIR payloads. |

## Quick start

1. Sign up at [Sully](https://sully.ai) and create an API key. You'll get an account ID and an API key.
2. Set them in your shell:

```bash
export SULLY_ACCOUNT_ID=your-account-id
export SULLY_API_KEY=your-api-key
```

3. Generate a note from a recorded visit:

```bash
git clone https://github.com/aniquethaplawala/clinical-scribe-kit && cd clinical-scribe-kit

jq -n --rawfile t dataset/encounters/aci-bench/aci-D2N001/transcript.txt \
      --slurpfile tpl templates/outpatient-soap.json \
      '{transcript: $t, template: $tpl[0]}' |
curl -s https://api.sully.ai/v3/notes \
  -H "X-Account-Id: $SULLY_ACCOUNT_ID" -H "X-Api-Key: $SULLY_API_KEY" \
  -H "Content-Type: application/json" --data @- | jq -r .note
```

4. Compare it with the note the clinician wrote: `dataset/encounters/aci-bench/aci-D2N001/reference-note.md`

## How the pieces fit

```
audio ──► Sully transcription (batch or streaming) ──► transcript
transcript + template ──► POST /v3/notes ──► clinical note
note + EHR schema ──► POST /v1/utils/text-to-json ──► structured fields
structured fields ──► scripts/to_fhir.py ──► payload for the EHR's API
```

| Step | Sully API | In this repo |
|---|---|---|
| Transcribe a recording | [`POST /v2/audio/transcriptions`](https://docs.sully.ai/transcription-v2.md) | Audio in `dataset/encounters/*/*/audio.mp3` |
| Transcribe live | [Streaming transcription](https://docs.sully.ai/streaming-transcription.md) | Same audio, streamed in chunks |
| Write the note | [`POST /v3/notes`](https://docs.sully.ai/note-generation-v3.md) | `templates/` |
| Pull out structured data | [`POST /v1/utils/text-to-json`](https://docs.sully.ai/text-to-json.md) | `ehr-schemas/<ehr>/schema.json` |
| Send to the EHR | Your EHR's API | `scripts/to_fhir.py`, `ehr-schemas/<ehr>/ehr.json` |

## Test your scribe against the dataset

- **Transcription accuracy**: transcribe the PriMock57 or Fareez audio and compare word error rate against the human transcripts.
- **Note quality**: generate notes for the 207 ACI-Bench visits and compare them with the clinicians' notes (ROUGE, BERTScore, or a clinician review).
- **Section accuracy**: run the 1,701 MTS-Dialog snippets and compare each generated section with the reference section.
- **Hard cases**: the dataset includes family members speaking, patients correcting themselves, dictation-style visits and UK and Canadian English.

## Repo layout

```
dataset/        encounters, manifest, attribution, citations
templates/      19 Note Generation v3 templates
ehr-schemas/    one folder per EHR + a shared schema + research notes with sources
scripts/        build_dataset.py, download_audio.py, validate_templates.py, to_fhir.py,
                build_ehr_folders.py, build_hf_dataset.py
```

## License

Code, templates and EHR schemas: [MIT](LICENSE). Dataset: each source keeps its own license (CC BY 4.0 or CC0); see [dataset/ATTRIBUTION.md](dataset/ATTRIBUTION.md). The conversations are simulated and are for building and testing software, not for clinical decisions.

Built by [Sully.ai](https://sully.ai). Issues and pull requests welcome.
