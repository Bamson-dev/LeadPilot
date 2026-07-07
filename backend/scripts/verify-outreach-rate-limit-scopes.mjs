#!/usr/bin/env node
import { createRequire } from "node:module";

process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.RATE_LIMIT_MAX = "2";
process.env.RATE_LIMIT_SENDS_MAX = "4";
process.env.RATE_LIMIT_CHECKOUT_BALANCE_MAX = "5";

const require = createRequire(import.meta.url);
const { rateLimit } = require("../dist/middleware/rate-limit.js");

function run(path, times) {
  let blockedAt = -1;
  for (let i = 1; i <= times; i++) {
    let blocked = false;
    const req = {
      originalUrl: path,
      path,
      ip: "1.1.1.1",
      headers: {},
    };
    const res = {
      status() {
        blocked = true;
        return this;
      },
      json() {
        return this;
      },
    };
    rateLimit(req, res, () => {});
    if (blocked) {
      blockedAt = i;
      break;
    }
  }
  return blockedAt;
}

const defaultBlocked = run("/search", 4);
const sendsBlocked = run("/sends", 6);
const balanceBlocked = run("/balance", 7);

const okDefault = defaultBlocked === 3;
const okSends = sendsBlocked === 5;
const okBalance = balanceBlocked === 6;

if (okDefault) console.log("PASS: default scope blocks at 3rd request");
else console.log(`FAIL: default scope blocked at ${defaultBlocked}`);

if (okSends) console.log("PASS: sends scope blocks at 5th request");
else console.log(`FAIL: sends scope blocked at ${sendsBlocked}`);

if (okBalance) console.log("PASS: checkout/balance scope blocks at 6th request");
else console.log(`FAIL: checkout/balance scope blocked at ${balanceBlocked}`);

if (!okDefault || !okSends || !okBalance) process.exit(1);
