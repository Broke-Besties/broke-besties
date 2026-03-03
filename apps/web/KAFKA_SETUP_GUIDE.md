# Kafka Event-Driven Settlement Setup Guide

## Step 1: Create Aiven Kafka Service

1. Go to [aiven.io](https://aiven.io)
2. Sign up (free trial available)
3. Create a new Kafka service
4. Inside the service dashboard, create a topic named: `payment.success`

## Step 2: Get Connection Credentials

In the Aiven dashboard for your Kafka service:
1. Go to "Connection Info" tab
2. Note down:
   - **Broker address** (format: `your-service.aivencloud.com:12345`)
   - **Username** (typically `avnadmin`)
   - **Password** (your chosen password)
3. Download the certificates:
   - **CA Certificate** (file: `ca.pem`)
   - **Access Certificate** (file: `service.cert`)
   - **Access Key** (file: `service.key`)

## Step 3: Configure Environment Variables

Open the certificate files and convert them to single-line format:
- Replace all newlines with `\n` literals
- Keep the `-----BEGIN CERTIFICATE-----` and `-----END-----` markers

Add to `.env.local`:

```env
# Kafka Brokers (from Aiven Connection Info)
KAFKA_BROKERS="your-service.aivencloud.com:12345"
KAFKA_USERNAME="avnadmin"
KAFKA_PASSWORD="your-password"

# TLS Certificates (newlines as \n)
KAFKA_CA_CERT="-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----"
KAFKA_CLIENT_CERT="-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----"
KAFKA_CLIENT_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"

# Consumer authentication secret (create a random string)
KAFKA_CONSUMER_SECRET="your-random-secret-abc123xyz"
```

## Step 4: Verify Setup (Dev)

1. Start your dev server: `pnpm dev`
2. Navigate to: http://localhost:3000/events
3. Fill in the "Publish Event" form:
   - Debt ID: 1
   - Amount: 50
   - Provider: mock
4. Click "Publish PAYMENT_SUCCESS"
5. You should see success response with message: `"Mock payment event published to Kafka"`

### Consuming Messages (Dev)

1. Copy your `KAFKA_CONSUMER_SECRET` value
2. In the "Consume Messages" section on the dev page:
   - Paste the consumer secret
   - Click "Consume Messages"
3. You should see `messagesProcessed: 1` in the result
4. Check the database: debt should now have `status: "settled"`

## Step 5: Deploy to Vercel (Production)

1. Go to your Vercel project settings
2. Add environment variables (same as `.env.local`):
   - `KAFKA_BROKERS`
   - `KAFKA_USERNAME`
   - `KAFKA_PASSWORD`
   - `KAFKA_CA_CERT`
   - `KAFKA_CLIENT_CERT`
   - `KAFKA_CLIENT_KEY`
   - `KAFKA_CONSUMER_SECRET`

3. The `vercel.json` file includes a cron job that calls `/api/kafka/consume` every minute
4. The cron job will use the `KAFKA_CONSUMER_SECRET` to authenticate

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Publish Events:                                             │
│  - POST /api/events/trigger-mock (dev UI)                   │
│  - Future: POST /api/webhooks/stripe                        │
│  - Future: POST /api/webhooks/coinbase                      │
│                          │                                    │
│                          ▼                                    │
│                publishPaymentSuccess()  ──→  Kafka Topic     │
│                                               payment.success │
│                          ┌─────────────────────────┘         │
│                          │                                    │
│  Consume & Process:      │                                   │
│  - Dev: Manual button click                                  │
│  - Prod: Vercel Cron (every 1 minute)                       │
│                          │                                    │
│                          ▼                                    │
│              POST /api/kafka/consume                         │
│                          │                                    │
│         ┌────────────────┴────────────────┐                  │
│         ▼                                  ▼                  │
│  Database Listener              Notification Listener        │
│  ─────────────────              ──────────────────           │
│  • Mark debt settled            • Log settlement             │
│  • Set settledAt timestamp      • Future: Send email         │
│  • Cancel pending transactions  • Alert borrower/lender      │
│  • Deactivate alert                                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "KAFKA_BROKERS environment variable is not set"
- Ensure you've added `KAFKA_BROKERS` to `.env.local`
- Restart your dev server

### "Unauthorized" on consume endpoint
- Verify `KAFKA_CONSUMER_SECRET` matches in both `.env.local` and the header
- Check that the header is exactly `x-consumer-secret`

### "Cannot connect to Kafka broker"
- Verify broker address is correct from Aiven dashboard
- Check username/password
- Ensure certificates are properly formatted (newlines as `\n`)
- Verify Aiven service is running (not paused)

### No messages consumed
- Ensure publish worked (check dev UI response)
- Check Aiven dashboard to see if message is in topic
- Verify consumer is subscribing to correct topic name: `payment.success`

## Next Steps

### Adding Stripe Webhook
```typescript
// src/app/api/webhooks/stripe/route.ts
import { publishPaymentSuccess } from "@/events/producer";

export async function POST(req: Request) {
  // Validate Stripe signature...
  
  // On payment.charge.succeeded event:
  await publishPaymentSuccess({
    debtId: chargeMetadata.debtId,
    amount: charge.amount / 100,
    providerType: "stripe",
    providerReference: charge.id,
    timestamp: new Date(),
  });
}
```

### Adding Coinbase Webhook
Similar pattern to Stripe - just extract the data and call `publishPaymentSuccess()`

## Production Monitoring

- Check Vercel Cron Logs: Vercel Dashboard → Project → Cron Jobs
- Monitor Aiven Topic: Check message count in Aiven dashboard
- Database: Query `SELECT * FROM debt WHERE status = 'settled'` to verify processing
