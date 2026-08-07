# 09 — Redesign Workflow (LeadThur V2) — MOST IMPORTANT

This is the **official** process for every LeadThur V2 redesign and feature.

---

## Pipeline

```text
Product Decision
        ↓
UX Design (Figma / specs — outside Cursor inventing UI)
        ↓
Design Approval (Designer + Product Architect)
        ↓
Technical Specification (APIs, states, constraints)
        ↓
Cursor / Developer Implementation (against the spec only)
        ↓
Deploy to Staging (frontend + backend)
        ↓
QA Review (08-qa-process.md matrix)
        ↓
UX Review (on staging URL, not localhost alone)
        ↓
Fixes (still on staging)
        ↓
Final Approval (Product Architect + Production Owner)
        ↓
Production Release (main + verify health)
```

---

## Hard rules for Cursor / implementers

1. **Cursor must never invent UX.**  
   No new layouts, IA, copy hierarchy, or interaction patterns unless they appear in an approved specification or design.

2. **Cursor must never redesign layouts without specifications.**  
   Bugfixes that preserve existing UX are OK. Visual redesigns require Design Approval first.

3. **Every redesign must be reviewed on staging before production.**  
   Localhost-only approval is insufficient.

4. **Staging is the contract.**  
   If it is not on staging, it is not releasable.

5. **Do not “improve” marketing or dashboard aesthetics ad hoc.**  
   File a product decision instead.

---

## Responsibilities

| Role | Owns | Does not |
|------|------|----------|
| **Product Architect** | Problem, priority, acceptance criteria, waivers | Pixel design in Cursor chats without designer |
| **Designer** | Visual/UX specs, design system, staging visual sign-off | Deploying production |
| **Cursor (AI implementer)** | Code matching the approved spec; staging-ready PR | Inventing UX; skipping staging |
| **Developer** | Reviews AI diffs; owns merge quality; env correctness | Silent scope expansion |
| **QA** | Matrix testing on staging; defect log | Design invention |
| **Production Owner** | Go/no-go to `main`; Coolify/Vercel production; incidents | Skipping checklist |

---

## Artifacts required at each gate

| Gate | Artifact |
|------|----------|
| Product Decision | Written problem + success metric |
| Design Approval | Linked mockups / written UX notes |
| Technical Spec | Endpoints, states, empty/error/loading, mobile behavior |
| Implementation | PR + staging SHAs |
| QA | Checklist + evidence |
| UX Review | Written approve/reject on staging |
| Production | Release checklist (`06`) complete |

---

## What “reviewed on staging” means

- Open **`https://staging.leadthur.com`** (with SSO access if required).  
- Confirm API traffic hits **`https://staging-backend.leadthur.com`**.  
- Confirm backend `/health.gitCommitSha` matches the build under test.  
- Exercise the changed flow on desktop + mobile.  
- Designer signs off **in writing** (PR comment, Linear, Notion, etc.).

---

## Mapping to current tooling (honest)

| Step | Current support |
|------|-----------------|
| Spec → code | Cursor in repo |
| FE → staging | Vercel on `staging` branch |
| BE → staging | Coolify git-push on `staging` branch |
| FE → production | Vercel on `main` |
| BE → production | GHA `deploy.yml` + Coolify webhook |
| QA automation | Manual + `backend/scripts/verify-*.mjs` |

Until staging backend CI exists, Production Owner must confirm Coolify staging redeploy as part of the Implementation → Staging step.

---

## Anti-patterns (forbidden)

- Shipping UI straight to `main` / production domains for “just a small redesign.”  
- Using production admin to “try” experimental scripts.  
- Enabling **`MOCK_OUTREACH_SEND` / `MOCK_MAILBOX_SMTP` / `ENABLE_TEST_EMAIL` / `DEMO_MODE`** on Coolify staging or production (P0-3 boot failure).  
- Approving designs only from Storybook/localhost when staging exists.  
- Cursor expanding scope (“while here, I also redesigned pricing”).

---

## Minimal template for a V2 change request

```text
Title:
Problem:
Approved design link:
Technical notes (API/state):
Staging FE URL:
Staging BE SHA:
QA result:
UX approval:
Prod owner approval:
```
