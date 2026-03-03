"use client";

import { useState } from "react";

export default function EventsDevPage() {
  const [debtId, setDebtId] = useState("");
  const [amount, setAmount] = useState("");
  const [providerType, setProviderType] = useState("mock");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  async function handlePublish() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/events/trigger-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtId: Number(debtId),
          amount: Number(amount),
          providerType,
        }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  async function handleConsume() {
    if (!consumerSecret) {
      setResult(JSON.stringify({ error: "Consumer secret is required" }, null, 2));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/kafka/consume", {
        method: "POST",
        headers: { "x-consumer-secret": consumerSecret },
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 600 }}>
      <h1>Event Bus — Dev Control Panel</h1>

      <div style={{ marginTop: "2rem", borderTop: "1px solid #ddd", paddingTop: "2rem" }}>
        <h2>Publish Event</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label>
            Debt ID
            <input
              type="number"
              value={debtId}
              onChange={(e) => setDebtId(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <label>
            Provider
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            >
              <option value="mock">mock</option>
              <option value="stripe">stripe</option>
              <option value="coinbase">coinbase</option>
            </select>
          </label>
          <button
            onClick={handlePublish}
            disabled={loading || !debtId || !amount}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", background: "#007bff", color: "white", border: "none" }}
          >
            {loading ? "Publishing…" : "Publish PAYMENT_SUCCESS"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "2rem", borderTop: "1px solid #ddd", paddingTop: "2rem" }}>
        <h2>Consume Messages</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label>
            Consumer Secret
            <input
              type="password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              placeholder="From KAFKA_CONSUMER_SECRET env var"
              style={{ display: "block", width: "100%", padding: "0.5rem" }}
            />
          </label>
          <button
            onClick={handleConsume}
            disabled={loading || !consumerSecret}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", background: "#28a745", color: "white", border: "none" }}
          >
            {loading ? "Consuming…" : "Consume Messages"}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h3>Result</h3>
          <pre style={{ background: "#f4f4f4", padding: "1rem", overflow: "auto", maxHeight: 400 }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
