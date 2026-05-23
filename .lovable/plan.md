# Advanced Upgrade Plan

Existing app (Monetag Telegram mini app + admin panel) ke advanced banano hobe. UI improved hobe (current style rakhbo, polish + Tasks/Daily sections add hobe).

## 1. Multiple Ad Types (3 Monetag zones)

Monetag er 3 ta format alada button hisebe:

| Type | SDK function | Default zone | Default points |
|---|---|---|---|
| Rewarded Interstitial | `show_<zone>()` | 9518673 | 10 |
| Rewarded Popup | `show_<zone>('pop')` | (admin set) | 5 |
| In-App Interstitial | auto / timer-based | (admin set) | 3 (auto credit) |

- Home page e 2 ta section: **Tasks** (Interstitial + Popup — Claim button) ar **Daily** (In-App auto).
- Each type er alada cooldown + daily limit (admin controlled).
- DB e `ad_watches.ad_type` column add hobe.

## 2. Tasks / Offerwall System

Admin custom task add korte parbe (Telegram channel join, group join, bot start, custom URL visit).

- Table `tasks`: id, title, description, icon, url, reward_points, task_type (`join_channel` | `visit_url` | `custom`), verify_method (`auto` | `manual` | `telegram_member`), channel_username (nullable), active, sort_order.
- Table `task_completions`: id, chat_id, task_id, status (`pending`/`approved`/`rejected`), completed_at.
- User flow: Task list → click → opens URL → "I've done it" button → server verifies (Telegram `getChatMember` for channels, auto-approve for url) → points credited.
- Admin can add/edit/delete tasks + approve manual ones.

## 3. VIP / Level System

User more ads = higher level = more points per ad (multiplier).

- Levels stored in `app_settings` as JSON: `[{level:1,min_ads:0,multiplier:1.0,name:"Bronze"},{level:2,min_ads:100,multiplier:1.2,name:"Silver"},...]`
- `app_users` e `level` column add (computed on each ad claim).
- Home page e current level badge + progress bar (next level kotodur).
- Admin edit kortay parbe levels JSON.

## 4. Anti-Fraud

- Table `user_devices`: chat_id, ip, user_agent, fingerprint, created_at.
- On `getUserState`: capture IP (from request headers) + UA.
- If same IP/UA already linked to different chat_id beyond limit (default 3) → flag user + block ad claims.
- Admin panel e flagged users list, manual unblock.
- Settings: `max_accounts_per_ip` (default 3), `anti_fraud_enabled` (true/false).

## 5. Statistics Dashboard (Admin)

New tab `Stats` admin dashboard e:
- Total users, active today, total ads watched, ads today, total points earned, total withdrawn (approved), pending withdrawals, total tasks completed.
- Simple line chart (Recharts) — last 7 days: new users, ads watched, withdrawals.
- Top 10 earners table.

## 6. UI — Inspired but Improved

Current dark theme rakhbo + polish:
- Home: gradient header (balance + level badge + progress), then **Tasks** section (3 ad cards with emoji + Claim), then **Daily** section (in-app + check-in if exists), then **Offers** section (custom tasks list).
- Bottom nav: 4 tabs — Home, Stats (personal earnings chart), Withdraw, History. (Leaderboard skip kora hocche unless chao.)
- Smooth animations, glassmorphism cards, better typography.
- Mobile-first (360px viewport optimized).

## 7. Admin Panel Additions

New tabs:
- **Stats** — overview dashboard
- **Tasks** — CRUD for custom tasks
- **Ad Zones** — 3 alada zone id (interstitial / popup / inapp) + points per type + cooldown per type + daily limit per type
- **Levels** — JSON editor for VIP tiers
- **Anti-fraud** — flagged users list, settings

Existing tabs (Settings / Methods / Withdraws / Users) thakbe.

## Technical Plan

**DB migrations:**
1. `ALTER TABLE ad_watches ADD COLUMN ad_type text DEFAULT 'interstitial';`
2. `ALTER TABLE app_users ADD COLUMN level int DEFAULT 1, ADD COLUMN flagged boolean DEFAULT false, ADD COLUMN last_ip text, ADD COLUMN last_ua text;`
3. Create `tasks`, `task_completions`, `user_devices` tables (RLS enabled, no public policies — admin client only).
4. Seed new settings keys: `zone_interstitial`, `zone_popup`, `zone_inapp`, `points_interstitial`, `points_popup`, `points_inapp`, `cooldown_interstitial`, `cooldown_popup`, `cooldown_inapp`, `daily_limit_interstitial`, `daily_limit_popup`, `daily_limit_inapp`, `levels_json`, `max_accounts_per_ip`, `anti_fraud_enabled`.

**Server functions (new/updated):**
- `claimAdReward({chatId, adType})` — type-specific cooldown/limit/points, level multiplier, anti-fraud check
- `listTasks(chatId)` — tasks + completion status
- `claimTask({chatId, taskId})` — verify + credit
- `getStats()` (admin) — aggregates
- `adminSaveTask`, `adminDeleteTask`
- `adminGetFlagged`, `adminUnflagUser`
- Update `getUserState` to return all 3 zone configs + level info + IP capture

**Frontend:**
- Rewrite `src/routes/index.tsx` with Tasks/Daily/Offers sections
- New `src/routes/stats.tsx` (user personal stats)
- Add tabs in `src/routes/admin.dashboard.tsx`: Stats, Tasks, Ad Zones, Levels, Anti-fraud
- Recharts install for charts

**Out of scope (ask if needed later):** Referral system, daily check-in, leaderboard public page, multi-language, broadcast.

Approve korle implementation start korbo.
