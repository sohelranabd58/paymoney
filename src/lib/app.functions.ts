import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const chatIdSchema = z.string().trim().min(3).max(32).regex(/^\d+$/, "Invalid chat id");

async function getSettings() {
  const { data, error } = await supabaseAdmin.from("app_settings").select("key,value");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return map;
}

export const getUserState = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const settings = await getSettings();

    // upsert user
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("chat_id", data.chatId)
      .maybeSingle();

    let user = existing;
    if (!user) {
      const { data: created, error } = await supabaseAdmin
        .from("app_users")
        .insert({ chat_id: data.chatId })
        .select()
        .single();
      if (error) throw new Error(error.message);
      user = created;
    }

    // today's ad count
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId)
      .gte("watched_at", since.toISOString());

    return {
      user: {
        chat_id: user.chat_id,
        points: Number(user.points),
        total_earned: Number(user.total_earned),
        banned: user.banned,
        last_ad_at: user.last_ad_at,
      },
      settings: {
        app_name: settings.app_name ?? "Earn Rewards",
        welcome_message: settings.welcome_message ?? "Watch ads and earn points!",
        monetag_zone_id: settings.monetag_zone_id ?? "9518673",
        monetag_sdk_id: settings.monetag_sdk_id ?? "show_9518673",
        points_per_ad: Number(settings.points_per_ad ?? 10),
        min_withdraw: Number(settings.min_withdraw ?? 1000),
        daily_ad_limit: Number(settings.daily_ad_limit ?? 100),
        ad_cooldown_seconds: Number(settings.ad_cooldown_seconds ?? 30),
      },
      ads_today: count ?? 0,
    };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const settings = await getSettings();
    const pointsPerAd = Number(settings.points_per_ad ?? 10);
    const cooldown = Number(settings.ad_cooldown_seconds ?? 30);
    const dailyLimit = Number(settings.daily_ad_limit ?? 100);

    const { data: user, error: ue } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("chat_id", data.chatId)
      .single();
    if (ue || !user) throw new Error("User not found");
    if (user.banned) throw new Error("Account banned");

    // cooldown
    if (user.last_ad_at) {
      const last = new Date(user.last_ad_at).getTime();
      const diff = (Date.now() - last) / 1000;
      if (diff < cooldown) {
        throw new Error(`Wait ${Math.ceil(cooldown - diff)}s before next ad`);
      }
    }

    // daily limit
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId)
      .gte("watched_at", since.toISOString());
    if ((count ?? 0) >= dailyLimit) {
      throw new Error("Daily ad limit reached. Come back tomorrow!");
    }

    // award
    const newPoints = Number(user.points) + pointsPerAd;
    const newTotal = Number(user.total_earned) + pointsPerAd;
    const nowIso = new Date().toISOString();

    const { error: ue2 } = await supabaseAdmin
      .from("app_users")
      .update({ points: newPoints, total_earned: newTotal, last_ad_at: nowIso })
      .eq("chat_id", data.chatId);
    if (ue2) throw new Error(ue2.message);

    await supabaseAdmin.from("ad_watches").insert({
      chat_id: data.chatId,
      points: pointsPerAd,
    });

    return { points: newPoints, earned: pointsPerAd, ads_today: (count ?? 0) + 1 };
  });

export const listWithdrawMethods = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("withdraw_methods")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const submitSchema = z.object({
  chatId: chatIdSchema,
  methodId: z.string().uuid(),
  account: z.string().trim().min(3).max(120),
  amount: z.number().int().positive().max(10_000_000),
});

export const submitWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const settings = await getSettings();
    const globalMin = Number(settings.min_withdraw ?? 1000);

    const { data: method, error: me } = await supabaseAdmin
      .from("withdraw_methods")
      .select("*")
      .eq("id", data.methodId)
      .eq("enabled", true)
      .maybeSingle();
    if (me || !method) throw new Error("Invalid method");

    const minAmount = Math.max(globalMin, Number(method.min_amount));
    if (data.amount < minAmount) throw new Error(`Minimum withdraw is ${minAmount} points`);

    const { data: user, error: ue } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("chat_id", data.chatId)
      .single();
    if (ue || !user) throw new Error("User not found");
    if (user.banned) throw new Error("Account banned");
    if (Number(user.points) < data.amount) throw new Error("Insufficient points");

    // pending check — only one active request at a time
    const { count: pendingCount } = await supabaseAdmin
      .from("withdraw_requests")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId)
      .eq("status", "pending");
    if ((pendingCount ?? 0) > 0) {
      throw new Error("You already have a pending withdraw request");
    }

    // deduct points immediately (hold)
    await supabaseAdmin
      .from("app_users")
      .update({ points: Number(user.points) - data.amount })
      .eq("chat_id", data.chatId);

    const { data: req, error: re } = await supabaseAdmin
      .from("withdraw_requests")
      .insert({
        chat_id: data.chatId,
        method_id: method.id,
        method_name: method.name,
        account: data.account,
        amount: data.amount,
        status: "pending",
      })
      .select()
      .single();
    if (re) throw new Error(re.message);

    // notify admin via telegram bot (best-effort)
    const botToken = settings.bot_token;
    const adminChat = settings.admin_chat_id;
    if (botToken && adminChat) {
      const msg =
        `🆕 New Withdraw Request\n\n` +
        `User: ${data.chatId}\n` +
        `Method: ${method.name}\n` +
        `Account: ${data.account}\n` +
        `Amount: ${data.amount} points`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: adminChat, text: msg }),
        });
      } catch (e) {
        console.error("admin notify failed", e);
      }
    }

    return { id: req.id, status: req.status };
  });

export const getUserHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const [ads, withdraws] = await Promise.all([
      supabaseAdmin
        .from("ad_watches")
        .select("id,points,watched_at")
        .eq("chat_id", data.chatId)
        .order("watched_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("withdraw_requests")
        .select("id,method_name,account,amount,status,created_at,processed_at,note")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (ads.error) throw new Error(ads.error.message);
    if (withdraws.error) throw new Error(withdraws.error.message);
    return { ads: ads.data ?? [], withdraws: withdraws.data ?? [] };
  });
