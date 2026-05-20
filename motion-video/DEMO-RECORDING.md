# Where to find the updated demo

## Live screen recording (recommended)

```bash
cd /Users/donbamz/LeadRush
npm run build && npm run start
```

Open in your browser:

**http://localhost:3000/demo-recording**

This is the **latest** version (slow pacing, scan + generate overlap, LIFETIME ACCESS end card).

Record with QuickTime or OBS in full screen.

---

## MP4 files (pre-rendered)

| File | What it is |
|------|------------|
| `motion-video/out/leadpilot-screen-demo.mp4` | Full 3-search demo — **re-render after changes** |
| `motion-video/out/leadpilot-promo.mp4` | Older 46s marketing cut — **not** the screen-recording demo |

Re-render the screen demo:

```bash
cd motion-video
npm run render:screen
```

Output: `motion-video/out/leadpilot-screen-demo.mp4`

---

## What changed recently

- Slower typing, rows, and counter (~40% slower)
- Results appear **while** location is still typing (scan + generate)
- End card: **"You're getting LIFETIME ACCESS"**
