
REVOKE EXECUTE ON FUNCTION public.claim_click_ad_atomic(text,integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_ad_atomic(text,text,integer,integer,integer,numeric,text,integer) FROM anon, authenticated;
