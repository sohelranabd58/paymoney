
REVOKE EXECUTE ON FUNCTION public.claim_ad_atomic(text, text, int, int, int, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_withdraw_atomic(text, uuid, text, text, bigint) FROM PUBLIC, anon, authenticated;
