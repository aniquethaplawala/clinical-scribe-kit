> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Custom note templates

A note template is the set of instructions Sully uses to turn a transcript
and patient context into a clinical note. It defines the sections and their order,
what information belongs in each section, and how the note should be written.

The template is broken up into two parts:

* Global instructions apply across the note.
* Section instructions provide specific rules and examples for each section.

This page provides our [default outpatient SOAP template](#outpatient-soap-example)
as a complete, ready-to-use starting point. Download or copy it as provided,
customize its instructions and sections, or use the guidance below to build your own.

## Template structure

```json theme={null}
{
  "transcript": "Fictional encounter transcript...",
  "template": {
    "instructions": "Use concise clinical language and do not infer absent facts.",
    "sections": [
      {
        "title": "History of Present Illness",
        "instructions": "Summarize symptoms, onset, severity, and relevant negatives."
      },
      {
        "title": "Assessment and Plan",
        "instructions": "Separate each assessed problem and its plan."
      }
    ]
  }
}
```

| Field | Validation |
| - | - |
| `template.instructions` | Optional string; maximum 10,000 characters. |
| `template.sections` | Required array of 1–50 sections. |
| `sections[].title` | Required string; trimmed, 1–200 characters, unique after trimming (case-sensitive). |
| `sections[].instructions` | Required string; maximum 10,000 characters. Empty strings are accepted. |

The combined text in the template and clinical context may not exceed 100,000
characters. Unknown fields are rejected. See the
[request reference](https://docs.sully.ai/note-generation-v3.md#request-fields) for the other request fields.

> [!NOTE]
>
> The `sections` array is flat. Define top-level titles and their order in this
> array. To create subsections, describe bold labels and their content in the
> parent section’s instructions; do not add child-section objects.

## Write global instructions

Global instructions define behavior shared by every section. Use the authoring
guidance to decide which rules your template needs, then see the worked example
for sample template text and the note it is intended to produce.

When writing `template.instructions`, specify:

* **Formatting:** Choose bullets or paragraphs, subsection labels, and spacing.
* **Missing information:** Decide how to represent a wholly unsupported section and whether to omit unsupported subsections.
* **Source handling:** Specify how the note should distinguish current findings from prior records.
* **Shared style:** Describe the writing style, including how to preserve uncertainty.

The service adds top-level `######` headings. In the SOAP example, use bold
labels within section bodies. The section instructions determine which content
belongs under each label.

> [accordion] Worked example: global instructions
>
> **Example value for `template.instructions`:**
>
> ```text theme={null}
> Use bold subsection labels. Use - item bullets and blank lines between content blocks.
> If an entire section has no supported content, use Not Provided. Omit unsupported subsections and optional details.
> Clearly identify prior results and distinguish them from current findings.
> ```
>
> The template contains Objective and Allergies, in that order. Objective’s
> section instructions select examination findings and completed imaging results,
> using Physical Exam Findings and Imaging Results as bold labels. Allergies’
> section instructions select stated allergens and reactions.
>
> **Encounter input:** Clinician: “Today there is mild epigastric tenderness. Last month’s
> abdominal ultrasound showed no gallstones.” No allergy information is supplied.
>
> **Expected note:**
>
> ```markdown theme={null}
> ###### Objective
>
> **Physical Exam Findings**
>
> - Abdomen: Mild epigastric tenderness today.
>
> **Imaging Results**
>
> - Prior abdominal ultrasound from last month: No gallstones.
>
> ###### Allergies
>
> Not Provided
> ```
>
> Unsupported Objective subsections are omitted. Allergies uses the whole-section
> placeholder, and the imaging result is explicitly identified as prior information.

## Write section instructions

Section instructions define the content and organization of one section. Use
the authoring guidance to write those rules, then see the worked example for
a Review of Systems section.

Use the blocks that apply to each section in the order below. These are
authoring conventions within an instruction string; they are not API fields
or labels that automatically appear in the generated note.

| Instruction block | What to specify |
| - | - |
| **Purpose and sources** | What the section communicates and which inputs it may use. |
| **Include** | Information to capture when available. |
| **Exclude and placement** | What belongs elsewhere and its destination. |
| **Organization and format** | Grouping, order, labels, bullets or paragraphs, and any repeated problem blocks. |
| **Missing information** | Section-specific behavior only when the global rule is insufficient. |
| **Examples** | Illustrative input and expected output showing content selection and exact formatting. |

Omit blocks with no relevant rules. Shared missing-information behavior can
remain in the global instructions.

> [accordion] Worked example: section instructions
>
> **Example section title (`sections[].title`):** `Review of Systems`.
>
> **Example value for that section’s `instructions` field:**
>
> ```text theme={null}
> Purpose and sources
> Summarize patient-reported symptoms and explicit symptom denials from the transcript, grouped by organ system.
>
> Include
> Reported symptoms, explicit negatives, and qualifications such as occasional or possible.
>
> Exclude and placement
> Physical examination findings belong in Objective. Diagnoses, clinical reasoning, and management decisions belong in Assessment and Plan.
>
> Organization and format
> Use one bullet per discussed system: - **System:** Findings.
> Group related symptoms together and document each finding once under its best-fitting system.
> Use clinical terminology when the meaning is clear; otherwise retain the patient's wording.
>
> Examples
> Illustrative only; do not copy clinical facts.
> Input: Patient reports occasional cough and denies shortness of breath. Clinician states the lungs are clear and orders a chest X-ray.
> Expected output:
> - **Respiratory:** Reports occasional cough; denies shortness of breath.
> ```
>
> **Encounter input:** Patient reports occasional cough and denies shortness of breath.
> Clinician states the lungs are clear and orders a chest X-ray.
>
> **Expected section body:**
>
> ```markdown theme={null}
> - **Respiratory:** Reports occasional cough; denies shortness of breath.
> ```
>
> The examination finding belongs in Objective; the test order belongs in
> Assessment and Plan. A separate Missing information block is unnecessary
> because the global rule already covers unsupported systems and whole sections.

## Outpatient SOAP example

The default outpatient SOAP template has seven top-level sections. The subjective components are
individual sections; Objective uses bold subsection labels within its body.
You can change the titles, order, instructions, and number of sections.

Use this template as provided or adapt it for your application. Include it in
each request; it is not applied automatically.

Download the complete SOAP template JSON

The file contains the `template` object itself; assign it to your request’s
`template` field.

> [accordion] Copy the complete template JSON
>
> ````json theme={null}
> {
>   "instructions": "### Heading hierarchy:\nALL section headings must use exactly six hash marks (######).\nWithin any section body, sub-elements that need visual labels (problem titles in Assessment & Plan, subsection labels in Objective, etc.) must use **bold text** (`**Label**`), not heading-level markdown.\nEvery heading must be followed by a blank line (double newline) before body content.\n### Missing information:\nIf an entire section has no supported content, use `Not Provided`. Omit unsupported subsections and optional details.\n---\n### Current vs Prior Information:\nThe focus of every note is the current encounter. When prior encounter information is referenced, explicitly indicate it using language such as \"Previously…\", \"At last visit…\", \"Per prior records…\". Do not blend prior and current encounter data without this explicit tagging.\n\nUse supplied facts only. Do not infer absent facts or copy clinical facts from illustrative examples.",
>   "sections": [
>     {
>       "title": "Chief Complaint",
>       "instructions": "**Purpose and sources**\nCapture the major topic(s) of the encounter — the primary reason(s) the patient is presenting today. This section functions like the title of the note, giving the reader an immediate sense of what the encounter covers.\n- Use the stated reason(s) for the encounter, whether expressed by the patient or clinician, including follow-up or preventive visits.\n**Exclude and placement**\n- Do NOT include plans, assessment details, or detailed clinician discussion.\n**Organization and format**\n- Keep entries brief — a short phrase or symptom label.\n- Use `- item` bullets, one per stated reason for the encounter.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: Patient: “I'm here for my blood pressure follow-up, and my right knee has been hurting.” Clinician: “We'll order a knee X-ray.”\nOutput:\n```text\n- Blood pressure follow-up\n- Right knee pain\n```"
>     },
>     {
>       "title": "History of Present Illness",
>       "instructions": "**Purpose and sources**\nDocument a concise, clinically focused history of the present illness based on what the patient reported.\n- Include only what the patient reports.\n**Include**\n- Chronology: Use specific timeframes when stated.\n- OLDCARTS GUIDE: Use Onset, Location, Duration, Character, Aggravating/Alleviating factors, Radiation, Timing, Severity as a guide to cover all relevant HPI details.\n- **MEDICATIONS FROM PRIOR ENCOUNTERS**: Pull through medication names and doses from prior encounter context only if those medications are discussed in the current encounter transcript. If a medication was stopped during the current encounter, note that where relevant.\n**Exclude and placement**\n- Do not include clinician observations, clinician questions, assessments, clinical reasoning, recommendations, or plans.\n- No treatment plans, future actions, or recommendations. These belong in Assessment & Plan.\n- Do not include vitals: Do not include weight, BMI, or vitals in the HPI.\n- **PROPOSED ≠ CONFIRMED**: Treatments about to start (e.g., \"She has elected to begin…\") reflect current encounter decisions, not past history — exclude from HPI.\n- Conversational, incidental, administrative, and repeated details.\n**Organization and format**\nGroup history by complaint using a bold label followed by concise bullets. Include pertinent reported details without repeating them in an introductory paragraph. Separate complaint blocks with blank lines.\nSummarize rather than quote the transcript verbatim.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: Patient: “My right knee started aching three days ago after jogging. It's 6 out of 10, worse on stairs, and better with rest. I've also had a dry cough for a week, without fever.” Clinician: “The knee is tender on examination. I'll order an X-ray.”\nOutput:\n```text\n**Right knee pain**\n\n- Aching pain began three days ago after jogging.\n- Severity 6/10; worse with stairs and improved with rest.\n\n**Cough**\n\n- Dry cough for one week.\n- Denies fever.\n```"
>     },
>     {
>       "title": "Past Medical, Family, and Social History",
>       "instructions": "**Purpose and sources**\nDocument the patient's pertinent medical, surgical, family, and social history.\n- Use relevant information from the transcript and supplied clinical context for all four history groups.\n**Include**\n- **Medical History:** Established prior or ongoing conditions pertinent to today's care.\n- **Surgical History:** The patient's procedures, including the year and surgeon's name when available.\n- **Family History:** Pertinent conditions in relatives. Identify the relative and condition when available; do not document every family member's full medical history.\n- **Social History:**\n\t- Living situation: household, housing type, and stability.\n\t- Occupation, including relevant exposures.\n\t- Substance use: tobacco, alcohol, and recreational drugs; include reported quantities or pack-years when available.\n\t- Relationships and support system.\n\t- Sexual history when relevant to the visit.\n\t- Diet and exercise.\n**Organization and format**\nUse bold labels for Medical History, Surgical History, Family History, and Social History. Separate groups with blank lines and use `- item` bullets within each group.\n- Medical: one condition per bullet.\n- Surgical: `[Procedure]: [Year if stated], [Surgeon if stated]`.\n- Family: `[Relative]: [Condition]`.\n- Social: group related details under bold labels such as Home, Employment, Substances, Relationships, Sexual History, and Diet and Exercise.\nKeep entries concise and factual.\n**Missing information**\n- Omit history groups with no supported information.\n- Omit unavailable optional details, such as a procedure's year or surgeon.\n- Omit social history domains without supported information. Include Sexual History only when relevant.\n- If the entire section has no supported content, use `Not Provided`.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: During a hypertension follow-up, supplied prior records list hypertension and an appendectomy in 2012. Patient: “My mother also has hypertension. I live with my partner, work as a teacher, and have never smoked. I have a headache today.” No surgeon, diet, exercise, or sexual history is provided.\nOutput:\n```text\n**Medical History**\n\n- Hypertension, per prior records.\n\n**Surgical History**\n\n- Appendectomy: 2012, per prior records.\n\n**Family History**\n\n- Mother: Hypertension.\n\n**Social History**\n\n- **Home:** Lives with partner.\n- **Employment:** Teacher.\n- **Substances:** Never smoked.\n```"
>     },
>     {
>       "title": "Review of Systems",
>       "instructions": "**Purpose and sources**\nSummarize patient-reported symptoms and explicit symptom denials, grouped by organ system.\n**Include**\n- Reported symptoms, explicit negatives, and relevant qualifications such as “occasional” or “possible.”\n**Exclude and placement**\n- Physical examination findings belong in Objective.\n- Diagnoses, clinical reasoning, and management decisions belong in Assessment and Plan.\n**Organization and format**\n- Use one bullet per discussed system: `- **System:** Findings.`\n- Group related symptoms together and document each finding once under its best-fitting system.\n- Use clinical terminology when the meaning is clear; otherwise retain the patient’s wording.\n**Missing information**\n- Omit systems without supported information.\n- If the entire section has no supported content, use `Not Provided`.\n**Example**\nIllustrative only; do not copy the clinical facts.\nInput: Patient reports occasional cough and denies shortness of breath.\nOutput:\n- **Respiratory:** Reports occasional cough; denies shortness of breath."
>     },
>     {
>       "title": "Allergies",
>       "instructions": "**Purpose and sources**\nDocument the patient's allergies as provided in the transcript.\n**Include**\n- Capture the allergen name AND the reaction if available.\n- Include all allergies mentioned (medications, environmental, food, etc.).\n**Organization and format**\n- Use `- item` bullet format if multiple allergies.\n- Format each entry as: `[Allergen]: [Reaction if stated]`.\n**Missing information**\nIf allergy information was not discussed in the transcript, use `Not Provided`.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: Patient: “Penicillin gives me hives. I'm also allergic to shellfish, but I don't remember the reaction.”\nOutput:\n```text\n- Penicillin: Hives.\n- Shellfish\n```"
>     },
>     {
>       "title": "Objective",
>       "instructions": "**Purpose and sources**\nDocument physical examination findings, measurements, and completed diagnostic results stated or reviewed during the encounter.\n**Include**\n- **Physical Exam Findings:** Document all relevant physical examination findings as observed and stated by the clinician.\n- **Laboratory Data:** Document completed laboratory results provided in the transcript. Be specific: if named labs are mentioned, list them by name and value. Include reference ranges or clinical interpretation only if stated by the clinician.\n- **Imaging Results:** Document completed imaging results provided in the transcript. Include modality, body region, and findings as stated.\n- **Other Diagnostic Data:** Document any other diagnostic data (e.g., ECG, spirometry, biopsy, scoring tools) as provided in the transcript.\n**Exclude and placement**\n- Place patient-reported symptoms in HPI or ROS, and assessments and management decisions in Assessment and Plan.\n- Include only provider-observed signs, not patient-reported symptoms. For other diagnostic data, apply the same symptom vs. sign distinction: only objective/provider-generated data here.\n- Do not list ordered or pending tests here; place those only in Assessment and Plan. Do not list ordered or pending imaging here; place it only in Assessment and Plan.\nCRITICAL: Distinguish carefully between symptoms (subjective — patient's experience, belongs in HPI) and signs (objective — provider-observed findings, belongs here). Example: Patient stating \"stomach pain\" is a symptom (HPI). \"Abdominal tenderness to palpation\" is a sign (Objective).\n**Organization and format**\nOrganize this section using Physical Exam Findings, Laboratory Data, Imaging Results, and Other Diagnostic Data, each labeled in **bold text**. Use `- item` bullet format within each sub-section.\nStructure physical examination findings appropriately for a clinical note (by system or body region if multiple systems examined).\n**Missing information**\nOmit any sub-section that has no transcript-supported data, with no heading or placeholder. If none of the four sub-sections have data, use `Not Provided` for the entire Objective section.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: Patient reports abdominal pain. Clinician: “There is mild epigastric tenderness on examination. Today's hemoglobin is 12.4 g/dL. We reviewed last month's abdominal ultrasound, which showed no gallstones. I'll order a CT of the abdomen.” No other diagnostic data is discussed.\nOutput:\n```text\n**Physical Exam Findings**\n\n- Abdomen: Mild epigastric tenderness.\n\n**Laboratory Data**\n\n- Hemoglobin: 12.4 g/dL today.\n\n**Imaging Results**\n\n- Prior abdominal ultrasound from last month: No gallstones.\n```"
>     },
>     {
>       "title": "Assessment and Plan",
>       "instructions": "**Purpose and sources**\nDocument the clinician’s current assessment and management decisions. Use patient history, findings, and prior records only as discussed supporting context. Write directly from the clinician’s perspective.\n**Include**\n- Problems assessed, managed, or materially affecting today’s decisions, including existing diagnoses discussed today.\n- Selected actions, contingencies, and counseling, alternatives, risks, benefits, side effects, or preferences that affected decisions or safe follow-through.\n- Medication changes, including discontinuations. Prior medication details only when discussed today.\n**Exclude and placement**\n- Omit unaddressed conditions, conversational process, reassurance, and generic statements without specifics.\n**Organization and format**\n- Use consistent labels for problems shared with HPI. Put each action once under its best-fitting problem and category; do not repeat it in Plan.\nOptional opening: 1–2 sentences only when they add information beyond the problem blocks.\nOrder problems by clinical importance. Combine related problems only when they share a plan, retaining each problem name.\nEach block: **bold problem name**, optional plain-text assessment sentence (at most one), then `- **Label**: Content` bullets. Separate these elements and problem blocks with blank lines.\nUse populated categories in this order:\n- **Plan**: Other selected actions, contingencies, and decision-relevant counseling.\n- **Tests**: Named laboratory, imaging, and other diagnostic tests ordered during the encounter; include body site and study details when supplied.\n- **Medications**: Action and name; dose, frequency, route, and duration when supplied. Includes prescriptions, OTC medications, and supplements.\n- **Lifestyle Measures**: Specific diet, exercise, or other measures discussed.\n- **Referrals**: Specialty and stated instructions.\n- **Follow Up**: Date or timeframe.\n**Missing information**\nOmit unavailable details, unsupported assessment sentences, and empty categories; no placeholder bullets. An assessment may stand alone. With no supported content, use `Not Provided` for the section.\n**Examples**\nIllustrative only; do not copy clinical facts.\nInput: Clinician: “Hypertension remains above goal. I increased losartan to 50 mg orally daily, ordered a BMP, and set follow-up in four weeks.”\nOutput:\n```text\n**Hypertension**\n\nBlood pressure remains above goal.\n\n- **Tests**: BMP ordered.\n- **Medications**: Increase losartan to 50 mg orally daily.\n- **Follow Up**: Four weeks.\n```\nInput: Patient requests a higher dose. Clinician states hypothyroidism is controlled based on reviewed TSH; no medication decision or test order is stated.\nOutput:\n```text\n**Hypothyroidism**\n\nControlled based on the reviewed TSH result.\n```"
>     }
>   ]
> }
> ````

Each section prompt below contains its rules and illustrative input/output
examples in one copyable block. Copy the entire block into that section’s
`instructions` field; both the rules and examples are sent to the model. These
blocks match the instruction strings in the downloadable JSON.

> [accordion] Global instructions
>
> ```text theme={null}
> ### Heading hierarchy:
> ALL section headings must use exactly six hash marks (######).
> Within any section body, sub-elements that need visual labels (problem titles in Assessment & Plan, subsection labels in Objective, etc.) must use **bold text** (`**Label**`), not heading-level markdown.
> Every heading must be followed by a blank line (double newline) before body content.
> ### Missing information:
> If an entire section has no supported content, use `Not Provided`. Omit unsupported subsections and optional details.
> ---
> ### Current vs Prior Information:
> The focus of every note is the current encounter. When prior encounter information is referenced, explicitly indicate it using language such as "Previously…", "At last visit…", "Per prior records…". Do not blend prior and current encounter data without this explicit tagging.
>
> Use supplied facts only. Do not infer absent facts or copy clinical facts from illustrative examples.
> ```

> [accordion] Chief Complaint
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Capture the major topic(s) of the encounter — the primary reason(s) the patient is presenting today. This section functions like the title of the note, giving the reader an immediate sense of what the encounter covers.
> - Use the stated reason(s) for the encounter, whether expressed by the patient or clinician, including follow-up or preventive visits.
> **Exclude and placement**
> - Do NOT include plans, assessment details, or detailed clinician discussion.
> **Organization and format**
> - Keep entries brief — a short phrase or symptom label.
> - Use `- item` bullets, one per stated reason for the encounter.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: Patient: “I'm here for my blood pressure follow-up, and my right knee has been hurting.” Clinician: “We'll order a knee X-ray.”
> Output:
> ```text
> - Blood pressure follow-up
> - Right knee pain
> ```
> ````

> [accordion] History of Present Illness
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Document a concise, clinically focused history of the present illness based on what the patient reported.
> - Include only what the patient reports.
> **Include**
> - Chronology: Use specific timeframes when stated.
> - OLDCARTS GUIDE: Use Onset, Location, Duration, Character, Aggravating/Alleviating factors, Radiation, Timing, Severity as a guide to cover all relevant HPI details.
> - **MEDICATIONS FROM PRIOR ENCOUNTERS**: Pull through medication names and doses from prior encounter context only if those medications are discussed in the current encounter transcript. If a medication was stopped during the current encounter, note that where relevant.
> **Exclude and placement**
> - Do not include clinician observations, clinician questions, assessments, clinical reasoning, recommendations, or plans.
> - No treatment plans, future actions, or recommendations. These belong in Assessment & Plan.
> - Do not include vitals: Do not include weight, BMI, or vitals in the HPI.
> - **PROPOSED ≠ CONFIRMED**: Treatments about to start (e.g., "She has elected to begin…") reflect current encounter decisions, not past history — exclude from HPI.
> - Conversational, incidental, administrative, and repeated details.
> **Organization and format**
> Group history by complaint using a bold label followed by concise bullets. Include pertinent reported details without repeating them in an introductory paragraph. Separate complaint blocks with blank lines.
> Summarize rather than quote the transcript verbatim.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: Patient: “My right knee started aching three days ago after jogging. It's 6 out of 10, worse on stairs, and better with rest. I've also had a dry cough for a week, without fever.” Clinician: “The knee is tender on examination. I'll order an X-ray.”
> Output:
> ```text
> **Right knee pain**
>
> - Aching pain began three days ago after jogging.
> - Severity 6/10; worse with stairs and improved with rest.
>
> **Cough**
>
> - Dry cough for one week.
> - Denies fever.
> ```
> ````

> [accordion] Past Medical, Family, and Social History
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Document the patient's pertinent medical, surgical, family, and social history.
> - Use relevant information from the transcript and supplied clinical context for all four history groups.
> **Include**
> - **Medical History:** Established prior or ongoing conditions pertinent to today's care.
> - **Surgical History:** The patient's procedures, including the year and surgeon's name when available.
> - **Family History:** Pertinent conditions in relatives. Identify the relative and condition when available; do not document every family member's full medical history.
> - **Social History:**
> 	- Living situation: household, housing type, and stability.
> 	- Occupation, including relevant exposures.
> 	- Substance use: tobacco, alcohol, and recreational drugs; include reported quantities or pack-years when available.
> 	- Relationships and support system.
> 	- Sexual history when relevant to the visit.
> 	- Diet and exercise.
> **Organization and format**
> Use bold labels for Medical History, Surgical History, Family History, and Social History. Separate groups with blank lines and use `- item` bullets within each group.
> - Medical: one condition per bullet.
> - Surgical: `[Procedure]: [Year if stated], [Surgeon if stated]`.
> - Family: `[Relative]: [Condition]`.
> - Social: group related details under bold labels such as Home, Employment, Substances, Relationships, Sexual History, and Diet and Exercise.
> Keep entries concise and factual.
> **Missing information**
> - Omit history groups with no supported information.
> - Omit unavailable optional details, such as a procedure's year or surgeon.
> - Omit social history domains without supported information. Include Sexual History only when relevant.
> - If the entire section has no supported content, use `Not Provided`.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: During a hypertension follow-up, supplied prior records list hypertension and an appendectomy in 2012. Patient: “My mother also has hypertension. I live with my partner, work as a teacher, and have never smoked. I have a headache today.” No surgeon, diet, exercise, or sexual history is provided.
> Output:
> ```text
> **Medical History**
>
> - Hypertension, per prior records.
>
> **Surgical History**
>
> - Appendectomy: 2012, per prior records.
>
> **Family History**
>
> - Mother: Hypertension.
>
> **Social History**
>
> - **Home:** Lives with partner.
> - **Employment:** Teacher.
> - **Substances:** Never smoked.
> ```
> ````

> [accordion] Review of Systems
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ```text theme={null}
> **Purpose and sources**
> Summarize patient-reported symptoms and explicit symptom denials, grouped by organ system.
> **Include**
> - Reported symptoms, explicit negatives, and relevant qualifications such as “occasional” or “possible.”
> **Exclude and placement**
> - Physical examination findings belong in Objective.
> - Diagnoses, clinical reasoning, and management decisions belong in Assessment and Plan.
> **Organization and format**
> - Use one bullet per discussed system: `- **System:** Findings.`
> - Group related symptoms together and document each finding once under its best-fitting system.
> - Use clinical terminology when the meaning is clear; otherwise retain the patient’s wording.
> **Missing information**
> - Omit systems without supported information.
> - If the entire section has no supported content, use `Not Provided`.
> **Example**
> Illustrative only; do not copy the clinical facts.
> Input: Patient reports occasional cough and denies shortness of breath.
> Output:
> - **Respiratory:** Reports occasional cough; denies shortness of breath.
> ```

> [accordion] Allergies
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Document the patient's allergies as provided in the transcript.
> **Include**
> - Capture the allergen name AND the reaction if available.
> - Include all allergies mentioned (medications, environmental, food, etc.).
> **Organization and format**
> - Use `- item` bullet format if multiple allergies.
> - Format each entry as: `[Allergen]: [Reaction if stated]`.
> **Missing information**
> If allergy information was not discussed in the transcript, use `Not Provided`.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: Patient: “Penicillin gives me hives. I'm also allergic to shellfish, but I don't remember the reaction.”
> Output:
> ```text
> - Penicillin: Hives.
> - Shellfish
> ```
> ````

> [accordion] Objective
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Document physical examination findings, measurements, and completed diagnostic results stated or reviewed during the encounter.
> **Include**
> - **Physical Exam Findings:** Document all relevant physical examination findings as observed and stated by the clinician.
> - **Laboratory Data:** Document completed laboratory results provided in the transcript. Be specific: if named labs are mentioned, list them by name and value. Include reference ranges or clinical interpretation only if stated by the clinician.
> - **Imaging Results:** Document completed imaging results provided in the transcript. Include modality, body region, and findings as stated.
> - **Other Diagnostic Data:** Document any other diagnostic data (e.g., ECG, spirometry, biopsy, scoring tools) as provided in the transcript.
> **Exclude and placement**
> - Place patient-reported symptoms in HPI or ROS, and assessments and management decisions in Assessment and Plan.
> - Include only provider-observed signs, not patient-reported symptoms. For other diagnostic data, apply the same symptom vs. sign distinction: only objective/provider-generated data here.
> - Do not list ordered or pending tests here; place those only in Assessment and Plan. Do not list ordered or pending imaging here; place it only in Assessment and Plan.
> CRITICAL: Distinguish carefully between symptoms (subjective — patient's experience, belongs in HPI) and signs (objective — provider-observed findings, belongs here). Example: Patient stating "stomach pain" is a symptom (HPI). "Abdominal tenderness to palpation" is a sign (Objective).
> **Organization and format**
> Organize this section using Physical Exam Findings, Laboratory Data, Imaging Results, and Other Diagnostic Data, each labeled in **bold text**. Use `- item` bullet format within each sub-section.
> Structure physical examination findings appropriately for a clinical note (by system or body region if multiple systems examined).
> **Missing information**
> Omit any sub-section that has no transcript-supported data, with no heading or placeholder. If none of the four sub-sections have data, use `Not Provided` for the entire Objective section.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: Patient reports abdominal pain. Clinician: “There is mild epigastric tenderness on examination. Today's hemoglobin is 12.4 g/dL. We reviewed last month's abdominal ultrasound, which showed no gallstones. I'll order a CT of the abdomen.” No other diagnostic data is discussed.
> Output:
> ```text
> **Physical Exam Findings**
>
> - Abdomen: Mild epigastric tenderness.
>
> **Laboratory Data**
>
> - Hemoglobin: 12.4 g/dL today.
>
> **Imaging Results**
>
> - Prior abdominal ultrasound from last month: No gallstones.
> ```
> ````

> [accordion] Assessment and Plan
>
> **Section prompt**
>
> Copy this entire block, including the examples, into this section’s `instructions` field.
>
> ````text theme={null}
> **Purpose and sources**
> Document the clinician’s current assessment and management decisions. Use patient history, findings, and prior records only as discussed supporting context. Write directly from the clinician’s perspective.
> **Include**
> - Problems assessed, managed, or materially affecting today’s decisions, including existing diagnoses discussed today.
> - Selected actions, contingencies, and counseling, alternatives, risks, benefits, side effects, or preferences that affected decisions or safe follow-through.
> - Medication changes, including discontinuations. Prior medication details only when discussed today.
> **Exclude and placement**
> - Omit unaddressed conditions, conversational process, reassurance, and generic statements without specifics.
> **Organization and format**
> - Use consistent labels for problems shared with HPI. Put each action once under its best-fitting problem and category; do not repeat it in Plan.
> Optional opening: 1–2 sentences only when they add information beyond the problem blocks.
> Order problems by clinical importance. Combine related problems only when they share a plan, retaining each problem name.
> Each block: **bold problem name**, optional plain-text assessment sentence (at most one), then `- **Label**: Content` bullets. Separate these elements and problem blocks with blank lines.
> Use populated categories in this order:
> - **Plan**: Other selected actions, contingencies, and decision-relevant counseling.
> - **Tests**: Named laboratory, imaging, and other diagnostic tests ordered during the encounter; include body site and study details when supplied.
> - **Medications**: Action and name; dose, frequency, route, and duration when supplied. Includes prescriptions, OTC medications, and supplements.
> - **Lifestyle Measures**: Specific diet, exercise, or other measures discussed.
> - **Referrals**: Specialty and stated instructions.
> - **Follow Up**: Date or timeframe.
> **Missing information**
> Omit unavailable details, unsupported assessment sentences, and empty categories; no placeholder bullets. An assessment may stand alone. With no supported content, use `Not Provided` for the section.
> **Examples**
> Illustrative only; do not copy clinical facts.
> Input: Clinician: “Hypertension remains above goal. I increased losartan to 50 mg orally daily, ordered a BMP, and set follow-up in four weeks.”
> Output:
> ```text
> **Hypertension**
>
> Blood pressure remains above goal.
>
> - **Tests**: BMP ordered.
> - **Medications**: Increase losartan to 50 mg orally daily.
> - **Follow Up**: Four weeks.
> ```
> Input: Patient requests a higher dose. Clinician states hypothyroidism is controlled based on reviewed TSH; no medication decision or test order is stated.
> Output:
> ```text
> **Hypothyroidism**
>
> Controlled based on the reviewed TSH result.
> ```
> ````

## Customize your template

Maintain separate templates by specialty, encounter type, or clinician in your
application. Select a template, combine any global or section-specific
customizations, and send the final `template` object with the transcript.

Put shared behavior in global instructions and local content or formatting
rules in the relevant section. Keep customizations consistent with the base
template; explicitly revise a conflicting rule instead of appending its opposite.

> [accordion] Additional history sections
>
> Surgical history, screening history, and other additional history sections can be added within an existing PFSH section or as standalone sections.
>
> **Example instruction**
>
> > “Within PFSH, include a bold Screening History label for screening dates and results discussed during the encounter.” If screening needs its own top-level section, add a separate entry to `template.sections`.

> [accordion] Missing data formatting
>
> If an entire section has no supported content, use `Not Provided`. Omit unsupported subsections and optional details. Do not turn missing information into a negative finding.
>
> **Example**
>
> > No allergy information → `Not Provided`; no imaging results → omit the Imaging Results subsection from Objective.

> [accordion] Rendering instructions
>
> * Use `- item` bullet syntax for all lists. Plain text items on separate lines may collapse, depending on the renderer.
> * Headings (`######`) must be followed by a blank line before body content.
> * Use double newlines (`\n\n`) between content blocks.
> * Use `Not Provided` for an unsupported whole section and omit unsupported subsections.
> * Sub-element labels use **bold text** (`**Label**`), never heading-level Markdown in this SOAP example.
>
> **Example section body**
>
> ```markdown theme={null}
> **Physical Exam Findings**
>
> - Abdomen: Mild epigastric tenderness.
> ```

> [accordion] Cross-section boundaries and rules
>
> Rules that specifically mention other sections. For example, a rule may reinforce that patient-reported history belongs in HPI, while examination findings belong in Objective and management decisions belong in Assessment and Plan.
>
> **Example instruction**
>
> > “A patient reporting abdominal pain belongs in HPI or ROS; clinician-observed tenderness belongs in Objective. Keep an ordered abdominal CT in Assessment and Plan.”

> [accordion] Organization-specific rules
>
> Any rules or instructions related to an organization's requirements or preferences for note formatting or content.
>
> **Example instruction**
>
> > “In PFSH, place occupational exposures under a bold Employment label when discussed.”

> [accordion] Formatting for writing custom fields
>
> Instructions relating to specific formatting, such as Markdown formatting, which helps distinguish sections, subsections, and important values. Consistent labels can help when mapping generated note text to custom fields later; labels do not create structured API fields by themselves.
>
> **Example instruction**
>
> > “Within Assessment and Plan, use a Medications label and include the medication action, name, and stated details in each bullet.” Specify the corresponding target fields separately in the extraction schema.

> [accordion] Style and personalization
>
> Rules defining writing preferences such as:
>
> * Using bullet points versus paragraphs.
> * Preferences regarding prose, such as avoiding repeated “Patient reports…” phrasing in HPI.
> * Using concise clinical language versus retaining the patient's own wording when needed to preserve meaning.
>
> **Example instruction**
>
> > “Use concise HPI bullets without repeating ‘Patient reports’ in every entry; retain uncertain wording such as ‘possibly’ when stated.”

> [accordion] Drop-in custom variable placement
>
> Substitute variables in your application before sending the request. The API
> receives the resulting instruction strings; it does not resolve application variables.
>
> Use your own string assembly or render a Handlebars template in your application:
>
> ```javascript theme={null}
> const patient = { name: "Example Patient", dateOfBirth: "1980-01-01" };
>
> const patientDetails = [
>   `Patient name: ${patient.name}`,
>   `Patient DOB: ${patient.dateOfBirth}`,
> ].join("\n");
>
> const template = {
>   instructions: `Use supplied facts only.\n\n${patientDetails}`,
>   sections: [
>     {
>       title: "History of Present Illness",
>       instructions: "Summarize patient-reported symptoms and their chronology.",
>     },
>   ],
> };
> ```
>
> You can also supply patient information through
> [clinical context](https://docs.sully.ai/note-generation-v3.md#request-fields) when appropriate.

## Assemble and send the template

Store long instructions in readable Markdown or plain-text files. File headings
are authoring labels; the API receives strings and does not read local files
or interpret file boundaries.

> [tab] From the SOAP JSON
>
> Save the downloadable template as `templates/outpatient-soap.json`. For example:
>
> ```javascript theme={null}
> import { readFile } from "node:fs/promises";
>
> const transcript = "Clinician: What brings you in today? Patient: A dry cough for three days.";
> const template = JSON.parse(
>   await readFile("./templates/outpatient-soap.json", "utf8"),
> );
>
> const request = { transcript, template };
> ```

> [tab] From instruction files
>
> If `global.md` contains global instructions and `ros.md` contains the ROS
> instructions above, assemble them like this:
>
> ```javascript theme={null}
> import { readFile } from "node:fs/promises";
>
> const transcript = "Patient reports occasional cough and denies shortness of breath.";
> const template = {
>   instructions: await readFile("./templates/global.md", "utf8"),
>   sections: [
>     {
>       title: "Review of Systems",
>       instructions: await readFile("./templates/ros.md", "utf8"),
>     },
>   ],
> };
>
> const request = { transcript, template };
> ```
>
> This example assembles one section. Add other sections in the order you want
> them to appear. If you store all instructions in one Markdown file, split it
> into the global string and flat section objects before sending.

Send `request` as the JSON body of `POST /v3/notes` using the
[authenticated SDK or curl examples](https://docs.sully.ai/note-generation-v3.md#generate-a-note).

## Test and refine

* Use representative encounters to check content selection, missing-information behavior, and formatting.
* Compare generated notes with the source transcript and supplied context to check for unsupported facts and incorrect placement.
* Include illustrative input and expected output in your instructions; explicitly say that their clinical facts must not be copied.
* Turn recurring unwanted behavior into a specific rule or example, then rerun the same encounters to check the change.
* Review global and section rules together for conflicts, especially after adding clinician or organization preferences.

## Map the note to custom fields

To populate EHR fields, send the generated `note` string as `text` to
`POST /v1/utils/text-to-json` with a JSON Schema defining the desired fields.
See [Generate a note, then structure it](https://docs.sully.ai/text-to-json.md#generate-a-note-then-structure-it)
for the two-request workflow.

Consistent section headings and labels can help extraction identify content.
For example, a Medications label in Assessment and Plan can help locate
medication actions and stated details. Define the target fields separately in
the extraction schema.

Template instructions are not automatically passed to Text to JSON. Markdown
labels organize the note; they do not create structured API fields.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.