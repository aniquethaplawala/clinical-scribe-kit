> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Note generation

Note generation turns a transcript into a clinical note in one synchronous
request. Every request requires a caller-supplied inline template. Structured
clinical context is optional.

Use this API when the caller can wait for generation to complete and wants the
note in the create response.

> [!NOTE]
>
> **For legacy customers only:** [Note Generation v2](https://docs.sully.ai/note-generation-v2) brings
> newer model capabilities while preserving backward compatibility with existing
> Note Generation v1 systems. Use Note Generation v3 (shown here) for new integrations.

## Medical coding

A standalone Medical Coding API for ICD-10 and CPT is coming soon. It will bring
even higher coding accuracy and suggestions for missing documentation.

Until then, legacy customers who expect coding with their notes, as in Note
Generation v1, should use [Note Generation v2](https://docs.sully.ai/note-generation-v2), a drop-in
replacement for Note Generation v1.

## SDK

Use the SDK's authenticated request method. Include `template` in every request:

```ts TypeScript theme={null}
import SullyAI from "@sullyai/sullyai";

type GenerateNoteResponse = {
  requestId: string;
  note: string;
  usage?: { inputTokens: number; outputTokens: number };
};

const client = new SullyAI({
  apiKey: process.env.SULLY_API_KEY,
  accountID: process.env.SULLY_ACCOUNT_ID,
  baseURL: process.env.SULLY_API_BASE_URL,
});

const result = await client.post<GenerateNoteResponse>("/v3/notes", {
  body: {
    transcript:
      "Clinician: What brings you in today? Patient: I have had a dry cough for three days.",
    template: {
      instructions: "Use concise clinical language and do not infer absent facts.",
      sections: [
        {
          title: "History of Present Illness",
          instructions: "Summarize symptoms, onset, severity, and relevant negatives.",
        },
        {
          title: "Assessment and Plan",
          instructions: "Separate each assessed problem and its plan.",
        },
      ],
    },
    clinicalContext: {
      patient: {
        name: "Example Patient",
        age: 46,
        gender: "female",
      },
    },
  },
  timeout: 300_000,
  maxRetries: 0,
});

console.log(result.requestId, result.note);
```

```python Python theme={null}
import os

import httpx
from sullyai import SullyAI

client = SullyAI(
    api_key=os.environ["SULLY_API_KEY"],
    account_id=os.environ["SULLY_ACCOUNT_ID"],
    base_url=os.environ["SULLY_API_BASE_URL"],
)

response = client.post(
    "/v3/notes",
    cast_to=httpx.Response,
    body={
        "transcript": (
            "Clinician: What brings you in today? "
            "Patient: I have had a dry cough for three days."
        ),
        "template": {
            "instructions": "Use concise clinical language and do not infer absent facts.",
            "sections": [
                {
                    "title": "History of Present Illness",
                    "instructions": "Summarize symptoms, onset, severity, and relevant negatives.",
                },
                {
                    "title": "Assessment and Plan",
                    "instructions": "Separate each assessed problem and its plan.",
                },
            ],
        },
        "clinicalContext": {
            "patient": {
                "name": "Example Patient",
                "age": 46,
                "gender": "female",
            }
        },
    },
    options={"timeout": 300.0, "max_retries": 0},
)
result = response.json()

print(result["requestId"], result["note"])
```

## Generate a note

```bash theme={null}
curl "$SULLY_API_BASE_URL/v3/notes" \
  --request POST \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "transcript": "Clinician: What brings you in today? Patient: I have had a dry cough for three days.",
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
    },
    "clinicalContext": {
      "patient": {
        "name": "Example Patient",
        "age": 46,
        "gender": "female"
      },
      "medications": [
        {"name": "Example medication", "description": "once daily"}
      ],
      "contextItems": [
        {"label": "Visit type", "content": "Outpatient follow-up"}
      ]
    }
  }'
```

A successful response contains the finished note:

```json theme={null}
{
  "requestId": "req_...",
  "note": "# History of Present Illness\nThe patient reports a dry cough for three days.\n...",
  "usage": {
    "inputTokens": 1450,
    "outputTokens": 320
  }
}
```

The `note` value is a rendered string. To extract discrete fields or map its
sections into your own JSON structure, send that string and a JSON Schema to
[Text to JSON](https://docs.sully.ai/text-to-json.md#generate-a-note-then-structure-it). The two-call
example shows both requests. This is a separate request.

`usage` is diagnostic and may be omitted. `requestId` is also returned in the
`x-request-id` response header; retain it for support.

## Provide a template

Include an inline `template` in every request to define the note's sections and
instructions. Choose how to set up your template:

[Interactive setup
Download the Sully template skill and paste it into your coding agent.
Download skill ](https://docs.sully.ai/assets/sully-note-template-builder.zip)

[Manual setup
Start with the default SOAP template and follow the guide to customize your instructions.
View template guide ](https://docs.sully.ai/note-generation-custom-templates.md)

For example:

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

Omitting `template` returns `400 invalid_request`.

The required `template` field has this structure:

```ts theme={null}
type InlineTemplate = {
  instructions?: string;
  sections: Array<{
    title: string;
    instructions: string;
  }>;
};
```

The field limits are listed below.

## Request fields

| Field | Type | Required | Limits |
| - | - | -: | - |
| `transcript` | string | Yes | Nonblank; maximum 100,000 characters. |
| `template` | object | Yes | Inline sections and optional global instructions. |
| `template.instructions` | string | No | Maximum 10,000 characters. |
| `template.sections` | array | Yes | 1–50 sections with unique titles. |
| `template.sections[].title` | string | Yes | Nonblank; maximum 200 characters. |
| `template.sections[].instructions` | string | Yes | Maximum 10,000 characters. |
| `clinicalContext.patient` | object | No | Optional `name`, integer `age` from 0–150, and `gender`. |
| `clinicalContext.medications` | array | No | Up to 100 `{name, description}` items. |
| `clinicalContext.pastVisits` | array | No | Up to 100 `{date, content}` items. |
| `clinicalContext.contextItems` | array | No | Up to 100 `{label, content}` items. |

The total text in the inline template and clinical context may not exceed 100,000
characters. Unknown fields are rejected so request mistakes fail visibly.

## Errors and retries

Errors use a stable code and request ID:

```json theme={null}
{
  "code": "invalid_request",
  "message": "The request is invalid.",
  "requestId": "req_..."
}
```

| Status | Code | What to do |
| - | - | - |
| `400` | `invalid_request` | Correct the body; do not retry unchanged. |
| `401` | `unauthorized` | Verify the account ID and API key. |
| `402` | `insufficient_credits` | Add credits before retrying. |
| `404` | `endpoint_disabled` | Verify that the endpoint is enabled for your account. |
| `502` | `generation_failed`, `invalid_generation_response` | Retry with backoff if the operation is safe to repeat. |
| `503` | `generation_unavailable`, `billing_unavailable` | Honor `Retry-After` when present and retry with backoff. |
| `504` | `generation_timeout` | Retry with backoff if the operation is safe to repeat. |

Each POST is a new generation request. If the client disconnects after the request
has completed on the server, the response can be lost and a retry can create another
billable generation. Use the returned `requestId` to investigate ambiguous outcomes.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.