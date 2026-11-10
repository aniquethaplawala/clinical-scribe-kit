# eClinicalWorks

**Can a third-party app write a note? Discrete data yes; clinical note create not documented.**

| | |
|---|---|
| Market | #2 in US ambulatory (about 11.9%, Definitive Healthcare) |
| Serves | Ambulatory |
| Developer portal | https://fhir.eclinicalworks.com/ecwopendev |
| Sandbox | Sandbox credentials from eCW FHIR Support; each practice activates your app |
| FHIR | R4 with US Core 6.1.0, (g)(10) certified. SMART EHR launch, standalone, backend and bulk. Certified APIs are free 'at this time'. |

## Writing the note

- eCW's FHIR docs list create APIs for DocumentReference as PDF, C-CDA and insurance card, but there is no create entry for clinical notes (clinical notes are read only).
- The practical route today is a PDF `DocumentReference` attached to the patient, plus discrete writes below. Confirm with eCW whether a PDF can attach to the visit's progress note.
- Field-level specs are PDFs behind the developer portal; check them before building.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Condition (problems, encounter diagnoses) | Write |  |
| AllergyIntolerance | Write |  |
| Observation (vital signs) | Write |  |
| MedicationStatement (reconciliation) | Write |  |
| MedicationRequest (orders) | Write |  |
| ServiceRequest (lab, imaging, procedure, referral) | Write |  |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for eClinicalWorks; the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Build the FHIR payload

```bash
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \
  --ehr ehr-schemas/eclinicalworks/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

The bundle contains only the resources eClinicalWorks accepts from outside apps: Condition, AllergyIntolerance, Observation, MedicationStatement, ServiceRequest. Everything else stays in the note text. Sending it needs your own app registration and OAuth token with eClinicalWorks.

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://fhir.eclinicalworks.com/ecwopendev/documentation
- https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-fhir-r4-mapping
- https://www.eclinicalworks.com/resources/certified-ehr-technology/
