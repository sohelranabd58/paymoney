
-- Enable RLS on all public tables (deny by default; service role bypasses)
ALTER TABLE public.ad_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;

-- Prevent double-spend: only one pending withdraw per user
CREATE UNIQUE INDEX IF NOT EXISTS withdraw_requests_one_pending_per_user
  ON public.withdraw_requests (chat_id)
  WHERE status = 'pending';

-- Atomic ad-claim function: row-locks the user, enforces cooldown & daily limit, inserts watch, returns new state
CREATE OR REPLACE FUNCTION public.claim_ad_atomic(
  p_chat_id text,
  p_ad_type text,
  p_cooldown int,
  p_daily_limit int,
  p_base_points int,
  p_multiplier numeric,
  p_last_col text
) RETURNS TABLE (
  new_points bigint,
  earned int,
  today_count bigint,
  new_level int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.app_users%ROWTYPE;
  last_ts timestamptz;
  today_cnt bigint;
  total_cnt bigint;
  reward int;
  since timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
BEGIN
  SELECT * INTO u FROM public.app_users WHERE chat_id = p_chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF u.banned THEN RAISE EXCEPTION 'Account banned'; END IF;
  IF u.flagged THEN RAISE EXCEPTION 'Account flagged for suspicious activity'; END IF;

  EXECUTE format('SELECT ($1).%I', p_last_col) INTO last_ts USING u;
  IF last_ts IS NOT NULL AND EXTRACT(EPOCH FROM (now() - last_ts)) < p_cooldown THEN
    RAISE EXCEPTION 'Wait % seconds before next ad', CEIL(p_cooldown - EXTRACT(EPOCH FROM (now() - last_ts)));
  END IF;

  SELECT count(*) INTO today_cnt FROM public.ad_watches
    WHERE chat_id = p_chat_id AND ad_type = p_ad_type AND watched_at >= since;
  IF today_cnt >= p_daily_limit THEN
    RAISE EXCEPTION 'Daily limit reached for this ad type. Try again tomorrow!';
  END IF;

  reward := ROUND(p_base_points * p_multiplier);

  EXECUTE format(
    'UPDATE public.app_users SET points = points + $1, total_earned = total_earned + $1, %I = now() WHERE chat_id = $2',
    p_last_col
  ) USING reward, p_chat_id;

  INSERT INTO public.ad_watches (chat_id, points, ad_type)
    VALUES (p_chat_id, reward, p_ad_type);

  SELECT points INTO new_points FROM public.app_users WHERE chat_id = p_chat_id;
  earned := reward;
  today_count := today_cnt + 1;
  new_level := u.level;
  RETURN NEXT;
END;
$$;

-- Atomic withdraw submission
CREATE OR REPLACE FUNCTION public.submit_withdraw_atomic(
  p_chat_id text,
  p_method_id uuid,
  p_method_name text,
  p_account text,
  p_amount bigint
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u public.app_users%ROWTYPE;
  new_id uuid;
BEGIN
  SELECT * INTO u FROM public.app_users WHERE chat_id = p_chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF u.banned THEN RAISE EXCEPTION 'Account banned'; END IF;
  IF u.flagged THEN RAISE EXCEPTION 'Account flagged'; END IF;
  IF u.points < p_amount THEN RAISE EXCEPTION 'Insufficient points'; END IF;

  UPDATE public.app_users SET points = points - p_amount WHERE chat_id = p_chat_id;

  INSERT INTO public.withdraw_requests (chat_id, method_id, method_name, account, amount, status)
    VALUES (p_chat_id, p_method_id, p_method_name, p_account, p_amount, 'pending')
    RETURNING id INTO new_id;
  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  -- partial unique index caught a concurrent duplicate pending request; refund
  UPDATE public.app_users SET points = points + p_amount WHERE chat_id = p_chat_id;
  RAISE EXCEPTION 'You already have a pending withdraw request';
END;
$$;
