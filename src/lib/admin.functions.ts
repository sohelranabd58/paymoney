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
    for (const r of settings.data ?? []) {
      if (r.key === "admin_password") continue; // never expose plaintext to browser
      if (r.key === "bot_token" && r.value) {
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
    const rows = Object.entries(data.settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString(),
    }));
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
    }

    await supabaseAdmin
      .from("withdraw_requests")
      .update({
        status: newStatus,
        note: data.note ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key,value")
      .in("key", ["bot_token"]);
    const botToken = settings?.find((s) => s.key === "bot_token")?.value;
    if (botToken) {
      const msg =
        data.action === "approve"
          ? `✅ Your withdraw of ${req.amount} points via ${req.method_name} has been APPROVED.${data.note ? `\n\nNote: ${data.note}` : ""}`
          : `❌ Your withdraw of ${req.amount} points via ${req.method_name} was REJECTED. Points refunded.${data.note ? `\n\nReason: ${data.note}` : ""}`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: req.chat_id, text: msg }),
        });
      } catch (e) {
        console.error("user notify failed", e);
      }
    }

    return { ok: true };
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
            url: z.string().max(500).optional(),
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
