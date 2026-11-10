> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK reference

The Sully SDKs provide authenticated clients for note generation, text extraction, and
transcription. Sully M1 uses the OpenAI SDK instead.

## Install

```bash TypeScript theme={null}
npm install @sullyai/sullyai
```

```bash Python theme={null}
pip install --pre sullyai
```

## Create a client

```ts TypeScript theme={null}
import SullyAI from "@sullyai/sullyai";

const client = new SullyAI({
  apiKey: process.env.SULLY_API_KEY,
  accountID: process.env.SULLY_ACCOUNT_ID,
  baseURL: process.env.SULLY_API_BASE_URL,
});
```

```python Python theme={null}
import os

from sullyai import SullyAI

client = SullyAI(
    api_key=os.environ["SULLY_API_KEY"],
    account_id=os.environ["SULLY_ACCOUNT_ID"],
    base_url=os.environ["SULLY_API_BASE_URL"],
)
```

| TypeScript | Python | Description |
| - | - | - |
| `apiKey` | `api_key` | API key created in the Sully dashboard. |
| `accountID` | `account_id` | Account ID from the Sully dashboard. |
| `baseURL` | `base_url` | API origin, `https://api.sully.ai`. |

## Request methods

The clients add the Sully authentication headers and parse successful JSON
responses. The public guides use these methods:

| TypeScript | Python | Use |
| - | - | - |
| `client.get<T>(path, options)` | `client.get(path, cast_to=..., options=...)` | Retrieve a resource. |
| `client.post<T>(path, options)` | `client.post(path, cast_to=..., body=..., options=...)` | Create a resource or start an operation. |
| `client.delete<T>(path, options)` | `client.delete(path, cast_to=..., options=...)` | Delete a resource. |

TypeScript returns parsed JSON. Python requires `cast_to`; use `httpx.Response`
when you want to read the response with `.json()`:

```ts TypeScript theme={null}
type GenerateNoteResponse = {
  requestId: string;
  note: string;
};

const result = await client.post<GenerateNoteResponse>("/v3/notes", {
  body: {
    transcript: "Fictional encounter transcript...",
    template: {
      sections: [
        { title: "HPI", instructions: "Summarize the reported symptoms and timeline." },
        { title: "Assessment and Plan", instructions: "Document the stated assessment and plan." },
      ],
    },
  },
  timeout: 300_000,
  maxRetries: 0,
});

console.log(result.note);
```

```python Python theme={null}
import httpx

response = client.post(
    "/v3/notes",
    cast_to=httpx.Response,
    body={
        "transcript": "Fictional encounter transcript...",
        "template": {
            "sections": [
                {"title": "HPI", "instructions": "Summarize the reported symptoms and timeline."},
                {"title": "Assessment and Plan", "instructions": "Document the stated assessment and plan."},
            ]
        },
    },
    options={"timeout": 300.0, "max_retries": 0},
)

print(response.json()["note"])
```

Note generation requires an inline `template` on every request. See the
[template example and schema](https://docs.sully.ai/note-generation-v3.md#provide-a-template).

For multipart requests, pass a `FormData` body in TypeScript. In Python, pass
form fields with `body`, the upload with `files`, and a multipart content type:

```ts TypeScript theme={null}
import { readFile } from "node:fs/promises";

const form = new FormData();
form.append(
  "audio",
  new Blob([new Uint8Array(await readFile("./visit.mp3"))], {
    type: "audio/mpeg",
  }),
  "visit.mp3",
);
form.append("language", "en");

const transcription = await client.post("/v2/audio/transcriptions", {
  body: form,
  timeout: 300_000,
  maxRetries: 0,
});
```

```python Python theme={null}
import httpx

with open("./visit.mp3", "rb") as audio:
    response = client.post(
        "/v2/audio/transcriptions",
        cast_to=httpx.Response,
        body={"language": "en"},
        files={"audio": ("visit.mp3", audio, "audio/mpeg")},
        options={
            "headers": {"Content-Type": "multipart/form-data"},
            "timeout": 300.0,
            "max_retries": 0,
        },
    )
```

Creation requests use a five-minute client timeout because note generation and
transcription setup can exceed the SDK's one-minute default. Automatic retries are
disabled because repeating these POSTs can create duplicate billable work.
Use the same authenticated `client.post()` method for
[Text to JSON](https://docs.sully.ai/text-to-json.md), with automatic retries disabled.

## Create a streaming token

Create a short-lived token before opening a browser WebSocket connection:

```ts TypeScript theme={null}
type CreateStreamingTokenResponse = {
  data: { token: string };
};

const tokenResponse = await client.post<CreateStreamingTokenResponse>(
  "/v1/audio/transcriptions/stream/token",
  {
    body: { expiresIn: 300 },
    maxRetries: 0,
  },
);
const token = tokenResponse.data.token;
```

```python Python theme={null}
import httpx

token_response = client.post(
    "/v1/audio/transcriptions/stream/token",
    cast_to=httpx.Response,
    body={"expiresIn": 300},
    options={"max_retries": 0},
)
token = token_response.json()["data"]["token"]
```

The SDK authenticates the token request but does not open the WebSocket or capture
audio. See [streaming transcription](https://docs.sully.ai/streaming-transcription.md) for the connection
flow.

## Errors

Non-success responses raise typed SDK errors:

```ts TypeScript theme={null}
try {
  await client.get("/v2/audio/transcriptions/tx_example");
} catch (error) {
  if (error instanceof SullyAI.APIError) {
    console.error(error.status);
  } else {
    throw error;
  }
}
```

```python Python theme={null}
import httpx
import sullyai

try:
    client.get(
        "/v2/audio/transcriptions/tx_example",
        cast_to=httpx.Response,
    )
except sullyai.APIStatusError as error:
    print(error.status_code)
```


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.