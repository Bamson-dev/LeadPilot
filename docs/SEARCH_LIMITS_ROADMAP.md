# Search Limits & Admin Controls (implement after core flows work)

**Prerequisites:** Admin login, Paystack webhook, search streaming, full buyer journey (pay → email → activate → search → export).

See the full implementation spec in the product brief — includes:
- Supabase schema columns (search_count, monthly_search_limit, devices, suspension)
- `checkSearchLimit` middleware on POST /search
- Device registration (2 devices max)
- Abuse detection (20 searches/hour flag)
- Admin: update-limit, suspend, unsuspend, reset-devices
- Frontend license headers + searches remaining UI

Do not implement until the four prerequisite flows are confirmed in production.
