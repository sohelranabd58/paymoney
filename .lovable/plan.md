## Plan

1. **Prevent repeat claims while the same ad remains open**
   - Add an auto-ad session lock so only one short-ad cycle can run at a time.
   - Clear the lock only after the SDK promise finishes or after a safe timeout and the user state refresh completes.
   - Disable scheduling the next countdown while a claim is still pending.

2. **Claim only after a confirmed completed/closed view**
   - Change the auto flow from “timer finished → claim” to “SDK started and resolved/closed after minimum view time → claim”.
   - If the SDK does not resolve/close, keep waiting or stop auto-next instead of awarding points repeatedly.
   - If the SDK resolves too quickly, skip reward and schedule a fresh attempt without adding points.

3. **Stop auto-next on backend claim failure**
   - If `claimAdReward` returns cooldown/daily-limit/failure, immediately turn Auto-next off and clear countdown.
   - Show a clear toast so users understand auto mode paused.

4. **Avoid stale user data causing duplicate rewards**
   - After a successful claim, refresh user state before arming the next random countdown.
   - Use the updated cooldown/today values before opening the next ad.

5. **Server-side duplicate protection**
   - Add a backend guard so interstitial claims cannot be accepted more often than the configured cooldown/min view window, even if the frontend timer loops or the browser glitches.
   - This ensures points cannot keep increasing from the same still-open ad.

6. **Verification**
   - Type-check the changed files.
   - Verify the auto-next logic no longer schedules another claim while an ad/claim is in progress.