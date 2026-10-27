export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, message: string, status: number, requestId: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export class TenantNotFoundError extends DomainError {
  constructor(requestId: string) {
    super("TENANT_NOT_FOUND", "No organisation matches this API key.", 401, requestId);
    this.name = "TenantNotFoundError";
  }
}

export class BudgetExceededError extends DomainError {
  constructor(requestId: string) {
    super(
      "BUDGET_EXCEEDED",
      "This request would exceed the organisation's monthly AI budget.",
      402,
      requestId,
    );
    this.name = "BudgetExceededError";
  }
}

export class SpikeDetectedError extends DomainError {
  constructor(requestId: string) {
    super(
      "SPIKE_DETECTED",
      "This request was blocked by the runaway-agent guard. Recent spend is above the organisation spike threshold.",
      429,
      requestId,
    );
    this.name = "SpikeDetectedError";
  }
}

export class DailyLimitExceededError extends DomainError {
  constructor(requestId: string) {
    super("DAILY_LIMIT_EXCEEDED", "The organisation has reached its daily request limit.", 429, requestId);
    this.name = "DailyLimitExceededError";
  }
}

export class PIIServiceUnavailableError extends DomainError {
  constructor(requestId: string) {
    super(
      "PII_SERVICE_UNAVAILABLE",
      "Request blocked because privacy protection is unavailable.",
      503,
      requestId,
    );
    this.name = "PIIServiceUnavailableError";
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(requestId: string, provider: string) {
    super(
      "PROVIDER_UNAVAILABLE",
      `The ${provider} provider could not complete the request. No unscreened prompt was sent.`,
      502,
      requestId,
    );
    this.name = "ProviderUnavailableError";
  }
}

export class InvalidRequestError extends DomainError {
  constructor(requestId: string, message: string) {
    super("INVALID_REQUEST", message, 400, requestId);
    this.name = "InvalidRequestError";
  }
}

export class DemoConsoleDisabledError extends DomainError {
  constructor(requestId: string) {
    super("DEMO_CONSOLE_DISABLED", "The operator console is only available in demo mode.", 404, requestId);
    this.name = "DemoConsoleDisabledError";
  }
}
