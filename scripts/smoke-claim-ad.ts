/**
 * Smoke test for claim_ad_atomic RPC.
 * Run with: bun scripts/smoke-claim-ad.ts
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (Available in Lovable Cloud sandbox automatically.)
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const CHAT_ID = "smoke_test_user";

async function callClaim() {
  return supabase.rpc("claim_ad_atomic", {
    p_chat_id: CHAT_ID,
    p_ad_type: "interstitial",
    p_cooldown: 0, // disable cooldown for back-to-back calls
    p_daily_limit: 100,
    p_base_points: 10,
    p_multiplier: 1,
    p_last_col: "last_ad_at",
    p_click_every: 10,
  });
}

function assertShape(row: Record<string, unknown>) {
  const required = [
    "out_new_points",
    "out_pending_points",
    "out_earned",
    "out_today_count",
    "out_cycle_ads",
    "out_needs_click_ad",
    "out_new_level",
  ];
  const missing = required.filter((k) => !(k in row));
  if (missing.length) throw new Error(`Missing fields: ${missing.join(", ")}`);
}

async function main() {
  // Clean previous test state
  await supabase.from("ad_watches").delete().eq("chat_id", CHAT_ID);
  await supabase.from("app_users").delete().eq("chat_id", CHAT_ID);

  // --- Pass 1: NEW user ---
  console.log("\n[1] Inserting fresh test user…");
  const { error: insErr } = await supabase
    .from("app_users")
    .insert({ chat_id: CHAT_ID });
  if (insErr) throw insErr;

  console.log("[1] Calling claim_ad_atomic (new user)…");
  const r1 = await callClaim();
  if (r1.error) throw new Error(`NEW user claim failed: ${r1.error.message}`);
  const row1 = Array.isArray(r1.data) ? r1.data[0] : r1.data;
  assertShape(row1 as Record<string, unknown>);
  console.log("[1] OK →", row1);

  // --- Pass 2: EXISTING user, second claim ---
  console.log("\n[2] Calling claim_ad_atomic (existing user, 2nd claim)…");
  const r2 = await callClaim();
  if (r2.error) throw new Error(`EXISTING user claim failed: ${r2.error.message}`);
  const row2 = Array.isArray(r2.data) ? r2.data[0] : r2.data;
  assertShape(row2 as Record<string, unknown>);
  console.log("[2] OK →", row2);

  // sanity: cycle_ads should have incremented
  if (Number(row2.out_cycle_ads) <= Number(row1.out_cycle_ads)) {
    throw new Error("cycle_ads did not increment between calls");
  }

  // Cleanup
  await supabase.from("ad_watches").delete().eq("chat_id", CHAT_ID);
  await supabase.from("app_users").delete().eq("chat_id", CHAT_ID);

  console.log("\n✅ All smoke tests passed — no ambiguity errors.");
}

main().catch((e) => {
  console.error("\n❌ Smoke test failed:", e);
  process.exit(1);
});
