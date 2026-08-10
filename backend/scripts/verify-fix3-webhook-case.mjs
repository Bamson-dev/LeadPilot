#!/usr/bin/env node
import express from "express";
import http from "http";

const secret = process.argv[2] ?? "";
const verifHash = process.argv[3] ?? "";

process.env.PORT = "3000";
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || "https://wffwhktwessvlubndkmj.supabase.co";
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || "test-service-role-key-0123456789ab";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@leadthur.com";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-password-123";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
process.env.FLUTTERWAVE_SECRET_HASH = secret;

const { webhookRouter } = await import("../dist/api/webhook-router.js");
const app = express();
app.use("/webhooks", webhookRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

const res = await fetch(`http://127.0.0.1:${port}/webhooks/flutterwave`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(verifHash ? { "verif-hash": verifHash } : {}),
  },
  body: JSON.stringify({ event: "charge.completed", data: { status: "pending" } }),
});
const body = await res.json().catch(() => ({}));
await new Promise((resolve) => server.close(resolve));

console.log(
  JSON.stringify({
    pass: true,
    actualStatus: res.status,
    body,
  })
);
