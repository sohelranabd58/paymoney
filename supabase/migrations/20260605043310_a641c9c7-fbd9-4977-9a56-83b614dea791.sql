
-- 1) Extend tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS sponsor_chat_id text,
  ADD COLUMN IF NOT EXISTS max_completions integer,
  ADD COLUMN IF NOT EXISTS completions_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_interval_seconds integer NOT NULL DEFAULT 0;

-- 2) app_users click ad open timestamp
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS click_ad_opened_at timestamptz;

-- 3) Sponsor task requests
CREATE TABLE IF NOT EXISTS public.sponsor_task_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  title text NOT NULL,
  description text,
  icon text,
  url text,
  task_type text NOT NULL DEFAULT 'visit_url',
  reward_points bigint NOT NULL,
  total_slots integer NOT NULL,
  total_cost bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewer_note text,
  created_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

GRANT ALL ON public.sponsor_task_requests TO service_role;
ALTER TABLE public.sponsor_task_requests ENABLE ROW LEVEL SECURITY;
-- No public policies; accessed only via SECURITY DEFINER server fns.

-- 4) Seed app_settings (idempotent)
INSERT INTO public.app_settings (key, value) VALUES
  ('sponsor_tasks_enabled','true'),
  ('sponsor_min_reward','10'),
  ('sponsor_min_slots','10'),
  ('click_ad_enabled','true'),
  ('click_ad_min_view_seconds','15'),
  ('marquee_tasks_text',''),
  ('global_banner_enabled','true')
ON CONFLICT (key) DO NOTHING;

-- 5) Seed Bot Points withdraw method (only if not present)
INSERT INTO public.withdraw_methods (name, icon, min_amount, instructions, enabled, sort_order)
SELECT 'Bot Points', '🤖', 100,
  'Enter your bot user_id. Points will be credited to your bot account automatically on approval.',
  true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.withdraw_methods WHERE name = 'Bot Points');

-- 6) Submit sponsor task atomically (debit points, lock row)
CREATE OR REPLACE FUNCTION public.submit_sponsor_task_atomic(
  p_chat_id text,
  p_title text,
  p_description text,
  p_icon text,
  p_url text,
  p_task_type text,
  p_reward bigint,
  p_slots integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u public.app_users%ROWTYPE;
  cost bigint;
  min_reward bigint;
  min_slots integer;
  enabled_v text;
  new_id uuid;
BEGIN
  SELECT value INTO enabled_v FROM public.app_settings WHERE key = 'sponsor_tasks_enabled';
  IF COALESCE(enabled_v,'true') <> 'true' THEN
    RAISE EXCEPTION 'Sponsor tasks are disabled';
  END IF;

  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key='sponsor_min_reward'),'10')::bigint INTO min_reward;
  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key='sponsor_min_slots'),'10')::int INTO min_slots;

  IF p_reward < min_reward THEN RAISE EXCEPTION 'Reward must be at least % points', min_reward; END IF;
  IF p_slots  < min_slots  THEN RAISE EXCEPTION 'Slots must be at least %', min_slots; END IF;

  cost := p_reward * p_slots;

  SELECT * INTO u FROM public.app_users WHERE chat_id = p_chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF u.banned THEN RAISE EXCEPTION 'Account banned'; END IF;
  IF u.flagged THEN RAISE EXCEPTION 'Account flagged'; END IF;
  IF u.points < cost THEN RAISE EXCEPTION 'Insufficient points (need %)', cost; END IF;

  UPDATE public.app_users SET points = points - cost WHERE chat_id = p_chat_id;

  INSERT INTO public.sponsor_task_requests
    (chat_id, title, description, icon, url, task_type, reward_points, total_slots, total_cost, status)
  VALUES
    (p_chat_id, p_title, p_description, p_icon, p_url, p_task_type, p_reward, p_slots, cost, 'pending')
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 7) Approve sponsor task: create real tasks row
CREATE OR REPLACE FUNCTION public.admin_approve_sponsor_task(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.sponsor_task_requests%ROWTYPE;
  new_task uuid;
BEGIN
  SELECT * INTO r FROM public.sponsor_task_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  INSERT INTO public.tasks
    (title, description, icon, url, reward_points, task_type, verify_method,
     active, sort_order, source, sponsor_chat_id, max_completions, completions_count)
  VALUES
    (r.title, r.description, COALESCE(r.icon,'🎁'), r.url, r.reward_points,
     r.task_type, 'auto', true, 0, 'sponsor', r.chat_id, r.total_slots, 0)
  RETURNING id INTO new_task;

  UPDATE public.sponsor_task_requests
    SET status='approved', reviewed_at=now(), created_task_id=new_task
    WHERE id = p_id;

  RETURN new_task;
END;
$$;

-- 8) Reject sponsor task with refund
CREATE OR REPLACE FUNCTION public.admin_reject_sponsor_task(p_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.sponsor_task_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.sponsor_task_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already processed'; END IF;

  UPDATE public.app_users SET points = points + r.total_cost WHERE chat_id = r.chat_id;
  UPDATE public.sponsor_task_requests
    SET status='rejected', reviewed_at=now(), reviewer_note=p_note
    WHERE id = p_id;
END;
$$;

-- 9) Trigger: bump completions_count, auto-deactivate when full (approved only)
CREATE OR REPLACE FUNCTION public.bump_task_completions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  newc integer;
  maxc integer;
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.tasks
      SET completions_count = completions_count + 1
      WHERE id = NEW.task_id
      RETURNING completions_count, max_completions INTO newc, maxc;
    IF maxc IS NOT NULL AND newc >= maxc THEN
      UPDATE public.tasks SET active = false WHERE id = NEW.task_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_completions_bump ON public.task_completions;
CREATE TRIGGER task_completions_bump
  AFTER INSERT ON public.task_completions
  FOR EACH ROW EXECUTE FUNCTION public.bump_task_completions();

-- Also handle status transitions (manual approval)
CREATE OR REPLACE FUNCTION public.bump_task_completions_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  newc integer;
  maxc integer;
BEGIN
  IF OLD.status <> 'approved' AND NEW.status = 'approved' THEN
    UPDATE public.tasks
      SET completions_count = completions_count + 1
      WHERE id = NEW.task_id
      RETURNING completions_count, max_completions INTO newc, maxc;
    IF maxc IS NOT NULL AND newc >= maxc THEN
      UPDATE public.tasks SET active = false WHERE id = NEW.task_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_completions_bump_update ON public.task_completions;
CREATE TRIGGER task_completions_bump_update
  AFTER UPDATE ON public.task_completions
  FOR EACH ROW EXECUTE FUNCTION public.bump_task_completions_update();

-- 10) Mark click-ad opened
CREATE OR REPLACE FUNCTION public.mark_click_ad_opened(p_chat_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.app_users SET click_ad_opened_at = now() WHERE chat_id = p_chat_id;
END;
$$;

-- 11) Enforce min view seconds in click ad claim
CREATE OR REPLACE FUNCTION public.claim_click_ad_atomic(p_chat_id text, p_bonus integer)
RETURNS TABLE(new_points bigint, moved bigint, bonus integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u public.app_users%ROWTYPE;
  total_add bigint;
  min_s integer;
  elapsed numeric;
BEGIN
  SELECT * INTO u FROM public.app_users WHERE chat_id = p_chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF u.banned THEN RAISE EXCEPTION 'Account banned'; END IF;
  IF u.flagged THEN RAISE EXCEPTION 'Account flagged'; END IF;

  SELECT COALESCE((SELECT value FROM public.app_settings WHERE key='click_ad_min_view_seconds'),'15')::int INTO min_s;
  IF min_s > 0 THEN
    IF u.click_ad_opened_at IS NULL THEN
      RAISE EXCEPTION 'Open the ad first';
    END IF;
    elapsed := EXTRACT(EPOCH FROM (now() - u.click_ad_opened_at));
    IF elapsed < min_s THEN
      RAISE EXCEPTION 'Watch the ad for % more second(s)', CEIL(min_s - elapsed);
    END IF;
  END IF;

  total_add := u.pending_points + p_bonus;

  UPDATE public.app_users
    SET points = points + total_add,
        total_earned = total_earned + p_bonus,
        pending_points = 0,
        cycle_ads = 0,
        click_ad_opened_at = NULL
    WHERE chat_id = p_chat_id;

  INSERT INTO public.ad_watches (chat_id, points, ad_type)
    VALUES (p_chat_id, p_bonus, 'click');

  SELECT points INTO new_points FROM public.app_users WHERE chat_id = p_chat_id;
  moved := u.pending_points;
  bonus := p_bonus;
  RETURN NEXT;
END;
$$;
