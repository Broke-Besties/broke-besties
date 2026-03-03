import { kafka, TOPICS } from "@/lib/kafka";
import { PaymentSuccessPayload } from "./types";

export async function publishPaymentSuccess(
  payload: PaymentSuccessPayload
): Promise<void> {
  const producer = kafka.producer();

  try {
    await producer.connect();
    await producer.send({
      topic: TOPICS.PAYMENT_SUCCESS,
      messages: [
        {
          value: JSON.stringify(payload),
        },
      ],
    });
    console.log(
      `[Producer] Message published to ${TOPICS.PAYMENT_SUCCESS}:`,
      payload
    );
  } catch (error) {
    console.error("[Producer] Failed to publish message:", error);
    throw error;
  } finally {
    await producer.disconnect();
  }
}
