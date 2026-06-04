
-- Fix reset function: Supabase Data API blocks bare UPDATE without WHERE
CREATE OR REPLACE FUNCTION public.admin_reset_all_points()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n bigint;
BEGIN
  UPDATE public.app_users
    SET points = 0, pending_points = 0, cycle_ads = 0
    WHERE chat_id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Task completion proof fields
ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer_note text;

-- Optional require_proof flag on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS require_proof boolean NOT NULL DEFAULT false;

-- Add 'rejected' status compatibility — column already accepts text; no enum change needed.
