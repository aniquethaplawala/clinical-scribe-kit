# MEDITECH Expanse

**Can a third-party app write a note? Yes, section by section (clinician approves).**

| | |
|---|---|
| Market | #3 in US hospitals (14.7% of acute-care hospitals, KLAS 2025); leads among community hospitals |
| Serves | Mainly community hospitals |
| Developer portal | https://ehr.meditech.com/meditech-greenfield |
| Sandbox | Greenfield Workspace: https://greenfield.meditech.com/ (registration form; production access is per hospital) |
| FHIR | R4 with US Core STU3, STU4, STU6 and STU7. SMART EHR launch, standalone, backend services. (g)(10) certified. |

## Writing the note

- `POST {base}/Observation` writes narrative text into one section of a document the clinician already has in progress. MEDITECH holds it (`202 Accepted`) until the clinician approves it.
- Pick the section with the LOINC `code`: 10164-2 HPI, 10187-3 ROS, 29545-1 Physical findings, 51847-2 Assessment and plan.
- Required: `subject`, `encounter`, the EHR's `document` category, and `focus` pointing at the in-progress document's identifier.
- A whole-document `POST DocumentReference` is also listed in Greenfield, but its required fields are not public. Confirm with MEDITECH before relying on it. MEDITECH's marketing pages still call these APIs view-only, so confirm availability per hospital.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| Condition | Read only |  |
| AllergyIntolerance | Read only |  |
| Observation | Write (limited) | Documentation text, CT radiation dose, device-read vitals only |
| MedicationRequest | Read only |  |
| ServiceRequest | Read only |  |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for MEDITECH Expanse; the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://greenfield.meditech.com/explorer/topic/USCore-STU7
- https://greenfield.meditech.com/explorer/api/uscore.STU7.Observation/2
- https://greenfield.meditech.com/explorer/topic/authorization-flows
- https://home.meditech.com/en/d/regulatoryresources/otherfiles/2025meditechrealworldtestingresultsreport.pdf
