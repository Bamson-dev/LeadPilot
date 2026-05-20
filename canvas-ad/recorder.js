(function () {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });
  const btnRecord = document.getElementById("btnRecord");
  const btnConvert = document.getElementById("btnConvert");
  const statusEl = document.getElementById("status");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const convertNote = document.getElementById("convertNote");

  const { DURATION_MS, FPS, loadFonts, renderFrame } = window.LeadPilotCanvasAd;

  let frame = 0;
  let rafId = null;
  let recording = false;
  let recordedChunks = [];
  let webmBlob = null;
  let ffmpegInstance = null;
  let recorder = null;

  const frameMs = 1000 / FPS;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function setProgress(pct) {
    progressWrap.classList.add("visible");
    progressBar.style.width = `${Math.min(100, pct)}%`;
  }

  function hideProgress() {
    progressWrap.classList.remove("visible");
    progressBar.style.width = "0%";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function tick() {
    const elapsed = Math.min(frame * frameMs, DURATION_MS);
    renderFrame(ctx, elapsed);
    frame++;

    if (recording && elapsed >= DURATION_MS) {
      stopRecording();
      return;
    }

    if (recording || elapsed < DURATION_MS + frameMs) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function resetAnimation() {
    if (rafId) cancelAnimationFrame(rafId);
    frame = 0;
    renderFrame(ctx, 0);
    rafId = requestAnimationFrame(tick);
  }

  function stopRecording() {
    if (!recording) return;
    recording = false;
    btnRecord.disabled = false;
    setStatus("Finalizing WebM…");
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  async function startRecording() {
    recordedChunks = [];
    webmBlob = null;
    btnConvert.disabled = true;
    convertNote.textContent = "";

    resetAnimation();

    const stream = canvas.captureStream(FPS);
    const mimeTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || "";

    recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 8_000_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    recorder.onstop = () => {
      webmBlob = new Blob(recordedChunks, { type: "video/webm" });
      downloadBlob(webmBlob, "leadpilot-ad.webm");
      btnConvert.disabled = false;
      setStatus("Downloaded leadpilot-ad.webm — click Convert to MP4");
      convertNote.textContent =
        "If MP4 conversion fails, use CloudConvert or HandBrake on the WebM file.";
      hideProgress();
    };

    recorder.onerror = () => {
      setStatus("Recording failed. Try Chrome or Edge.");
      recording = false;
      btnRecord.disabled = false;
    };

    recording = true;
    btnRecord.disabled = true;
    setStatus("Recording 45s… stay on this tab");
    recorder.start(100);

    setTimeout(() => {
      if (recording) stopRecording();
    }, DURATION_MS);
  }

  btnRecord.addEventListener("click", startRecording);

  async function loadFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    if (typeof FFmpegWASM === "undefined") {
      throw new Error("FFmpeg not loaded");
    }
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });
    setStatus("Loading FFmpeg…");
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  }

  btnConvert.addEventListener("click", async () => {
    if (!webmBlob) {
      setStatus("Record a video first.");
      return;
    }
    try {
      btnConvert.disabled = true;
      setProgress(0);
      setStatus("Converting to MP4…");
      const ffmpeg = await loadFFmpeg();
      const { fetchFile } = FFmpegUtil;
      await ffmpeg.writeFile("input.webm", await fetchFile(webmBlob));
      await ffmpeg.exec([
        "-i",
        "input.webm",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-b:v",
        "8M",
        "output.mp4",
      ]);
      const data = await ffmpeg.readFile("output.mp4");
      const mp4Blob = new Blob([data.buffer], { type: "video/mp4" });
      downloadBlob(mp4Blob, "leadpilot-ad.mp4");
      setStatus("Downloaded leadpilot-ad.mp4");
      convertNote.textContent = "";
    } catch {
      setStatus("MP4 conversion failed — WebM file is ready.");
      convertNote.textContent =
        "Convert leadpilot-ad.webm using CloudConvert or HandBrake, then upload to social.";
    } finally {
      btnConvert.disabled = false;
      hideProgress();
    }
  });

  (async function init() {
    try {
      await loadFonts();
      renderFrame(ctx, 0);
      setStatus("Ready — click Record 45s Video");
    } catch {
      setStatus("Font load failed. Check internet connection.");
    }
  })();
})();
