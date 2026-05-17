
-- Users table (telegram chat_id as primary identifier)
CREATE TABLE public.app_users (
  chat_id TEXT PRIMARY KEY,
  points BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ad_at TIMESTAMPTZ
);

CREATE TABLE public.ad_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.app_users(chat_id) ON DELETE CASCADE,
  points INT NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ad_watches_chat ON public.ad_watches(chat_id, watched_at DESC);

CREATE TABLE public.withdraw_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT,
  min_amount BIGINT NOT NULL DEFAULT 1000,
  instructions TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.withdraw_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL REFERENCES public.app_users(chat_id) ON DELETE CASCADE,
  method_id UUID REFERENCES public.withdraw_methods(id),
  method_name TEXT NOT NULL,
  account TEXT NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX idx_withdraw_requests_chat ON public.withdraw_requests(chat_id, created_at DESC);
CREATE INDEX idx_withdraw_requests_status ON public.withdraw_requests(status, created_at DESC);

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lock everything down — only server functions (service role) access
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('admin_password', '76737'),
  ('monetag_zone_id', '9518673'),
  ('monetag_sdk_id', 'show_9518673'),
  ('admin_chat_id', ''),
  ('bot_token', ''),
  ('points_per_ad', '10'),
  ('min_withdraw', '1000'),
  ('daily_ad_limit', '100'),
  ('ad_cooldown_seconds', '30'),
  ('app_name', 'Earn Rewards'),
  ('welcome_message', 'Watch ads and earn points!');

INSERT INTO public.withdraw_methods (name, icon, min_amount, instructions, sort_order) VALUES
  ('bKash', '📱', 1000, 'Enter your bKash personal number (11 digits)', 1),
  ('Nagad', '💸', 1000, 'Enter your Nagad personal number (11 digits)', 2),
  ('Binance Pay (USDT)', '💰', 5000, 'Enter your Binance Pay ID', 3);
