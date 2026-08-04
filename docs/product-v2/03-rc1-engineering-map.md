# LeadThur V2 RC1 — Engineering Map

**Visual source of truth:** Stitch RC1 screens in `docs/product-v2/screens/rc1-*.png`  
**Behaviour source of truth:** Existing LeadThur frontend + backend (staging/production)  
**Branch:** `staging`

## Principle

RC1 defines **look, layout, and interaction chrome**.  
Existing product APIs define **what data and actions are real**.

Where RC1 invents surfaces LeadThur does not support (AI firmographics, Sync CRM, people-enrichment tables, pipelines as CRM), we:

1. Match shell / tokens / component language exactly  
2. Bind real capabilities only  
3. Record the gap in the screen milestone report as **Known differences from RC1**  
4. Never fake live metrics or invent backend endpoints

## Nav mapping (RC1 → real product)

| RC1 | Maps to | Notes |
|-----|---------|-------|
| Home | `/dashboard` overview / recent searches | Existing search history + credits |
| Discovery / Workspace | Search + results (businesses) | Flagship — existing scrape/search |
| Saved lists | Search history / saved result sets | No new list DB in Phase 1 |
| Outreach | Existing outreach workspace | Gmail + send balance |
| Mailboxes | Existing mailbox section | |
| Insights / Analytics | Deferred or credits/sends summary only | No fake ROI charts |
| Account / Settings | Activate profile chrome + billing + mailbox | License auth unchanged |
| Affiliate | Existing affiliate section | |
| Billing | Existing plans / checkout | |
| Admin | Existing `/admin` | Separate shell ok |

## Discovery table columns

RC1 people columns (Lead Name / Company / Tags) are **visual patterns**.  
LeadThur rows remain **businesses** from search results:

Business · Category · Location · Phone · Email · Rating · Status · Actions

Same selection, bulk export, outreach, hover copy behaviours as today — restyled.
