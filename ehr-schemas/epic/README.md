# Epic

**Can a third-party app write a note? Yes, with standard FHIR.**

| | |
|---|---|
| Market | #1 in US hospitals (43.7% of acute-care hospitals, KLAS 2025) and #1 in ambulatory (about 19.5%, Definitive Healthcare) |
| Serves | Hospitals and ambulatory |
| Developer portal | https://fhir.epic.com/ |
| Sandbox | https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/ (free self-service signup) |
| FHIR | R4 (also STU3, DSTU2). Sandbox reports US Core 6.1.0. SMART EHR launch, standalone launch and backend services. |

## Writing the note

- `POST {base}/api/FHIR/R4/DocumentReference` with the note as base64 `text/plain` (RTF and HTML are rejected; only the first attachment is saved).
- Required: `type` (LOINC or the organization's note type), `subject`, `context.encounter` (an encounter that can hold a note), `docStatus`.
- Send `docStatus: preliminary` so the note files as unsigned for the clinician to review and sign. `final` files it as signed.
- Epic lists these LOINC note types: 11506-3 Progress note, 34117-2 H&P, 11488-4 Consult note, 18842-5 Discharge summary, 28570-0 Procedure note, 34111-5 ED note, 34746-8 Nurse note. Health systems can map their own.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Condition (problems) | Write | Lands in a holding area until a clinician reconciles it |
| AllergyIntolerance | Write | Holding area until reconciled |
| Observation (vital signs) | Write | One flowsheet value per call; open encounters only |
| MedicationRequest / MedicationStatement | Read only | Medications stay in the note text |
| ServiceRequest (orders) | Read only | Orders stay in the note text |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for Epic; the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Build the FHIR payload

```bash
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \
  --ehr ehr-schemas/epic/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

The bundle contains only the resources Epic accepts from outside apps: DocumentReference, Condition, AllergyIntolerance, Observation. Everything else stays in the note text. Sending it needs your own app registration and OAuth token with Epic.

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://fhir.epic.com/Specifications?api=1046
- https://fhir.epic.com/Specifications?api=949
- https://fhir.epic.com/Specifications?api=945
- https://fhir.epic.com/Specifications?api=963
- https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/metadata
