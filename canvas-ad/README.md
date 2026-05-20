# LeadPilot Canvas Ad (9:16)

Portrait product ad: **1080×1920**, **45 seconds**, **30fps**.

## Open on your Mac

```bash
open /Users/donbamz/LeadRush/canvas-ad/index.html
```

Or start a local server (recommended for FFmpeg):

```bash
cd /Users/donbamz/LeadRush/canvas-ad
python3 -m http.server 8765
```

Then open: **http://localhost:8765**

## Export (browser)

1. Click **Record 45s Video** — plays animation from start and downloads `leadpilot-ad.webm`
2. Click **Convert to MP4** — downloads `leadpilot-ad.mp4` (requires internet for FFmpeg.wasm)

Use **Chrome** or **Edge** for best MediaRecorder support.

## Export to Downloads automatically (recommended)

From the repo root:

```bash
npm run canvas-ad:export
```

This records in headless Chrome and saves:

- `~/Downloads/leadpilot-ad.webm`
- `~/Downloads/leadpilot-ad.mp4`

## Files

| File | Purpose |
|------|---------|
| `index.html` | UI + canvas |
| `animation.js` | All 8 scenes (canvas only) |
| `recorder.js` | MediaRecorder + FFmpeg convert |
