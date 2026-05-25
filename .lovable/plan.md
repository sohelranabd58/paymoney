## Goal
Home page o Tasks page alada koro. Home = profile + stats only. Earn = ads. Tasks = offerwall.

## Changes

### 1. Database migration
`app_users` table e notun column add:
- `tg_username` text
- `tg_first_name` text  
- `tg_last_name` text
- `tg_photo_url` text
- `tg_profile_synced_at` timestamptz

### 2. New server function: `syncTelegramProfile(chatId)` in `src/lib/app.functions.ts`
- `bot_token` settings theke nibe
- Telegram Bot API call:
  - `getChat?chat_id={chatId}` → first_name, last_name, username
  - `getUserProfilePhotos?user_id={chatId}&limit=1` → photo file_id
  - `getFile?file_id=...` → file_path
  - Final URL: `https://api.telegram.org/file/bot{token}/{file_path}` — eta server side e fetch kore base64/data URL hisebe save korbo na; shudhu URL ta DB te store korbo (token expose hobe na karon eta server theke render hobe na, but link e token thake — better option: download kore Supabase storage te save kora, OR proxy route)
- **Choice**: Notun public storage bucket `tg-avatars` banabo, photo download kore `{chatId}.jpg` hisebe upload korbo, then public URL `tg_photo_url` te save
- Cache: 24 ghonta er beshi hole re-sync, otherwise skip
- `getUserState` first call e auto trigger korbe (background, non-blocking)

### 3. New route: `src/routes/earn.tsx`
- Existing `EarnScreen` content (ad cards: Interstitial, Popup, In-app) move here
- Header simple: app name + points badge
- Guest mode support same way

### 4. Rewrite `src/routes/index.tsx` (Home)
Logged-in view:
- Big profile card: avatar (tg_photo_url or fallback initial), first_name + last_name, @username
- Points big display, Lifetime + ads watched
- Level card with progress bar
- VIP multiplier badge
- Quick action shortcut grid: Earn, Tasks, Withdraw, History (4 cards, big icons)
- Marquee at top

Guest view:
- Generic avatar + "Guest" label
- Same stats from localStorage
- Same quick action grid (Earn, Tasks disabled/limited)

### 5. Update `BottomNav.tsx`
5 tabs: Home, Earn (Zap icon), Tasks, Withdraw, History
OR 4 tabs (replace Home behavior): Home, Earn, Tasks, Withdraw — History move to Home quick actions
**Recommended: 5 tabs** for clarity

### 6. Return shape updates
`getUserState` returns user object — add `tg_username`, `tg_first_name`, `tg_last_name`, `tg_photo_url` fields.

### 7. Storage bucket
Create public bucket `tg-avatars` via migration with public read policy.

## Files touched
- `supabase/migrations/...sql` (new) — columns + storage bucket
- `src/lib/app.functions.ts` — add `syncTelegramProfile`, update `getUserState` return shape
- `src/routes/index.tsx` — rewrite as profile/home dashboard
- `src/routes/earn.tsx` (new) — ad-watching screen
- `src/components/BottomNav.tsx` — add Earn tab

## Open question
History tab BottomNav e rakhbo na quick action e shorabo? Default plan: 5 tabs rakhi (Home, Earn, Tasks, Withdraw, History).
