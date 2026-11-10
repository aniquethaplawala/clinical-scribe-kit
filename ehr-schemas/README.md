# EHR write-back schemas

How to get an AI-generated clinical note, and the facts in it, into the 10 most widely used EHRs in the US.

Each EHR has its own folder with:

- **`README.md`**: whether an outside app can write a note, which endpoint to use, the required fields, and which discrete data (problems, allergies, vitals, medications, orders) it accepts
- **`schema.json`**: a JSON Schema for [Sully Text to JSON](https://docs.sully.ai/text-to-json.md) that splits a generated note into the pieces that EHR accepts
- **`ehr.json`**: settings for [`scripts/to_fhir.py`](../scripts/to_fhir.py), which builds a FHIR R4 payload containing only what that EHR accepts

## At a glance

| EHR | Market | Can an outside app write the note? | How |
|---|---|---|---|
| [Epic](epic/) | #1 hospitals, #1 ambulatory | Yes | FHIR `DocumentReference`, plain text, can file unsigned for review |
| [Oracle Health](oracle-health/) | #2 hospitals | Yes | FHIR `DocumentReference`, filed as final |
| [MEDITECH Expanse](meditech/) | #3 hospitals | Yes, per section | FHIR `Observation` into HPI, ROS, Exam or A&P of an in-progress document; clinician approves |
| [TruBridge](trubridge/) | #4 hospitals | No public API | Read-only FHIR |
| [eClinicalWorks](eclinicalworks/) | #2 ambulatory | Discrete data only | FHIR creates for problems, allergies, vitals, meds, orders; no clinical-note create documented |
| [athenahealth](athenahealth/) | #3 ambulatory | Yes, per section | athenaOne chart APIs (HPI, ROS, Physical Exam, Assessment); needs a Platform Services contract |
| [NextGen](nextgen/) | #5 ambulatory | Possibly | NextGen Enterprise API, docs after onboarding |
| [ModMed](modmed/) | #6 ambulatory (specialty) | Yes | EMA Proprietary API `Composition` |
| [Veradigm](veradigm/) | #7 and #8 ambulatory | Not through FHIR | Unity API, endpoints not public |
| [Greenway](greenway/) | #10 ambulatory | Not through FHIR | GAPI, endpoints not public |

Market positions are from KLAS (acute-care hospitals, 2025 decisions) and Definitive Healthcare (ambulatory installs, October 2025). Altera Digital Health (Sunrise, Paragon, TouchWorks) is #5 in hospitals and a reasonable swap for Greenway if you mostly serve health systems.

## The flow

```
transcript ──► POST /v3/notes ──► note (Markdown)
                                     │
                                     ▼
                 POST /v1/utils/text-to-json  +  ehr-schemas/<ehr>/schema.json
                                     │
                                     ▼
              extracted JSON ──► scripts/to_fhir.py --ehr ehr-schemas/<ehr>/ehr.json
                                     │
                                     ▼
                      FHIR bundle for that EHR's API (your OAuth token)
```

```bash
# 1. Note from a transcript
jq -n --rawfile t dataset/encounters/aci-bench/aci-D2N001/transcript.txt \
      --slurpfile tpl templates/outpatient-soap.json '{transcript: $t, template: $tpl[0]}' |
curl -s https://api.sully.ai/v3/notes -H "X-Account-Id: $SULLY_ACCOUNT_ID" -H "X-Api-Key: $SULLY_API_KEY" \
  -H "Content-Type: application/json" --data @- | jq -r .note > note.md

# 2. Structured data shaped for Epic
jq -n --rawfile n note.md --slurpfile s ehr-schemas/epic/schema.json '{text: $n, schema: $s[0]}' |
curl -s https://api.sully.ai/v1/utils/text-to-json -H "X-Account-Id: $SULLY_ACCOUNT_ID" -H "X-Api-Key: $SULLY_API_KEY" \
  -H "Content-Type: application/json" --data @- > extracted.json

# 3. FHIR payload Epic will accept
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \
  --ehr ehr-schemas/epic/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

[`_common/encounter-note.schema.json`](_common/encounter-note.schema.json) is the EHR-neutral version: the seven Outpatient SOAP sections as strings plus the same discrete fields.

## Things to know before you build

- **Every EHR needs its own app registration and customer sign-off.** A sandbox is not production; each health system or practice enables your app.
- **Clinician review is not optional.** Epic and MEDITECH can hold your note for sign-off. Oracle Health files it as final, so put the review step in your app before you send.
- **Discrete data goes to a holding area in some EHRs.** Epic sends new problems and allergies to a reconciliation queue. That is expected behavior.
- **Codes.** The schemas only return an ICD-10 code if the note states one. EHRs that need SNOMED (athenahealth problems) or local note-type codes (Oracle Health) need a mapping step of your own.
- **This changes often.** Everything here was checked on 10 November 2026 against public vendor docs, with sources in each folder and the full research notes in [`_research/`](_research/). Where a fact couldn't be confirmed publicly, it says so.
