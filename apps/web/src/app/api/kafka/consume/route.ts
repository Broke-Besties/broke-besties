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

    // Use eachBatch to process all pending messages then stop.
    // consumer.run() loops forever; we instead grab one batch and disconnect.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 8000); // max 8s per cron invocation

      consumer
        .run({
          eachBatch: async ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary }) => {
            for (const message of batch.messages) {
              try {
                if (!message.value) {
                  console.warn("[Consumer] Received message with no value");
                  resolveOffset(message.offset);
                  continue;
                }

                const data: PaymentSuccessPayload = JSON.parse(
                  message.value.toString()
                );

                console.log(`[Consumer] Processing message:`, data);

                await Promise.allSettled([
                  databaseHandler(data),
                  notificationHandler(data),
                ]);

                messageCount++;
              } catch (error) {
                console.error("[Consumer] Error processing message:", error);
                lastError = error instanceof Error ? error : new Error(String(error));
              }

              resolveOffset(message.offset);
              await heartbeat();
            }

            await commitOffsetsIfNecessary();
          },
        })
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });

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
