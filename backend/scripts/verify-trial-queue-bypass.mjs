#!/usr/bin/env node
/**
 * Verifies trial searches are not blocked by QUEUE_FULL.
 * Usage: node backend/scripts/verify-trial-queue-bypass.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routerSrc = fs.readFileSync(
  path.join(__dirname, "../src/api/search-router.ts"),
  "utf8"
);

const trialStart = routerSrc.indexOf("export async function handleFreeTrialSearch");
const trialEnd = routerSrc.indexOf("searchRouter.post(\"/freetrial\"");
const trialHandler = routerSrc.slice(trialStart, trialEnd);

const trialBlockRemoved =
  trialHandler.includes("const claim = await claimTrialSearch") &&
  !trialHandler.includes("QUEUE_FULL");

const paidStillGuarded = /searchRouter\.post\("\/",[\s\S]*?QUEUE_FULL/.test(routerSrc);

const queueSrc = fs.readFileSync(path.join(__dirname, "../src/queue/search-queue.ts"), "utf8");
const trialPriority = /priority:\s*data\.isTrial\s*\?\s*1\s*:\s*5/.test(queueSrc);

const report = {
  trialSkipsQueueFullGate: trialBlockRemoved,
  paidSearchKeepsQueueFullGate: paidStillGuarded,
  trialJobsGetHigherPriority: trialPriority,
  pass: trialBlockRemoved && paidStillGuarded && trialPriority,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
