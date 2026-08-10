# LeadThur UI Audit — Feature Matrix

| Feature | Status | Primary screen(s) |
|---------|--------|-------------------|
| Marketing landing | Finished | `/` |
| Free trial (2 searches) | Finished | `/freetrial` |
| Trial email nurture sequence | Finished (ops may be paused) | Email only |
| Lifetime checkout | Finished | `/checkout` |
| Dual payment (Paystack/FLW) | Finished | Checkout, top-up modal |
| License activation | Finished | `/activate` |
| Device binding | Finished | Activate / dashboard register |
| Maps search + enrichment | Finished | `/dashboard` |
| SSE live results | Finished | Dashboard |
| Search result deep link | Finished | `/dashboard/search/[id]` |
| CSV export | Finished | Dashboard actions |
| Export confirmation modal | Unused | `export-modal.tsx` orphan |
| Lead status CRM | Finished | Results table |
| Rating filter | Finished | Results table |
| Search history | Finished | Dashboard history |
| Recent searches panel | Finished | Dashboard |
| WhatsApp templates | Finished | WhatsappTemplateModal |
| AI WhatsApp message | Finished | WhatsappTemplateModal |
| Search credit top-ups | Finished | SearchLimitModal |
| Search upgrade banner | Finished | Dashboard |
| Onboarding modal | Finished | Dashboard first visit |
| Affiliate section | Finished | Dashboard |
| Affiliate payouts (user) | Finished | Affiliate + admin |
| Outreach mailboxes | Finished | Mailboxes tab |
| Guided Gmail connect | Finished | Mailbox wizard |
| Outreach compose/send | Finished | Send panel |
| Outreach AI email | Finished | Send panel |
| Sends report | Finished | Sends tab |
| Open tracking | Finished | Pixel (email) |
| Mark replied | Finished | Sends report |
| Outreach subscriptions/packs | Finished | `/dashboard/plans` |
| Follow-up sequences | Finished (backend) | UI dedicated manager **Incomplete / Hidden** |
| Admin console | Finished | `/admin` |
| Blog public + CMS | Finished | `/blog`, admin |
| Site script injection | Finished | Admin scripts |
| Suspended page | Finished | `/suspended` |
| Demo mode | Experimental | `/demo` |
| Demo recording | Experimental | `/demo-recording` |
| Password accounts | Not Found | — |
| Sidebar IA | Not Found | — |
| Light mode | Not Found | — |
| Business detail page | Not Found | — |
| In-app invoices | Not Found | — |
| Coupons | Not Found | — |
| Drawers (Sheet) | Not Found | — |
| Legacy leads-table | Unused | orphan component |
| Legacy payment-success | Hidden/legacy | `/payment-success` |
| get-access / start | Finished redirects | → checkout |

### Status legend

- **Finished** — wired end-to-end in UI + API  
- **Incomplete** — backend exists, weak/missing UI  
- **Experimental** — env-gated or sales tooling  
- **Broken** — none confirmed in this read-only pass without runtime QA  
- **Hidden** — exists but not discoverable as first-class nav  
- **Unused** — code present, not imported in live paths  
- **Not Found** — no product surface
