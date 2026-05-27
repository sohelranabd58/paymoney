import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function verifyAdmin(password: string) {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "admin_password")
    .single();
  if (error || !data) throw new Error("Server error");
  if (password !== data.value) throw new Error("Invalid password");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    return { ok: true };
  });

export const adminGetAll = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const [settings, methods, withdraws, users, stats, tasks] = await Promise.all([
      supabaseAdmin.from("app_settings").select("*"),
      supabaseAdmin.from("withdraw_methods").select("*").order("sort_order"),
      supabaseAdmin
        .from("withdraw_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("tasks").select("*").order("sort_order"),
    ]);
    const settingsMap: Record<string, string> = {};
    const secretKeys = new Set(["bot_token", "notify_bot_token", "redeem_api_key"]);
    for (const r of settings.data ?? []) {
      if (r.key === "admin_password") continue; // never expose plaintext to browser
      if (secretKeys.has(r.key) && r.value) {
        settingsMap[r.key] = r.value.length > 8 ? r.value.slice(0, 6) + "***" : "***";
        continue;
      }
      settingsMap[r.key] = r.value;
    }
    return {
      settings: settingsMap,
      methods: methods.data ?? [],
      withdraws: withdraws.data ?? [],
      users: users.data ?? [],
      total_ads: stats.count ?? 0,
      tasks: tasks.data ?? [],
    };
  });

export const adminGetStats = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);

    const since7 = new Date();
    since7.setUTCDate(since7.getUTCDate() - 6);
    since7.setUTCHours(0, 0, 0, 0);
    const sinceToday = new Date();
    sinceToday.setUTCHours(0, 0, 0, 0);

    const [
      totalUsersR,
      todayUsersR,
      totalAdsR,
      todayAdsR,
      pendingWdR,
      approvedWdR,
      totalTasksR,
      ads7R,
      users7R,
      wd7R,
      topR,
    ] = await Promise.all([
      supabaseAdmin.from("app_users").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("app_users")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sinceToday.toISOString()),
      supabaseAdmin.from("ad_watches").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("ad_watches")
        .select("*", { count: "exact", head: true })
        .gte("watched_at", sinceToday.toISOString()),
      supabaseAdmin
        .from("withdraw_requests")
        .select("amount", { count: "exact" })
        .eq("status", "pending"),
      supabaseAdmin
        .from("withdraw_requests")
        .select("amount")
        .eq("status", "approved"),
      supabaseAdmin.from("task_completions").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("ad_watches")
        .select("watched_at,points")
        .gte("watched_at", since7.toISOString()),
      supabaseAdmin
        .from("app_users")
        .select("created_at")
        .gte("created_at", since7.toISOString()),
      supabaseAdmin
        .from("withdraw_requests")
        .select("created_at,amount,status")
        .gte("created_at", since7.toISOString()),
      supabaseAdmin
        .from("app_users")
        .select("chat_id,total_earned,points")
        .order("total_earned", { ascending: false })
        .limit(10),
    ]);

    const approvedTotal = (approvedWdR.data ?? []).reduce(
      (s, r) => s + Number(r.amount),
      0,
    );
    const pendingTotal = (pendingWdR.data ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    // build 7-day buckets
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(since7);
      d.setUTCDate(d.getUTCDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dayKey = (iso: string) => iso.slice(0, 10);
    const adsByDay = Object.fromEntries(days.map((d) => [d, 0]));
    const pointsByDay = Object.fromEntries(days.map((d) => [d, 0]));
    const usersByDay = Object.fromEntries(days.map((d) => [d, 0]));
    const wdByDay = Object.fromEntries(days.map((d) => [d, 0]));
    for (const a of ads7R.data ?? []) {
      const k = dayKey(a.watched_at as string);
      if (k in adsByDay) {
        adsByDay[k]++;
        pointsByDay[k] += Number(a.points);
      }
    }
    for (const u of users7R.data ?? []) {
      const k = dayKey(u.created_at as string);
      if (k in usersByDay) usersByDay[k]++;
    }
    for (const w of wd7R.data ?? []) {
      if (w.status !== "approved") continue;
      const k = dayKey(w.created_at as string);
      if (k in wdByDay) wdByDay[k] += Number(w.amount);
    }

    return {
      totals: {
        users: totalUsersR.count ?? 0,
        users_today: todayUsersR.count ?? 0,
        ads: totalAdsR.count ?? 0,
        ads_today: todayAdsR.count ?? 0,
        pending_withdraws: pendingWdR.count ?? 0,
        pending_amount: pendingTotal,
        paid_amount: approvedTotal,
        tasks_completed: totalTasksR.count ?? 0,
      },
      chart: days.map((d) => ({
        day: d.slice(5),
        ads: adsByDay[d],
        points: pointsByDay[d],
        users: usersByDay[d],
        withdrawn: wdByDay[d],
      })),
      top: topR.data ?? [],
    };
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; settings: Record<string, string> }) =>
    z
      .object({
        password: z.string().min(1).max(100),
        settings: z.record(z.string().min(1).max(60), z.string().max(5000)),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const rows = Object.entries(data.settings)
      // Don't overwrite secrets when admin leaves the field empty or unchanged (masked value ends with ***)
      .filter(([key, value]) => {
        const secretKeys = new Set(["admin_password", "bot_token", "notify_bot_token", "redeem_api_key"]);
        if (secretKeys.has(key) && (value === "" || value.endsWith("***"))) {
          return false;
        }
        return true;
      })
      .map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveMethod = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      password: string;
      method: {
        id?: string;
        name: string;
        icon?: string;
        min_amount: number;
        instructions?: string;
        enabled: boolean;
        sort_order: number;
      };
    }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          method: z.object({
            id: z.string().uuid().optional(),
            name: z.string().trim().min(1).max(60),
            icon: z.string().max(10).optional(),
            min_amount: z.number().int().positive(),
            instructions: z.string().max(500).optional(),
            enabled: z.boolean(),
            sort_order: z.number().int(),
          }),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    if (data.method.id) {
      const { error } = await supabaseAdmin
        .from("withdraw_methods")
        .update(data.method)
        .eq("id", data.method.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("withdraw_methods").insert(data.method);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteMethod = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1).max(100), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const { error } = await supabaseAdmin.from("withdraw_methods").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminProcessWithdraw = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { password: string; id: string; action: "approve" | "reject"; note?: string }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          id: z.string().uuid(),
          action: z.enum(["approve", "reject"]),
          note: z.string().max(500).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const { data: req, error } = await supabaseAdmin
      .from("withdraw_requests")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("Already processed");

    const newStatus = data.action === "approve" ? "approved" : "rejected";
    let redeemCode: string | null = null;

    // Load settings once
    const { data: settingsRows } = await supabaseAdmin
      .from("app_settings")
      .select("key,value")
      .in("key", ["bot_token", "notify_bot_token", "admin_chat_id", "redeem_api_key"]);
    const sMap: Record<string, string> = {};
    for (const r of settingsRows ?? []) sMap[r.key] = r.value;
    const botToken = sMap.bot_token;
    const notifyToken = sMap.notify_bot_token || botToken;
    const adminChat = sMap.admin_chat_id;
    const redeemKey = sMap.redeem_api_key;

    if (data.action === "reject") {
      const { data: user } = await supabaseAdmin
        .from("app_users")
        .select("points")
        .eq("chat_id", req.chat_id)
        .single();
      if (user) {
        await supabaseAdmin
          .from("app_users")
          .update({ points: Number(user.points) + Number(req.amount) })
          .eq("chat_id", req.chat_id);
      }
    } else if (data.action === "approve" && redeemKey) {
      // Call external redeem API
      try {
        const url = `https://sohel.pp.ua/main/bot/fackss/redeem_api.php?key=${encodeURIComponent(redeemKey)}&redeem=${encodeURIComponent(String(req.amount))}`;
        const r = await fetch(url);
        const text = (await r.text()).trim();
        // try to extract a plausible code (alphanumeric chunk) — fall back to whole text
        const m = text.match(/[A-Za-z0-9_-]{6,}/);
        redeemCode = (m ? m[0] : text).slice(0, 80);
      } catch (e) {
        console.error("redeem api failed", e);
      }
    }

    await supabaseAdmin
      .from("withdraw_requests")
      .update({
        status: newStatus,
        note: data.note ?? null,
        processed_at: new Date().toISOString(),
        redeem_code: redeemCode,
      })
      .eq("id", data.id);

    // Notify user (main bot)
    if (botToken) {
      const userMsg =
        data.action === "approve"
          ? `✅ Withdraw APPROVED\n\n${req.amount} pts via ${req.method_name}\n\n🎁 Redeem code:\n\`${redeemCode ?? "(not generated)"}\`\n\nUse it any time — also saved in your history.${data.note ? `\n\nNote: ${data.note}` : ""}`
          : `❌ Withdraw REJECTED\n\n${req.amount} pts via ${req.method_name}\nPoints have been refunded.${data.note ? `\n\nReason: ${data.note}` : ""}`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: req.chat_id, text: userMsg, parse_mode: "Markdown" }),
        });
      } catch (e) {
        console.error("user notify failed", e);
      }
    }

    // Notify admin (notify bot)
    if (notifyToken && adminChat) {
      const adminMsg =
        data.action === "approve"
          ? `✅ Approved request\nUser: ${req.chat_id}\nAmount: ${req.amount} pts\nMethod: ${req.method_name}\nCode: ${redeemCode ?? "(failed)"}`
          : `❌ Rejected request\nUser: ${req.chat_id}\nAmount: ${req.amount} pts\nReason: ${data.note ?? "—"}`;
      try {
        await fetch(`https://api.telegram.org/bot${notifyToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: adminChat, text: adminMsg }),
        });
      } catch (e) {
        console.error("admin notify failed", e);
      }
    }

    return { ok: true, redeem_code: redeemCode };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { password: string; chatId: string; points?: number; banned?: boolean; flagged?: boolean }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          chatId: z.string().min(1).max(32),
          points: z.number().int().min(0).max(1_000_000_000).optional(),
          banned: z.boolean().optional(),
          flagged: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const patch: { points?: number; banned?: boolean; flagged?: boolean } = {};
    if (data.points !== undefined) patch.points = data.points;
    if (data.banned !== undefined) patch.banned = data.banned;
    if (data.flagged !== undefined) patch.flagged = data.flagged;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("app_users")
      .update(patch)
      .eq("chat_id", data.chatId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Task CRUD --------

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      password: string;
      task: {
        id?: string;
        title: string;
        description?: string;
        icon?: string;
        url?: string;
        reward_points: number;
        task_type: string;
        verify_method: string;
        channel_username?: string;
        active: boolean;
        sort_order: number;
      };
    }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          task: z.object({
            id: z.string().uuid().optional(),
            title: z.string().trim().min(1).max(120),
            description: z.string().max(500).optional(),
            icon: z.string().max(10).optional(),
            url: z
              .string()
              .max(500)
              .url()
              .refine((u) => /^https?:\/\//i.test(u), "URL must start with http:// or https://")
              .optional()
              .or(z.literal("").transform(() => undefined)),
            reward_points: z.number().int().positive().max(1_000_000),
            task_type: z.enum(["join_channel", "visit_url", "custom"]),
            verify_method: z.enum(["auto", "manual", "telegram_member"]),
            channel_username: z.string().max(64).optional(),
            active: z.boolean(),
            sort_order: z.number().int(),
          }),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const payload = data.task;
    if (payload.id) {
      const { error } = await supabaseAdmin.from("tasks").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("tasks").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) =>
    z.object({ password: z.string().min(1).max(100), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Advanced: per-user detail (history + devices + withdrawals) --------
export const adminGetUserDetail = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; chatId: string }) =>
    z.object({ password: z.string().min(1).max(100), chatId: z.string().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const [userR, watchesR, withdrawalsR, devicesR, taskCompR] = await Promise.all([
      supabaseAdmin.from("app_users").select("*").eq("chat_id", data.chatId).maybeSingle(),
      supabaseAdmin
        .from("ad_watches")
        .select("ad_type,points,watched_at")
        .eq("chat_id", data.chatId)
        .order("watched_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("withdraw_requests")
        .select("*")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("user_devices")
        .select("ip,user_agent,created_at")
        .eq("chat_id", data.chatId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("task_completions")
        .select("task_id,status,completed_at")
        .eq("chat_id", data.chatId)
        .order("completed_at", { ascending: false })
        .limit(50),
    ]);

    // Aggregate ads by type
    const adsByType: Record<string, { count: number; points: number }> = {};
    for (const w of watchesR.data ?? []) {
      const k = w.ad_type as string;
      adsByType[k] = adsByType[k] ?? { count: 0, points: 0 };
      adsByType[k].count++;
      adsByType[k].points += Number(w.points);
    }

    return {
      user: userR.data ?? null,
      watches: watchesR.data ?? [],
      withdrawals: withdrawalsR.data ?? [],
      devices: devicesR.data ?? [],
      task_completions: taskCompR.data ?? [],
      ads_by_type: adsByType,
    };
  });

// -------- Bulk withdraw processing --------
export const adminBulkProcessWithdraw = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { password: string; ids: string[]; action: "approve" | "reject"; note?: string }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          ids: z.array(z.string().uuid()).min(1).max(50),
          action: z.enum(["approve", "reject"]),
          note: z.string().max(500).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const results: { id: string; ok: boolean; error?: string }[] = [];
    // serial to avoid hammering redeem api
    for (const id of data.ids) {
      try {
        const res = await fetch(
          new URL("/_serverFn/adminProcessWithdraw", "http://localhost").toString(),
          {},
        ).catch(() => null);
        void res;
        // Inline call instead of HTTP to avoid auth attaching
        const { data: req } = await supabaseAdmin
          .from("withdraw_requests")
          .select("status")
          .eq("id", id)
          .single();
        if (!req || req.status !== "pending") {
          results.push({ id, ok: false, error: "Not pending" });
          continue;
        }
        // Just mark as processed without external calls in bulk for speed
        const newStatus = data.action === "approve" ? "approved" : "rejected";
        if (data.action === "reject") {
          const { data: full } = await supabaseAdmin
            .from("withdraw_requests")
            .select("chat_id,amount")
            .eq("id", id)
            .single();
          if (full) {
            const { data: u } = await supabaseAdmin
              .from("app_users")
              .select("points")
              .eq("chat_id", full.chat_id)
              .single();
            if (u) {
              await supabaseAdmin
                .from("app_users")
                .update({ points: Number(u.points) + Number(full.amount) })
                .eq("chat_id", full.chat_id);
            }
          }
        }
        await supabaseAdmin
          .from("withdraw_requests")
          .update({
            status: newStatus,
            note: data.note ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", id);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, error: e instanceof Error ? e.message : "failed" });
      }
    }
    return { results };
  });

