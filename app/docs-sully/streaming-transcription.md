> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming transcription

Streaming transcription returns partial and final text while audio is being
captured. Connect over WebSocket, wait for the `connected` status message, then send
base64-encoded audio chunks.

## Connect

The endpoint is:

```text theme={null}
wss://api.sully.ai/v1/audio/transcriptions/stream
```

Server-side WebSocket clients should authenticate with headers:

```http theme={null}
X-Account-Id: your-account-id
X-Api-Key: your-api-key
```

Browser WebSocket APIs cannot set custom headers. For a browser integration, use a
short-lived API token issued for the account and connect with `account_id` plus
`token` query parameters. Never place a permanent API key in a URL or browser
bundle.

The SDKs create short-lived streaming tokens but do not manage the WebSocket or
audio capture. Use the WebSocket library appropriate for your application.

## SDK

These server-side examples use the Sully SDK for token creation and a WebSocket
library for the connection.

```bash TypeScript theme={null}
npm install @sullyai/sullyai ws
```

```bash Python theme={null}
pip install --pre sullyai websockets
```

```ts TypeScript theme={null}
import { readFile } from "node:fs/promises";
import SullyAI from "@sullyai/sullyai";
import WebSocket from "ws";

const apiKey = process.env.SULLY_API_KEY;
const accountID = process.env.SULLY_ACCOUNT_ID;
const baseURL = process.env.SULLY_API_BASE_URL;

if (!apiKey || !accountID || !baseURL) {
  throw new Error("Missing Sully environment variables");
}

const client = new SullyAI({
  apiKey,
  accountID,
  baseURL,
});
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

if (!token) throw new Error("Sully did not return a streaming token");

const url = new URL(
  "/v1/audio/transcriptions/stream",
  baseURL,
);
url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
url.searchParams.set("account_id", accountID);
url.searchParams.set("api_token", token);
url.searchParams.set("sample_rate", "16000");
url.searchParams.set("encoding", "linear16");

const socket = new WebSocket(url);
let audioComplete = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const closeAfterQuietPeriod = () => {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => socket.close(1000, "Audio complete"), 2_000);
};

socket.on("message", async (raw) => {
  const message = JSON.parse(raw.toString());
  console.log(message);

  if (audioComplete) closeAfterQuietPeriod();

  if (message.type === "status" && message.status === "connected") {
    const audio = await readFile("./fictional-visit.pcm");
    for (let offset = 0; offset < audio.length; offset += 3_200) {
      const chunk = audio.subarray(offset, offset + 3_200);
      socket.send(JSON.stringify({ audio: chunk.toString("base64") }));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    audioComplete = true;
    closeAfterQuietPeriod();
  }
});

socket.on("close", () => clearTimeout(closeTimer));
```

```python Python theme={null}
import asyncio
import base64
import json
import os
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx
from sullyai import SullyAI
from websockets.asyncio.client import connect

client = SullyAI(
    api_key=os.environ["SULLY_API_KEY"],
    account_id=os.environ["SULLY_ACCOUNT_ID"],
    base_url=os.environ["SULLY_API_BASE_URL"],
)
token_response = client.post(
    "/v1/audio/transcriptions/stream/token",
    cast_to=httpx.Response,
    body={"expiresIn": 300},
    options={"max_retries": 0},
)
token = token_response.json()["data"]["token"]
if not token:
    raise RuntimeError("Sully did not return a streaming token")

base = urlsplit(os.environ["SULLY_API_BASE_URL"])
query = urlencode(
    {
        "account_id": os.environ["SULLY_ACCOUNT_ID"],
        "api_token": token,
        "sample_rate": 16000,
        "encoding": "linear16",
    }
)
url = urlunsplit(
    (
        "wss" if base.scheme == "https" else "ws",
        base.netloc,
        "/v1/audio/transcriptions/stream",
        query,
        "",
    )
)


async def transcribe() -> None:
    async with connect(url) as socket:
        while True:
            raw = await socket.recv()
            message = json.loads(raw)
            print(message)
            if message.get("type") == "status" and message.get("status") == "connected":
                break

        with open("./fictional-visit.pcm", "rb") as audio:
            while chunk := audio.read(3_200):
                encoded = base64.b64encode(chunk).decode("ascii")
                await socket.send(json.dumps({"audio": encoded}))
                await asyncio.sleep(0.1)

        while True:
            try:
                raw = await asyncio.wait_for(socket.recv(), timeout=2.0)
            except asyncio.TimeoutError:
                break
            print(json.loads(raw))


asyncio.run(transcribe())
```

The file examples close the connection after two seconds without a server message,
allowing final results to drain without leaving an idle billable session open. For
live capture, close the WebSocket explicitly when the user stops recording.

For live capture, send short, consistently paced chunks instead of reading the
whole file at once.

## Query parameters

| Parameter | Required | Default | Notes |
| - | -: | - | - |
| `sample_rate` | No | `16000` | Positive integer matching the audio stream. |
| `encoding` | No | Automatic detection | `linear16`, `linear32`, `flac`, `mulaw`, `amr-nb`, `amr-wb`, `opus`, `speex`, or `g729`. |
| `language` | No | `en` | Language or locale for recognition. |
| `word_boost` | No | — | URL-encoded JSON array of terms, for example `["metformin","hypertension"]`. |
| `dictation` | No | `false` | `true` or `false`; availability may vary by account. |
| `account_id` | Browser auth only | — | Account paired with a short-lived API token. |
| `api_token` | Browser auth only | — | Short-lived API token. `token` is also accepted. |

Example URL before URL encoding:

```text theme={null}
wss://api.sully.ai/v1/audio/transcriptions/stream?sample_rate=16000&encoding=linear16&language=en&word_boost=["metformin"]
```

## Wait for readiness

Do not send audio immediately after the WebSocket opens. Wait for:

```json theme={null}
{
  "type": "status",
  "status": "connected",
  "timestamp": "2026-09-22T20:15:30.000Z"
}
```

The server drops audio received before recognition is ready.

## Send audio

Each WebSocket message is JSON with a base64-encoded audio chunk:

```json theme={null}
{
  "audio": "AAECAwQFBgcICQ=="
}
```

The bytes must match the `encoding` and `sample_rate` declared at connection time.
For `linear16`, send signed 16-bit little-endian PCM. Small, consistently paced
chunks—about 50–200 ms of audio—work well for live capture.

Malformed messages are ignored so that a later valid audio frame can continue the
session.

## Receive transcripts

Partial and final results share one shape:

```json theme={null}
{
  "type": "transcript",
  "audio_start": 0.5,
  "audio_end": 2.1,
  "duration": 1.6,
  "text": "The patient reports a dry cough.",
  "isFinal": true,
  "is_final": true,
  "words": [
    {
      "word": "patient",
      "start": 0.72,
      "end": 1.05,
      "confidence": 0.98,
      "language": "en",
      "punctuated_word": "patient",
      "speaker": 0,
      "speaker_confidence": 0.99
    }
  ],
  "timestamp": "2026-09-22T20:15:32.000Z"
}
```

Use `is_final` as the canonical finality field. `isFinal` is included for
compatibility. Timing values may be `null`, and word objects can contain additional
normalized metadata. Render partial text as provisional and replace it
when a final segment arrives.

## Errors and reconnects

The server can send an error message before closing:

```json theme={null}
{
  "type": "error",
  "code": "invalid_api_key",
  "retryable": false,
  "error": "The supplied credentials are invalid.",
  "timestamp": "2026-09-22T20:16:00.000Z"
}
```

| Close code | Meaning | What to do |
| -: | - | - |
| `1000` | Normal connection cleanup | Reconnect only when starting another session. |
| `4000` | Transcription service failed | Retry with exponential backoff. |
| `4001` | Missing, invalid, expired, or mismatched credentials; also invalid query parameters | Fix credentials or parameters; do not retry unchanged. |
| `4002` | Insufficient credits | Add credits, then reconnect. |
| `1013` | Temporary service interruption | Honor `retry_after_seconds` when present and reconnect with backoff. |

A session can last up to two hours. A network or service interruption ends the
current session; reconnecting creates a new session.

## Usage behavior

Billable streaming time starts when the server sends `connected`, not when the
WebSocket transport opens. Idle time after readiness counts. Time spent starting
transcription and draining final results after audio closes does not count.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.