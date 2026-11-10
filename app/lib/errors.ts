import type { AppError } from "./types";

/**
 * Turns a Sully error response into plain-language guidance.
 * Codes follow the Sully docs: 400 invalid_request, 401 unauthorized,
 * 402 insufficient_credits, 404 endpoint_disabled, and 5xx service errors.
 */
export function describeSullyError(input: {
  status: number | null;
  code?: string;
  message?: string;
  requestId?: string;
  endpoint?: string;
}): AppError {
  const { status, code, message, requestId } = input;
  const detail = message ? ` Sully said: "${message}"` : "";
  const base = { status, code, requestId };

  if (status === null) {
    return {
      ...base,
      title: "Could not reach Sully",
      message: `The request did not get a response (network error or timeout). Check your connection and SULLY_API_BASE_URL. Billable requests are not retried automatically; check the request ID in the API calls panel before trying again.${detail}`,
    };
  }
  switch (status) {
    case 400:
      return {
        ...base,
        title: "Sully rejected the request",
        message: `The request was invalid (${code ?? "invalid_request"}). Fix the input before trying again; sending it unchanged will fail the same way.${detail}`,
      };
    case 401:
      return {
        ...base,
        title: "Your Sully keys were not accepted",
        message: "Check SULLY_ACCOUNT_ID and SULLY_API_KEY in .env.local, then restart the dev server.",
      };
    case 402:
      return {
        ...base,
        title: "Out of Sully credits",
        message: "Your account does not have enough credits for this request. Add credits in the Sully dashboard, then try again.",
      };
    case 404:
      return {
        ...base,
        title: code === "endpoint_disabled" ? "Endpoint not enabled" : "Not found",
        message:
          code === "endpoint_disabled"
            ? "This endpoint is not enabled for your Sully account. Ask Sully to enable it."
            : `Sully could not find this resource or endpoint.${detail}`,
      };
    case 409:
      return {
        ...base,
        title: "Billing conflict",
        message: "Sully reported a billing conflict. If it keeps happening, contact Sully support with the request ID.",
      };
    case 413:
      return { ...base, title: "File too large", message: "Audio files can be at most 100 MiB." };
    case 422:
      return {
        ...base,
        title: "Audio could not be read",
        message: "The audio needs readable duration metadata between 0 and 24 hours. Try converting it to MP3 or WAV.",
      };
    case 429:
      return { ...base, title: "Too many requests", message: "Sully is rate limiting this account. Wait a moment, then try again." };
  }
  if (status >= 500) {
    return {
      ...base,
      title: "Sully had a temporary problem",
      message: `The service returned ${status}${code ? ` (${code})` : ""}. Wait a moment and try again. Billable requests are never retried automatically.`,
    };
  }
  return { ...base, title: `Request failed (${status})`, message: message ?? "Unexpected error from Sully." };
}

/** A local validation error, shown before any request is sent. */
export function inputError(message: string): AppError {
  return { title: "Check the form", message };
}

export function toAppError(err: unknown): AppError {
  if (err && typeof err === "object" && "appError" in err) {
    return (err as { appError: AppError }).appError;
  }
  const message = err instanceof Error ? err.message : String(err);
  return { title: "Something went wrong", message };
}
