
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS pending_points bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_ads integer NOT NULL DEFAULT 0;

ALTER TABLE public.withdraw_requests
  ADD COLUMN IF NOT EXISTS redeem_code text;

-- Replace claim_ad_atomic: accumulate into pending_points, increment cycle_ads, signal needs_click_ad
CREATE OR REPLACE FUNCTION public.claim_ad_atomic(
  p_chat_id text,
  p_ad_type text,
  p_cooldown integer,
  p_daily_limit integer,
  p_base_points integer,
  p_multiplier numeric,
  p_last_col text,
  p_click_every integer DEFAULT 10
)
RETURNS TABLE(new_points bigint, pending_points bigint, earned integer, today_count bigint, cycle_ads integer, needs_click_ad boolean, new_level integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u public.app_users%ROWTYPE;
  last_ts timestamptz;
  today_cnt bigint;
  reward int;
  new_cycle int;
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
  new_cycle := u.cycle_ads + 1;

  EXECUTE format(
    'UPDATE public.app_users SET pending_points = pending_points + $1, total_earned = total_earned + $1, cycle_ads = $3, %I = now() WHERE chat_id = $2',
    p_last_col
  ) USING reward, p_chat_id, new_cycle;

  INSERT INTO public.ad_watches (chat_id, points, ad_type)
    VALUES (p_chat_id, reward, p_ad_type);

  SELECT points, pending_points INTO new_points, pending_points
    FROM public.app_users WHERE chat_id = p_chat_id;
  earned := reward;
  today_count := today_cnt + 1;
  cycle_ads := new_cycle;
  needs_click_ad := (p_click_every > 0 AND new_cycle >= p_click_every);
  new_level := u.level;
  RETURN NEXT;
END;
$function$;

-- New: claim_click_ad_atomic — moves pending + bonus into main points, resets cycle
CREATE OR REPLACE FUNCTION public.claim_click_ad_atomic(
  p_chat_id text,
  p_bonus integer
)
RETURNS TABLE(new_points bigint, moved bigint, bonus integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u public.app_users%ROWTYPE;
  total_add bigint;
BEGIN
  SELECT * INTO u FROM public.app_users WHERE chat_id = p_chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF u.banned THEN RAISE EXCEPTION 'Account banned'; END IF;
  IF u.flagged THEN RAISE EXCEPTION 'Account flagged'; END IF;

  total_add := u.pending_points + p_bonus;

  UPDATE public.app_users
    SET points = points + total_add,
        total_earned = total_earned + p_bonus,
        pending_points = 0,
        cycle_ads = 0
    WHERE chat_id = p_chat_id;

  INSERT INTO public.ad_watches (chat_id, points, ad_type)
    VALUES (p_chat_id, p_bonus, 'click');

  SELECT points INTO new_points FROM public.app_users WHERE chat_id = p_chat_id;
  moved := u.pending_points;
  bonus := p_bonus;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_ad_atomic(text,text,integer,integer,integer,numeric,text,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_click_ad_atomic(text,integer) FROM PUBLIC;

INSERT INTO public.app_settings (key, value) VALUES
  ('click_ad_every', '10'),
  ('click_ad_points', '50'),
  ('click_ad_zone', '9518673'),
  ('click_ad_sdk_id', 'show_9518673'),
  ('redeem_api_key', '8099021b36fa6ada29f091a3949bf00b'),
  ('notify_bot_token', ''),
  ('admin_username', '')
ON CONFLICT (key) DO NOTHING;
