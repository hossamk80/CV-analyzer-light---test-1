/**
 * Maps the wildly different error shapes the AI providers return onto a small set
 * of stable codes. The client renders a localized sentence per code, so the user
 * sees "your AI plan's quota is used up" instead of a raw
 * `[GoogleGenerativeAI Error] 429 RESOURCE_EXHAUSTED …` dump.
 *
 * The original provider text is still carried alongside the code as a technical
 * detail — it is what makes a support conversation possible.
 */
export type AiErrorCode =
  | 'quota_exceeded'
  | 'rate_limited'
  | 'invalid_api_key'
  | 'permission_denied'
  | 'model_not_found'
  | 'provider_overloaded'
  | 'content_too_large'
  | 'unsupported_file'
  | 'network'
  | 'timeout'
  | 'bad_response'
  | 'no_provider'
  | 'unknown';

export interface ClassifiedAiError {
  code: AiErrorCode;
  /** Raw provider text, trimmed — shown as secondary technical detail. */
  detail: string;
  /** True when retrying later (without changing configuration) could succeed. */
  retryable: boolean;
}

/** Pulls an HTTP-ish status code out of the error object or its message text. */
function extractStatus(err: any, text: string): number | null {
  const direct = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.code;
  if (typeof direct === 'number' && direct >= 100 && direct < 600) return direct;
  const m = text.match(/\b(4\d{2}|5\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

export function classifyAiError(err: any): ClassifiedAiError {
  const text = String(err?.message || err || '').trim();
  const lower = text.toLowerCase();
  const status = extractStatus(err, text);
  const detail = text.slice(0, 400);

  // Quota / billing exhaustion. Checked before the generic rate-limit branch:
  // both are commonly HTTP 429, but only one of them is fixed by waiting.
  if (
    /resource[_ ]exhausted|insufficient_quota|exceeded your current quota|quota exceeded|out of credits|billing|free tier|credit balance|payment required/i.test(text)
    || status === 402
    || (status === 429 && /quota|billing|credit/i.test(lower))
  ) {
    return { code: 'quota_exceeded', detail, retryable: false };
  }

  if (status === 429 || /rate limit|too many requests|requests per (minute|second)|slow down/i.test(lower)) {
    return { code: 'rate_limited', detail, retryable: true };
  }

  if (
    /api[_ ]?key not valid|invalid[_ ]api[_ ]key|incorrect api key|unauthorized|authentication|invalid authentication|no auth credentials/i.test(lower)
    || status === 401
  ) {
    return { code: 'invalid_api_key', detail, retryable: false };
  }

  if (status === 403 || /permission denied|forbidden|not allowed|access denied/i.test(lower)) {
    return { code: 'permission_denied', detail, retryable: false };
  }

  if (
    /model .*(not found|does not exist|is not supported)|unknown model|no such model|deprecated model/i.test(lower)
    || (status === 404 && /model/i.test(lower))
  ) {
    return { code: 'model_not_found', detail, retryable: false };
  }

  if (status === 503 || status === 502 || status === 500 || /overloaded|unavailable|internal (server )?error|try again later|capacity/i.test(lower)) {
    return { code: 'provider_overloaded', detail, retryable: true };
  }

  if (status === 413 || /too large|context length|maximum context|token limit|payload size|request entity/i.test(lower)) {
    return { code: 'content_too_large', detail, retryable: false };
  }

  if (/does not support|unsupported (file|media|mime|document)|invalid (file|image|document)|cannot process .*(pdf|image)/i.test(lower)) {
    return { code: 'unsupported_file', detail, retryable: false };
  }

  if (/timed? ?out|etimedout|deadline exceeded|aborted/i.test(lower)) {
    return { code: 'timeout', detail, retryable: true };
  }

  if (/econnrefused|enotfound|econnreset|network|fetch failed|socket hang up|dns/i.test(lower)) {
    return { code: 'network', detail, retryable: true };
  }

  if (/empty response|returned an empty|failed to parse|not valid json|unexpected token|invalid json/i.test(lower)) {
    return { code: 'bad_response', detail, retryable: true };
  }

  return { code: 'unknown', detail, retryable: false };
}
