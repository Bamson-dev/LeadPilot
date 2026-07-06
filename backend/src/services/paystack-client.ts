import Paystack from "paystack";
import type { PaystackClient } from "paystack";
import { config } from "../config/env";

let client: PaystackClient | null = null;

export function getPaystack(): PaystackClient {
  const secret = config.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  if (!client) {
    client = Paystack(secret);
  }
  return client;
}

/** Promisify Paystack SDK callback-style APIs. */
export function paystackAsync<T>(
  run: (cb: (err: Error | null, body: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    run((err, body) => {
      if (err) reject(err);
      else resolve(body);
    });
  });
}

interface PaystackApiResponse<T> {
  status: boolean;
  message?: string;
  data: T;
}

async function paystackHttp<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<T> {
  const secret = config.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");

  const url = new URL(`https://api.paystack.co${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as PaystackApiResponse<T> & { message?: string };
  if (!json.status) {
    throw new Error(json.message || "Paystack API request failed");
  }
  return json.data;
}

export async function createTransferRecipient(params: {
  name: string;
  account_number: string;
  bank_code: string;
}): Promise<{ recipient_code: string }> {
  return paystackHttp("POST", "/transferrecipient", {
    type: "nuban",
    name: params.name,
    account_number: params.account_number,
    bank_code: params.bank_code,
    currency: "NGN",
  });
}

export async function resolveBankAccount(params: {
  account_number: string;
  bank_code: string;
}): Promise<{ account_name: string; account_number: string }> {
  return paystackHttp("GET", "/bank/resolve", undefined, {
    account_number: params.account_number,
    bank_code: params.bank_code,
  });
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  customer: { email: string };
  metadata: Record<string, unknown>;
  reference: string;
}> {
  return paystackHttp("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function initiateTransfer(params: {
  amountKobo: number;
  recipient: string;
  reason: string;
  reference: string;
}): Promise<{ transfer_code: string }> {
  return paystackHttp("POST", "/transfer", {
    source: "balance",
    amount: params.amountKobo,
    recipient: params.recipient,
    reason: params.reason,
    reference: params.reference,
  });
}

export interface PaystackPlanRecord {
  id: number;
  name: string;
  plan_code: string;
  amount: number;
  interval: string;
}

export async function listPaystackPlans(params?: {
  perPage?: number;
  page?: number;
}): Promise<PaystackPlanRecord[]> {
  const data = await paystackHttp<PaystackPlanRecord[] | PaystackPlanRecord>(
    "GET",
    "/plan",
    undefined,
    {
      perPage: String(params?.perPage ?? 100),
      page: String(params?.page ?? 1),
    }
  );
  return Array.isArray(data) ? data : [data];
}

export async function createPaystackPlan(params: {
  name: string;
  amountKobo: number;
  interval?: "monthly";
  description?: string;
}): Promise<PaystackPlanRecord> {
  return paystackHttp<PaystackPlanRecord>("POST", "/plan", {
    name: params.name,
    amount: params.amountKobo,
    interval: params.interval ?? "monthly",
    description: params.description,
  });
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
  planCode?: string;
  channels?: string[];
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  const body: Record<string, unknown> = {
    email: params.email.toLowerCase().trim(),
    amount: params.amountKobo,
    currency: "NGN",
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
    channels: params.channels ?? ["card", "bank", "ussd", "bank_transfer"],
  };
  if (params.planCode) {
    body.plan = params.planCode;
  }
  return paystackHttp("POST", "/transaction/initialize", body);
}
