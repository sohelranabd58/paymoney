import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Coins, Trophy, Zap, Wallet, ListChecks, History, UserCircle2, AtSign, Shield, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserState, getPublicConfig, syncTelegramProfile } from "@/lib/app.functions";
import { Marquee, LoadingScreen, ErrorScreen } from "@/components/earn-ui";
import { NoticeSlider } from "@/components/NoticeSlider";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Earn Rewards — Watch & Earn" },
      { name: "description", content: "Your profile, points and rewards." },
    ],
  }),
});

function HomePage() {
  const chatId = useChatIdFromSearch();
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
    } catch {}
  }, []);
  return chatId ? <HomeLoggedIn chatId={chatId} /> : <HomeGuest />;
}

function ActionGrid({ chatId, disabled }: { chatId?: string; disabled?: { tasks?: boolean; withdraw?: boolean; history?: boolean } }) {
  const search = chatId ? { id: chatId } : undefined;
  const items = [
    { to: "/earn", label: "Earn", icon: Zap, color: "text-primary", bg: "bg-primary/15", disabled: false },
    { to: "/tasks", label: "Tasks", icon: ListChecks, color: "text-warning", bg: "bg-warning/15", disabled: disabled?.tasks },
    { to: "/withdraw", label: "Withdraw", icon: Wallet, color: "text-success", bg: "bg-success/15", disabled: disabled?.withdraw },
    { to: "/history", label: "History", icon: History, color: "text-accent-foreground", bg: "bg-accent", disabled: disabled?.history },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        const inner = (
          <Card className={`flex h-full items-center gap-3 p-4 transition active:scale-[0.98] ${it.disabled ? "opacity-50" : "hover:border-primary/50"}`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-full ${it.bg}`}>
              <Icon className={`h-5 w-5 ${it.color}`} />
            </div>
            <div className="text-sm font-semibold">{it.label}</div>
          </Card>
        );
        if (it.disabled || !search) {
          return <div key={it.to}>{inner}</div>;
        }
        return (
          <Link key={it.to} to={it.to} search={search}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}

function HomeLoggedIn({ chatId }: { chatId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getUserState);
  const syncProfile = useServerFn(syncTelegramProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["userState", chatId],
    queryFn: () => fetchState({ data: { chatId } }),
    refetchOnWindowFocus: false,
  });

  // Trigger profile sync once on mount (cached server-side 24h)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await syncProfile({ data: { chatId } });
        if (!cancelled && res && !("skipped" in res && res.skipped && (res as { reason?: string }).reason === "fresh")) {
          qc.invalidateQueries({ queryKey: ["userState", chatId] });
        }
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [chatId, syncProfile, qc]);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;
  if (!data) return null;

  const { user, level, settings } = data;
  const displayName = [user.tg_first_name, user.tg_last_name].filter(Boolean).join(" ") || "Telegram User";
  const initial = (user.tg_first_name?.[0] || user.tg_username?.[0] || "U").toUpperCase();

  return (
    <div className="min-h-screen pb-24">
      <Marquee text={settings.marquee_text} />

      {/* Profile header */}
      <header className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/30 via-card to-background pb-6 pt-5">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.7_0.18_155/.25),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-md px-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">{settings.app_name}</div>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Trophy className="h-3 w-3" /> {level.current.name} ×{level.current.multiplier}
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Avatar className="h-16 w-16 ring-2 ring-primary/40">
              {user.tg_photo_url ? (
                <AvatarImage src={user.tg_photo_url} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-lg font-bold">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold">{displayName}</div>
              {user.tg_username ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AtSign className="h-3 w-3" />
                  <span className="truncate">{user.tg_username}</span>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">ID: {user.chat_id}</div>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <Coins className="mb-1.5 h-6 w-6 text-primary" />
            <div className="text-4xl font-bold tracking-tight">{user.points.toLocaleString()}</div>
            <div className="mb-1.5 text-xs text-muted-foreground">pts</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lifetime: {user.total_earned.toLocaleString()} · {user.total_ads} ads watched
          </div>

          {level.next && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{level.current.name}</span>
                <span>{level.next.name}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${level.progress}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {Math.max(0, level.next.min_ads - user.total_ads)} more ads to {level.next.name}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        {user.flagged && (
          <Card className="border-destructive/50 bg-destructive/10 p-3 text-xs">
            <Shield className="mr-1 inline h-3.5 w-3.5" /> Your account has been flagged. Contact admin.
          </Card>
        )}
        {user.banned && (
          <Card className="border-destructive/60 bg-destructive/15 p-3 text-xs">
            <AlertCircle className="mr-1 inline h-3.5 w-3.5" /> Your account is banned.
          </Card>
        )}

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
          <ActionGrid chatId={chatId} />
        </section>

        {user.points >= settings.min_withdraw && (
          <Card className="border-success/40 bg-success/10 p-3 text-center text-xs text-success">
            ✓ You can withdraw now (min {settings.min_withdraw} pts)
          </Card>
        )}
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}

function HomeGuest() {
  const fetchCfg = useServerFn(getPublicConfig);
  const { data, isLoading, error } = useQuery({
    queryKey: ["publicConfig"],
    queryFn: () => fetchCfg(),
    refetchOnWindowFocus: false,
  });

  // hydrate guest stats from localStorage
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAds, setTotalAds] = useState(0);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("guest_state_v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      setPoints(s.points ?? 0);
      setTotalEarned(s.totalEarned ?? 0);
      setTotalAds(s.totalAds ?? 0);
    } catch {}
  }, []);

  if (isLoading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen message={(error as Error)?.message ?? "Failed to load"} />;

  const s = data.settings;

  return (
    <div className="min-h-screen pb-24">
      <Marquee text={s.marquee_text} />
      <header className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/30 via-card to-background pb-6 pt-5">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.7_0.18_155/.25),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-md px-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">{s.app_name}</div>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <UserCircle2 className="h-3 w-3" /> Guest mode
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Avatar className="h-16 w-16 ring-2 ring-muted">
              <AvatarFallback className="bg-muted text-lg font-bold">G</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold">Guest</div>
              <div className="text-[11px] text-muted-foreground">Open from Telegram to save points</div>
            </div>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <Coins className="mb-1.5 h-6 w-6 text-primary" />
            <div className="text-4xl font-bold tracking-tight">{points.toLocaleString()}</div>
            <div className="mb-1.5 text-xs text-muted-foreground">pts</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lifetime: {totalEarned.toLocaleString()} · {totalAds} ads watched
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        <Card className="border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning">
          ⚠️ Open from the Telegram bot to save points & withdraw.
        </Card>
        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</h2>
          <ActionGrid disabled={{ tasks: true, withdraw: true, history: true }} />
          <p className="mt-3 px-1 text-[11px] text-muted-foreground">
            Earn page works in guest mode — Tasks, Withdraw and History require login.
          </p>
        </section>
      </main>
    </div>
  );
}
