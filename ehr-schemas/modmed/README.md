# ModMed (EMA)

**Can a third-party app write a note? Yes, with the EMA Proprietary API (FHIR-style).**

| | |
|---|---|
| Market | #6 in US ambulatory (about 3.6%, Definitive Healthcare); specialty practices |
| Serves | Specialty ambulatory (dermatology, ophthalmology, orthopedics, GI and more) |
| Developer portal | https://portal.api.modmed.com |
| Sandbox | Public EMA sandbox: https://stage.ema-api.com/ema-dev/firm/apiportal/ema (shared sandbox key on the portal) |
| FHIR | Certified R4 API is read/search only. The EMA Proprietary API uses FHIR R4-style resources under `/fhir/v2` and supports writes. |

## Writing the note

- `POST {base}/fhir/v2/Composition` with the note text in a section coded LOINC 18776-5 (Plan of treatment). It goes into the visit's Additional Visit Note if a visit is in progress, otherwise into a Chart Note. A 69730-0 (Instructions) section goes to transcriptionist notes.
- ModMed's example uses `type` LOINC 11488-4, `category` LOINC LP173421-1, `status: preliminary`, plus `subject`, `encounter`, `author` and `date`.
- Every call needs a bearer token and an `x-api-key` header.
- `POST /fhir/v2/DocumentReference` attaches a file (such as a PDF) from a presigned S3 URL.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Condition | Write | Create and update |
| AllergyIntolerance | Write | Create and update |
| MedicationStatement | Write | Create and update |
| Procedure | Write | Create |
| Observation | Read only |  |
| ServiceRequest | Read only |  |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for ModMed (EMA); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Build the FHIR payload

```bash
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \
  --ehr ehr-schemas/modmed/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

The bundle contains only the resources ModMed (EMA) accepts from outside apps: Composition, Condition, AllergyIntolerance, MedicationStatement. Everything else stays in the note text. Sending it needs your own app registration and OAuth token with ModMed (EMA).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://portal.api.modmed.com/reference/post_fhir-v2-composition.md
- https://portal.api.modmed.com/reference/post_fhir-v2-documentreference.md
- https://portal.api.modmed.com/docs/ema-proprietary-api
- https://portal.api.modmed.com/reference
