## 1. Fix the "pending_points is ambiguous" bug

The current `claim_ad_atomic` RPC declares an OUT parameter named `pending_points` and ALSO selects from a column named `pending_points` on `app_users`. Postgres can't tell them apart in the final `SELECT ... INTO`, so every ad claim throws the error shown in your screenshot.

**Fix:** migration that recreates `claim_ad_atomic` with renamed OUT params (`new_points`, `new_pending`, `earned`, `today_count`, `cycle_ads`, `needs_click_ad`, `new_level`) and fully-qualified column reads (`u.pending_points`, etc.). Update the server function in `src/lib/app.functions.ts` to read the renamed fields and map them back to the same client shape (`pending_points` stays in the JSON response so `earn.tsx` keeps working unchanged).

Also add a tiny smoke-test script `scripts/smoke-claim-ad.ts` that:
- creates/upserts a test `app_users` row (`chat_id = 'smoke_test_user'`)
- calls `claim_ad_atomic` with sample args (interstitial, 30s cooldown, 100 limit, 10 base pts, 1.0 multiplier, last_ad_at, every=10)
- prints returned fields and asserts no error
- runs once for "new user" and once for "existing user" path
- cleans up

You can run it with `bun scripts/smoke-claim-ad.ts` after the fix lands.

## 2. Full admin panel remake

Based on your choices: full UI redesign + reorganize sections + advanced user mgmt + advanced withdrawal queue, with a **professional slate/blue data-dense look** (Vercel/Linear style).

### Layout

- `SidebarProvider` + collapsible icon sidebar on the left, top header with breadcrumb + search + logout.
- Slate-900 background, slate-800 surfaces, blue-500 accent, mono numbers, compact data tables.
- Each section becomes its own route under `/admin/dashboard/*` so URLs are shareable and code stays small.

```text
src/routes/
  admin.dashboard.tsx          → layout shell (sidebar + Outlet), guards password
  admin.dashboard.index.tsx    → Overview
  admin.dashboard.users.tsx    → Users
  admin.dashboard.withdrawals.tsx
  admin.dashboard.ads.tsx      → Ads & Zones
  admin.dashboard.tasks.tsx
  admin.dashboard.methods.tsx
  admin.dashboard.settings.tsx
```

### Sections

1. **Overview** — KPI cards (total users, today's ads, pending withdrawals, total points paid, today's signups), 7-day line chart (ads + signups + withdrawals), recent activity feed.

2. **Users** — searchable/sortable table (chat_id, tg_username, name, points, pending, lifetime, total ads, last seen, status). Row click opens a side sheet with: full Telegram profile, ad history breakdown by type, withdrawal history, devices/IPs, and actions: edit points (+/-), ban/unban, flag/unflag, force-claim pending, delete user.

3. **Withdrawals** — tabs Pending / Approved / Rejected / All, search by chat_id/account, each row expandable inline showing user stats (total ads, click ads, lifetime earned, prior withdrawals). Approve generates redeem code via existing sohel.pp.ua API + notifies user & admin. Reject takes optional reason. Bulk select for approve/reject.

4. **Ads & Zones** — per-ad-type cards (interstitial / popup / inapp / click) with editable SDK zone id, points, daily limit, cooldown. Click-ad cycle setting (`click_ad_every`).

5. **Tasks** — list + create/edit/delete tasks (visit URL, join Telegram channel), toggle active, reorder.

6. **Methods** — withdraw methods CRUD (bKash, Nagad, Binance, etc.) with min amount, instructions, icon, enabled toggle.

7. **Settings** — app name, marquee text, min withdraw, bot token (masked), notify bot token (masked), admin chat id, redeem API key (masked), admin password change.

### Backend additions (server fns in `src/lib/admin.functions.ts`)

- `adminGetUsers({ search, limit, offset, sort })` — paginated list
- `adminGetUserDetail({ chat_id })` — full profile + history
- `adminAdjustPoints({ chat_id, delta, reason })`
- `adminToggleBan` / `adminToggleFlag`
- `adminBulkProcessWithdraws({ ids[], action, note? })`
- `adminGetWithdraws({ status, search, limit, offset })` — extend existing query

All gated by the existing admin password check; password stays `76737`.

### Tech notes

- Reuse all existing tables — no schema changes beyond the function fix.
- Use shadcn `Sidebar`, `Table`, `Sheet`, `Tabs`, `Dialog`, `Command` (for search), `Badge`.
- Slate/blue theme applied via local CSS variables on the admin layout only — does NOT change the user-facing dark green app theme.
- Mobile: sidebar collapses to icon strip; tables get horizontal scroll.

## Out of scope

- No changes to user-facing Earn/Home/Tasks/Withdraw/History UI.
- No new database tables.
- Marquee, redeem flow, bot notifications already work — left untouched, just exposed in new admin UI.
