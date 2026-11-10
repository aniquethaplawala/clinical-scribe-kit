import copy, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
E = ROOT / "ehr-schemas"
COMMON = json.loads((E / "_common/encounter-note.schema.json").read_text())

def sec(desc):
    return {"type": ["string", "null"], "description": desc + " Return null if the note has no such content."}

def schema_for(key, title, note_obj, note_desc):
    s = copy.deepcopy(COMMON)
    s["title"] = f"{title}: encounter note extraction (Sully Text to JSON)"
    s["description"] = (f"Send a generated note as `text` with this schema to POST /v1/utils/text-to-json. "
                        f"`ehrNote` holds the note text shaped for {title}; the other fields are discrete data. "
                        "Extract only facts written in the note; use null or [] when absent.")
    props = {"ehrNote": {"type": "object", "description": note_desc, "properties": note_obj,
                         "required": list(note_obj), "additionalProperties": False}}
    for k, v in s["properties"].items():
        if k != "sections":
            props[k] = v
    s.pop("$schema", None)
    s["properties"] = props
    s["required"] = list(props)
    return s

FULL = {"fullNote": sec("Copy the entire note verbatim as plain text, keeping section headings and bullets.")}
SOAP4 = lambda names: {k: sec(f"Copy the body of the {v} verbatim. Exclude the heading.") for k, v in names.items()}

EHRS = [
 dict(key="epic", name="Epic", rank="#1 in US hospitals (43.7% of acute-care hospitals, KLAS 2025) and #1 in ambulatory (about 19.5%, Definitive Healthcare)",
      segment="Hospitals and ambulatory", portal="https://fhir.epic.com/", sandbox="https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/ (free self-service signup)",
      fhir="R4 (also STU3, DSTU2). Sandbox reports US Core 6.1.0. SMART EHR launch, standalone launch and backend services.",
      writePath="fhir", verdict="Yes, with standard FHIR",
      noteHow=["`POST {base}/api/FHIR/R4/DocumentReference` with the note as base64 `text/plain` (RTF and HTML are rejected; only the first attachment is saved).",
               "Required: `type` (LOINC or the organization's note type), `subject`, `context.encounter` (an encounter that can hold a note), `docStatus`.",
               "Send `docStatus: preliminary` so the note files as unsigned for the clinician to review and sign. `final` files it as signed.",
               "Epic lists these LOINC note types: 11506-3 Progress note, 34117-2 H&P, 11488-4 Consult note, 18842-5 Discharge summary, 28570-0 Procedure note, 34111-5 ED note, 34746-8 Nurse note. Health systems can map their own."],
      discrete=[("Condition (problems)", "Write", "Lands in a holding area until a clinician reconciles it"),
                ("AllergyIntolerance", "Write", "Holding area until reconciled"),
                ("Observation (vital signs)", "Write", "One flowsheet value per call; open encounters only"),
                ("MedicationRequest / MedicationStatement", "Read only", "Medications stay in the note text"),
                ("ServiceRequest (orders)", "Read only", "Orders stay in the note text")],
      writable=["DocumentReference", "Condition", "AllergyIntolerance", "Observation"],
      cfg=dict(noteType="progress-note", noteContentType="text/plain", noteDocStatus="preliminary", author="Practitioner/REPLACE_WITH_AUTHOR"),
      note=FULL, noteDesc="Epic stores one plain-text note per DocumentReference.",
      sources=["https://fhir.epic.com/Specifications?api=1046", "https://fhir.epic.com/Specifications?api=949", "https://fhir.epic.com/Specifications?api=945", "https://fhir.epic.com/Specifications?api=963", "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/metadata"]),
 dict(key="oracle-health", name="Oracle Health (Cerner)", rank="#2 in US hospitals (21.9% of acute-care hospitals, KLAS 2025); about 5.4% of ambulatory",
      segment="Mainly hospitals", portal="https://docs.oracle.com/en/industries/health/millennium-platform-apis/",
      sandbox="Open read-only: https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d ; secure read/write: https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d (register in code Console)",
      fhir="R4 (DSTU2 retiring). SMART App Launch 1.0 and 2.0, EHR launch, standalone, backend services. (g)(10) certified.",
      writePath="fhir", verdict="Yes, with standard FHIR",
      noteHow=["`POST {base}/DocumentReference` with base64 content. The content type must include a charset, e.g. `text/plain;charset=utf-8` (PDF, RTF and HTML are also accepted).",
               "Required: `status: current`, `docStatus`, `type` (LOINC or the health system's code set 72 code, not both), `subject`, `context` with `context.period.end`, and `author` for provider-launched apps.",
               "There is no draft option: provider-launched apps must send `docStatus: final`; backend apps can send `final` or `amended`. Build your review step before you file.",
               "Document type codes differ per health system, so plan a mapping table per customer."],
      discrete=[("Condition", "Write", "problem-list-item or encounter-diagnosis, one category per resource"),
                ("AllergyIntolerance", "Write", ""),
                ("Observation", "Write", "Vital signs, laboratory, some imaging"),
                ("MedicationRequest", "Write (limited)", "Patient-reported records only (`reportedBoolean: true`)"),
                ("ServiceRequest", "Read only", "Orders stay in the note text")],
      writable=["DocumentReference", "Condition", "AllergyIntolerance", "Observation"],
      cfg=dict(noteType="progress-note", noteContentType="text/plain;charset=utf-8", noteDocStatus="final", author="Practitioner/REPLACE_WITH_SIGNING_PROVIDER", contextPeriodEnd=True),
      note=FULL, noteDesc="Oracle Health stores one document per DocumentReference.",
      sources=["https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/rest-endpoints.html", "https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-condition-post.html", "https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-observation-post.html", "https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/op-medicationrequest-post.html", "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/metadata"]),
 dict(key="meditech", name="MEDITECH Expanse", rank="#3 in US hospitals (14.7% of acute-care hospitals, KLAS 2025); leads among community hospitals",
      segment="Mainly community hospitals", portal="https://ehr.meditech.com/meditech-greenfield", sandbox="Greenfield Workspace: https://greenfield.meditech.com/ (registration form; production access is per hospital)",
      fhir="R4 with US Core STU3, STU4, STU6 and STU7. SMART EHR launch, standalone, backend services. (g)(10) certified.",
      writePath="fhir-sections", verdict="Yes, section by section (clinician approves)",
      noteHow=["`POST {base}/Observation` writes narrative text into one section of a document the clinician already has in progress. MEDITECH holds it (`202 Accepted`) until the clinician approves it.",
               "Pick the section with the LOINC `code`: 10164-2 HPI, 10187-3 ROS, 29545-1 Physical findings, 51847-2 Assessment and plan.",
               "Required: `subject`, `encounter`, the EHR's `document` category, and `focus` pointing at the in-progress document's identifier.",
               "A whole-document `POST DocumentReference` is also listed in Greenfield, but its required fields are not public. Confirm with MEDITECH before relying on it. MEDITECH's marketing pages still call these APIs view-only, so confirm availability per hospital."],
      discrete=[("Condition", "Read only", ""), ("AllergyIntolerance", "Read only", ""),
                ("Observation", "Write (limited)", "Documentation text, CT radiation dose, device-read vitals only"),
                ("MedicationRequest", "Read only", ""), ("ServiceRequest", "Read only", "")],
      writable=[], cfg=dict(noteType="history-and-physical", noteContentType="text/plain"),
      note=SOAP4({"hpiNarrative": "History of Present Illness section (goes to LOINC 10164-2)",
                  "rosNarrative": "Review of Systems section (goes to LOINC 10187-3)",
                  "physicalFindingsNarrative": "Objective or Physical Exam section, exam findings only (goes to LOINC 29545-1)",
                  "assessmentPlanNarrative": "Assessment and Plan section (goes to LOINC 51847-2)"}),
      noteDesc="MEDITECH accepts narrative for four document sections, one Observation per section.",
      sources=["https://greenfield.meditech.com/explorer/topic/USCore-STU7", "https://greenfield.meditech.com/explorer/api/uscore.STU7.Observation/2", "https://greenfield.meditech.com/explorer/topic/authorization-flows", "https://home.meditech.com/en/d/regulatoryresources/otherfiles/2025meditechrealworldtestingresultsreport.pdf"]),
 dict(key="athenahealth", name="athenahealth (athenaOne)", rank="#3 in US ambulatory (about 6.9%, Definitive Healthcare)",
      segment="Ambulatory", portal="https://docs.athenahealth.com/api/", sandbox="Preview: https://api.preview.platform.athenahealth.com (free, self-service)",
      fhir="R4 with US Core 6.1.0, (g)(10) certified, but every FHIR resource is read/search only. SMART EHR launch, standalone, client credentials.",
      writePath="proprietary", verdict="Yes, with athena's own chart APIs (not FHIR)",
      noteHow=["Write into an open encounter (the patient is checked in), one section at a time:",
               "`PUT /v1/{practiceid}/chart/encounter/{encounterid}/hpi`, `/reviewofsystems`, `/physicalexam` with the text in `sectionnote`. GET the section first with `showstructured=true` and send the whole structure back: athena removes anything you leave out.",
               "Assessment takes `assessmenttext` plus `replacetext`.",
               "Light HTML is accepted in these four sections. athena recommends labeling text that came from an API.",
               "These are non-certified APIs: production use needs an athenahealth Platform Services contract, and each practice must enable your app."],
      discrete=[("Problems", "Write (athena API)", "`POST /chart/{patientid}/problems` (SNOMED code required)"),
                ("Encounter diagnoses", "Write (athena API)", "`POST /chart/encounter/{encounterid}/diagnoses` (SNOMED)"),
                ("Allergies", "Write (athena API)", "`PUT /chart/{patientid}/allergies`"),
                ("Vitals", "Write (athena API)", "Encounter vitals endpoint"),
                ("All FHIR resources", "Read only", "")],
      writable=[], cfg=dict(noteType="progress-note", noteContentType="text/html"),
      note=SOAP4({"hpiSectionNote": "History of Present Illness section (PUT .../hpi sectionnote)",
                  "reviewOfSystemsSectionNote": "Review of Systems section (PUT .../reviewofsystems sectionnote)",
                  "physicalExamSectionNote": "Objective or Physical Exam section, exam findings only (PUT .../physicalexam sectionnote)",
                  "assessmentText": "Assessment and Plan section (assessmenttext)"}),
      noteDesc="athenaOne encounters take narrative per section: HPI, ROS, Physical Exam and Assessment.",
      sources=["https://docs.athenahealth.com/api/guides/onboarding-overview", "https://dev-portal-prod.developer.athena.io/api/guides/base-fhir-urls", "https://dev-portal-prod.developer.athena.io/api/api-ref/problems", "https://docs.athenahealth.com/api/api-ref/allergy", "https://api.preview.platform.athenahealth.com/fhir/r4/metadata"]),
 dict(key="eclinicalworks", name="eClinicalWorks", rank="#2 in US ambulatory (about 11.9%, Definitive Healthcare)",
      segment="Ambulatory", portal="https://fhir.eclinicalworks.com/ecwopendev", sandbox="Sandbox credentials from eCW FHIR Support; each practice activates your app",
      fhir="R4 with US Core 6.1.0, (g)(10) certified. SMART EHR launch, standalone, backend and bulk. Certified APIs are free 'at this time'.",
      writePath="fhir-partial", verdict="Discrete data yes; clinical note create not documented",
      noteHow=["eCW's FHIR docs list create APIs for DocumentReference as PDF, C-CDA and insurance card, but there is no create entry for clinical notes (clinical notes are read only).",
               "The practical route today is a PDF `DocumentReference` attached to the patient, plus discrete writes below. Confirm with eCW whether a PDF can attach to the visit's progress note.",
               "Field-level specs are PDFs behind the developer portal; check them before building."],
      discrete=[("Condition (problems, encounter diagnoses)", "Write", ""), ("AllergyIntolerance", "Write", ""),
                ("Observation (vital signs)", "Write", ""), ("MedicationStatement (reconciliation)", "Write", ""),
                ("MedicationRequest (orders)", "Write", ""), ("ServiceRequest (lab, imaging, procedure, referral)", "Write", "")],
      writable=["Condition", "AllergyIntolerance", "Observation", "MedicationStatement", "ServiceRequest"],
      cfg=dict(noteType="progress-note", noteContentType="application/pdf"),
      note=FULL, noteDesc="eCW has no documented clinical-note create; keep the full text for a PDF attachment or manual paste.",
      sources=["https://fhir.eclinicalworks.com/ecwopendev/documentation", "https://fhir.eclinicalworks.com/ecwopendev/documentation/v3-fhir-r4-mapping", "https://www.eclinicalworks.com/resources/certified-ehr-technology/"]),
 dict(key="nextgen", name="NextGen Enterprise", rank="#5 in US ambulatory (about 4.2%, Definitive Healthcare)",
      segment="Ambulatory", portal="https://www.nextgen.com/developer-program", sandbox="Sandbox after joining the API Distributor Program (free to develop; production fees vary)",
      fhir="R4 (DSTU2 retiring 31 Dec 2026). Enterprise 8 is (g)(10) certified. Public FHIR is read only.",
      writePath="proprietary-unverified", verdict="Possibly, through the NextGen Enterprise API (details behind onboarding)",
      noteHow=["NextGen's public FHIR API is read only.",
               "The proprietary NextGen Enterprise API supports 'read and write', but its route-level docs, including any note endpoint, are only available after you join the API Distributor Program.",
               "Production fees can depend on whether your app reads only or reads and writes."],
      discrete=[("All public FHIR resources", "Read only", ""), ("Enterprise API", "Read and write", "Endpoints not public")],
      writable=[], cfg=dict(noteType="progress-note", noteContentType="text/plain"),
      note=FULL, noteDesc="Until you have NextGen Enterprise API access, keep the full note text.",
      sources=["https://www.nextgen.com/developer-program", "https://www.nextgen.com/api/regulatory-nge", "https://nextgen.com/certifications"]),
 dict(key="veradigm", name="Veradigm (Veradigm EHR, Practice Fusion)", rank="#7 and #8 in US ambulatory (about 3.1% each, Definitive Healthcare)",
      segment="Ambulatory", portal="https://developer.veradigm.com/", sandbox="Free signup; sandbox credentials emailed after account validation",
      fhir="R4, per-organization endpoints in Veradigm's endpoint directory. SMART EHR launch, standalone, system apps. FHIR is read only.",
      writePath="proprietary-unverified", verdict="Not through FHIR; Veradigm points writes to its Unity API",
      noteHow=["Veradigm's docs: the FHIR API 'is limited to read-only access and not write-backs'.",
               "Writes go through the proprietary Unity API (Veradigm Connect). Its note and document actions are not in Veradigm's public docs; ask Veradigm for Unity access.",
               "TouchWorks is no longer a Veradigm product: it moved to Altera Digital Health in 2022."],
      discrete=[("All FHIR resources", "Read only", ""), ("Unity API", "Read and write", "Endpoints not public")],
      writable=[], cfg=dict(noteType="progress-note", noteContentType="text/plain"),
      note=FULL, noteDesc="Until you have Unity API access, keep the full note text.",
      sources=["https://developer.veradigm.com/content/fhir/ProcessOverview_index.html", "https://developer.veradigm.com/Fhir/Introduction", "https://veradigm.com/legal/onc-reg-compliance/"]),
 dict(key="greenway", name="Greenway Health (Intergy, Prime Suite)", rank="#10 in US ambulatory (about 2.2%, Definitive Healthcare)",
      segment="Ambulatory", portal="https://developers.greenwayhealth.com/developer-platform/docs", sandbox="No public sandbox yet ('a public sandbox will be available soon')",
      fhir="R4, per-tenant base URL. Standalone launch and backend services (with site permission). FHIR is read only.",
      writePath="proprietary-unverified", verdict="Not through FHIR; the proprietary GAPI can write but endpoints are not public",
      noteHow=["Greenway: 'Currently, our FHIR ecosystem does not support the writeback feature.' Write-back is on its roadmap.",
               "The proprietary Greenway API (GAPI) 'supports both reads and writes', with different calls for Intergy and Prime Suite. Note endpoints are not public."],
      discrete=[("All FHIR resources", "Read only", ""), ("GAPI", "Read and write", "Endpoints not public")],
      writable=[], cfg=dict(noteType="progress-note", noteContentType="text/plain"),
      note=FULL, noteDesc="Until you have GAPI access, keep the full note text.",
      sources=["https://developers.greenwayhealth.com/developer-platform/docs/frequently-asked-questions-for-developers", "https://developers.greenwayhealth.com/developer-platform/docs/api-an-overview", "https://developers.greenwayhealth.com/developer-platform/docs/gapi"]),
 dict(key="modmed", name="ModMed (EMA)", rank="#6 in US ambulatory (about 3.6%, Definitive Healthcare); specialty practices",
      segment="Specialty ambulatory (dermatology, ophthalmology, orthopedics, GI and more)", portal="https://portal.api.modmed.com",
      sandbox="Public EMA sandbox: https://stage.ema-api.com/ema-dev/firm/apiportal/ema (shared sandbox key on the portal)",
      fhir="Certified R4 API is read/search only. The EMA Proprietary API uses FHIR R4-style resources under `/fhir/v2` and supports writes.",
      writePath="proprietary-fhir", verdict="Yes, with the EMA Proprietary API (FHIR-style)",
      noteHow=["`POST {base}/fhir/v2/Composition` with the note text in a section coded LOINC 18776-5 (Plan of treatment). It goes into the visit's Additional Visit Note if a visit is in progress, otherwise into a Chart Note. A 69730-0 (Instructions) section goes to transcriptionist notes.",
               "ModMed's example uses `type` LOINC 11488-4, `category` LOINC LP173421-1, `status: preliminary`, plus `subject`, `encounter`, `author` and `date`.",
               "Every call needs a bearer token and an `x-api-key` header.",
               "`POST /fhir/v2/DocumentReference` attaches a file (such as a PDF) from a presigned S3 URL."],
      discrete=[("Condition", "Write", "Create and update"), ("AllergyIntolerance", "Write", "Create and update"),
                ("MedicationStatement", "Write", "Create and update"), ("Procedure", "Write", "Create"),
                ("Observation", "Read only", ""), ("ServiceRequest", "Read only", "")],
      writable=["Composition", "Condition", "AllergyIntolerance", "MedicationStatement"],
      cfg=dict(noteType="consult-note", noteResource="Composition", noteDocStatus="preliminary",
               author="Practitioner/REPLACE_WITH_AUTHOR", compositionCategory={"code": "LP173421-1", "display": "Report"},
               compositionSections=[{"code": "18776-5", "display": "Plan of treatment", "title": "Visit note"}]),
      note={"visitNote": sec("Copy the entire note verbatim as plain text (goes to the Composition section LOINC 18776-5)."),
            "transcriptionistNotes": sec("Any instructions addressed to staff, if the note has them (Composition section LOINC 69730-0).")},
      noteDesc="ModMed EMA takes the note as a Composition section.",
      sources=["https://portal.api.modmed.com/reference/post_fhir-v2-composition.md", "https://portal.api.modmed.com/reference/post_fhir-v2-documentreference.md", "https://portal.api.modmed.com/docs/ema-proprietary-api", "https://portal.api.modmed.com/reference"]),
 dict(key="trubridge", name="TruBridge (formerly CPSI)", rank="#4 in US hospitals (7.6% of acute-care hospitals, KLAS 2025); rural and community hospitals",
      segment="Rural and community hospitals", portal="https://fhir-developer.plt.trubridge.com/", sandbox="Not publicly documented",
      fhir="R4 with USCDI v3, (g)(10) certified. Read only, served from a separate FHIR repository.",
      writePath="none", verdict="No public write API",
      noteHow=["TruBridge: its FHIR API 'makes patient clinical data available for read only access'.",
               "The only documented note write-back is TruBridge's own built-in Microsoft Dragon Copilot integration, which is a vendor partnership, not a public API.",
               "For now, deliver the note for clinicians to paste in, or talk to TruBridge about partnership and interface options."],
      discrete=[("All FHIR resources", "Read only", "")],
      writable=[], cfg=dict(noteType="progress-note", noteContentType="text/plain"),
      note=FULL, noteDesc="No public write path; keep the full note for copy and paste.",
      sources=["https://trubridge.com/wp-content/uploads/2026/06/TruBridge-FHIR-API.pdf", "https://trubridge.com/fhir-api/", "https://trubridge.com/solutions/ambient-listening-technology/"]),
]

for e in EHRS:
    d = E / e["key"]
    d.mkdir(parents=True, exist_ok=True)
    cfg = {"key": e["key"], "name": e["name"], "writePath": e["writePath"],
           "writableResources": e["writable"], **e["cfg"], "verifiedOn": "2026-11-10", "sources": e["sources"]}
    (d / "ehr.json").write_text(json.dumps(cfg, indent=2) + "\n")
    sch = schema_for(e["key"], e["name"], e["note"], e["noteDesc"])
    (d / "schema.json").write_text(json.dumps(sch, indent=2, ensure_ascii=False) + "\n")
    rows = "\n".join(f"| {a} | {b} | {c} |" for a, b, c in e["discrete"])
    how = "\n".join(f"- {x}" for x in e["noteHow"])
    src = "\n".join(f"- {u}" for u in e["sources"])
    fhir_cmd = ""
    if e["writable"]:
        fhir_cmd = f"""
## Build the FHIR payload

```bash
python3 scripts/to_fhir.py --note note.md --extracted extracted.json \\
  --ehr ehr-schemas/{e['key']}/ehr.json --patient Patient/<id> --encounter Encounter/<id> > bundle.json
```

The bundle contains only the resources {e['name']} accepts from outside apps: {', '.join(e['writable'])}. Everything else stays in the note text. Sending it needs your own app registration and OAuth token with {e['name']}.
"""
    readme = f"""# {e['name']}

**Can a third-party app write a note? {e['verdict']}.**

| | |
|---|---|
| Market | {e['rank']} |
| Serves | {e['segment']} |
| Developer portal | {e['portal']} |
| Sandbox | {e['sandbox']} |
| FHIR | {e['fhir']} |

## Writing the note

{how}

## Writing discrete data

| Data | Access | Notes |
|---|---|---|
{rows}

## Files

- [`schema.json`](schema.json): send with your generated note to Sully's `POST /v1/utils/text-to-json`. `ehrNote` comes back shaped for {e['name']}; the rest is discrete data (problems, medications, allergies, vitals, orders).
- [`ehr.json`](ehr.json): settings for `scripts/to_fhir.py` (which resources to send, note type, content type).
{fhir_cmd}
## Sources

Checked on 10 November 2026 against public vendor documentation. EHR APIs change often; confirm with the vendor before you build.

{src}
"""
    (d / "README.md").write_text(readme)
    print(e["key"], len(json.dumps(sch)))
