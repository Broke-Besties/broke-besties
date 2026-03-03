import { Kafka, logLevel } from "kafkajs";

export const TOPICS = {
  PAYMENT_SUCCESS: "payment.success",
} as const;

function createKafkaClient(): Kafka {
  const brokers = (process.env.KAFKA_BROKERS || "").split(",");

  if (!process.env.KAFKA_BROKERS) {
    throw new Error("KAFKA_BROKERS environment variable is not set");
  }

  const ssl =
    process.env.KAFKA_CA_CERT ||
    process.env.KAFKA_CLIENT_CERT ||
    process.env.KAFKA_CLIENT_KEY
      ? {
          ca: process.env.KAFKA_CA_CERT
            ? process.env.KAFKA_CA_CERT.split("\\n").join("\n")
            : undefined,
          cert: process.env.KAFKA_CLIENT_CERT
            ? process.env.KAFKA_CLIENT_CERT.split("\\n").join("\n")
            : undefined,
          key: process.env.KAFKA_CLIENT_KEY
            ? process.env.KAFKA_CLIENT_KEY.split("\\n").join("\n")
            : undefined,
          rejectUnauthorized: true,
        }
      : true;

  const sasl = process.env.KAFKA_USERNAME
    ? {
        mechanism: "plain" as const,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD || "",
      }
    : undefined;

  return new Kafka({
    clientId: "broke-besties-web",
    brokers,
    ssl,
    sasl,
    logLevel: logLevel.ERROR,
  });
}

const globalForKafka = globalThis as unknown as {
  kafka: Kafka | undefined;
};

export const kafka = globalForKafka.kafka ?? createKafkaClient();

if (process.env.NODE_ENV !== "production") {
  globalForKafka.kafka = kafka;
}
