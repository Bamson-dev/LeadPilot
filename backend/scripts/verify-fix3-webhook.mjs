#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-fix3-webhook-case.mjs");

const cases = [
  ["unset secret hash rejects", "", "anything", 500],
  ["invalid signature rejects", "expected-hash", "wrong-hash", 401],
  ["valid signature accepts non-success", "expected-hash", "expected-hash", 200],
];

let allPass = true;
for (const [label, secret, hash, expected] of cases) {
  const result = spawnSync(process.execPath, [runner, secret, hash], {
    env: {
      ...process.env,
      FLUTTERWAVE_SECRET_HASH: secret,
    },
    encoding: "utf8",
  });
  let parsed;
  try {
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    parsed = JSON.parse(lines[lines.length - 1]);
  } catch {
    parsed = { pass: false, stdout: result.stdout, stderr: result.stderr };
  }
  const pass = parsed.pass === true && parsed.actualStatus === expected;
  allPass = allPass && pass;
  console.log(
    JSON.stringify({
      label,
      pass,
      expectedStatus: expected,
      actualStatus: parsed.actualStatus,
      body: parsed.body,
    })
  );
}

process.exit(allPass ? 0 : 1);
