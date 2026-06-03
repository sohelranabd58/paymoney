# Plan: Magic-link admin auto-login

## Goal
Visiting any page with `?id=975998543` should silently authenticate the visitor as admin and land them on `/admin/dashboard` — no password prompt.

## Changes

### 1. `src/routes/__root.tsx` (or a small new `AdminAutoLogin` component mounted there)
- On client mount, read `window.location.search` for `id=975998543`.
- If matched:
  - Write `sessionStorage.setItem("admin_pw", "76737")` (the existing admin password the dashboard guard checks).
  - Strip the `id` param from the URL (`history.replaceState`) so it isn't shared/bookmarked.
  - `navigate({ to: "/admin/dashboard" })`.
- Runs once via `useEffect` with an empty dep array; guarded by `typeof window !== "undefined"`.

### 2. `src/routes/admin.tsx` (login page)
- Same check at mount: if `?id=975998543` present, set sessionStorage and redirect to `/admin/dashboard` without showing the form.

### 3. No backend / DB / server-function changes
- The magic ID maps to the already-known admin password client-side; `adminLogin` and all `verifyAdmin` server checks continue to use `76737` exactly as today, so security posture is unchanged (anyone who knows the magic ID is equivalent to knowing the password — matches user intent).

## Technical notes
- Magic ID stored as a constant `ADMIN_MAGIC_ID = "975998543"` at the top of the auto-login component for easy future rotation.
- URL cleanup uses `history.replaceState(null, "", url.pathname + url.hash)` to keep router state intact.
- Works from any route (home, earn, etc.) — user can paste `https://site/?id=975998543` and land on dashboard.

## Files touched
- `src/routes/__root.tsx` — add mounted `<AdminAutoLogin />` effect
- `src/routes/admin.tsx` — early redirect when magic id present
