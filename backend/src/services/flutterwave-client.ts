import { config } from "../config/env";

interface FlutterwaveVerifyResponse {
  status: string;
  message?: string;
  data: {
    status: string;
    tx_ref: string;
    flw_ref?: string;
    amount: number;
    currency: string;
    customer?: { email?: string; name?: string };
    meta?: Record<string, unknown>;
  };
}

export async function verifyFlutterwaveTransaction(txRef: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  customer: { email: string };
  tx_ref: string;
  metadata?: Record<string, unknown>;
}> {
  const secret = config.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  }

  const url = new URL("https://api.flutterwave.com/v3/transactions/verify_by_reference");
  url.searchParams.set("tx_ref", txRef);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  const json = (await res.json()) as FlutterwaveVerifyResponse;
  if (!res.ok || json.status !== "success") {
    throw new Error(json.message || "Flutterwave verification failed");
  }

  const email = json.data.customer?.email;
  if (!email) {
    throw new Error("No customer email on Flutterwave transaction");
  }

  return {
    status: json.data.status,
    amount: json.data.amount,
    currency: json.data.currency,
    customer: { email },
    tx_ref: json.data.tx_ref,
    metadata: json.data.meta,
  };
}
