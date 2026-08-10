# LeadThur UI Audit — Assets

**Root:** `frontend/public/`

---

## Logos

| Asset | Path | Used |
|-------|------|------|
| Logo PNG | `frontend/public/logo.png` | Flutterwave config, SearchLimitModal |
| Icon SVG | `frontend/public/icon.svg` | App icon route |
| LeadThurLogo component | `components/marketing/homepage/LeadThurLogo.tsx` | Marketing Nav/Footer (“LT”) |
| Navbar badge | Inline in `navbar.tsx` (“LP”) | App shell |

**Problem:** Three brand marks (LT / LP / PNG).

---

## Images

| Asset | Path | Used |
|-------|------|------|
| OG image | `frontend/public/og-image.png` | Social / SEO |
| Trustpilot 1–5 | `frontend/public/trustpilot/1.png` … `5.png` | TrustpilotSection |

Blog cover images: stored as URLs or base64 from admin upload (DB), not in `/public`.

---

## Videos

| Asset | Location | Notes |
|-------|----------|-------|
| YouTube demo | `DemoVideoSection.tsx` embed id `miaium-rONk` | External |
| Local MP4 in `frontend/public` | **Not Found** |
| Remotion/video packages | `video/`, `remotion-leadthur/`, `motion-video/` | Marketing production assets — **not** served by Next app runtime |

---

## Icons

| Source | Notes |
|--------|-------|
| `lucide-react` | Product UI |
| Custom contact dots | `contact-dots.tsx` |
| Dialog close | Radix Dialog X |

Illustration library: **Not Found.**

---

## Fonts

| Context | Font |
|---------|------|
| Root layout | Google Inter 400–900 (`--font-inter`) |
| Marketing theme | System UI stack (`-apple-system`, Segoe UI, Roboto, …) |

---

## Brand / color assets

Documented in `05-design-audit.md` and:

- `frontend/styles/globals.css` CSS variables  
- `frontend/components/marketing/homepage/theme.ts`  

Always-on dark mode. Brand accent purple `#7c3aed`.

---

## Other

| Item | Status |
|------|--------|
| Favicon | `icon.svg` |
| Lottie / illustration packs | Not Found |
| Design tokens file (JSON) | Not Found (CSS + TS consts only) |
