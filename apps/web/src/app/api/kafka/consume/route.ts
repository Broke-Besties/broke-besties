import { NextRequest, NextResponse } from "next/server";
import { kafka, TOPICS } from "@/lib/kafka";
import { handlePaymentSuccess as databaseHandler } from "@/events/listeners/database.listener";
import { handlePaymentSuccess as notificationHandler } from "@/events/listeners/notification.listener";
import { PaymentSuccessPayload } from "@/events/types";

export async function POST(request: NextRequest) {
  try {
    // Auth check: verify consumer secret from header
    const consumerSecret = request.headers.get("x-consumer-secret");
    if (!consumerSecret || consumerSecret !== process.env.KAFKA_CONSUMER_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const consumer = kafka.consumer({
      groupId: "settlement-consumers",
      sessionTimeout: 20000,
      heartbeatInterval: 5000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.PAYMENT_SUCCESS, fromBeginning: false });

    let messageCount = 0;
    let lastError: Error | null = null;

    await consumer.run({
      eachMessage: async ({ message }: any) => {
        try {
          if (!message.value) {
            console.warn("[Consumer] Received message with no value");
            return;
          }

          const data: PaymentSuccessPayload = JSON.parse(
            message.value.toString()
          );

          console.log(`[Consumer] Processing message:`, data);

          // Run both listeners
          await Promise.allSettled([
            databaseHandler(data),
            notificationHandler(data),
          ]);

          messageCount++;
        } catch (error) {
          console.error("[Consumer] Error processing message:", error);
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      },
    });

    // Run for 1 second to consume pending messages
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await consumer.disconnect();

    if (lastError) {
      return NextResponse.json(
        {
          message: `Processed ${messageCount} messages (with errors)`,
          messagesProcessed: messageCount,
          error: (lastError as Error).message,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      message: `Successfully processed ${messageCount} messages`,
      messagesProcessed: messageCount,
    });
  } catch (error) {
    console.error("[Consumer] Consume route error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
