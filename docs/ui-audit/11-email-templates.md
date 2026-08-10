# LeadThur UI Audit — Email Templates

**Sources:** `backend/src/services/email.ts`, `trial-email-content-v3.ts`, `supabase/migrations/030_outreach_mailboxes.sql`  
Emails are **not** React screens; listed for redesign of lifecycle messaging.

---

## Trial / Nurture (Resend-only nurture path in current code)

| Email | Subject | Trigger |
|-------|---------|---------|
| Trial welcome | Your LeadThur Free Trial Is Ready | Trial signup |
| Sequence 1–30 | See subjects below | Hourly scheduler by step |
| Post-search | You Searched. You Haven't Sent Anything Yet. | 3h after trial search |
| Trial broadcast | Admin-supplied | Admin broadcast |

### V3 sequence subjects (1–30)

1. You're In. Now Please Read This.  
2. What 393 Real Businesses Actually Looks Like  
3. Why Are They Eating And You Are Not?  
4. The Part Everyone Skips  
5. Does This Even Work For What I Do?  
6. Your Next Client Isn't Near You  
7. What If It Doesn't Work For Me?  
8. Here Is Everything You Actually Get For $25  
9. Six Slots Left. Then It Goes To $100 A Year.  
10. You Don't Have To Write The Email Yourself  
11. Hours On Google Vs 60 Seconds. Pick One.  
12. Stop Trying To Remember Who You Emailed  
13. Nobody Paid These People To Say This  
14. What Does $25 Actually Cost You?  
15. Why We Never Send To A Guessed Email  
16. Somebody Just Claimed A Slot. There Are Fewer Now.  
17. Who Actually Opened Your Email?  
18. What Is Actually Stopping You?  
19. This Sequence Is Coming To An End  
20. Somebody Landed A Client While You Were Reading This  
21. You Do Not Need Fiverr Anymore  
22. Your Slot Might Already Be Gone  
23. A Real Question From A Real User This Week  
24. One Client From This Pays For A Decade Of Other Tools  
25. This Sequence Is Almost Over  
26. Look At Your Bank Account Right Now  
27. Nigerian Freelancers, This One Is For You  
28. Two Days Left In This Sequence  
29. Final Reminder Before This Ends  
30. This Is The Last Email  

CTA in copy often: Paystack shop link / lifetime access.

---

## Activation / Checkout / Access

| Email | Subject |
|-------|---------|
| Access ready | Your LeadThur Access Is Ready |
| Welcome | Start Finding Clients in 60 Seconds |
| Payment confirmed | Payment Confirmed — LeadThur Lifetime Access Activated |
| Password reset | Reset Your LeadThur Password *(helper exists; product reset UX Not Found)* |

---

## Search transactional

| Email | Subject |
|-------|---------|
| Search complete | Your Search Found {n} Businesses — LeadThur |
| Results ready | We Found {n} Potential Clients for You in {city} |
| Still running | Your LeadThur Search Is Still Running — Feel Free to Check Back Later |
| Search failed | Your LeadThur Search Did Not Complete — Here Is What to Try |
| Queue failure | Your Search Ran Into a Problem — Please Try Again |
| Limit reached | Your LeadThur Search Limit Has Been Reached |
| Top-up confirmation | Your Search Credits Have Been Added |

---

## Affiliate

| Email | Subject |
|-------|---------|
| Commission | You Just Earned ${x} — LeadThur Commission |
| Payout requested | Your Payout Request Is Being Processed — LeadThur |
| Payout paid | Your ₦{x} Payout Has Been Sent — LeadThur |

---

## Admin / Broadcast

| Email | Subject |
|-------|---------|
| Direct message | Admin-supplied |
| Broadcast | Admin-supplied |
| Domain change | We Have a New Name and a New Home |

---

## Outreach (user-authored)

| Item | Detail |
|------|--------|
| Channel | User Gmail SMTP — **not** LeadThur branded wrapper for content |
| System templates (seeded) | No website found; Low Instagram; Low Google rating; Weak website copy |
| Niches | web_design, social_media, seo, copywriting |
| AI generate | Fills subject/body in compose UI |
| Tracking | Open pixel + unsubscribe links |

---

## Providers (product implication)

| Stream | Provider |
|--------|----------|
| Transactional | ZeptoMail → Resend fallback |
| Nurture / trial sequence | Resend-only (`sendNurtureEmail`) |
| Outreach | Customer SMTP |

---

## Redesign notes

- Separate brand templates: Acquisition / Product transactional / Admin  
- Align CTA destinations (app checkout vs Paystack.shop links)  
- Password reset email without in-app reset flow is incomplete
