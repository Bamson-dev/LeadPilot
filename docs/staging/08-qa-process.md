# 08 — QA Process (LeadThur V2)

Every feature that ships through staging must pass this process before production approval.

---

## Principles

1. **Staging is the source of truth for “done.”** Production is promotion, not discovery.  
2. **No silent UX invention.** QA validates against approved specs/mockups.  
3. **Real devices when possible;** otherwise Chrome DevTools device mode + one real phone.  
4. **Failures block release** unless Product Owner accepts a documented waiver.

---

## Test matrix (required)

| Dimension | Required coverage |
|-----------|-------------------|
| Desktop | ~1440×900 |
| Tablet | ~768×1024 |
| Mobile | ~390×844 |
| Chrome | Latest stable |
| Safari | Latest stable (macOS/iOS) |
| Firefox | Latest stable |
| Edge | Latest stable |
| Theme | Dark (only mode today); if light added later, both |
| Loading | Spinners/progress for search, checkout, admin |
| Errors | Invalid input, 4xx/5xx, payment fail, search fail |
| Offline | Disconnect mid-search; UI should not crash |
| Slow network | Chrome throttling “Slow 3G” on search + activate |
| Accessibility | Keyboard primary path; labels; focus; contrast spot-check |
| Keyboard | Tab/Enter/Escape on modals and forms |
| Performance | Search usable; no multi-second UI lock on results scroll |

---

## Feature-type checklists

### UI-only / redesign

- [ ] Matches approved design (spacing, type, CTAs)  
- [ ] No broken marketing↔app chrome  
- [ ] Responsive matrix above  
- [ ] Empty / loading / error / success states  

### Search / scraping

- [ ] Start search, see queue/progress  
- [ ] Leads appear via SSE or poll  
- [ ] `fullyComplete` end state  
- [ ] Export CSV  
- [ ] Trial limits if trial-facing  

### Payments

- [ ] Initialize with **test** keys only on staging  
- [ ] Success and failure paths  
- [ ] License row / outreach balance updates  

### Outreach

- [ ] Confirm mock vs live SMTP setting  
- [ ] Connect mailbox path  
- [ ] Send + Sends report  
- [ ] Tracking URL host = staging-backend  

### Admin

- [ ] Login  
- [ ] Changed panel only + one regression smoke (lookup)  
- [ ] No production site-scripts edits from staging confusion  

---

## Roles in QA

| Role | Responsibility |
|------|----------------|
| Implementer (Cursor/dev) | Self-test on staging; attach SHA + notes |
| QA Lead | Matrix execution; log defects |
| Designer / UX | Visual & interaction approval on staging URL |
| Product Architect | Scope / waiver decisions |
| Production Owner | Final go/no-go for `main` promote |

---

## Defect severity

| Severity | Definition | Release rule |
|----------|------------|--------------|
| Blocker | Data loss, payment wrong env, cannot activate/search | No release |
| Major | Core flow broken on one major browser | No release unless waiver |
| Minor | Cosmetic / edge | May ship with ticket |
| Nit | Polish | Backlog |

---

## Evidence to attach before approval

1. Staging FE URL + BE `/health` JSON (SHA)  
2. Short screen recording or screenshots of happy path  
3. Checklist ticks for this feature type  
4. List of known issues / waivers  

---

## Explicit non-goals for QA

- Do not run destructive admin tools against production.  
- Do not unpause nurture on staging without a plan.  
- Do not use live Paystack keys on staging.
