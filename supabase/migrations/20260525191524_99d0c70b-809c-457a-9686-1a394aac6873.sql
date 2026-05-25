
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS tg_username text,
  ADD COLUMN IF NOT EXISTS tg_first_name text,
  ADD COLUMN IF NOT EXISTS tg_last_name text,
  ADD COLUMN IF NOT EXISTS tg_photo_url text,
  ADD COLUMN IF NOT EXISTS tg_profile_synced_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tg-avatars', 'tg-avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tg-avatars public read'
  ) THEN
    CREATE POLICY "tg-avatars public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'tg-avatars');
  END IF;
END $$;
