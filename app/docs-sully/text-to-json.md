> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Text to JSON

Text to JSON extracts facts or maps Markdown sections into a JSON structure you
define. Send plain text, a transcript, or an existing note with a JSON Schema to
`POST /v1/utils/text-to-json`. The endpoint returns schema-validated `data` in one
synchronous response.

You choose the fields and sections. Extraction instructions restrict the output
to information explicitly present in the source.

## SDK

Use the SDK's authenticated request method:

```ts TypeScript theme={null}
import SullyAI from "@sullyai/sullyai";

type ExtractionResponse = {
  data: { pulse: number; carePreferences: string };
};

const client = new SullyAI({
  apiKey: process.env.SULLY_API_KEY,
  accountID: process.env.SULLY_ACCOUNT_ID,
  baseURL: process.env.SULLY_API_BASE_URL,
});

const result = await client.post<ExtractionResponse>("/v1/utils/text-to-json", {
  body: {
    text: "Pulse is 72 bpm. The patient prefers video follow-up appointments.",
    schema: {
      type: "object",
      properties: {
        pulse: { type: "integer", description: "Pulse in beats per minute." },
        carePreferences: { type: "string" },
      },
      required: ["pulse", "carePreferences"],
      additionalProperties: false,
    },
  },
  timeout: 300_000,
  maxRetries: 0,
});

console.log(result.data);
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
    "/v1/utils/text-to-json",
    cast_to=httpx.Response,
    body={
        "text": "Pulse is 72 bpm. The patient prefers video follow-up appointments.",
        "schema": {
            "type": "object",
            "properties": {
                "pulse": {
                    "type": "integer",
                    "description": "Pulse in beats per minute.",
                },
                "carePreferences": {"type": "string"},
            },
            "required": ["pulse", "carePreferences"],
            "additionalProperties": False,
        },
    },
    options={"timeout": 300.0, "max_retries": 0},
)

print(response.json()["data"])
```

## Extract structured data

```bash theme={null}
curl "$SULLY_API_BASE_URL/v1/utils/text-to-json" \
  --request POST \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "text": "Pulse is 72 bpm. The patient prefers video follow-up appointments.",
    "schema": {
      "type": "object",
      "properties": {
        "pulse": {"type": "integer", "description": "Pulse in beats per minute."},
        "carePreferences": {"type": "string"}
      },
      "required": ["pulse", "carePreferences"],
      "additionalProperties": false
    }
  }'
```

A successful request returns `200` with extracted values, for example:

```json theme={null}
{
  "data": {
    "pulse": 72,
    "carePreferences": "Prefers video follow-up appointments."
  }
}
```

Persist `data` if you need it later; there is no resource to poll or retrieve.

## Map Markdown sections to JSON

To return whole sections as strings, describe what to copy in each property's
`description`:

```json theme={null}
{
  "text": "## HPI\nPatient reports cough for three days.\n\n## Plan\n- Rest\n- Follow up in one week",
  "schema": {
    "type": "object",
    "properties": {
      "hpi": {
        "type": "string",
        "description": "Copy the HPI section body verbatim, preserving Markdown. Exclude the section heading."
      },
      "plan": {
        "type": "string",
        "description": "Copy the Plan section body verbatim, preserving Markdown. Exclude the section heading."
      }
    },
    "required": ["hpi", "plan"],
    "additionalProperties": false
  }
}
```

An example response is:

```json theme={null}
{
  "data": {
    "hpi": "Patient reports cough for three days.",
    "plan": "- Rest\n- Follow up in one week"
  }
}
```

Mapping is model-based: requesting verbatim copying does not guarantee exact
character preservation. Use a deterministic parser when that is required.

## Combine section mapping and extraction

Use the same schema to copy section bodies and extract typed facts. This request
keeps the HPI and Plan as strings while extracting pulse into a nested object:

```json theme={null}
{
  "text": "## HPI\nPatient reports cough for three days.\n\n## Vitals\nPulse: 72 bpm.\n\n## Plan\n- Rest\n- Follow up in one week",
  "schema": {
    "type": "object",
    "properties": {
      "hpi": {
        "type": "string",
        "description": "Copy the HPI section body verbatim, preserving Markdown. Exclude the section heading."
      },
      "plan": {
        "type": "string",
        "description": "Copy the Plan section body verbatim, preserving Markdown. Exclude the section heading."
      },
      "vitals": {
        "type": "object",
        "properties": {
          "pulse": {"type": "integer", "description": "Pulse in beats per minute."}
        },
        "required": ["pulse"],
        "additionalProperties": false
      }
    },
    "required": ["hpi", "plan", "vitals"],
    "additionalProperties": false
  }
}
```

An example response is:

```json theme={null}
{
  "data": {
    "hpi": "Patient reports cough for three days.",
    "plan": "- Rest\n- Follow up in one week",
    "vitals": {"pulse": 72}
  }
}
```

## Generate a note, then structure it

First call [note generation](https://docs.sully.ai/note-generation-v3.md), then pass the returned
`note` string as `text` to Text to JSON. The inline template below requests HPI
and Vitals sections; the extraction schema copies the HPI and extracts pulse.

Using the `client` created in the SDK example above:

```ts TypeScript theme={null}
const generated = await client.post<{ requestId: string; note: string }>(
  "/v3/notes",
  {
    body: {
      transcript: "Patient: I have had a dry cough for three days. Clinician: Your pulse is 72 beats per minute.",
      template: {
        sections: [
          { title: "HPI", instructions: "Summarize the reported symptoms and duration." },
          { title: "Vitals", instructions: "Include only explicitly stated vital signs." },
        ],
      },
    },
    timeout: 300_000,
    maxRetries: 0,
  },
);

const structured = await client.post<{
  data: { hpi: string; pulse: number | null };
}>("/v1/utils/text-to-json", {
  body: {
    text: generated.note,
    schema: {
      type: "object",
      properties: {
        hpi: {
          type: "string",
          description: "Copy the HPI section body verbatim, preserving Markdown. Exclude the section heading.",
        },
        pulse: {
          type: ["integer", "null"],
          description: "Pulse in beats per minute. Return null if absent from the note.",
        },
      },
      required: ["hpi", "pulse"],
      additionalProperties: false,
    },
  },
  timeout: 300_000,
  maxRetries: 0,
});

console.log(structured.data);
```

```python Python theme={null}
import httpx

generated = client.post(
    "/v3/notes",
    cast_to=httpx.Response,
    body={
        "transcript": "Patient: I have had a dry cough for three days. Clinician: Your pulse is 72 beats per minute.",
        "template": {
            "sections": [
                {"title": "HPI", "instructions": "Summarize the reported symptoms and duration."},
                {"title": "Vitals", "instructions": "Include only explicitly stated vital signs."},
            ]
        },
    },
    options={"timeout": 300.0, "max_retries": 0},
).json()

structured = client.post(
    "/v1/utils/text-to-json",
    cast_to=httpx.Response,
    body={
        "text": generated["note"],
        "schema": {
            "type": "object",
            "properties": {
                "hpi": {
                    "type": "string",
                    "description": "Copy the HPI section body verbatim, preserving Markdown. Exclude the section heading.",
                },
                "pulse": {
                    "type": ["integer", "null"],
                    "description": "Pulse in beats per minute. Return null if absent from the note.",
                },
            },
            "required": ["hpi", "pulse"],
            "additionalProperties": False,
        },
    },
    options={"timeout": 300.0, "max_retries": 0},
).json()

print(structured["data"])
```

For a generated HPI of "The patient reports a dry cough for three days." and
pulse of 72 bpm, the second response would contain:

```json theme={null}
{
  "data": {
    "hpi": "The patient reports a dry cough for three days.",
    "pulse": 72
  }
}
```

The HPI text depends on the generated note. The second call extracts from that
note, rather than directly from the original transcript. Generation and
extraction are separate requests and, for billing-enabled accounts, separately
billable operations.

## Define the output schema

JSON Schema supports nested objects, arrays, strings, numbers, integers, booleans,
and nullable values. Use property `description` values for extraction guidance,
section names, units, or copying requirements.

* List fields that must appear in `required`.
* Use `additionalProperties: false` to reject fields outside the schema.
* Allow `null` for missing values, for example `"type": ["integer", "null"]`.
  Extraction instructions request `null` for missing optional fields.
* Allow empty arrays to represent no supplied items.

Sully selects models and handles provider fallback; there are no `model`,
`provider`, or separate custom-instructions parameters. Schema validation checks
structure and types, not factual fidelity or clinical correctness.

## Request fields

| Field | Type | Required | Limits |
| - | - | -: | - |
| `text` | string | Yes | Nonempty; maximum 50,000 characters. |
| `schema` | object | Yes | Valid JSON Schema; maximum 50,000 characters after JSON serialization. |

The schema document's JSON nesting depth, including objects and arrays, must not
exceed 10. This measures the schema document itself, not the requested result.

## Errors and retries

Invalid schemas return `error: "Provided schema is not a valid JSON Schema."`
with a `details` array. Extraction failures return
`{"error": "Extraction failed", "message": "..."}`; billing errors use an
`error` field containing the error name.

| Status | Meaning | What to do |
| - | - | - |
| `400` | Invalid request, schema, or size/depth limit | Correct the input; do not retry unchanged. |
| `401` | Missing or invalid credentials | Verify both authentication headers. |
| `402` | `insufficient_credits` | Add credits before retrying. |
| `409` | `billing_conflict` | Contact support with `x-request-id` if it persists. |
| `500` | Extraction, schema compilation, or completion failed | Check the schema and source text; retry only if safe to repeat. |
| `503` | `billing_provider_unavailable` | Honor `Retry-After` when present before retrying. |

For billing-enabled accounts, each successful extraction counts as one
`text_to_json_request` at your account's configured rate, regardless of internal
retries or fallback. Validation and extraction failures do not count as successful
usage.

Billing completes before the success response is sent, so a lost response may
still be billable. Each POST starts a new operation with no public idempotency
key; retrying can incur another charge. The SDK examples disable automatic
retries for this reason. Retain `x-request-id` for support.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.