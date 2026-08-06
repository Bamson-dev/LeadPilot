# 05 — Background Services (Staging)

All services below run in (or alongside) the **staging backend container**, unless noted.

---

## 1. Express API

| Item | Detail |
|------|--------|
| Start | `node dist/server.js` (Docker CMD) / `tsx watch src/server.ts` (dev) |
| Port | `3000` |
| Health | `GET /health`, `GET /api/health`, `GET /health/ready` |
| Staging URL | `https://staging-backend.leadthur.com` |

**Healthy when:** JSON `status: "ok"`, not Next.js HTML; `gitCommitSha` present.

```bash
curl -sS https://staging-backend.leadthur.com/health | jq '{status,browser,queue:.queue.mode,sha:.gitCommitSha,ipCap:.freeTrialIpCapReady}'
```

---

## 2. Search queue + worker (BullMQ or inline)

| Item | Detail |
|------|--------|
| Start | `initSearchQueue()` during `start()` in `server.ts` |
| Redis | Required for BullMQ; else inline fallback |
| Worker | `search-worker.ts` in-process |
| Verify | `/health` → `queue.mode` is `"bullmq"` (staging probe: bullmq) |

Also: orphan reconcile interval inside search-queue.

---

## 3. Outreach send queue + worker

| Item | Detail |
|------|--------|
| Start | `initOutreachSendQueue()` on boot |
| Worker | `outreach-send-worker.ts` |
| Mock | **Not available on Coolify staging** — `MOCK_OUTREACH_SEND` refused under `NODE_ENV=production` |
| Verify | Send test via staging UI with real Gmail + disposable recipient; scripts `verify-outreach-staging*.mjs` |

---

## 4. Redis

| Item | Detail |
|------|--------|
| Start | External process / managed Redis — **Not Found** in compose |
| Config | `REDIS_URL` in Coolify env |
| Verify | Health `queue.mode === "bullmq"` |

---

## 5. Playwright / browser pool

| Item | Detail |
|------|--------|
| Start | `initBrowserPoolSafe()` after routes (retries) |
| Role | Google Maps scrape + email site crawl |
| Verify | `/health.browser === "ready"` |

If `initializing` for long periods, scrapes fail or queue.

---

## 6. Trial email scheduler

| Item | Detail |
|------|--------|
| Start | `startTrialSequenceScheduler()` — hourly |
| Role | Nurture sequence + post-search emails |
| Verify | Logs `Trial email sequence scheduler started`; DB `sequence_paused`; staging Resend/Zepto activity |

**Caution:** Staging can email real addresses if signups exist and sequence not paused.

---

## 7. Outreach grace scheduler

| Item | Detail |
|------|--------|
| Start | `startOutreachGraceScheduler()` — hourly |
| Role | Expire grace-period outreach accounts |
| Verify | Boot log; account status transitions |

---

## 8. Startup migrations

| Item | Detail |
|------|--------|
| Start | `runStartupMigrations()` if `SUPABASE_DB_PASSWORD` set |
| Role | IP usage table, sequence columns, v3 migration/backfill |
| Verify | `/health.freeTrialIpCapReady === true`; Coolify logs |

---

## 9. Paystack outreach plan ensure

| Item | Detail |
|------|--------|
| Start | `ensureOutreachPaystackPlans()` if `PAYSTACK_SECRET_KEY` set |
| Verify | Boot logs; `outreach_paystack_plans` rows |

---

## 10. Frontend (Vercel)

| Item | Detail |
|------|--------|
| Start | Vercel deployment of `frontend` |
| Not | Does not run queues/scrapers |
| Verify | Open `https://staging.leadthur.com` (may require Vercel SSO) |

---

## Health checklist (staging)

| Check | Command / action | Pass |
|-------|------------------|------|
| API up | `curl …/health` | `status: ok` |
| Not FE | Body has no Next.js | Pass |
| Browser | `browser: ready` | Pass |
| Queue | `queue.mode: bullmq` | Pass |
| Memory | `memory.safe: true` | Pass |
| IP cap | `freeTrialIpCapReady: true` | Pass |
| DeepSeek | `deepseek.configured` if AI needed | Pass |
| Commit | SHA matches intended staging deploy | Pass |
| Ready | `GET /health/ready` | 200 |

```bash
bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com
```

---

## What is NOT a separate staging service

- Dedicated cron container — **Not Found**  
- Dedicated worker Dyno/service — **Not Found**  
- Separate email worker — **Not Found**  
- Redis in docker-compose — **Not Found**
