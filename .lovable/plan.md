## Plan

1. **Auto-next short ads with on/off button**
   - Add `auto_next_ad_enabled` and `auto_next_ad_delay_seconds` support in the Earn page.
   - Add a compact option button/switch near “Watch short ads”.
   - After a short ad is claimed, start a 16-second countdown; when it ends, auto-load the next short ad if enabled.
   - If the ad closes/finishes and the user has not hit cooldown/daily limit, continue the same auto-next flow safely.

2. **Ad open/view second logging + click-ad reward gating**
   - Wire `markClickAdOpened` when the bonus/click ad dialog opens and before the ad is played.
   - Add stronger state handling so `claimClickAdReward` only succeeds after required view seconds.
   - Add database logging fields for ad open/view timing where needed, so admin can inspect whether ad views were actually opened and claimed.
   - Make claim errors user-friendly: e.g. “আর 8 সেকেন্ড দেখুন” instead of unclear API errors.

3. **Admin ad watch/review verification**
   - Upgrade Admin “Ads & Zones” / user detail area to show recent ad logs with type, points, time, and view/open timing when available.
   - Verify manual task `require_proof` review flow: private screenshot signed URL, approve credits points, reject does not credit, and reviewed proof is cleaned up where current logic supports it.

4. **High-rate CPM professional upgrade**
   - Improve the Earn ad section UI to feel more professional: clearer high-CPM labels, progress/cooldown state, daily limit visibility, and auto-next status.
   - Keep the actual ad SDK integration unchanged, but make the workflow more robust and premium-looking.

5. **Top fixed banner ad slot**
   - Move the global banner from bottom to a fixed top slot on all non-admin pages.
   - Reserve layout space so page headers/content are not covered.
   - Keep the banner responsive and sandboxed.

6. **Task page marquee text**
   - Add the configured `marquee_tasks_text` to the Tasks page.
   - If task-specific marquee is empty, fall back to normal `marquee_text`.

7. **Bot Points API fully workable**
   - Use the user’s own Telegram/chat id automatically for Bot Points; no manual id field.
   - Move the redeem API key to a backend secret if missing, then call:
     - check old points
     - add points
     - check new points
   - Make the parser handle plain text or JSON responses.
   - Only mark withdrawal approved if the API call succeeds; if it fails, keep the request pending and show the real failure in admin.
   - Disable unsafe bulk approve for Bot Points, so the API is never skipped.

8. **Security cleanup**
   - Remove the hardcoded admin magic auto-login/password from the root route.
   - Keep admin access through the existing admin login flow.
   - Ensure third-party API keys are not exposed in frontend code.

## Technical notes

- Likely files: `src/routes/earn.tsx`, `src/components/earn-ui.tsx`, `src/routes/__root.tsx`, `src/routes/tasks.tsx`, `src/lib/app.functions.ts`, `src/lib/admin.functions.ts`, `src/routes/admin.dashboard.tsx`, plus one migration if ad timing columns are added.
- Backend API calls stay server-side only.
- No public frontend code will contain the Bot Points secret key.