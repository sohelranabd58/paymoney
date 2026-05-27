
DROP FUNCTION IF EXISTS public.claim_ad_atomic(text, text, integer, integer, integer, numeric, text, integer);

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
RETURNS TABLE(
  out_new_points bigint,
  out_pending_points bigint,
  out_earned integer,
  out_today_count bigint,
  out_cycle_ads integer,
  out_needs_click_ad boolean,
  out_new_level integer
)
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

  SELECT au.points, au.pending_points INTO out_new_points, out_pending_points
    FROM public.app_users au WHERE au.chat_id = p_chat_id;
  out_earned := reward;
  out_today_count := today_cnt + 1;
  out_cycle_ads := new_cycle;
  out_needs_click_ad := (p_click_every > 0 AND new_cycle >= p_click_every);
  out_new_level := u.level;
  RETURN NEXT;
END;
$function$;
