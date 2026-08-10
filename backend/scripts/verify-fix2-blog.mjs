#!/usr/bin/env node
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";
import { registerSupabaseMock, getCapturedUpdates } from "./mock-supabase-hook.mjs";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://wffwhktwessvlubndkmj.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-service-role-key-0123456789ab";
process.env.FRONTEND_URL = "https://staging.leadthur.com";
process.env.ADMIN_EMAIL = "admin@leadthur.com";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.JWT_SECRET = "test-jwt-secret-01234567890123456789012";

await registerSupabaseMock();

const { adminRouter } = await import("../dist/api/admin-router.js");

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use("/admin", adminRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const token = jwt.sign({ role: "admin", email: "admin@leadthur.com" }, process.env.JWT_SECRET, {
  expiresIn: "8h",
});

const res = await fetch(`${base}/admin/blog/posts/post-1`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    title: "Updated Secure Title",
    author: "Evil Author",
    is_admin: true,
    status: "draft",
  }),
});

const body = await res.json().catch(() => ({}));
const captured = getCapturedUpdates();
const pass =
  res.status === 200 &&
  captured?.title === "Updated Secure Title" &&
  captured?.author === undefined &&
  captured?.is_admin === undefined;

console.log(
  JSON.stringify({
    label: "blog update allowlist",
    pass,
    status: res.status,
    capturedUpdates: captured,
    response: body,
  })
);

server.close();
process.exit(pass ? 0 : 1);
