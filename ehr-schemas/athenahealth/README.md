# athenahealth (athenaOne)

**Can a third-party app write a note? Yes, with athena's own chart APIs (not FHIR).**

| | |
|---|---|
| Market | #3 in US ambulatory (about 6.9%, Definitive Healthcare) |
| Serves | Ambulatory |
| Developer portal | https://docs.athenahealth.com/api/ |
| Sandbox | Preview: https://api.preview.platform.athenahealth.com (free, self-service) |
| FHIR | R4 with US Core 6.1.0, (g)(10) certified, but every FHIR resource is read/search only. SMART EHR launch, standalone, client credentials. |

## Writing the note

- Write into an open encounter (the patient is checked in), one section at a time:
- `PUT /v1/{practiceid}/chart/encounter/{encounterid}/hpi`, `/reviewofsystems`, `/physicalexam` with the text in `sectionnote`. GET the section first with `showstructured=true` and send the whole structure back: athena removes anything you leave out.
- Assessment takes `assessmenttext` plus `replacetext`.
- Light HTML is accepted in these four sections. athena recommends labeling text that came from an API.
- These are non-certified APIs: production use needs an athenahealth Platform Services contract, and each practice must enable your app.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Problems | Write (athena API) | `POST /chart/{patientid}/problems` (SNOMED code required) |
| Encounter diagnoses | Write (athena API) | `POST /chart/encounter/{encounterid}/diagnoses` (SNOMED) |
| Allergies | Write (athena API) | `PUT /chart/{patientid}/allergies` |
| Vitals | Write (athena API) | Encounter vitals endpoint |
| All FHIR resources | Read only |  |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for athenahealth (athenaOne); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://docs.athenahealth.com/api/guides/onboarding-overview
- https://dev-portal-prod.developer.athena.io/api/guides/base-fhir-urls
- https://dev-portal-prod.developer.athena.io/api/api-ref/problems
- https://docs.athenahealth.com/api/api-ref/allergy
- https://api.preview.platform.athenahealth.com/fhir/r4/metadata
