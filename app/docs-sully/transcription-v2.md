> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Transcription

Transcription accepts a completed audio file and processes it asynchronously.
Submit the recording, store the returned transcription ID, and poll until the
resource is completed or failed.

For live audio, use [streaming transcription](https://docs.sully.ai/streaming-transcription.md).

## SDK

Submit multipart data through the SDK's authenticated request method:

```ts TypeScript theme={null}
import { readFile } from "node:fs/promises";
import SullyAI from "@sullyai/sullyai";

type CreateTranscriptionResponse = {
  data: { id: string; status: "pending" };
};

const client = new SullyAI({
  apiKey: process.env.SULLY_API_KEY,
  accountID: process.env.SULLY_ACCOUNT_ID,
  baseURL: process.env.SULLY_API_BASE_URL,
});

const form = new FormData();
form.append(
  "audio",
  new Blob([new Uint8Array(await readFile("./fictional-visit.mp3"))], {
    type: "audio/mpeg",
  }),
  "fictional-visit.mp3",
);
form.append("language", "en");
form.append("multichannel", "false");
form.append("dictation", "true");

const created = await client.post<CreateTranscriptionResponse>(
  "/v2/audio/transcriptions",
  {
    body: form,
    timeout: 300_000,
    maxRetries: 0,
  },
);

console.log(created.data.id);
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

with open("./fictional-visit.mp3", "rb") as audio:
    response = client.post(
        "/v2/audio/transcriptions",
        cast_to=httpx.Response,
        body={
            "language": "en",
            "multichannel": "false",
            "dictation": "true",
        },
        files={"audio": ("fictional-visit.mp3", audio, "audio/mpeg")},
        options={
            "headers": {"Content-Type": "multipart/form-data"},
            "timeout": 300.0,
            "max_retries": 0,
        },
    )

created = response.json()
print(created["data"]["id"])
```

Use `client.get()` and `client.delete()` with the returned transcription resource
path to retrieve or delete it.

## Upload audio

```bash theme={null}
curl "$SULLY_API_BASE_URL/v2/audio/transcriptions" \
  --request POST \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY" \
  --form "audio=@./fictional-visit.mp3" \
  --form "language=en" \
  --form "multichannel=false" \
  --form "dictation=true"
```

The multipart file field must be named `audio`. A successful upload returns `201`:

```json theme={null}
{
  "data": {
    "id": "tx_...",
    "status": "pending",
    "created_at": "2026-09-22T20:15:30.000Z",
    "updated_at": "2026-09-22T20:15:30.000Z"
  }
}
```

Store `data.id`; the response only confirms that processing has been accepted.

## Upload options

| Field | Required | Default | Notes |
| - | -: | - | - |
| `audio` | Yes | — | One audio file, maximum 100 MiB. |
| `language` | No | `en` | Language or locale of the recording. |
| `encoding` | No | Detected | `linear16`, `flac`, `mulaw`, `amr-nb`, `amr-wb`, `opus`, `speex`, or `g729`. Usually omit this for a normal container file. |
| `multichannel` | No | `false` | Set `true` when the source contains separate audio channels. |
| `dictation` | No | `false` | Enables dictation-oriented formatting. |

Boolean form fields must be exactly `true` or `false`.

Accepted MIME types include WAV, MP3/MPEG, FLAC, OGG, WebM, MP4/M4A, AAC, and
Opus. The server may convert the file before transcription. Audio must have a
measurable positive duration and may not exceed 24 hours.

Supported language values:

```text theme={null}
en, en-US, es, de, fr, hi, it, ja, nl, pt, ru,
bg, ca, zh, zh-CN, zh-Hans, zh-TW, zh-Hant, zh-HK,
cs, da, da-DK, en-AU, en-GB, en-NZ, en-IN, et, fi,
nl-BE, fr-CA, de-CH, el, hu, id, ko, ko-KR, lv, lt,
ms, no, pl, pt-BR, pt-PT, ro, sk, es-419, sv, sv-SE,
th, th-TH, tr, uk, vi
```

## Poll the transcription

```bash theme={null}
curl "$SULLY_API_BASE_URL/v2/audio/transcriptions/$TRANSCRIPTION_ID" \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY"
```

Possible `data.status` values are `pending`, `processing`, `completed`, and
`failed`. A completed response has one result per channel:

```json theme={null}
{
  "data": {
    "id": "tx_...",
    "status": "completed",
    "result": {
      "channels": [
        {
          "transcript": "The patient reports a dry cough for three days.",
          "confidence": 0.97,
          "words": [
            {
              "word": "patient",
              "start": 0.42,
              "end": 0.81,
              "confidence": 0.99,
              "speaker": 0
            }
          ]
        }
      ]
    },
    "created_at": "2026-09-22T20:15:30.000Z",
    "updated_at": "2026-09-22T20:15:38.000Z"
  }
}
```

`words` and `speaker` are optional. Stop polling when the status is `completed` or
`failed`. On failure, `data.result.error` contains a safe summary.

If webhooks are configured for the account, terminal events use
`audio_transcription.succeeded` or `audio_transcription.failed` and include the
same public transcription object in `data`.

## Delete a transcription

```bash theme={null}
curl "$SULLY_API_BASE_URL/v2/audio/transcriptions/$TRANSCRIPTION_ID" \
  --request DELETE \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY"
```

A successful deletion returns `204 No Content`.

## Errors and retries

| Status | Meaning | What to do |
| - | - | - |
| `400` | Missing file, unsupported file type, or invalid form field | Correct the upload. |
| `401` | Missing or invalid credentials | Verify both authentication headers. |
| `402` | `insufficient_credits` | Add credits before uploading again. |
| `404` | Transcription not found | Verify the ID and authenticated account. |
| `409` | `billing_conflict` | Contact support with `x-request-id` if it persists. |
| `413` | File too large | Upload a file no larger than 100 MiB. |
| `422` | `invalid_audio_duration` | Supply audio with readable duration metadata between 0 and 24 hours. |
| `503` | Service unavailable | Wait at least the `Retry-After` value, then retry with jitter. |

Once an upload returns an ID, poll that resource. GET, DELETE, and webhook retries
do not start another transcription.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.