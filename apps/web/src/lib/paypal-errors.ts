export type PaypalErrorDetail = {
  issue?: string;
  description?: string;
  field?: string;
  value?: string;
  location?: string;
};

/** A non-2xx response from the PayPal REST API. */
export class PaypalError extends Error {
  /** HTTP status PayPal answered with. */
  readonly status: number;
  /** PayPal's error name, e.g. UNPROCESSABLE_ENTITY, RESOURCE_NOT_FOUND, invalid_client (OAuth). */
  readonly paypalName: string;
  /** PayPal debug id, quoted when asking PayPal support about a failed call. */
  readonly debugId: string | null;
  readonly details: PaypalErrorDetail[];

  constructor(
    status: number,
    paypalName: string,
    message: string,
    debugId: string | null = null,
    details: PaypalErrorDetail[] = [],
  ) {
    super(message);
    this.name = "PaypalError";
    this.status = status;
    this.paypalName = paypalName;
    this.debugId = debugId;
    this.details = details;
  }

  /** First `details[].issue`, e.g. INSTRUMENT_DECLINED or ORDER_NOT_APPROVED. */
  get issue(): string | null {
    return this.details.find((d) => d.issue)?.issue ?? null;
  }
}

/** Required PayPal settings (credentials, webhook id, state secret, app URL) are missing. */
export class PaypalConfigError extends Error {
  constructor(message = "PayPal is not configured") {
    super(message);
    this.name = "PaypalConfigError";
  }
}

/**
 * An expected failure in a PayPal flow, carrying the HTTP status the route
 * should answer with. Routes respond `{ error: message, ...body }`.
 */
export class PaypalFlowError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "PaypalFlowError";
    this.status = status;
    this.body = body;
  }
}
