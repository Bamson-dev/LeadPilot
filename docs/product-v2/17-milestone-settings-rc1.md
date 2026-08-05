# LeadThur V2 — Milestone Report  
## RC1 Settings Workspace

**Branch:** `staging`  
**Date:** 2026-08-05  
**Route:** `/dashboard/settings`  
**Entry:** Top-nav Settings gear (Billing remains `/dashboard/plans`)

---

## Summary

Settings is an account chrome page: profile/license, usage snapshot, this-device ID, connected Gmail mailboxes, Sign out (`clearStoredLicense`), and honest empties for unsupported prefs. No auth, licensing, or payment logic was changed.

---

## Components completed

| Component | Path |
|-----------|------|
| SettingsPageWorkspace | `frontend/components/settings/settings-page-workspace.tsx` |
| Settings page | `frontend/app/dashboard/settings/page.tsx` |

### Wiring
- Top-nav gear → `/dashboard/settings` (was `/dashboard/plans`)
- Credits click / sidebar Billing / mobile Billing → still `/dashboard/plans`
- `?view=settings` / `?view=account` → `/dashboard/settings`

---

## Backend mapping

| UI | Capability |
|----|------------|
| Email / license key | localStorage (`leadthur_*`) |
| License status | `GET /auth/status` |
| Usage snapshot | `GET /auth/usage`, `GET /balance` |
| Connected services | `GET /mailboxes` + link to Mailboxes |
| This device | `getDeviceId()` client ID |
| Sign out | `clearStoredLicense()` → `/activate` |

---

## Unsupported (honest empties)

- Password change / 2FA / security dashboard  
- Notification preference persistence  
- Theme / appearance toggle  
- Team, roles, workspace switching  
- API key generation  
- Audit / activity history  
- List or revoke other devices (admin-only reset)  
- Profile name / avatar upload  

---

## QA screenshots

`docs/product-v2/screenshots/settings-*.png` after license session: profile panel, mailboxes list/empty, sign-out, empties for password/notifications.

---

## Next

Admin (last remaining RC1 module after Settings push).
