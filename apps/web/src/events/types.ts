export const EventNames = {
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  DEBT_SETTLED: "debt.settled",
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];

export interface PaymentSuccessPayload {
  debtId: number;
  amount: number;
  providerType: "stripe" | "coinbase" | "mock";
  providerReference?: string;
  timestamp: Date;
}

export interface PaymentFailedPayload {
  debtId: number;
  amount: number;
  providerType: "stripe" | "coinbase" | "mock";
  reason: string;
  timestamp: Date;
}

export interface DebtSettledPayload {
  debtId: number;
  lenderId: string;
  borrowerId: string;
  amount: number;
  provider: string;
}

export interface EventPayloadMap {
  [EventNames.PAYMENT_SUCCESS]: PaymentSuccessPayload;
  [EventNames.PAYMENT_FAILED]: PaymentFailedPayload;
  [EventNames.DEBT_SETTLED]: DebtSettledPayload;
}

export type EventHandler<E extends EventName> = (
  payload: EventPayloadMap[E]
) => Promise<void> | void;
