# TruBridge (formerly CPSI)

**Can a third-party app write a note? No public write API.**

| | |
|---|---|
| Market | #4 in US hospitals (7.6% of acute-care hospitals, KLAS 2025); rural and community hospitals |
| Serves | Rural and community hospitals |
| Developer portal | https://fhir-developer.plt.trubridge.com/ |
| Sandbox | Not publicly documented |
| FHIR | R4 with USCDI v3, (g)(10) certified. Read only, served from a separate FHIR repository. |

## Writing the note

- TruBridge: its FHIR API 'makes patient clinical data available for read only access'.
- The only documented note write-back is TruBridge's own built-in Microsoft Dragon Copilot integration, which is a vendor partnership, not a public API.
- For now, deliver the note for clinicians to paste in, or talk to TruBridge about partnership and interface options.

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
| All FHIR resources | Read only |  |

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for TruBridge (formerly CPSI); the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).

## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

- https://trubridge.com/wp-content/uploads/2026/06/TruBridge-FHIR-API.pdf
- https://trubridge.com/fhir-api/
- https://trubridge.com/solutions/ambient-listening-technology/
