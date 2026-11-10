# Veradigm (Veradigm EHR, Practice Fusion)

**Can a third-party app write a note? Not through FHIR; Veradigm points writes to its Unity API.**

| | |
|---|---|
| Market | #7 and #8 in US ambulatory (about 3.1% each, Definitive Healthcare) |
| Serves | Ambulatory |
| Developer portal | https://developer.veradigm.com/ |
| Sandbox | Free signup; sandbox credentials emailed after account validation |
| FHIR | R4, per-organization endpoints in Veradigm's endpoint directory. SMART EHR launch, standalone, system apps. FHIR is read only. |

## Writing the note

- Veradigm's docs: the FHIR API 'is limited to read-only access and not write-backs'.
- Writes go through the proprietary Unity API (Veradigm Connect). Its note and document actions are not in Veradigm's public docs; ask Veradigm for Unity access.
- TouchWorks is no longer a Veradigm product: it moved to Altera Digital Health in 2022.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| All FHIR resources | Read only |  |
| Unity API | Read and write | Endpoints not public |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for Veradigm (Veradigm EHR, Practice Fusion); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://developer.veradigm.com/content/fhir/ProcessOverview_index.html
- https://developer.veradigm.com/Fhir/Introduction
- https://veradigm.com/legal/onc-reg-compliance/
