export class ZapierError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ZapierError";
  }
}

export class ZapierNotConnected extends ZapierError {
  constructor(userId: string) {
    super(
      `No Zapier connection found for user ${userId}`,
      "ZAPIER_NOT_CONNECTED",
      { userId }
    );
    this.name = "ZapierNotConnected";
  }
}

export class ZapierReauthRequired extends ZapierError {
  constructor(userId: string, reason?: string) {
    super(
      `Zapier re-authentication required for user ${userId}: ${reason ?? "token expired"}`,
      "ZAPIER_REAUTH_REQUIRED",
      { userId, reason }
    );
    this.name = "ZapierReauthRequired";
  }
}

export class ZapierRateLimited extends ZapierError {
  constructor(retryAfter?: number) {
    super(
      `Zapier API rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ""}`,
      "ZAPIER_RATE_LIMITED",
      { retryAfter }
    );
    this.name = "ZapierRateLimited";
  }
}

export class ZapierActionFailed extends ZapierError {
  constructor(actionKey: string, detail?: string) {
    super(
      `Zapier action "${actionKey}" failed: ${detail ?? "unknown error"}`,
      "ZAPIER_ACTION_FAILED",
      { actionKey, detail }
    );
    this.name = "ZapierActionFailed";
  }
}

export class ZapierCapabilityDenied extends ZapierError {
  constructor(capability: string, userId: string) {
    super(
      `Capability "${capability}" is not enabled for user ${userId}`,
      "ZAPIER_CAPABILITY_DENIED",
      { capability, userId }
    );
    this.name = "ZapierCapabilityDenied";
  }
}
