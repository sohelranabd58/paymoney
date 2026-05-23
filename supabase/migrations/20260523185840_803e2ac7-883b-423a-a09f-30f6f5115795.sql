
-- Extend ad_watches with type
ALTER TABLE public.ad_watches ADD COLUMN IF NOT EXISTS ad_type text NOT NULL DEFAULT 'interstitial';
CREATE INDEX IF NOT EXISTS idx_ad_watches_chat_type ON public.ad_watches(chat_id, ad_type, watched_at DESC);

-- Extend app_users
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT 1;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_ip text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_ua text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_inapp_at timestamptz;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS last_popup_at timestamptz;

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  url text,
  reward_points bigint NOT NULL DEFAULT 50,
  task_type text NOT NULL DEFAULT 'visit_url',
  verify_method text NOT NULL DEFAULT 'auto',
  channel_username text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'approved',
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id, task_id)
);
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_task_completions_chat ON public.task_completions(chat_id);

-- Devices / anti-fraud
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_devices_ip ON public.user_devices(ip);
CREATE INDEX IF NOT EXISTS idx_user_devices_chat ON public.user_devices(chat_id);

-- Seed default settings (only if missing)
INSERT INTO public.app_settings(key, value) VALUES
  ('zone_interstitial', '9518673'),
  ('zone_popup', '9518673'),
  ('zone_inapp', '9518673'),
  ('points_interstitial', '10'),
  ('points_popup', '5'),
  ('points_inapp', '3'),
  ('cooldown_interstitial', '30'),
  ('cooldown_popup', '60'),
  ('cooldown_inapp', '120'),
  ('daily_limit_interstitial', '100'),
  ('daily_limit_popup', '50'),
  ('daily_limit_inapp', '30'),
  ('levels_json', '[{"level":1,"min_ads":0,"multiplier":1.0,"name":"Bronze"},{"level":2,"min_ads":50,"multiplier":1.1,"name":"Silver"},{"level":3,"min_ads":200,"multiplier":1.25,"name":"Gold"},{"level":4,"min_ads":500,"multiplier":1.5,"name":"Platinum"},{"level":5,"min_ads":1500,"multiplier":2.0,"name":"Diamond"}]'),
  ('max_accounts_per_ip', '3'),
  ('anti_fraud_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
