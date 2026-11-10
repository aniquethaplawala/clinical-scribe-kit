> ## Documentation Index
> Fetch the complete documentation index at: https://docs.sully.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Sully M1

Sully M1 is Sully's general inference model. Its OpenAI-compatible Chat
Completions API supports text generation, streaming, structured JSON, and
client-executed function tools.

## SDK quickstart

Use the OpenAI SDK with Sully's OpenAI-compatible endpoint.

```bash TypeScript theme={null}
npm install openai
```

```bash Python theme={null}
pip install openai
```

Create a client with the Sully endpoint and your account ID and API key as one
composite credential:

```ts TypeScript theme={null}
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: `${process.env.SULLY_ACCOUNT_ID}:${process.env.SULLY_API_KEY}`,
  baseURL: `${process.env.SULLY_API_BASE_URL}/openai/v1`,
  maxRetries: 0,
});

const completion = await client.chat.completions.create({
  model: "sully-m1",
  messages: [
    {
      role: "user",
      content:
        "Explain the difference between systolic and diastolic blood pressure.",
    },
  ],
  max_completion_tokens: 300,
});

console.log(completion.choices[0]?.message.content);
```

```python Python theme={null}
import os

from openai import OpenAI

client = OpenAI(
    api_key=f"{os.environ['SULLY_ACCOUNT_ID']}:{os.environ['SULLY_API_KEY']}",
    base_url=f"{os.environ['SULLY_API_BASE_URL']}/openai/v1",
    max_retries=0,
)

completion = client.chat.completions.create(
    model="sully-m1",
    messages=[
        {
            "role": "user",
            "content": (
                "Explain the difference between systolic and diastolic "
                "blood pressure."
            ),
        }
    ],
    max_completion_tokens=300,
)

print(completion.choices[0].message.content)
```

Use `sully-m1` as the `model` value unless Sully provides another model name.

## HTTP request

```bash theme={null}
curl "$SULLY_API_BASE_URL/openai/v1/chat/completions" \
  --header "X-Account-Id: $SULLY_ACCOUNT_ID" \
  --header "X-Api-Key: $SULLY_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "model": "sully-m1",
    "messages": [
      {"role": "system", "content": "Be concise and use plain language."},
      {"role": "user", "content": "What does an A1C test measure?"}
    ],
    "max_completion_tokens": 300
  }'
```

A successful response uses the familiar OpenAI Chat Completions shape:

```json theme={null}
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1789952400,
  "model": "sully-m1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "An A1C test estimates average blood glucose over the past two to three months.",
        "refusal": null
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 28,
    "completion_tokens": 24,
    "total_tokens": 52
  }
}
```

Token usage is included when available. Code should tolerate an omitted `usage`
object.

## Stream a response

Set `stream: true`. With the OpenAI SDK, iterate over completion chunks:

```ts TypeScript theme={null}
const stream = await client.chat.completions.create({
  model: "sully-m1",
  messages: [{ role: "user", content: "List three common causes of fatigue." }],
  stream: true,
  stream_options: { include_usage: true },
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? "");
}
```

```python Python theme={null}
stream = client.chat.completions.create(
    model="sully-m1",
    messages=[
        {"role": "user", "content": "List three common causes of fatigue."}
    ],
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in stream:
    content = chunk.choices[0].delta.content if chunk.choices else None
    if content:
        print(content, end="", flush=True)
```

At the HTTP level, streaming uses server-sent events and ends with
`data: [DONE]`. When `stream_options.include_usage` is true, the final JSON frame
has an empty `choices` array and contains `usage`. It may contain `usage: null`.

## Request JSON output

Use JSON mode when you need parseable JSON:

```json theme={null}
{
  "model": "sully-m1",
  "messages": [
    {
      "role": "user",
      "content": "Return JSON with keys summary and follow_up_questions for this fictional visit: The patient reports a cough for three days."
    }
  ],
  "response_format": { "type": "json_object" }
}
```

The non-streaming API verifies that a completed JSON-mode answer is parseable JSON.
Clients using `json_schema` should still validate the response against their schema.
Streaming JSON may be incomplete until the final chunk arrives.

## Use function tools

Tools are returned to your application; Sully does not execute them.

```ts TypeScript theme={null}
const completion = await client.chat.completions.create({
  model: "sully-m1",
  messages: [
    { role: "user", content: "Look up the fictional patient record P-100." },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "get_patient",
        description: "Retrieve a patient by ID",
        parameters: {
          type: "object",
          properties: { patient_id: { type: "string" } },
          required: ["patient_id"],
          additionalProperties: false,
        },
      },
    },
  ],
  tool_choice: "auto",
});

for (const call of completion.choices[0]?.message.tool_calls ?? []) {
  if (call.type !== "function") continue;
  const args = JSON.parse(call.function.arguments);
  console.log(call.function.name, args);
}
```

```python Python theme={null}
import json

completion = client.chat.completions.create(
    model="sully-m1",
    messages=[
        {"role": "user", "content": "Look up the fictional patient record P-100."}
    ],
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_patient",
                "description": "Retrieve a patient by ID",
                "parameters": {
                    "type": "object",
                    "properties": {"patient_id": {"type": "string"}},
                    "required": ["patient_id"],
                    "additionalProperties": False,
                },
            },
        }
    ],
    tool_choice="auto",
)

for call in completion.choices[0].message.tool_calls or []:
    if call.type != "function":
        continue
    args = json.loads(call.function.arguments)
    print(call.function.name, args)
```

Send the tool result in a subsequent request using the normal OpenAI tool message
shape and the returned `tool_call_id`.

## Supported request fields

The Chat Completions endpoint honors:

* `messages`
* `model`
* `stream` and `stream_options.include_usage`
* `max_completion_tokens`
* `temperature`, `top_p`, `seed`, and `stop`
* `tools` and `tool_choice`
* `response_format`
* `reasoning_effort`: `none`, `medium`, or `high`
* `logprobs`, `top_logprobs`, and `logit_bias` when enabled for the model

Only one completion is generated per request. Unknown top-level fields are ignored.
Inline `data:` image URLs are accepted in message content; remote image URLs are
not fetched.

## Errors and retries

An invalid `reasoning_effort` value, such as `"extreme"`, returns HTTP `400`
before model inference, with code `invalid_value`, param `reasoning_effort`, and
message `Unsupported reasoning_effort value.`

Errors use the OpenAI error envelope:

```json theme={null}
{
  "error": {
    "message": "Request exceeded the available token budget.",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "context_length_exceeded"
  }
}
```

| Status | Common code | What to do |
| - | - | - |
| `400` | `invalid_value`, `context_length_exceeded` | Correct the request; do not retry unchanged. |
| `401` | `invalid_api_key` | Verify the account ID and API key. |
| `402` | `insufficient_funds` | Add credits before retrying. |
| `404` | `unknown_url`, `model_not_found` | Check access, the request path, and model name. |
| `429` | `rate_limit_exceeded` | Wait for `Retry-After`, then retry with jitter. |
| `503` | `engine_overloaded` | Retry with exponential backoff. |
| `504` | `upstream_timeout` | Retry only when your operation is safe to repeat. |

Every response includes `x-request-id`. Capture it for support and debugging.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.