#!/usr/bin/env python3
"""Turn a Sully note + Text to JSON output into a FHIR R4 (US Core) transaction Bundle.

    python3 scripts/to_fhir.py \
        --note note.md \
        --extracted extracted.json \
        --ehr ehr-schemas/epic/ehr.json \
        --patient Patient/123 --encounter Encounter/456 \
        > bundle.json

`extracted.json` is the `data` object returned by POST /v1/utils/text-to-json
with ehr-schemas/_common/encounter-note.schema.json.

The EHR config decides which resources are emitted (only ones that EHR accepts
from third-party apps), the note's LOINC type and content type. Everything the
EHR cannot accept as discrete data still lives in the note text.

This builds the payload only. Sending it needs your own SMART on FHIR app
registration and OAuth token with that EHR.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

LOINC = "http://loinc.org"
UCUM = "http://unitsofmeasure.org"
NOTE_TYPES = {
    "progress-note": ("11506-3", "Progress note"),
    "history-and-physical": ("34117-2", "History and physical note"),
    "consult-note": ("11488-4", "Consult note"),
    "discharge-summary": ("18842-5", "Discharge summary"),
    "procedure-note": ("28570-0", "Procedure note"),
}
VITALS = {  # field -> (LOINC, display, UCUM unit)
    "heartRate": ("8867-4", "Heart rate", "/min"),
    "respiratoryRate": ("9279-1", "Respiratory rate", "/min"),
    "oxygenSaturation": ("59408-5", "Oxygen saturation in Arterial blood by Pulse oximetry", "%"),
    "painScore": ("72514-3", "Pain severity - 0-10 verbal numeric rating [Score] - Reported", "{score}"),
}
QTY_VITALS = {
    "temperature": ("8310-5", "Body temperature", {"f": "[degF]", "c": "Cel"}),
    "weight": ("29463-7", "Body weight", {"lb": "[lb_av]", "lbs": "[lb_av]", "kg": "kg"}),
    "height": ("8302-2", "Body height", {"in": "[in_i]", "cm": "cm"}),
}
CONDITION_STATUS = {
    "new": "active", "assessed-today": "active", "chronic-stable": "active",
    "resolved": "resolved", "history-only": "active",
}
MED_STATUS = {
    "started": "active", "continued": "active", "dose-increased": "active", "dose-decreased": "active",
    "stopped": "stopped", "discussed-not-started": "not-taken", "history-only": "unknown",
}


def ref(s: str) -> dict:
    return {"reference": s}


def entry(resource: dict) -> dict:
    full = f"urn:uuid:{uuid.uuid4()}"
    return {"fullUrl": full, "resource": resource,
            "request": {"method": "POST", "url": resource["resourceType"]}}


def vital_cat() -> list:
    return [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category",
                         "code": "vital-signs", "display": "Vital Signs"}]}]


def build(note: str, data: dict, ehr: dict, patient: str, encounter: str | None, when: str) -> dict:
    allow = set(ehr["writableResources"])
    subj = ref(patient)
    enc = ref(encounter) if encounter else None
    out: list[dict] = []

    # 1. The note itself
    code, display = NOTE_TYPES[ehr.get("noteType", "progress-note")]
    ctype = ehr.get("noteContentType", "text/plain")
    doc = {
        "resourceType": "DocumentReference",
        "status": "current",
        "docStatus": ehr.get("noteDocStatus", "preliminary"),
        "type": {"coding": [{"system": LOINC, "code": code, "display": display}]},
        "category": [{"coding": [{"system": "http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category",
                                  "code": "clinical-note", "display": "Clinical Note"}]}],
        "subject": subj,
        "date": when,
        "content": [{"attachment": {"contentType": ctype,
                                    "data": base64.b64encode(note.encode("utf-8")).decode("ascii")}}],
    }
    if enc:
        doc["context"] = {"encounter": [enc]}
    if ehr.get("author"):
        doc["author"] = [ref(ehr["author"])]
    if ehr.get("contextPeriodEnd"):
        doc.setdefault("context", {})["period"] = {"end": when}
    if ehr.get("noteResource", "DocumentReference") == "Composition":
        # Note text as a Composition (e.g. ModMed EMA): one section per configured LOINC code
        div = "<div xmlns=\"http://www.w3.org/1999/xhtml\"><pre>" + html.escape(note) + "</pre></div>"
        doc = {
            "resourceType": "Composition",
            "status": ehr.get("noteDocStatus", "preliminary"),
            "type": {"coding": [{"system": LOINC, "code": code, "display": display}]},
            "subject": subj,
            "date": when,
            "title": ehr.get("noteTitle", display),
            "author": [ref(ehr.get("author", "Practitioner/REPLACE_ME"))],
            "section": [{"title": s.get("title", s["display"]),
                         "code": {"coding": [{"system": LOINC, "code": s["code"], "display": s["display"]}]},
                         "text": {"status": "generated", "div": div}}
                        for s in ehr.get("compositionSections", [{"code": "18776-5", "display": "Plan of treatment"}])],
        }
        if ehr.get("compositionCategory"):
            doc["category"] = [{"coding": [{"system": LOINC, **ehr["compositionCategory"]}]}]
        if enc:
            doc["encounter"] = enc
    out.append(doc)

    # 2. Problems
    for p in data.get("problems", []):
        c = {"resourceType": "Condition",
             "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                                            "code": CONDITION_STATUS[p["status"]]}]},
             "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
                                                "code": "confirmed"}]},
             "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-category",
                                       "code": "problem-list-item" if p["status"] == "history-only" else "encounter-diagnosis"}]}],
             "code": {"text": p["name"]},
             "subject": subj}
        if p.get("icd10Code"):
            c["code"]["coding"] = [{"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": p["icd10Code"]}]
        if enc and p["status"] != "history-only":
            c["encounter"] = enc
        if p.get("assessment"):
            c["note"] = [{"text": p["assessment"]}]
        out.append(c)

    # 3. Allergies
    for a in data.get("allergies", []):
        r = {"resourceType": "AllergyIntolerance",
             "clinicalStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                                            "code": "active"}]},
             "verificationStatus": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
                                                "code": "unconfirmed"}]},
             "code": {"text": a["substance"]},
             "patient": subj}
        if a.get("category"):
            r["category"] = [a["category"]]
        if a.get("reaction"):
            r["reaction"] = [{"manifestation": [{"text": a["reaction"]}]}]
        out.append(r)

    # 4. Medications (patient-reported statements; prescribing stays with the clinician in the EHR)
    for m in data.get("medications", []):
        dosage = " ".join(x for x in (m.get("dose"), m.get("route"), m.get("frequency"), m.get("duration")) if x)
        r = {"resourceType": "MedicationStatement", "status": MED_STATUS[m["action"]],
             "medicationCodeableConcept": {"text": m["name"]}, "subject": subj,
             "note": [{"text": f"Action at this visit: {m['action']}"}]}
        if dosage:
            r["dosage"] = [{"text": dosage}]
        if enc:
            r["context"] = enc
        out.append(r)

    # 5. Vitals
    v = data.get("vitals") or {}
    def obs(code: str, display: str, value: dict | None = None, components: list | None = None) -> dict:
        o = {"resourceType": "Observation", "status": "final", "category": vital_cat(),
             "code": {"coding": [{"system": LOINC, "code": code, "display": display}]},
             "subject": subj, "effectiveDateTime": when}
        if enc:
            o["encounter"] = enc
        if value:
            o["valueQuantity"] = value
        if components:
            o["component"] = components
        return o
    if v.get("systolicBp") and v.get("diastolicBp"):
        out.append(obs("85354-9", "Blood pressure panel with all children optional", components=[
            {"code": {"coding": [{"system": LOINC, "code": "8480-6", "display": "Systolic blood pressure"}]},
             "valueQuantity": {"value": v["systolicBp"], "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"}},
            {"code": {"coding": [{"system": LOINC, "code": "8462-4", "display": "Diastolic blood pressure"}]},
             "valueQuantity": {"value": v["diastolicBp"], "unit": "mmHg", "system": UCUM, "code": "mm[Hg]"}}]))
    for field, (code, display, unit) in VITALS.items():
        if v.get(field) is not None:
            out.append(obs(code, display, {"value": v[field], "unit": unit, "system": UCUM, "code": unit}))
    for field, (code, display, units) in QTY_VITALS.items():
        q = v.get(field) or {}
        u = (q.get("unit") or "").lower().strip(".° ").replace("degrees ", "")
        if q.get("value") is not None and u in units:
            out.append(obs(code, display, {"value": q["value"], "unit": q["unit"], "system": UCUM, "code": units[u]}))

    # 6. Orders as draft ServiceRequests for clinician sign-off
    o = data.get("orders") or {}
    for kind, items in (("108252007", o.get("labs", [])), ("363679005", o.get("imaging", []))):
        for name in items:
            sr = {"resourceType": "ServiceRequest", "status": "draft", "intent": "proposal",
                  "category": [{"coding": [{"system": "http://snomed.info/sct", "code": kind}]}],
                  "code": {"text": name}, "subject": subj}
            if enc:
                sr["encounter"] = enc
            out.append(sr)
    for r in o.get("referrals", []):
        sr = {"resourceType": "ServiceRequest", "status": "draft", "intent": "proposal",
              "category": [{"coding": [{"system": "http://snomed.info/sct", "code": "3457005", "display": "Patient referral"}]}],
              "code": {"text": f"Referral to {r['specialty']}"}, "subject": subj}
        if r.get("reason"):
            sr["reasonCode"] = [{"text": r["reason"]}]
        out.append(sr)

    kept = [entry(r) for r in out if r["resourceType"] in allow]
    skipped = sorted({r["resourceType"] for r in out} - allow)
    bundle = {"resourceType": "Bundle", "type": "transaction", "entry": kept}
    if skipped:
        bundle["meta"] = {"tag": [{"system": "urn:sully:clinical-scribe-kit", "code": "kept-in-note-only",
                                   "display": ", ".join(skipped)}]}
    return bundle


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--note", required=True, type=Path)
    ap.add_argument("--extracted", required=True, type=Path)
    ap.add_argument("--ehr", required=True, type=Path)
    ap.add_argument("--patient", required=True, help="e.g. Patient/123")
    ap.add_argument("--encounter", help="e.g. Encounter/456")
    a = ap.parse_args()
    data = json.loads(a.extracted.read_text())
    data = data.get("data", data)
    bundle = build(a.note.read_text(), data, json.loads(a.ehr.read_text()), a.patient, a.encounter,
                   datetime.now(timezone.utc).isoformat(timespec="seconds"))
    print(json.dumps(bundle, indent=2))


if __name__ == "__main__":
    main()
