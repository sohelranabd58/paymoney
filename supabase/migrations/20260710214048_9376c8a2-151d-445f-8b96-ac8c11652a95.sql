INSERT INTO public.app_settings (key, value) VALUES
  ('auto_next_min_delay_seconds', '12'),
  ('auto_next_max_delay_seconds', '22'),
  ('auto_next_min_view_seconds', '15'),
  ('auto_next_max_view_seconds', '25')
ON CONFLICT (key) DO NOTHING;