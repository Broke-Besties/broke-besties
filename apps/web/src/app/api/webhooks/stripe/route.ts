import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { publishPaymentSuccess, publishPaymentFailed } from "@/events/producer";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Convert request body to string for Stripe signature verification
 */
async function getRawBody(request: NextRequest): Promise<string> {
  const arrayBuffer = await request.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("utf-8");
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = await getRawBody(request);
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "charge.failed": {
        await handleChargeFailed(event.data.object as Stripe.Charge);
        break;
      }

      case "checkout.session.expired": {
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Find payment attempt
  const paymentAttempt = await prisma.paymentAttempt.findUnique({
    where: { stripe_session_id: session.id },
    include: { debt: true },
  });

  if (!paymentAttempt) {
    console.error(`Payment attempt not found for session ${session.id}`);
    throw new Error("Payment attempt not found");
  }

  // Check idempotency: prevent duplicate processing
  if (paymentAttempt.webhook_event_id) {
    console.log(
      `[Webhook] Session ${session.id} already processed (event: ${paymentAttempt.webhook_event_id})`
    );
    return;
  }

  // Update payment attempt to completed
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: {
      stripe_payment_intent_id: session.payment_intent as string,
      status: "completed",
      webhook_event_id: undefined, // Set after Kafka publish to avoid race condition
      webhook_processed_at: new Date(),
    },
  });

  // Publish to Kafka
  await publishPaymentSuccess({
    debtId: paymentAttempt.debtId,
    amount: paymentAttempt.amount / 100, // Convert cents to dollars
    providerType: "stripe",
    providerReference: paymentAttempt.id,
    timestamp: new Date(),
  });

  // Mark webhook as processed
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: { webhook_event_id: "processed" }, // Mark as processed
  });

  console.log(
    `[Webhook] Successfully processed checkout.session.completed for debt ${paymentAttempt.debtId}`
  );
}

/**
 * Handle failed charge
 */
async function handleChargeFailed(charge: Stripe.Charge) {
  if (!charge.payment_intent || typeof charge.payment_intent === "string") {
    console.warn("Charge failed but no payment intent found");
    return;
  }

  const paymentAttempt = await prisma.paymentAttempt.findFirst({
    where: { stripe_payment_intent_id: charge.payment_intent },
    include: { debt: true },
  });

  if (!paymentAttempt) {
    console.warn(
      `Payment attempt not found for payment intent ${charge.payment_intent}`
    );
    return;
  }

  // Check idempotency
  if (paymentAttempt.webhook_event_id) {
    console.log(
      `[Webhook] Charge failure already processed (event: ${paymentAttempt.webhook_event_id})`
    );
    return;
  }

  // Update payment attempt
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: {
      status: "failed",
      stripe_error_code: charge.failure_code,
      stripe_error_message: charge.failure_message,
      webhook_processed_at: new Date(),
    },
  });

  // Publish failure event
  await publishPaymentFailed({
    debtId: paymentAttempt.debtId,
    amount: paymentAttempt.amount / 100,
    providerType: "stripe",
    reason: charge.failure_message || charge.failure_code || "Unknown error",
    timestamp: new Date(),
  });

  // Mark webhook as processed
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: { webhook_event_id: "processed" },
  });

  console.log(
    `[Webhook] Processed charge.failed for debt ${paymentAttempt.debtId}: ${charge.failure_message}`
  );
}

/**
 * Handle checkout session expiration
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  const paymentAttempt = await prisma.paymentAttempt.findUnique({
    where: { stripe_session_id: session.id },
  });

  if (!paymentAttempt) {
    console.warn(`Payment attempt not found for session ${session.id}`);
    return;
  }

  // Check idempotency
  if (paymentAttempt.webhook_event_id) {
    console.log(
      `[Webhook] Session expiration already processed (event: ${paymentAttempt.webhook_event_id})`
    );
    return;
  }

  // Update payment attempt
  await prisma.paymentAttempt.update({
    where: { id: paymentAttempt.id },
    data: {
      status: "expired",
      webhook_event_id: "processed",
      webhook_processed_at: new Date(),
    },
  });

  console.log(`[Webhook] Processed checkout.session.expired for session ${session.id}`);
}
