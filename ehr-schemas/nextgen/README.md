# NextGen Enterprise

**Can a third-party app write a note? Possibly, through the NextGen Enterprise API (details behind onboarding).**

| | |
|---|---|
| Market | #5 in US ambulatory (about 4.2%, Definitive Healthcare) |
| Serves | Ambulatory |
| Developer portal | https://www.nextgen.com/developer-program |
| Sandbox | Sandbox after joining the API Distributor Program (free to develop; production fees vary) |
| FHIR | R4 (DSTU2 retiring 31 Dec 2026). Enterprise 8 is (g)(10) certified. Public FHIR is read only. |

## Writing the note

- NextGen's public FHIR API is read only.
- The proprietary NextGen Enterprise API supports 'read and write', but its route-level docs, including any note endpoint, are only available after you join the API Distributor Program.
- Production fees can depend on whether your app reads only or reads and writes.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| All public FHIR resources | Read only |  |
| Enterprise API | Read and write | Endpoints not public |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for NextGen Enterprise; the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://www.nextgen.com/developer-program
- https://www.nextgen.com/api/regulatory-nge
- https://nextgen.com/certifications
