#!/usr/bin/env node
/**
 * Renders the canvas ad in headless Chromium, records 45s WebM,
 * converts to MP4, saves to canvas-ad/output/
 */
import { createServer } from "http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8765;
const DURATION_MS = 45000;
const OUT_DIR = join(__dirname, "output");
const WEBM_OUT = join(OUT_DIR, "leadpilot-ad.webm");
const MP4_OUT = join(OUT_DIR, "leadpilot-ad.mp4");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
};

function serve(dir) {
  return createServer((req, res) => {
    const file = join(dir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
}

async function getFfmpegPath() {
  try {
    const mod = await import("ffmpeg-static");
    return mod.default;
  } catch {
    return "ffmpeg";
  }
}

function convertToMp4(ffmpeg, webm, mp4) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      webm,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-b:v",
      "8M",
      "-an",
      mp4,
    ];
    const proc = spawn(ffmpeg, args, { stdio: "inherit" });
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("Starting local server…");
  const server = serve(__dirname);
  await new Promise((r) => server.listen(PORT, r));

  console.log("Launching Chromium (1080×1920)…");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.LeadPilotCanvasAd && document.fonts.ready);

  console.log("Recording 45 seconds…");
  const webmBase64 = await page.evaluate(async (durationMs) => {
    const { loadFonts, renderFrame, FPS } = window.LeadPilotCanvasAd;
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d", { alpha: false });
    await loadFonts();

    return new Promise((resolve, reject) => {
      const stream = canvas.captureStream(FPS);
      const mime =
        ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || "";
      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 8_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => reject(new Error("MediaRecorder failed"));
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const step = 0x8000;
        for (let i = 0; i < buf.length; i += step) {
          binary += String.fromCharCode(...buf.subarray(i, i + step));
        }
        resolve(btoa(binary));
      };

      const frameMs = 1000 / FPS;
      let frame = 0;
      recorder.start(100);

      function tick() {
        const elapsed = Math.min(frame * frameMs, durationMs);
        renderFrame(ctx, elapsed);
        frame++;
        if (elapsed < durationMs) {
          setTimeout(tick, frameMs);
        } else {
          recorder.stop();
        }
      }
      tick();
    });
  }, DURATION_MS);

  await browser.close();
  server.close();

  writeFileSync(WEBM_OUT, Buffer.from(webmBase64, "base64"));
  console.log(`Saved ${WEBM_OUT}`);

  const ffmpeg = await getFfmpegPath();
  console.log("Converting to MP4…");
  try {
    await convertToMp4(ffmpeg, WEBM_OUT, MP4_OUT);
    console.log(`\n✓ Done: ${MP4_OUT}`);
  } catch (err) {
    console.error("FFmpeg conversion failed:", err.message);
    console.log(`WebM is ready at: ${WEBM_OUT}`);
    console.log("Install ffmpeg: brew install ffmpeg");
    console.log("Or run: npm install ffmpeg-static --prefix canvas-ad");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
