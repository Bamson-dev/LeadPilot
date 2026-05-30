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
    customer?: { email?: string };
    meta?: Record<string, unknown>;
  };
}

async function flutterwaveFetch<T>(path: string): Promise<T> {
  const secret = config.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  }

  const res = await fetch(`https://api.flutterwave.com/v3${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  const json = (await res.json()) as T & { message?: string };
  return json;
}

/** Verify by Flutterwave transaction id (from inline checkout callback). */
export async function verifyFlutterwaveByTransactionId(
  transactionId: string
): Promise<FlutterwaveVerifyResponse["data"]> {
  const json = await flutterwaveFetch<FlutterwaveVerifyResponse>(
    `/transactions/${encodeURIComponent(transactionId)}/verify`
  );

  if (json.status !== "success" || json.data.status !== "successful") {
    throw new Error(json.message || "Flutterwave payment not successful");
  }

  return json.data;
}

/** Verify by tx_ref (webhook / reference lookup). */
export async function verifyFlutterwaveByTxRef(
  txRef: string
): Promise<FlutterwaveVerifyResponse["data"]> {
  const json = await flutterwaveFetch<FlutterwaveVerifyResponse>(
    `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`
  );

  if (json.status !== "success" || json.data.status !== "successful") {
    throw new Error(json.message || "Flutterwave payment not successful");
  }

  return json.data;
}
