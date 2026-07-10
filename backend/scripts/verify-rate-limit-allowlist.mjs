#!/usr/bin/env node
/**
 * Verifies IP allowlist bypass in rate-limit middleware.
 * Usage: node backend/scripts/verify-rate-limit-allowlist.mjs
 */
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX = "2";
process.env.RATE_LIMIT_IP_ALLOWLIST = "162.120.188.117,203.0.113.50";

const { rateLimit, clientIp } = await import("../dist/middleware/rate-limit.js");

function mockReq(ip, path = "/freetrial") {
  return {
    ip,
    originalUrl: path,
    path,
    headers: { "x-forwarded-for": ip },
  };
}

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function hit(ip, path) {
  const req = mockReq(ip, path);
  const res = mockRes();
  let nextCalled = false;
  rateLimit(req, res, () => {
    nextCalled = true;
  });
  return { status: res.statusCode, body: res.body, nextCalled };
}

let blocked = false;
for (let i = 0; i < 5; i++) {
  const r = hit("198.51.100.99");
  if (r.status === 429) blocked = true;
}

const allowlistedBurst = [];
for (let i = 0; i < 5; i++) {
  allowlistedBurst.push(hit("162.120.188.117"));
}

const report = {
  nonAllowlistedEventuallyBlocked: blocked,
  allowlistedAlwaysPasses: allowlistedBurst.every((r) => r.nextCalled && r.status === 200),
  blockedResponse: hit("198.51.100.99", "/freetrial"),
  clientIpForwarded: clientIp(mockReq("162.120.188.117")),
};

console.log(JSON.stringify(report, null, 2));
const pass =
  report.nonAllowlistedEventuallyBlocked &&
  report.allowlistedAlwaysPasses &&
  report.blockedResponse.status === 429 &&
  report.blockedResponse.body?.code === "RATE_LIMITED";
process.exit(pass ? 0 : 1);
