# Plan

## 1. Fix admin login → dashboard redirect

**Problem:** After entering password on `/admin`, the dashboard at `/admin/dashboard` immediately bounces back to `/admin` because its `useEffect` reads `sessionStorage` on the first client tick and, in some browsers (and after SSR hydration), runs before TanStack Router has stabilized the new route, so the guard navigates away.

**Fix in `src/routes/admin.dashboard.tsx`:**
- Initialize `password` synchronously from `sessionStorage` using a lazy `useState` initializer (guarded with `typeof window !== "undefined"`).
- Only call `navigate({ to: "/admin" })` inside `useEffect` when `password === null` AFTER mount — and only once.
- Remove the early `return null` flicker by rendering a small "Checking session…" placeholder while redirecting.

This guarantees the dashboard sees the freshly-written `admin_pw` and stays put.

## 2. Click ad: make optional + fully admin-configurable

**Currently** `claim_ad_atomic` forces a click-ad every N ads (cycle), and `earn.tsx` opens the click-ad dialog when `needs_click_ad` is true. The user wants click-ads to NOT be mandatory; all ad-view and click-ad point/zone settings must live in the admin panel.

**Changes:**
- **DB migration**: Update `claim_ad_atomic` so `out_needs_click_ad` is always `false` when a new setting `click_ad_required` is `'false'` (default `'false'`). The cycle counter still advances, but it never blocks claiming.
- **`src/lib/app.functions.ts`**: Read `click_ad_required` from `app_settings` and expose it in `getApp().settings.click_ad.required`. When `false`, `claimAd` returns `needs_click_ad: false` regardless.
- **`src/routes/earn.tsx`**: Only open the click-ad dialog when `settings.click_ad.required && res.needs_click_ad`. Keep the manual "Claim pending + bonus" button so users can still trigger the bonus click-ad voluntarily.
- **Admin panel — Ads & Zones section**: Add the missing controls so admin can edit, for each ad type:
  - SDK zone ID, points per view, daily limit, cooldown seconds
  - Click-ad: zone ID, points, cycle (every N), and a new "Required" toggle (`click_ad_required`)
  - These already partially exist; we'll add the toggle + ensure all values save through `adminUpdateSettings`.

## 3. Reset-all-points button

**Admin panel → Users section** (and also in Settings as a dangerous action):
- Add a red "Reset all user points" button that opens an `AlertDialog` confirmation requiring typing `RESET` to confirm.
- New server fn `adminResetAllPoints({ password })` in `src/lib/admin.functions.ts` that runs `UPDATE app_users SET points = 0, pending_points = 0, cycle_ads = 0`. (Does NOT touch `total_earned` so history is preserved.)
- Optional second button "Reset points + total_earned" with separate confirm for full wipe.

## 4. Home notice slider (admin-controlled)

The existing `marquee_text` is a single scrolling line. The user wants a **notice slider** — multiple announcements that rotate/slide on the Home page, edited from admin.

**Changes:**
- **DB**: Add `notice_slides` setting key storing a JSON array of strings (e.g. `["New ad zone live!", "Withdraw min lowered to 500"]`).
- **`src/lib/app.functions.ts`**: Parse and expose `settings.notice_slides: string[]`.
- **`src/components/NoticeSlider.tsx`** (new): A horizontally sliding/auto-rotating banner above the marquee on Home; rotates every 4s with fade transition; hidden when empty.
- **`src/routes/index.tsx`**: Render `<NoticeSlider items={settings.notice_slides} />` above the existing `<Marquee />`.
- **Admin panel → Settings**: New "Notice slides" textarea (one notice per line) that serializes to JSON on save.

## Technical notes

- All admin actions stay password-gated via the existing `verifyAdmin` helper.
- The click-ad SQL change is the only DB-function edit; data shape unchanged.
- No changes to user-facing theme/tokens.
- Marquee stays as-is for backward compatibility.

## Files touched

- `src/routes/admin.dashboard.tsx` (login guard fix, Reset button, Required toggle, Notice slides textarea)
- `src/lib/admin.functions.ts` (`adminResetAllPoints`)
- `src/lib/app.functions.ts` (expose `click_ad.required`, `notice_slides`)
- `src/routes/earn.tsx` (respect `required` flag)
- `src/routes/index.tsx` (mount NoticeSlider)
- `src/components/NoticeSlider.tsx` (new)
- New migration: update `claim_ad_atomic` + seed `click_ad_required='false'` and `notice_slides='[]'`
