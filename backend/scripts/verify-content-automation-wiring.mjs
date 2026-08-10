/**
 * Static verification for content automation module wiring.
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const requiredFiles = [
  "src/content-automation/pipeline.ts",
  "src/content-automation/scheduler.ts",
  "src/content-automation/admin-router.ts",
  "src/content-automation/providers/tavily.ts",
  "src/content-automation/providers/serper.ts",
  "src/content-automation/providers/openai-image.ts",
  "src/database/content-automation-sql.ts",
];

const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(root, f)));
const serverSrc = fs.readFileSync(path.join(root, "src/server.ts"), "utf8");
const wired =
  serverSrc.includes("contentAutomationRouter") &&
  serverSrc.includes("startContentAutomationScheduler");

const report = {
  ok: missing.length === 0 && wired,
  missing,
  wired,
  providers: ["DEEPSEEK_API_KEY", "TAVILY_API_KEY", "SERPER_API_KEY", "OPENAI_API_KEY"],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
