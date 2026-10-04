import { NextResponse } from "next/server";
import { PaypalConfigError, PaypalFlowError } from "@/lib/paypal-errors";

/** Maps an error from the PayPal service to the route's JSON error response. */
export function paypalErrorResponse(error: unknown, { configStatus = 503 } = {}) {
  if (error instanceof PaypalFlowError) {
    return NextResponse.json({ ...error.body, error: error.message }, { status: error.status });
  }
  console.error("PayPal route error:", error);
  if (error instanceof PaypalConfigError) {
    return NextResponse.json({ error: "PayPal is not configured" }, { status: configStatus });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
