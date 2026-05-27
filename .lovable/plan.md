## Bug: Duplicate `claim_ad_atomic` function overloads

**Error:** `Could not choose the best candidate function between: public.claim_ad_atomic(... 7 args) and public.claim_ad_atomic(... 8 args with p_click_every)`

When the cycle/click-ad migration added a new `claim_ad_atomic` signature with `p_click_every`, the old 7-arg version was not dropped. Postgres can't pick between them when the client calls the RPC, so every ad claim fails.

## Fix

1. **Migration** — drop the obsolete overload:
   ```sql
   DROP FUNCTION IF EXISTS public.claim_ad_atomic(text, text, integer, integer, integer, numeric, text);
   ```
   Keep the 8-arg version (with `p_click_every`) intact.

2. **Audit other RPCs** for the same hazard (`claim_click_ad_atomic`, `submit_withdraw_atomic`) — single overload each, OK.

3. **Sanity check** `src/lib/app.functions.ts` passes `p_click_every` in every `claim_ad_atomic` call so the resolved signature is unambiguous.

No frontend code changes required. After the migration the Earn page Claim buttons will work again.