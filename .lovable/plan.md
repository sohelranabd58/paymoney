
# Fix-all pass: crash, security, bot-redeem, withdraw UX, history, ads, tasks

## 0. Critical crash — "require is not defined"

`src/routes/__root.tsx` currently loads `HighPerfBanner` via `require(...)` which breaks in the browser → blank screen with `Try again` / `Go home`. Replace with a normal ESM import and gate by route (hide on `/admin/*`). This unblocks everything else.

## 1. Bot-point redeem — auto chat_id + working pay-out

Problem: admin currently has to type the bot user_id; approval doesn't actually credit the user.

- Bot Points withdraw form (user side): when method = "Bot Points", hide the "Account / wallet" input and auto-submit `account = chatId`. Server `submitWithdraw` re-validates this on bot-points method.
- `adminProcessWithdraw` (approve path):
  1. Read old balance: `GET …/redeem_api.php?key=$BOT_REDEEM_KEY&action=check&user_id=<account>` → `old_points`.
  2. Credit: `GET …action=add_points&user_id=<account>&points=<amount>`.
  3. Re-check: same `check` call → `new_points`.
  4. Only mark `completed` when add returns success AND `new_points >= old_points + amount` (tolerant of pre-existing pending). Otherwise leave `pending` and surface error in admin UI.
- Persist `old_points`, `new_points`, and bot raw response on the withdraw row (new columns: `bot_old_points bigint`, `bot_new_points bigint`, `bot_response jsonb`).

## 2. User Telegram notifications (advanced Bangla)

Send via existing bot token (already configured for the app — confirm `TELEGRAM_BOT_TOKEN` exists; if missing, ask user to add). Two events:

- **On submit** (any method): "আপনার উইথড্র অনুরোধ গ্রহণ করা হয়েছে …" with amount, method, account, current balance (for Bot Points: old balance fetched from API).
- **On approve**: "✅ আপনার উইথড্র সফলভাবে সম্পন্ন হয়েছে …" with amount, method; for Bot Points include `পূর্ববর্তী পয়েন্ট: X` and `বর্তমান পয়েন্ট: Y` from the API.
- **On reject**: short Bangla message + reason.

Bangla strings centralized in `src/lib/notify.server.ts`. All calls fire from server fns; failures are logged but don't break the admin action.

## 3. Per-method minimum withdraw (drop global)

- Hide / ignore `min_withdraw` in `app_settings`. Admin settings UI removes the field.
- Withdraw page + server validation use **only** `withdraw_methods.min_amount`.
- Method editor in admin already has min_amount — keep, label as "Minimum (this method)".

## 4. Auto-load next short ad after 16s (optional toggle)

- New settings: `auto_next_ad_enabled` (default false) and `auto_next_ad_delay_seconds` (default 16).
- In `earn.tsx`: when enabled, after a successful short-ad claim, start a countdown; when it hits 0 and cooldown is clear, automatically trigger the next short-ad watch. A visible "Auto-play next ad" switch lets the user override per session (stored in `localStorage`).
- Admin Ads card surfaces the toggle + delay input.

## 5. Advanced history page (separate tabs, last 30 days)

`src/routes/history.tsx`:
- Tabs: **Ads**, **Tasks**, **Withdraws**, **Sponsor**.
- Each tab lists last 30 days (server fn filters by `created_at >= now() - interval '30 days'`), grouped by day, with totals at top.
- Withdraws tab shows status badge + bot old/new points when present.
- New server fns: `listAdHistory`, `listTaskHistory`, `listWithdrawHistory`, `listSponsorHistory` (all paginated, 30-day window).

## 6. Tasks — admin time interval in days

- Tasks editor: replace seconds input with a "Repeat every" control (number + unit select: Off / Hours / Days). Stored as `repeat_interval_seconds`.
- Quick presets: 1 / 2 / 3 / 7 days.
- Cooldown badge on Tasks page already exists; format upgrade to show `Xd Yh` when ≥ 1 day.

## 7. Responsive banner ad — finish wiring

- Crash from §0 was the only blocker; after ESM import, the existing `HighPerfBanner` renders on every non-admin page.
- Make sure it's also injected at the bottom of the Earn, Tasks, History, Withdraw, Sponsor routes (already covered by mounting in `__root.tsx`).

## 8. Finish previously-promised wiring

- `src/routes/tasks.tsx` → use `TaskDetailDialog`, render `marquee_tasks_text`, show source/sponsor badge and repeat cooldown.
- `src/routes/admin.dashboard.tsx` → Sponsor Reviews section, settings for sponsor/click-ad/marquee/auto-next-ad, removal of global min withdraw.
- `earn.tsx` → call `markClickAdOpened` when the bonus popup opens so the min-seconds gate works.

## 9. Security pass

- `adminProcessWithdraw`, `adminReviewTask`, `adminReviewSponsor`, all admin fns: assert admin via existing `assertAdmin(password)` first.
- Zod validation on all new inputs (history filters, settings, withdraw account, bot-redeem user_id regex `^\d{5,15}$`).
- `BOT_REDEEM_KEY` read only inside `.handler()` from `process.env`. Never bundled.
- `TELEGRAM_BOT_TOKEN` likewise.
- Storage: `task-proofs` stays private; admin signed URLs only.
- Re-run `supabase--linter` after migration; patch findings.

## Migrations (single file)

- `withdraw_requests`: + `bot_old_points bigint`, `bot_new_points bigint`, `bot_response jsonb`.
- `app_settings` seed: `auto_next_ad_enabled=false`, `auto_next_ad_delay_seconds=16`. Mark `min_withdraw` as unused (kept for back-compat, not read).
- No schema change needed for per-method min (already exists).

## Secrets needed

- `BOT_REDEEM_KEY` — already requested previously; confirm set.
- `TELEGRAM_BOT_TOKEN` — required for user notifications. If not yet set, I'll prompt before shipping the notify step (the rest still ships).

## Files touched

- `src/routes/__root.tsx` (ESM banner import — fixes crash)
- `src/routes/withdraw.tsx` (bot-points auto chat_id, per-method min)
- `src/routes/earn.tsx` (auto-next ad, markClickAdOpened)
- `src/routes/tasks.tsx` (dialog, marquee, badges, cooldown formatting)
- `src/routes/history.tsx` (tabs, 30-day separation)
- `src/routes/admin.dashboard.tsx` (settings, sponsor reviews, day-interval input)
- `src/lib/app.functions.ts` (history fns, submit validation, auto-ad helpers)
- `src/lib/admin.functions.ts` (bot pay-out flow, notifications, settings)
- `src/lib/notify.server.ts` (new — Bangla Telegram messages)
- One Supabase migration (columns + seeds)

## Out of scope (ask if you want)

- In-app realtime notification panel (we only do Telegram messages).
- Re-implementing global min withdraw as a hard cap.
