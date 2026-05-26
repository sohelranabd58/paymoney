## 1. Profile name/photo fix

**Why it fails now:** `syncTelegramProfile` calls Bot API `getChat(chat_id=user_id)`, which only works if the user has ever DMed the bot. For Mini App users opened from a button, this typically returns "chat not found" → name/photo stay null.

**Fix:** Read profile directly from `Telegram.WebApp.initDataUnsafe.user` on the client (gives `first_name`, `last_name`, `username`, `photo_url`) and pass it to a new server fn `saveTelegramProfile({ chatId, first_name, last_name, username, photo_url })` which:
- Writes name/username to `app_users` immediately.
- If `photo_url` present, downloads and caches it to the `tg-avatars` bucket (so it doesn't expire).
- Keeps `getChat`/`getUserProfilePhotos` as fallback only.

Call this on mount in `index.tsx` before/instead of the current `syncTelegramProfile`.

## 2. Ad cards: countdown overlay on top of the ad button

Update `AdCard` in `src/components/earn-ui.tsx`: when `left > 0` (cooldown active), render a semi-transparent overlay over the whole card with a big circular timer (seconds remaining). User sees the ad area dimmed with countdown sitting on top, instead of just text inside the button.

## 3. Every-Nth-ad "Click ad" bonus with pending balance

**New flow (Fixed: every Nth ad):**
- Admin sets `click_ad_every` (e.g. 10) and `click_ad_zone` / `click_ad_sdk_id` in admin panel.
- All ad rewards go into a new column `app_users.pending_points` instead of `points`.
- When a user's count inside the current cycle hits `N-1` completed normal ads, the next claim shows a **Click Ad popup** (uses the click-ad zone). On successful click-ad completion:
  - `pending_points + click_ad_reward` is added to `points` (main balance).
  - `pending_points` reset to 0; cycle counter reset.
- If they skip, pending stays until they complete the click ad on a future cycle.

**Schema changes:**
- `app_users`: add `pending_points bigint default 0`, `cycle_ads int default 0`.
- `app_settings` new keys: `click_ad_every`, `click_ad_zone`, `click_ad_sdk_id`, `click_ad_points`.
- Update `claim_ad_atomic` RPC: increment `pending_points` (not `points`), increment `cycle_ads`. Return a `needs_click_ad` flag when `cycle_ads >= click_ad_every - 1` (passed in as param).
- New RPC `claim_click_ad_atomic`: moves `pending_points + reward → points`, resets `cycle_ads`, logs as ad_type='click'.

UI on `/earn`: show small "Pending: X pts" chip + main "Points: Y". When server returns `needs_click_ad`, open a dialog with the click-ad button. Withdraw uses `points` only (pending excluded).

## 4. Admin notify bot + redeem code on approve

**Admin panel additions** (`/admin/dashboard` Settings tab):
- `notify_bot_token` (separate from main `bot_token`).
- `admin_username` / `admin_chat_id` (admin's Telegram numeric ID — required for DM).
- `redeem_api_key` (default to the provided key).

**On withdraw submit:** notify admin via `notify_bot_token` → `admin_chat_id` with full context: user id, name/username, account, amount, **total ads watched, total click-ads completed, total points earned lifetime**.

**On approve (in `adminProcessWithdraw`):**
1. Call `https://sohel.pp.ua/main/bot/fackss/redeem_api.php?key={redeem_api_key}&redeem={amount}` → parse code from response.
2. Save code to new column `withdraw_requests.redeem_code`.
3. DM the user (via main `bot_token`): "✅ Approved. Your redeem code: `XXXX`".
4. DM admin (via `notify_bot_token`): "Approved request #… code: XXXX".

**On reject:** existing reason/note flow stays, just also DM via notify bot.

**Schema:** `ALTER TABLE withdraw_requests ADD COLUMN redeem_code text`.

**History page:** show `redeem_code` for approved withdraws with copy button.

## 5. Marquee already implemented — verify

`Marquee` component already scrolls and reads `settings.marquee_text` set from admin Settings tab. Verify the admin Settings tab exposes the `marquee_text` field (text + emoji allowed). If missing, add it. No code change needed otherwise.

## 6. Admin dashboard polish

- Add a "Click Ad" subsection under Settings tab with the new fields.
- Add the new `notify_bot_token`, `admin_chat_id`, `redeem_api_key` fields (token/key masked like existing `bot_token`).
- Withdraw requests table: show extra columns (user name/username, total ads, click-ads completed, lifetime earned).
- User list: already exists — add a "Click ads" column.

## Technical Details

**Files to change:**
- `src/lib/useChatId.ts` — expose initDataUnsafe.user fields.
- `src/lib/app.functions.ts` — new `saveTelegramProfile`, update `claimAdReward`, new `claimClickAdReward`, update `submitWithdraw` notify payload.
- `src/lib/admin.functions.ts` — update `adminProcessWithdraw` for redeem API + dual notify; expose extra user stats in `adminGetAll`.
- `src/components/earn-ui.tsx` — cooldown overlay; new `ClickAdDialog`.
- `src/routes/index.tsx` — call `saveTelegramProfile`, show pending balance.
- `src/routes/earn.tsx` — wire click-ad dialog flow.
- `src/routes/admin.dashboard.tsx` — new settings fields, withdraw table columns.
- `src/routes/history.tsx` — show redeem code.

**Migrations:**
1. `app_users`: add `pending_points`, `cycle_ads`.
2. `withdraw_requests`: add `redeem_code`.
3. Replace `claim_ad_atomic` (pending instead of points; cycle counter).
4. New `claim_click_ad_atomic` (move pending→points + reward, reset cycle).
5. Seed defaults in `app_settings`: `click_ad_every=10`, `click_ad_points=50`, `click_ad_zone=9518673`, `redeem_api_key=8099021b36fa6ada29f091a3949bf00b`.

**Security:** redeem API call from server only; admin password still required on `adminProcessWithdraw`; no client-side redeem trigger.
