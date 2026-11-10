# Oracle Health (Cerner)

**Can a third-party app write a note? Yes, with standard FHIR.**

| | |
|---|---|
| Market | #2 in US hospitals (21.9% of acute-care hospitals, KLAS 2025); about 5.4% of ambulatory |
| Serves | Mainly hospitals |
| Developer portal | https://docs.oracle.com/en/industries/health/millennium-platform-apis/ |
| Sandbox | Open read-only: https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d ; secure read/write: https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d (register in code Console) |
| FHIR | R4 (DSTU2 retiring). SMART App Launch 1.0 and 2.0, EHR launch, standalone, backend services. (g)(10) certified. |

## Writing the note

- `POST {base}/DocumentReference` with base64 content. The content type must include a charset, e.g. `text/plain;charset=utf-8` (PDF, RTF and HTML are also accepted).
- Required: `status: current`, `docStatus`, `type` (LOINC or the health system's code set 72 code, not both), `subject`, `context` with `context.period.end`, and `author` for provider-launched apps.
- There is no draft option: provider-launched apps must send `docStatus: final`; backend apps can send `final` or `amended`. Build your review step before you file.
- Document type codes differ per health system, so plan a mapping table per customer.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Condition | Write | problem-list-item or encounter-diagnosis, one category per resource |
| AllergyIntolerance | Write |  |
| Observation | Write | Vital signs, laboratory, some imaging |
| MedicationRequest | Write (limited) | Patient-reported records only (`reportedBoolean: true`) |
| ServiceRequest | Read only | Orders stay in the note text |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for Oracle Health (Cerner); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Build the FHIR payload

```bash
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \
  --ehr ehr-schemas/oracle-health/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

The bundle contains only the resources Oracle Health (Cerner) accepts from outside apps: DocumentReference, Condition, AllergyIntolerance, Observation. Everything else stays in the note text. Sending it needs your own app registration and OAuth token with Oracle Health (Cerner).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/rest-endpoints.html
- https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-condition-post.html
- https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-observation-post.html
- https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-medicationrequest-post.html
- https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/metadata
