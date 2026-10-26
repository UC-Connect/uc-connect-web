export type LLMErrorKind = "config" | "rate_limit" | "timeout" | "upstream" | "empty" | "aborted";

const RETRYABLE_KINDS = new Set<LLMErrorKind>(["rate_limit", "timeout", "upstream"]);

// Every provider converts its own failures into this type so callers can decide on retries
// and fallbacks without knowing which vendor failed.
export class LLMError extends Error {
  readonly provider: string;
  readonly kind: LLMErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(provider: string, kind: LLMErrorKind, message: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "LLMError";
    this.provider = provider;
    this.kind = kind;
    this.status = options.status;
    this.retryable = options.retryable ?? RETRYABLE_KINDS.has(kind);
  }
}

export function errorFromStatus(provider: string, status: number, detail = ""): LLMError {
  const message = `${provider} request failed with status ${status}${detail ? `: ${detail}` : ""}`;

  if (status === 429) return new LLMError(provider, "rate_limit", message, { status });
  if (status === 401 || status === 403) return new LLMError(provider, "config", message, { status, retryable: false });
  if (status >= 500) return new LLMError(provider, "upstream", message, { status });
  return new LLMError(provider, "upstream", message, { status, retryable: false });
}
