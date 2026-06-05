# Plan

Big multi-feature update. Grouped into 9 areas. Approve and I'll ship migrations + code in one pass.

## 1. User-created (sponsor) tasks — points spent to advertise

Users can spend their points to publish a task. Admin reviews and approves.

- New table `sponsor_task_requests`: `chat_id`, `title`, `description`, `icon`, `url`, `task_type`, `reward_points` (per user), `total_slots` (how many users complete before "done"), `completed_slots`, `total_cost` (points debited from sponsor = reward × slots, locked at submit), `status` (pending/approved/rejected/done), `reviewer_note`.
- Admin settings: `sponsor_tasks_enabled` (on/off), `sponsor_min_reward`, `sponsor_min_slots`, `sponsor_min_total_cost`.
- User flow (new page `/sponsor`): form with title, description, link, per-task reward, total slots. Live "total cost = reward × slots" preview. On submit: atomic SQL `submit_sponsor_task_atomic` debits points → inserts pending row.
- Admin reviews in dashboard → Approve creates a real row in `tasks` with `source='sponsor'`, `sponsor_chat_id`, `max_completions=total_slots`. Reject refunds points.
- `tasks` gets `source` ('admin' | 'sponsor'), `sponsor_chat_id`, `max_completions`, `completions_count`. Task auto-deactivates when `completions_count >= max_completions`.
- Tasks list shows badge: "Sponsor" or "Admin", matching whatever was selected.

## 2. Bot-point withdrawal method

- Seed a `withdraw_methods` row "Bot Points" with icon 🤖.
- When admin processes a withdraw whose `method_name='Bot Points'`, server calls:
  `https://sohel.pp.ua/main/bot/fackss/redeem_api.php?key=<BOT_REDEEM_KEY>&action=add_points&user_id=<account>&points=<amount>`
  on Approve. Key stored in secrets (`BOT_REDEEM_KEY`), not hardcoded. Auto-mark completed on 200 OK; show error + leave pending on failure.

## 3. Time-based / repeatable tasks

- `tasks` adds `repeat_interval_seconds int default 0` (0 = one-time). When > 0, the user can complete the same task again after the interval.
- Listing logic uses most-recent completion timestamp; "Locked for Xh Ym" badge until cooldown elapses. Sponsor tasks remain one-time-per-user.

## 4. Task page UX — full-screen step-by-step dialog

- Replace inline description with a full-screen `Dialog` opened on card tap.
- Shows: icon, title, description (admin/sponsor markdown-ish line breaks preserved, rendered as ordered steps), reward.
- Bottom: single primary button `Start` → opens link in new tab AND marks task as opened (`localStorage`). After return, the dialog updates to show `Verify & claim` (and screenshot uploader when `require_proof`).

## 5. Click-to-get-reward (bonus click ad) controls

Already partially exists; add full admin control + correctness:
- New settings: `click_ad_enabled` (master on/off — when off, never show popup and rewards always go to balance), `click_ad_min_view_seconds` (default 15).
- Popup only shows when `click_ad_enabled` AND `bonus_points > 0` AND `pending_points > 0` (so 0 amount = silent).
- Track `click_ad_opened_at` server-side via new fn `startClickAd`; `claimClickAd` rejects if `now() - opened_at < click_ad_min_view_seconds` ("Watch the ad for X more seconds").
- Admin Ads section gets: master toggle, min seconds input.

## 6. Manual task proof — delete after review

- Update `adminReviewTask`: after Approve/Reject is saved, remove the file from storage (`task-proofs`) and null out `proof_url`. Pending list keeps showing thumbnail until decision.

## 7. Scrolling marquee on Tasks page

- `app_settings.marquee_tasks_text` (separate from existing earn marquee). Tasks header renders `<Marquee text={...} />` reusing the existing component.

## 8. Responsive 468×60 banner ad on every page

- New `<HighPerfBanner />` component injecting the provided `atOptions` + invoke.js into an isolated `<iframe srcDoc>` so the third-party script is sandboxed. Wrapper: `w-full max-w-[468px] mx-auto aspect-[468/60]` so it scales down responsively on narrow phones without overflow.
- Mounted in `__root.tsx` below `<Outlet />` so it appears on every page (home, earn, tasks, withdraw, history, sponsor). Hidden on `/admin/*` routes.

## 9. Admin panel UI polish + security pass

- Sidebar → grouped collapsible nav (Overview · Users · Tasks · Sponsor Reviews · Task Reviews · Withdrawals · Methods · Ads · Levels · Settings) with icons, active highlight, sticky header showing current section + logout.
- Stat cards on Overview: pending sponsor count, pending task reviews count, pending withdrawals, today's earnings.
- Tasks editor: add Source selector (Admin / Sponsor display-only flag), Reward, Max completions, Repeat interval, Require proof toggle.
- Settings page surfaces: sponsor toggle + minimums, click-ad master toggle + min seconds, marquee texts (earn + tasks).
- Security sweep:
  - Confirm every admin server fn calls `assertAdmin(password)` before any write.
  - Add Zod validation (length / regex / range) to every new input (sponsor submit, settings, withdraw account).
  - `submit_sponsor_task_atomic` runs `SELECT … FOR UPDATE` on `app_users` to prevent double-spend.
  - Bot-redeem API key only read from `process.env.BOT_REDEEM_KEY` inside `.handler()`; never bundled to client.
  - Storage policies: `task-proofs` stays private; admin signed URLs only.
  - Re-run `supabase--linter` and patch findings introduced by new tables (GRANTs + RLS).

## Technical / files

**Migrations (single file):**
- `tasks`: + `source text default 'admin'`, `sponsor_chat_id text`, `max_completions int`, `completions_count int default 0`, `repeat_interval_seconds int default 0`.
- New `sponsor_task_requests` table + GRANTs + RLS (admin-only via server fn).
- New `app_settings` rows: `sponsor_tasks_enabled`, `sponsor_min_reward`, `sponsor_min_slots`, `click_ad_enabled`, `click_ad_min_view_seconds`, `marquee_tasks_text`.
- `app_users`: + `click_ad_opened_at timestamptz`.
- SQL fns: `submit_sponsor_task_atomic`, `admin_approve_sponsor_task`, `admin_reject_sponsor_task` (refund), update `claim_click_ad_atomic` to check min seconds, trigger on `task_completions` insert to bump `tasks.completions_count` and auto-set `active=false` when full.
- Seed `withdraw_methods` "Bot Points".

**Code:**
- `src/components/HighPerfBanner.tsx` (new), mount in `src/routes/__root.tsx`.
- `src/components/TaskDetailDialog.tsx` (new full-screen task dialog).
- `src/routes/sponsor.tsx` (new), nav entry in `BottomNav`.
- `src/routes/tasks.tsx`: dialog wiring, marquee, source badge, repeat cooldown.
- `src/routes/admin.dashboard.tsx`: nav refactor, Sponsor Reviews tab, Settings additions, Tasks editor extensions.
- `src/lib/app.functions.ts`: `submitSponsorTask`, `startClickAd`, updated `claimClickAd`.
- `src/lib/admin.functions.ts`: sponsor list/approve/reject, settings save, bot-redeem call on approve, proof file deletion after review.
- Secret: `BOT_REDEEM_KEY` (I'll prompt you to set it).

## Out of scope (flag if you want them)
- Email/Telegram notification to sponsor on approval/rejection.
- Sponsor analytics (impressions, click-through).
