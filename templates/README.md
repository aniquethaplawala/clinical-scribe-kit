# Clinical note templates

19 ready-to-use note templates in the exact format the [Sully Note Generation API](https://docs.sully.ai/note-generation-v3.md) expects. Each file is the `template` object for `POST /v3/notes`: global `instructions` plus an ordered list of `sections`.

`outpatient-soap.json` is Sully's official default template, copied unchanged from the [custom templates guide](https://docs.sully.ai/note-generation-custom-templates.md). Every other template starts from its global rules (use only stated facts, label prior information, `Not Provided` for empty sections) and adds rules for its note type.

## Templates

| File | Use for | Sections |
|---|---|---:|
| [outpatient-soap.json](outpatient-soap.json) | Default outpatient visit (official Sully template) | 7 |
| [history-and-physical.json](history-and-physical.json) | Hospital admission H&P | 12 |
| [progress-note.json](progress-note.json) | Daily inpatient progress note | 7 |
| [specialty/urgent-care.json](specialty/urgent-care.json) | Acute visits; Centor, Ottawa and other decision rules; work notes | 10 |
| [specialty/telehealth.json](specialty/telehealth.json) | Video and phone visits; self-reported vitals; exam limits | 10 |
| [specialty/emergency-department.json](specialty/emergency-department.json) | ED note with ED course and medical decision making | 12 |
| [specialty/pediatrics.json](specialty/pediatrics.json) | Well-child and sick visits; growth, milestones, vaccines | 12 |
| [specialty/cardiology.json](specialty/cardiology.json) | Cardiology consult and follow-up; diagnostics; anticoagulation | 11 |
| [specialty/dermatology.json](specialty/dermatology.json) | Lesion exams, dermoscopy, biopsies | 8 |
| [specialty/psychiatry-intake.json](specialty/psychiatry-intake.json) | Psychiatric evaluation; mental status exam; risk assessment | 12 |
| [specialty/behavioral-health-dap.json](specialty/behavioral-health-dap.json) | Therapy session (DAP format) | 4 |
| [specialty/obstetrics-prenatal.json](specialty/obstetrics-prenatal.json) | Prenatal visits | 9 |
| [specialty/orthopedics.json](specialty/orthopedics.json) | Musculoskeletal visits with an injection procedure note | 9 |
| [specialty/physical-therapy-eval.json](specialty/physical-therapy-eval.json) | PT initial evaluation; goals and plan of care | 9 |
| [specialty/neurology.json](specialty/neurology.json) | Headache and neurology follow-up | 10 |
| [specialty/gastroenterology.json](specialty/gastroenterology.json) | GI consult; alarm features; endoscopy planning | 10 |
| [specialty/endocrinology.json](specialty/endocrinology.json) | Thyroid, diabetes and lab-trend follow-up | 10 |
| [specialty/pulmonology.json](specialty/pulmonology.json) | COPD and asthma; spirometry; inhaler technique | 10 |
| [specialty/geriatrics.json](specialty/geriatrics.json) | Cognition, falls, function and deprescribing | 11 |

## Use one

```bash
jq -n --rawfile t dataset/encounters/aci-bench/aci-D2N001/transcript.txt \
      --slurpfile tpl templates/specialty/cardiology.json \
      '{transcript: $t, template: $tpl[0]}' |
curl -s "https://api.sully.ai/v3/notes" \
  -H "X-Account-Id: $SULLY_ACCOUNT_ID" \
  -H "X-Api-Key: $SULLY_API_KEY" \
  -H "Content-Type: application/json" \
  --data @- | jq -r .note
```

Python:

```python
import json, os
import httpx
from sullyai import SullyAI

client = SullyAI(api_key=os.environ["SULLY_API_KEY"], account_id=os.environ["SULLY_ACCOUNT_ID"])
template = json.load(open("templates/outpatient-soap.json"))
transcript = open("dataset/encounters/primock57/pm57-d1c01/transcript.txt").read()

response = client.post("/v3/notes", cast_to=httpx.Response,
                       body={"transcript": transcript, "template": template},
                       options={"timeout": 300.0, "max_retries": 0})
print(response.json()["note"])
```

## How a template is built

Every section's `instructions` uses the same blocks, following Sully's authoring guide:

- **Purpose and sources**: what the section is for and which inputs it may use
- **Include**: what to capture when it was said
- **Exclude and placement**: what belongs in another section, and which one
- **Organization and format**: labels, bullets, order
- **Missing information**: only when it differs from the global rule
- **Examples**: a short input and the exact expected output (marked as illustrative, so the model does not copy the facts)

The `sections` array is flat. Subsections such as **Physical Exam Findings** or a bold problem name are described inside the parent section's instructions.

## Customize

Copy a file, then edit it. Change the global `instructions` for rules that apply to the whole note (tone, length, bullets or prose), and a section's `instructions` for rules that apply only there. Add, remove, rename or reorder entries in `sections` to change the note's structure. When you change a rule, edit the old rule rather than adding a second one that contradicts it.

Check your edits before sending them:

```bash
python3 scripts/validate_templates.py my-template.json
```

The validator checks the API limits: 1 to 50 sections, unique titles of up to 200 characters, up to 10,000 characters per instruction field, and no unknown keys. It cannot tell you whether the notes are clinically good. Run the template on encounters from [the dataset](../dataset/) and have a clinician review the output before using it in care.

Prefer an interactive setup? Sully's [template-builder skill](https://docs.sully.ai/note-generation-v3.md#provide-a-template) walks a coding agent through building a template with you.

## License

MIT, like the rest of the repo's code and templates. `outpatient-soap.json` is reproduced from Sully's public documentation.
