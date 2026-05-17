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
    const [settings, methods, withdraws, users, stats] = await Promise.all([
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
    ]);
    const settingsMap: Record<string, string> = {};
    for (const r of settings.data ?? []) settingsMap[r.key] = r.value;
    return {
      settings: settingsMap,
      methods: methods.data ?? [],
      withdraws: withdraws.data ?? [],
      users: users.data ?? [],
      total_ads: stats.count ?? 0,
    };
  });

export const adminUpdateSettings = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; settings: Record<string, string> }) =>
    z
      .object({
        password: z.string().min(1).max(100),
        settings: z.record(z.string().min(1).max(60), z.string().max(2000)),
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

    // if reject, refund points
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

    // notify user
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
    (d: { password: string; chatId: string; points?: number; banned?: boolean }) =>
      z
        .object({
          password: z.string().min(1).max(100),
          chatId: z.string().min(1).max(32),
          points: z.number().int().min(0).max(1_000_000_000).optional(),
          banned: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    await verifyAdmin(data.password);
    const patch: { points?: number; banned?: boolean } = {};
    if (data.points !== undefined) patch.points = data.points;
    if (data.banned !== undefined) patch.banned = data.banned;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("app_users")
      .update(patch)
      .eq("chat_id", data.chatId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
