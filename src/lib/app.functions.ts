import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const chatIdSchema = z.string().trim().min(3).max(32).regex(/^\d+$/, "Invalid chat id");
const adTypeSchema = z.enum(["interstitial", "popup", "inapp"]);

type Level = { level: number; min_ads: number; multiplier: number; name: string };

async function getSettings() {
  const { data, error } = await supabaseAdmin.from("app_settings").select("key,value");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return map;
}

function parseLevels(json: string | undefined): Level[] {
  const fallback: Level[] = [{ level: 1, min_ads: 0, multiplier: 1, name: "Bronze" }];
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Level[];
    return fallback;
  } catch {
    return fallback;
  }
}

function computeLevel(levels: Level[], totalAds: number) {
  const sorted = [...levels].sort((a, b) => a.min_ads - b.min_ads);
  let current = sorted[0];
  let next: Level | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (totalAds >= sorted[i].min_ads) {
      current = sorted[i];
      next = sorted[i + 1] ?? null;
    }
  }
  return { current, next };
}

function getClientIp(): string | null {
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return getRequestHeader("cf-connecting-ip") || getRequestHeader("x-real-ip") || null;
}

async function antiFraudCheck(chatId: string, settings: Record<string, string>) {
  if (settings.anti_fraud_enabled !== "true") return;
  const ip = getClientIp();
  const ua = getRequestHeader("user-agent") || null;
  if (!ip) return;

  // upsert device record
  await supabaseAdmin.from("user_devices").insert({ chat_id: chatId, ip, user_agent: ua });
  await supabaseAdmin
    .from("app_users")
    .update({ last_ip: ip, last_ua: ua })
    .eq("chat_id", chatId);

  // count distinct chat ids on this IP
  const { data } = await supabaseAdmin
    .from("user_devices")
    .select("chat_id")
    .eq("ip", ip);
  const distinct = new Set((data ?? []).map((r) => r.chat_id));
  const max = Math.max(1, parseInt(settings.max_accounts_per_ip ?? "3", 10));
  if (distinct.size > max) {
    await supabaseAdmin.from("app_users").update({ flagged: true }).eq("chat_id", chatId);
  }
}

export const getUserState = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const settings = await getSettings();

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
      await antiFraudCheck(data.chatId, settings);
    }

    // total ad count (lifetime)
    const { count: totalAds } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId);

    // per-type today counts
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const [intCount, popCount, inappCount] = await Promise.all([
      supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true })
        .eq("chat_id", data.chatId).eq("ad_type", "interstitial").gte("watched_at", since.toISOString()),
      supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true })
        .eq("chat_id", data.chatId).eq("ad_type", "popup").gte("watched_at", since.toISOString()),
      supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true })
        .eq("chat_id", data.chatId).eq("ad_type", "inapp").gte("watched_at", since.toISOString()),
    ]);

    const levels = parseLevels(settings.levels_json);
    const { current, next } = computeLevel(levels, totalAds ?? 0);

    return {
      user: {
        chat_id: user.chat_id,
        points: Number(user.points),
        total_earned: Number(user.total_earned),
        banned: user.banned,
        flagged: user.flagged ?? false,
        last_ad_at: user.last_ad_at,
        last_popup_at: user.last_popup_at,
        last_inapp_at: user.last_inapp_at,
        total_ads: totalAds ?? 0,
      },
      level: {
        current,
        next,
        progress: next
          ? Math.min(100, Math.round(((totalAds ?? 0) - current.min_ads) / (next.min_ads - current.min_ads) * 100))
          : 100,
      },
      settings: {
        app_name: settings.app_name ?? "Earn Rewards",
        welcome_message: settings.welcome_message ?? "Watch ads and earn points!",
        min_withdraw: Number(settings.min_withdraw ?? 1000),
        zones: {
          interstitial: {
            zone: settings.zone_interstitial ?? "9518673",
            sdk_id: `show_${settings.zone_interstitial ?? "9518673"}`,
            points: Number(settings.points_interstitial ?? 10),
            cooldown: Number(settings.cooldown_interstitial ?? 30),
            limit: Number(settings.daily_limit_interstitial ?? 100),
            today: intCount.count ?? 0,
          },
          popup: {
            zone: settings.zone_popup ?? "9518673",
            sdk_id: `show_${settings.zone_popup ?? "9518673"}`,
            points: Number(settings.points_popup ?? 5),
            cooldown: Number(settings.cooldown_popup ?? 60),
            limit: Number(settings.daily_limit_popup ?? 50),
            today: popCount.count ?? 0,
          },
          inapp: {
            zone: settings.zone_inapp ?? "9518673",
            sdk_id: `show_${settings.zone_inapp ?? "9518673"}`,
            points: Number(settings.points_inapp ?? 3),
            cooldown: Number(settings.cooldown_inapp ?? 120),
            limit: Number(settings.daily_limit_inapp ?? 30),
            today: inappCount.count ?? 0,
          },
        },
      },
    };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string; adType?: string }) => ({
    chatId: chatIdSchema.parse(d.chatId),
    adType: adTypeSchema.parse(d.adType ?? "interstitial"),
  }))
  .handler(async ({ data }) => {
    const settings = await getSettings();
    const type = data.adType;

    const cfg = {
      interstitial: {
        points: Number(settings.points_interstitial ?? 10),
        cooldown: Number(settings.cooldown_interstitial ?? 30),
        limit: Number(settings.daily_limit_interstitial ?? 100),
        lastCol: "last_ad_at" as const,
      },
      popup: {
        points: Number(settings.points_popup ?? 5),
        cooldown: Number(settings.cooldown_popup ?? 60),
        limit: Number(settings.daily_limit_popup ?? 50),
        lastCol: "last_popup_at" as const,
      },
      inapp: {
        points: Number(settings.points_inapp ?? 3),
        cooldown: Number(settings.cooldown_inapp ?? 120),
        limit: Number(settings.daily_limit_inapp ?? 30),
        lastCol: "last_inapp_at" as const,
      },
    }[type];

    const { data: user, error: ue } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("chat_id", data.chatId)
      .single();
    if (ue || !user) throw new Error("User not found");
    if (user.banned) throw new Error("Account banned");
    if (user.flagged) throw new Error("Account flagged for suspicious activity");

    const lastTs = (user as Record<string, unknown>)[cfg.lastCol] as string | null;
    if (lastTs) {
      const diff = (Date.now() - new Date(lastTs).getTime()) / 1000;
      if (diff < cfg.cooldown) {
        throw new Error(`Wait ${Math.ceil(cfg.cooldown - diff)}s before next ad`);
      }
    }

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId)
      .eq("ad_type", type)
      .gte("watched_at", since.toISOString());
    if ((count ?? 0) >= cfg.limit) {
      throw new Error(`Daily limit reached for this ad type. Try again tomorrow!`);
    }

    // level multiplier
    const { count: totalAds } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId);
    const levels = parseLevels(settings.levels_json);
    const { current } = computeLevel(levels, totalAds ?? 0);
    const earned = Math.round(cfg.points * (current.multiplier ?? 1));

    const newPoints = Number(user.points) + earned;
    const newTotal = Number(user.total_earned) + earned;
    const nowIso = new Date().toISOString();

    const patch: Record<string, unknown> = {
      points: newPoints,
      total_earned: newTotal,
      level: current.level,
    };
    patch[cfg.lastCol] = nowIso;

    const { error: ue2 } = await supabaseAdmin
      .from("app_users")
      .update(patch)
      .eq("chat_id", data.chatId);
    if (ue2) throw new Error(ue2.message);

    await supabaseAdmin.from("ad_watches").insert({
      chat_id: data.chatId,
      points: earned,
      ad_type: type,
    });

    return { points: newPoints, earned, today: (count ?? 0) + 1, level: current };
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
    if (user.flagged) throw new Error("Account flagged");
    if (Number(user.points) < data.amount) throw new Error("Insufficient points");

    const { count: pendingCount } = await supabaseAdmin
      .from("withdraw_requests")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId)
      .eq("status", "pending");
    if ((pendingCount ?? 0) > 0) {
      throw new Error("You already have a pending withdraw request");
    }

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

    const botToken = settings.bot_token;
    const adminChat = settings.admin_chat_id;
    if (botToken && adminChat) {
      const msg =
        `🆕 New Withdraw Request\n\nUser: ${data.chatId}\nMethod: ${method.name}\nAccount: ${data.account}\nAmount: ${data.amount} points`;
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
        .select("id,points,watched_at,ad_type")
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

// -------- Tasks (Offerwall) --------

export const listTasks = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const [tasks, done] = await Promise.all([
      supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("task_completions")
        .select("task_id,status")
        .eq("chat_id", data.chatId),
    ]);
    if (tasks.error) throw new Error(tasks.error.message);
    const doneMap = new Map((done.data ?? []).map((d) => [d.task_id, d.status]));
    return (tasks.data ?? []).map((t) => ({
      ...t,
      completion_status: doneMap.get(t.id) ?? null,
    }));
  });

export const claimTask = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string; taskId: string }) =>
    z.object({ chatId: chatIdSchema, taskId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: task, error: te } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("active", true)
      .maybeSingle();
    if (te || !task) throw new Error("Task not found");

    const { data: user, error: ue } = await supabaseAdmin
      .from("app_users")
      .select("points,total_earned,banned,flagged")
      .eq("chat_id", data.chatId)
      .single();
    if (ue || !user) throw new Error("User not found");
    if (user.banned) throw new Error("Account banned");
    if (user.flagged) throw new Error("Account flagged");

    const { data: existing } = await supabaseAdmin
      .from("task_completions")
      .select("id,status")
      .eq("chat_id", data.chatId)
      .eq("task_id", data.taskId)
      .maybeSingle();
    if (existing) throw new Error("Already submitted");

    // verify
    let status: "approved" | "pending" = "approved";
    if (task.verify_method === "telegram_member" && task.channel_username) {
      const settings = await getSettings();
      const botToken = settings.bot_token;
      if (!botToken) throw new Error("Bot not configured. Try again later.");
      const channel = task.channel_username.startsWith("@")
        ? task.channel_username
        : `@${task.channel_username}`;
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${data.chatId}`,
        );
        const json = (await res.json()) as { ok: boolean; result?: { status: string } };
        const ok =
          json.ok && ["member", "administrator", "creator"].includes(json.result?.status ?? "");
        if (!ok) throw new Error("Please join the channel first");
      } catch (e) {
        if (e instanceof Error) throw e;
        throw new Error("Verification failed");
      }
    } else if (task.verify_method === "manual") {
      status = "pending";
    }

    await supabaseAdmin.from("task_completions").insert({
      chat_id: data.chatId,
      task_id: data.taskId,
      status,
    });

    if (status === "approved") {
      const reward = Number(task.reward_points);
      await supabaseAdmin
        .from("app_users")
        .update({
          points: Number(user.points) + reward,
          total_earned: Number(user.total_earned) + reward,
        })
        .eq("chat_id", data.chatId);
      return { status, earned: reward };
    }
    return { status, earned: 0 };
  });
