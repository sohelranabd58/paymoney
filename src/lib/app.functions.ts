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

function buildZonesAndMeta(settings: Record<string, string>, todayCounts?: { interstitial: number; popup: number; inapp: number }) {
  const t = todayCounts ?? { interstitial: 0, popup: 0, inapp: 0 };
  const clickZone = settings.click_ad_zone ?? "9518673";
  let noticeSlides: string[] = [];
  try {
    const parsed = JSON.parse(settings.notice_slides ?? "[]");
    if (Array.isArray(parsed)) noticeSlides = parsed.filter((s) => typeof s === "string" && s.trim().length > 0);
  } catch { /* ignore */ }
  return {
    app_name: settings.app_name ?? "Earn Rewards",
    welcome_message: settings.welcome_message ?? "Watch ads and earn points!",
    marquee_text: settings.marquee_text ?? "",
    notice_slides: noticeSlides,
    min_withdraw: Number(settings.min_withdraw ?? 1000),
    click_ad_every: Number(settings.click_ad_every ?? 10),
    click_ad_points: Number(settings.click_ad_points ?? 50),
    click_ad: {
      zone: clickZone,
      sdk_id: settings.click_ad_sdk_id || `show_${clickZone}`,
      points: Number(settings.click_ad_points ?? 50),
      every: Number(settings.click_ad_every ?? 10),
      required: (settings.click_ad_required ?? "false") === "true",
    },
    zones: {
      interstitial: {
        zone: settings.zone_interstitial ?? "9518673",
        sdk_id: `show_${settings.zone_interstitial ?? "9518673"}`,
        points: Number(settings.points_interstitial ?? 10),
        cooldown: Number(settings.cooldown_interstitial ?? 30),
        limit: Number(settings.daily_limit_interstitial ?? 100),
        today: t.interstitial,
      },
      popup: {
        zone: settings.zone_popup ?? "9518673",
        sdk_id: `show_${settings.zone_popup ?? "9518673"}`,
        points: Number(settings.points_popup ?? 5),
        cooldown: Number(settings.cooldown_popup ?? 60),
        limit: Number(settings.daily_limit_popup ?? 50),
        today: t.popup,
      },
      inapp: {
        zone: settings.zone_inapp ?? "9518673",
        sdk_id: `show_${settings.zone_inapp ?? "9518673"}`,
        points: Number(settings.points_inapp ?? 3),
        cooldown: Number(settings.cooldown_inapp ?? 120),
        limit: Number(settings.daily_limit_inapp ?? 30),
        today: t.inapp,
      },
    },
  };
}

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const settings = await getSettings();
  const levels = parseLevels(settings.levels_json);
  return { settings: buildZonesAndMeta(settings), levels };
});

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
        pending_points: Number(user.pending_points ?? 0),
        cycle_ads: Number(user.cycle_ads ?? 0),
        total_earned: Number(user.total_earned),
        banned: user.banned,
        flagged: user.flagged ?? false,
        last_ad_at: user.last_ad_at,
        last_popup_at: user.last_popup_at,
        last_inapp_at: user.last_inapp_at,
        total_ads: totalAds ?? 0,
        tg_username: user.tg_username ?? null,
        tg_first_name: user.tg_first_name ?? null,
        tg_last_name: user.tg_last_name ?? null,
        tg_photo_url: user.tg_photo_url ?? null,
        tg_profile_synced_at: user.tg_profile_synced_at ?? null,
      },
      level: {
        current,
        next,
        progress: next
          ? Math.min(100, Math.round(((totalAds ?? 0) - current.min_ads) / (next.min_ads - current.min_ads) * 100))
          : 100,
      },
      settings: buildZonesAndMeta(settings, {
        interstitial: intCount.count ?? 0,
        popup: popCount.count ?? 0,
        inapp: inappCount.count ?? 0,
      }),
    };
  });

// -------- Save Telegram profile from Mini App initData (client-provided) --------
export const saveTelegramProfile = createServerFn({ method: "POST" })
  .inputValidator((d: {
    chatId: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    photo_url?: string | null;
  }) =>
    z.object({
      chatId: chatIdSchema,
      first_name: z.string().trim().max(120).nullish(),
      last_name: z.string().trim().max(120).nullish(),
      username: z.string().trim().max(64).nullish(),
      photo_url: z.string().trim().url().max(500).nullish(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("tg_photo_url,tg_profile_synced_at,chat_id")
      .eq("chat_id", data.chatId)
      .maybeSingle();
    if (!existing) return { skipped: true, reason: "user_missing" as const };

    const updates: {
      tg_first_name: string | null;
      tg_last_name: string | null;
      tg_username: string | null;
      tg_profile_synced_at: string;
      tg_photo_url?: string | null;
    } = {
      tg_first_name: data.first_name ?? null,
      tg_last_name: data.last_name ?? null,
      tg_username: data.username ?? null,
      tg_profile_synced_at: new Date().toISOString(),
    };

    // download + cache photo if URL provided (Telegram photo_url is a CDN URL, can expire)
    if (data.photo_url) {
      try {
        const dl = await fetch(data.photo_url);
        if (dl.ok) {
          const buf = new Uint8Array(await dl.arrayBuffer());
          const ct = dl.headers.get("content-type") || "image/jpeg";
          const ext = ct.includes("png") ? "png" : "jpg";
          const path = `${data.chatId}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("tg-avatars")
            .upload(path, buf, { contentType: ct, upsert: true });
          if (!upErr) {
            const { data: pub } = supabaseAdmin.storage.from("tg-avatars").getPublicUrl(path);
            updates.tg_photo_url = `${pub.publicUrl}?v=${Date.now()}`;
          }
        }
      } catch (e) {
        console.error("photo cache failed", e);
      }
    }

    await supabaseAdmin.from("app_users").update(updates).eq("chat_id", data.chatId);
    return { skipped: false, ...updates };
  });

// -------- Telegram profile sync --------
export const syncTelegramProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string; force?: boolean }) => ({
    chatId: chatIdSchema.parse(d.chatId),
    force: Boolean(d.force),
  }))
  .handler(async ({ data }) => {
    const { data: existing } = await supabaseAdmin
      .from("app_users")
      .select("tg_profile_synced_at,tg_photo_url,tg_username,tg_first_name,tg_last_name")
      .eq("chat_id", data.chatId)
      .maybeSingle();
    if (!existing) return { skipped: true, reason: "user_missing" };

    // 24h cache
    if (!data.force && existing.tg_profile_synced_at) {
      const ageMs = Date.now() - new Date(existing.tg_profile_synced_at).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return {
          skipped: true,
          reason: "fresh",
          tg_username: existing.tg_username,
          tg_first_name: existing.tg_first_name,
          tg_last_name: existing.tg_last_name,
          tg_photo_url: existing.tg_photo_url,
        };
      }
    }

    const settings = await getSettings();
    const botToken = settings.bot_token;
    if (!botToken) return { skipped: true, reason: "no_bot_token" };

    const updates: {
      tg_profile_synced_at: string;
      tg_first_name?: string | null;
      tg_last_name?: string | null;
      tg_username?: string | null;
      tg_photo_url?: string | null;
    } = {
      tg_profile_synced_at: new Date().toISOString(),
    };


    // 1) getChat for name/username
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(data.chatId)}`,
      );
      const j = (await r.json()) as {
        ok: boolean;
        result?: { first_name?: string; last_name?: string; username?: string };
      };
      if (j.ok && j.result) {
        updates.tg_first_name = j.result.first_name ?? null;
        updates.tg_last_name = j.result.last_name ?? null;
        updates.tg_username = j.result.username ?? null;
      }
    } catch (e) {
      console.error("getChat failed", e);
    }

    // 2) getUserProfilePhotos -> getFile -> download -> upload to storage
    try {
      const r = await fetch(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${encodeURIComponent(data.chatId)}&limit=1`,
      );
      const j = (await r.json()) as {
        ok: boolean;
        result?: { total_count: number; photos: Array<Array<{ file_id: string; width: number }>> };
      };
      const photos = j.result?.photos?.[0];
      if (j.ok && photos && photos.length > 0) {
        // pick largest
        const best = photos.reduce((a, b) => (a.width >= b.width ? a : b));
        const fr = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(best.file_id)}`,
        );
        const fj = (await fr.json()) as { ok: boolean; result?: { file_path: string } };
        const filePath = fj.result?.file_path;
        if (fj.ok && filePath) {
          const dl = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
          if (dl.ok) {
            const buf = new Uint8Array(await dl.arrayBuffer());
            const ext = filePath.split(".").pop()?.toLowerCase() || "jpg";
            const storagePath = `${data.chatId}.${ext}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("tg-avatars")
              .upload(storagePath, buf, {
                contentType: ext === "png" ? "image/png" : "image/jpeg",
                upsert: true,
              });
            if (!upErr) {
              const { data: pub } = supabaseAdmin.storage
                .from("tg-avatars")
                .getPublicUrl(storagePath);
              // cache-bust
              updates.tg_photo_url = `${pub.publicUrl}?v=${Date.now()}`;
            }
          }
        }
      }
    } catch (e) {
      console.error("photo sync failed", e);
    }

    await supabaseAdmin.from("app_users").update(updates).eq("chat_id", data.chatId);

    return {
      skipped: false,
      tg_username: updates.tg_username ?? existing.tg_username,
      tg_first_name: updates.tg_first_name ?? existing.tg_first_name,
      tg_last_name: updates.tg_last_name ?? existing.tg_last_name,
      tg_photo_url: updates.tg_photo_url ?? existing.tg_photo_url,
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

    // Fetch user lightweight info for level calc (the atomic RPC enforces cooldown/limit/ban itself)
    const { count: totalAds } = await supabaseAdmin
      .from("ad_watches")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", data.chatId);
    const levels = parseLevels(settings.levels_json);
    const { current } = computeLevel(levels, totalAds ?? 0);

    const clickEvery = Number(settings.click_ad_every ?? 10);

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("claim_ad_atomic", {
      p_chat_id: data.chatId,
      p_ad_type: type,
      p_cooldown: cfg.cooldown,
      p_daily_limit: cfg.limit,
      p_base_points: cfg.points,
      p_multiplier: current.multiplier ?? 1,
      p_last_col: cfg.lastCol,
      p_click_every: clickEvery,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row) throw new Error("Claim failed");

    // Update level if changed
    await supabaseAdmin
      .from("app_users")
      .update({ level: current.level })
      .eq("chat_id", data.chatId);

    return {
      points: Number(row.out_new_points),
      pending_points: Number(row.out_pending_points),
      earned: Number(row.out_earned),
      today: Number(row.out_today_count),
      cycle_ads: Number(row.out_cycle_ads),
      needs_click_ad: Boolean(row.out_needs_click_ad),
      click_ad_points: Number(settings.click_ad_points ?? 50),
      level: current,
    };
  });

export const claimClickAdReward = createServerFn({ method: "POST" })
  .inputValidator((d: { chatId: string }) => ({ chatId: chatIdSchema.parse(d.chatId) }))
  .handler(async ({ data }) => {
    const settings = await getSettings();
    const bonus = Number(settings.click_ad_points ?? 50);
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("claim_click_ad_atomic", {
      p_chat_id: data.chatId,
      p_bonus: bonus,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row) throw new Error("Claim failed");
    return {
      points: Number(row.new_points),
      moved: Number(row.moved),
      bonus: Number(row.bonus),
    };
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

    // Atomic: row-lock user, check ban/flag/points, deduct, insert request (unique partial index prevents duplicate pending)
    const { data: newId, error: rpcErr } = await supabaseAdmin.rpc("submit_withdraw_atomic", {
      p_chat_id: data.chatId,
      p_method_id: method.id,
      p_method_name: method.name,
      p_account: data.account,
      p_amount: data.amount,
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const req = { id: newId as string, status: "pending" as const };

    const notifyToken = settings.notify_bot_token || settings.bot_token;
    const adminChat = settings.admin_chat_id;
    if (notifyToken && adminChat) {
      // gather user stats for context
      const [{ data: u }, { count: adsTotal }, { count: clicksTotal }] = await Promise.all([
        supabaseAdmin.from("app_users").select("tg_username,tg_first_name,tg_last_name,total_earned,points").eq("chat_id", data.chatId).maybeSingle(),
        supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true }).eq("chat_id", data.chatId),
        supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true }).eq("chat_id", data.chatId).eq("ad_type", "click"),
      ]);
      const name = [u?.tg_first_name, u?.tg_last_name].filter(Boolean).join(" ") || "—";
      const uname = u?.tg_username ? `@${u.tg_username}` : "—";
      const msg =
        `🆕 New Withdraw Request\n\n` +
        `👤 ${name} (${uname})\nID: ${data.chatId}\n\n` +
        `💳 ${method.name}\n📮 ${data.account}\n💰 ${data.amount} pts\n\n` +
        `📊 Stats:\n• Ads: ${adsTotal ?? 0}\n• Click ads: ${clicksTotal ?? 0}\n• Lifetime earned: ${u?.total_earned ?? 0}\n• Balance: ${u?.points ?? 0}`;
      try {
        await fetch(`https://api.telegram.org/bot${notifyToken}/sendMessage`, {
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
        .select("id,method_name,account,amount,status,created_at,processed_at,note,redeem_code")
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
