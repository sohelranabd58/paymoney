## Plan: Auto-close + auto-show short ads with randomized timing

### Goal
When a user watches a short ad, the ad should auto-close and a new ad should auto-start — fully hands-free. The delay between close and next open, and between open and close, should be **randomized** so the ad network can't detect a fixed pattern.

### Behavior
1. **Auto-next toggle** (already exists) stays as the on/off switch. When ON:
   - After a short ad is claimed/closed, wait a **random delay** before opening the next ad.
   - After the next ad opens, wait another **random view duration**, then trigger close and reward flow.
   - Loop continues until: toggle is turned off, daily limit is hit, cooldown blocks it, or user navigates away.

2. **Randomization ranges** (admin-tunable via `app_settings`, with safe defaults):
   - `auto_next_min_delay_seconds` = 12
   - `auto_next_max_delay_seconds` = 22
   - `auto_next_min_view_seconds` = 15
   - `auto_next_max_view_seconds` = 25
   - Each cycle picks a fresh random integer in each range (jitter, not fixed 16s).

3. **Auto-close**: after the random view window, programmatically dismiss the ad overlay (best-effort: blur/focus reset, remove ad iframe if the SDK leaves one, or fire the SDK's completion). If the SDK auto-closes on its own, we just wait the random window and proceed.

4. **Safety guards**:
   - Stop loop if `today >= daily_limit`, cooldown active, user banned, SDK not ready, page hidden (`document.hidden`), or toggle turned off mid-cycle.
   - Cancel pending timers on unmount / toggle-off.
   - Never claim reward before server-required min view seconds.

5. **UI**:
   - Small status line under the Auto-next switch: "Next ad in Ns" countdown using the randomized value (shown as countdown, not the range, so it looks natural).
   - Keep existing cooldown ring on the ad card.

### Files to change
- `src/routes/earn.tsx` — replace fixed 16s `autoLeft` logic with randomized cycle (delay → open → view → claim → repeat), add cleanup, respect guards.
- `src/components/earn-ui.tsx` — minor: expose auto-next status text.
- `src/lib/app.functions.ts` — extend `getSettings` return to include the four new range settings (with defaults if row missing).
- One migration to seed `auto_next_min_delay_seconds`, `auto_next_max_delay_seconds`, `auto_next_min_view_seconds`, `auto_next_max_view_seconds` into `app_settings`.

### Not in scope
- No change to reward amounts, SDK integration, or click-ad flow.
- No change to admin UI this turn (settings can be edited via existing settings editor once seeded).
