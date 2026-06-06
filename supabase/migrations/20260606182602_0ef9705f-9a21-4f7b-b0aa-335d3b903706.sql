
ALTER TABLE public.withdraw_requests
  ADD COLUMN IF NOT EXISTS bot_old_points bigint,
  ADD COLUMN IF NOT EXISTS bot_new_points bigint,
  ADD COLUMN IF NOT EXISTS bot_response text;

INSERT INTO public.app_settings (key, value)
VALUES
  ('auto_next_ad_enabled', 'false'),
  ('auto_next_ad_delay_seconds', '16'),
  ('use_global_min_withdraw', 'false')
ON CONFLICT (key) DO NOTHING;
