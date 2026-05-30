# LeadThur motion video

Hardcoded **46-second** promo motion design (1920×1080). Renders to **MP4** on your Mac — no After Effects required.

## What’s in the video

1. Logo intro  
2. Hero headline + example chips (dental / salon / real estate)  
3. **Three search demos** — types query + location for each niche  
4. **Three live tables** — Business, **Address**, Phone, Email, Rating per row  
5. Feature cards (addresses, contacts, export)  
6. CTA outro  

**Example scenarios (in `src/data/demo-leads.ts`):**

| Business type        | Location              |
|----------------------|-----------------------|
| dental clinic        | Victoria Island, Lagos |
| hair salon           | Ikeja, Lagos          |
| real estate agency   | Abuja                 |

## Render MP4 (one-time setup)

```bash
cd /Users/donbamz/LeadRush/motion-video
npm install
npm run render
```

**Output file:** `motion-video/out/leadthur-promo.mp4`

Optional:

```bash
npm run render:4k        # 3840×2160
npm run render:vertical  # 1080×1920 (Stories/Reels)
npm run studio           # preview & scrub timeline in browser
```

First render downloads FFmpeg via Remotion (~1–3 min). Later renders are faster.

## From project root

```bash
npm run motion:render
```

(added to main `package.json`)

## Customize

| File | Purpose |
|------|---------|
| `src/data/demo-leads.ts` | Business names, phones, emails in the table |
| `src/LeadThurPromo.tsx` | Scene timing & animations |
| `src/theme.ts` | Colors, duration, resolution |

Edit copy or leads, then run `npm run render` again.
