
# Fix admin magic-link login

## Problem
`/?id=975998543` doesn't reach `/admin/dashboard`:

1. `975998543` is also the user's real Telegram `chat_id`. The home page's `useChatIdFromSearch` grabs `?id=...` first and renders the Telegram user profile (see screenshot) before/instead of the admin redirect.
2. A SyntaxError in `src/routes/admin.tsx` (`Identifier 'password' has already been declared`) breaks the `/admin` route bundle, preventing clean redirect.

## Fix

### 1. Use a dedicated query param: `?admin=975998543`
No collision with Telegram `chat_id`. Old `?id=...` keeps its normal meaning (Telegram user login).

New magic URL: `https://paymoney.lovable.app/?admin=975998543`

### 2. `src/routes/__root.tsx` — update `AdminAutoLogin`
- Read `params.get("admin")` and compare to `ADMIN_MAGIC_ID = "975998543"`.
- If match: `sessionStorage.setItem("admin_pw", "76737")`, then `window.location.replace("/admin/dashboard")` — a hard replace avoids any router race and clears the query string atomically.
- Wrap in `useLayoutEffect` (client-only guard) so it fires before paint.

### 3. `src/routes/admin.tsx` — clean rewrite
- Restore a single clean component with exactly one `useState("")` for `password` (fixes the SyntaxError).
- Early redirect block: same `?admin=975998543` check + `window.location.replace("/admin/dashboard")`.
- Manual password form unchanged.

### 4. No backend / DB / server-function changes.

## Files touched
- `src/routes/__root.tsx`
- `src/routes/admin.tsx`
- `.lovable/plan.md`

## After
Use `https://paymoney.lovable.app/?admin=975998543` to enter the admin dashboard with no password prompt.
