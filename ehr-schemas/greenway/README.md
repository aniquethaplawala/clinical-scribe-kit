# Greenway Health (Intergy, Prime Suite)

**Can a third-party app write a note? Not through FHIR; the proprietary GAPI can write but endpoints are not public.**

| | |
|---|---|
| Market | #10 in US ambulatory (about 2.2%, Definitive Healthcare) |
| Serves | Ambulatory |
| Developer portal | https://developers.greenwayhealth.com/developer-platform/docs |
| Sandbox | No public sandbox yet ('a public sandbox will be available soon') |
| FHIR | R4, per-tenant base URL. Standalone launch and backend services (with site permission). FHIR is read only. |

## Writing the note

- Greenway: 'Currently, our FHIR ecosystem does not support the writeback feature.' Write-back is on its roadmap.
- The proprietary Greenway API (GAPI) 'supports both reads and writes', with different calls for Intergy and Prime Suite. Note endpoints are not public.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| All FHIR resources | Read only |  |
| GAPI | Read and write | Endpoints not public |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for Greenway Health (Intergy, Prime Suite); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://developers.greenwayhealth.com/developer-platform/docs/frequently-asked-questions-for-developers
- https://developers.greenwayhealth.com/developer-platform/docs/api-an-overview
- https://developers.greenwayhealth.com/developer-platform/docs/gapi
