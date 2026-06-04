# Plan

## 1. Tasks page — require Open before Verify & claim

In `src/routes/tasks.tsx`:
- Track per-task "opened" state in `localStorage` (key: `task_opened_<taskId>`), set when the user clicks the **Open** link.
- Hide the **Verify & claim** button until the task has been opened. Show a small hint: "Open the link first, then come back to claim."
- For tasks with `task_type === "join_channel"` (Telegram), the same gate applies — they must tap Open at least once.
- If a task has no `url` (custom), skip the gate.

## 2. Manual verification with screenshot upload

When a task's `verify_method` is `manual`, require the user to upload a screenshot before submission. Admin reviews it and approves/rejects.

### Database (migration)
- Add columns to `task_completions`:
  - `proof_url text` — uploaded screenshot URL
  - `reviewed_at timestamptz`
  - `reviewer_note text`
- Add column to `tasks`: `require_proof boolean default false` (auto-true when verify_method = manual; admin can also enable for other manual tasks).
- Create public storage bucket `task-proofs` with policy allowing anon insert (chat_id-scoped path) and public read.

### User flow (`src/routes/tasks.tsx`)
- For manual tasks, after Open is clicked, show a file input + preview. On submit, upload to `task-proofs/<chatId>/<taskId>-<timestamp>.jpg`, then call `claimTask` with `proof_url`.
- Update `claimTask` in `src/lib/app.functions.ts` to accept optional `proofUrl` and store it on `task_completions`. Reject manual submissions without proof when `require_proof` is on.

### Admin flow (`src/routes/admin.dashboard.tsx` + `src/lib/admin.functions.ts`)
- New section/tab **Task Reviews** listing pending manual completions with: chat_id, task title, reward, screenshot thumbnail (click to enlarge), Approve / Reject buttons + optional note.
- New server fns: `adminListPendingTaskCompletions`, `adminReviewTaskCompletion({id, action, note})`.
  - Approve → set status `approved`, credit user points + total_earned.
  - Reject → set status `rejected`, no credit (do not auto-refund since nothing was deducted).
- Add Task Reviews count badge to overview.

## 3. Fix "Reset all points" error

The Supabase Data API rejects bare UPDATEs without a WHERE clause. Fix the SQL function `admin_reset_all_points` to use an explicit predicate:

```sql
UPDATE public.app_users
SET points = 0, pending_points = 0, cycle_ads = 0
WHERE chat_id IS NOT NULL;
```

Ship as a migration replacing the function definition.

## Files changed
- `src/routes/tasks.tsx` — Open-gate + screenshot upload UI
- `src/lib/app.functions.ts` — `claimTask` accepts `proofUrl`, validates proof requirement
- `src/lib/admin.functions.ts` — pending list + review server fns
- `src/routes/admin.dashboard.tsx` — Task Reviews tab
- Migration: `task_completions` columns, `tasks.require_proof`, `task-proofs` bucket + policies, replace `admin_reset_all_points`
