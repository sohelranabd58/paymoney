## Plan

1. Fix the core routing bug
   - The current `/admin/dashboard` route is nested under `/admin`, but `src/routes/admin.tsx` renders only the login page and no child outlet.
   - Update `src/routes/admin.tsx` so:
     - `/admin` shows the password login form.
     - `/admin/dashboard` renders the dashboard child route, not the login page again.
     - The magic link still sets the admin session and redirects to `/admin/dashboard`.

2. Make login behavior clear and reliable
   - Keep the admin password as `76737`.
   - If login succeeds, store the password in `sessionStorage` and navigate to the dashboard.
   - If login fails, show a visible error toast instead of appearing stuck.
   - Add a fallback message on the dashboard if the saved admin session becomes invalid, with a direct link back to `/admin`.

3. Keep admin password changeable
   - Preserve the existing Settings > Security > Admin password field.
   - Make changing the password reliable: when a new password is saved, update the local admin session to the new password so the admin does not get locked out immediately.
   - Do not expose the existing admin password in fetched settings.

4. Audit all admin sections for workable state
   - Check Overview, Users, Withdrawals, Ads & Zones, Tasks, Methods, Levels, and Settings for broken routing/loading patterns and obvious mutation errors.
   - Fix any section that cannot load/save because of route nesting, stale password session, missing error UI, or incorrect server-function handling.

5. Verify in preview
   - Test `/admin` with password `76737`.
   - Confirm it lands on `/admin/dashboard` and shows the real admin dashboard.
   - Test `/?admin=975998543` redirects to `/admin/dashboard` and does not show the user home page.
   - Check browser console/network for errors after dashboard load.