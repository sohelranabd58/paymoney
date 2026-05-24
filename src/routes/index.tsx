import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Sparkles, AlertCircle, Trophy, Zap, MousePointerClick, Clock, Megaphone, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserState, claimAdReward, getPublicConfig } from "@/lib/app.functions";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Earn Rewards — Watch & Earn" },
      { name: "description", content: "Open from your Telegram bot to start earning." },
    ],
  }),
});


type AdType = "interstitial" | "popup" | "inapp";

function HomePage() {
  const chatId = useChatIdFromSearch();
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
    } catch {}
  }, []);
  if (!chatId) return <GuestScreen />;
  return <EarnScreen chatId={chatId} />;
}

// ---------- Shared SDK loader ----------
function useMonetagSdks(zones: Record<string, { zone: string; sdk_id: string }> | undefined) {
  const [loadedSdks, setLoadedSdks] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!zones) return;
    const unique = new Map<string, string>();
    Object.values(zones).forEach((z) => unique.set(z.zone, z.sdk_id));
    for (const [zone, sdkId] of unique) {
      if (document.querySelector(`script[data-zone="${zone}"]`)) {
        setLoadedSdks((p) => new Set(p).add(sdkId));
        continue;
      }
      const s = document.createElement("script");
      s.src = "//libtl.com/sdk.js";
      s.async = true;
      s.setAttribute("data-zone", zone);
      s.setAttribute("data-sdk", sdkId);
      s.onload = () => setLoadedSdks((p) => { const n = new Set(p); n.add(sdkId); return n; });
      document.head.appendChild(s);
    }
  }, [zones]);
  return loadedSdks;
}

async function playAd(sdkId: string, popup: boolean) {
  const fn = (window as unknown as Record<string, undefined | ((arg?: string) => Promise<void> | void)>)[sdkId];
  if (typeof fn !== "function") throw new Error("Ad function unavailable");
  await (popup ? fn("pop") : fn());
}

// ---------- Marquee ----------
function Marquee({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex items-center gap-2 overflow-hidden border-b border-border/40 bg-primary/10 py-1.5 text-xs">
      <Megaphone className="ml-3 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="relative flex-1 overflow-hidden">
        <div className="animate-marquee whitespace-nowrap font-medium">
          {text} &nbsp;&nbsp;•&nbsp;&nbsp; {text} &nbsp;&nbsp;•&nbsp;&nbsp; {text}
        </div>
      </div>
    </div>
  );
}

// ---------- Guest mode ----------
function GuestScreen() {
  const fetchCfg = useServerFn(getPublicConfig);
  const { data, isLoading, error } = useQuery({
    queryKey: ["publicConfig"],
    queryFn: () => fetchCfg(),
    refetchOnWindowFocus: false,
  });

  // local state
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAds, setTotalAds] = useState(0);
  const [todayCounts, setTodayCounts] = useState<Record<AdType, number>>({ interstitial: 0, popup: 0, inapp: 0 });
  const [lastAt, setLastAt] = useState<Record<AdType, string | null>>({ interstitial: null, popup: null, inapp: null });
  const [pendingType, setPendingType] = useState<AdType | null>(null);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("guest_state_v1");
      if (!raw) return;
      const s = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      setPoints(s.points ?? 0);
      setTotalEarned(s.totalEarned ?? 0);
      setTotalAds(s.totalAds ?? 0);
      setTodayCounts(s.day === today ? (s.todayCounts ?? { interstitial: 0, popup: 0, inapp: 0 }) : { interstitial: 0, popup: 0, inapp: 0 });
      setLastAt(s.lastAt ?? { interstitial: null, popup: null, inapp: null });
    } catch {}
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem("guest_state_v1", JSON.stringify({
        points, totalEarned, totalAds, todayCounts, lastAt,
        day: new Date().toISOString().slice(0, 10),
      }));
    } catch {}
  }, [points, totalEarned, totalAds, todayCounts, lastAt]);

  const loadedSdks = useMonetagSdks(data?.settings.zones);

  const levelInfo = useMemo(() => {
    if (!data) return null;
    const sorted = [...data.levels].sort((a, b) => a.min_ads - b.min_ads);
    let current = sorted[0];
    let next: typeof sorted[number] | null = null;
    for (let i = 0; i < sorted.length; i++) {
      if (totalAds >= sorted[i].min_ads) { current = sorted[i]; next = sorted[i + 1] ?? null; }
    }
    const progress = next
      ? Math.min(100, Math.round(((totalAds - current.min_ads) / (next.min_ads - current.min_ads)) * 100))
      : 100;
    return { current, next, progress };
  }, [data, totalAds]);

  const watch = useCallback(async (adType: AdType, popup: boolean) => {
    if (!data) return;
    const z = data.settings.zones[adType];
    if (!loadedSdks.has(z.sdk_id)) { toast.error("Ad SDK loading..."); return; }
    setPendingType(adType);
    try {
      await playAd(z.sdk_id, popup);
      const reward = Math.round(z.points * (levelInfo?.current.multiplier ?? 1));
      setPoints((p) => p + reward);
      setTotalEarned((p) => p + reward);
      setTotalAds((p) => p + 1);
      setTodayCounts((c) => ({ ...c, [adType]: c[adType] + 1 }));
      setLastAt((l) => ({ ...l, [adType]: new Date().toISOString() }));
      toast.success(`+${reward} points (guest)`, { icon: <Sparkles className="h-4 w-4" /> });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ad failed");
    } finally {
      setPendingType(null);
    }
  }, [data, loadedSdks, levelInfo]);

  if (isLoading) return <LoadingScreen />;
  if (error || !data) return <ErrorScreen message={(error as Error)?.message ?? "Failed to load"} />;

  const z = data.settings.zones;
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
          <div className="mt-4 flex items-end gap-2">
            <Coins className="mb-1.5 h-6 w-6 text-primary" />
            <div className="text-5xl font-bold tracking-tight">{points.toLocaleString()}</div>
            <div className="mb-2 text-xs text-muted-foreground">pts</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lifetime: {totalEarned.toLocaleString()} · {totalAds} ads watched
          </div>
          <Card className="mt-4 border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning">
            ⚠️ Open from the Telegram bot to save points & withdraw. In guest mode points are not stored.
          </Card>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        <section>
          <SectionTitle>Tasks</SectionTitle>
          <p className="mb-3 px-1 text-xs text-muted-foreground">Get rewards for actions</p>
          <div className="space-y-2">
            <AdCard emoji="🤩" title="Watch short ads" subtitle="Rewarded Interstitial"
              points={z.interstitial.points} today={todayCounts.interstitial} limit={z.interstitial.limit}
              lastAt={lastAt.interstitial} cooldown={z.interstitial.cooldown}
              loading={pendingType === "interstitial"} sdkReady={loadedSdks.has(z.interstitial.sdk_id)} banned={false}
              onClick={() => watch("interstitial", false)} />
            <AdCard emoji="😎" title="Click to get reward" subtitle="Rewarded Popup"
              points={z.popup.points} today={todayCounts.popup} limit={z.popup.limit}
              lastAt={lastAt.popup} cooldown={z.popup.cooldown}
              loading={pendingType === "popup"} sdkReady={loadedSdks.has(z.popup.sdk_id)} banned={false}
              onClick={() => watch("popup", true)} />
          </div>
        </section>
        <section>
          <SectionTitle>Daily</SectionTitle>
          <p className="mb-3 px-1 text-xs text-muted-foreground">After time actions</p>
          <AdCard emoji="👀" title="Watch video" subtitle="In-App Interstitial"
            points={z.inapp.points} today={todayCounts.inapp} limit={z.inapp.limit}
            lastAt={lastAt.inapp} cooldown={z.inapp.cooldown}
            loading={pendingType === "inapp"} sdkReady={loadedSdks.has(z.inapp.sdk_id)} banned={false}
            onClick={() => watch("inapp", false)} />
        </section>
      </main>
    </div>
  );
}

function EarnScreen({ chatId }: { chatId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getUserState);
  const claim = useServerFn(claimAdReward);

  const { data, isLoading, error } = useQuery({
    queryKey: ["userState", chatId],
    queryFn: () => fetchState({ data: { chatId } }),
    refetchOnWindowFocus: false,
  });

  const loadedSdks = useMonetagSdks(data?.settings.zones);

  const claimMut = useMutation({
    mutationFn: (adType: AdType) => claim({ data: { chatId, adType } }),
    onSuccess: (res) => {
      toast.success(`+${res.earned} points!`, { icon: <Sparkles className="h-4 w-4" /> });
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch {}
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchAd = useCallback(async (adType: AdType, sdkId: string, popup: boolean) => {
    if (!loadedSdks.has(sdkId)) { toast.error("Ad SDK loading... try again"); return; }
    try { await playAd(sdkId, popup); claimMut.mutate(adType); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ad failed"); }
  }, [loadedSdks, claimMut]);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;
  if (!data) return null;

  const { user, level, settings } = data;
  const z = settings.zones;

  return (
    <div className="min-h-screen pb-24">
      <Marquee text={settings.marquee_text} />
      <header className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/30 via-card to-background pb-6 pt-5">
        <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.7_0.18_155/.25),transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-md px-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">{settings.app_name}</div>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Trophy className="h-3 w-3" /> {level.current.name}
            </Badge>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <Coins className="mb-1.5 h-6 w-6 text-primary" />
            <div className="text-5xl font-bold tracking-tight">{user.points.toLocaleString()}</div>
            <div className="mb-2 text-xs text-muted-foreground">pts</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lifetime: {user.total_earned.toLocaleString()} · {user.total_ads} ads watched
          </div>
          {level.next && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>{level.current.name} ×{level.current.multiplier}</span>
                <span>{level.next.name} ×{level.next.multiplier}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${level.progress}%` }} />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {level.next.min_ads - user.total_ads} more ads to {level.next.name}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        {user.flagged && (
          <Card className="border-destructive/50 bg-destructive/10 p-3 text-xs">
            ⚠️ Your account has been flagged. Contact admin.
          </Card>
        )}
        <section>
          <SectionTitle>Tasks</SectionTitle>
          <p className="mb-3 px-1 text-xs text-muted-foreground">Get rewards for actions</p>
          <div className="space-y-2">
            <AdCard emoji="🤩" title="Watch short ads" subtitle="Rewarded Interstitial"
              points={z.interstitial.points} today={z.interstitial.today} limit={z.interstitial.limit}
              lastAt={user.last_ad_at} cooldown={z.interstitial.cooldown}
              loading={claimMut.isPending && claimMut.variables === "interstitial"}
              sdkReady={loadedSdks.has(z.interstitial.sdk_id)}
              onClick={() => watchAd("interstitial", z.interstitial.sdk_id, false)}
              banned={user.banned || user.flagged} />
            <AdCard emoji="😎" title="Click to get reward" subtitle="Rewarded Popup"
              points={z.popup.points} today={z.popup.today} limit={z.popup.limit}
              lastAt={user.last_popup_at} cooldown={z.popup.cooldown}
              loading={claimMut.isPending && claimMut.variables === "popup"}
              sdkReady={loadedSdks.has(z.popup.sdk_id)}
              onClick={() => watchAd("popup", z.popup.sdk_id, true)}
              banned={user.banned || user.flagged} />
          </div>
        </section>
        <section>
          <SectionTitle>Daily</SectionTitle>
          <p className="mb-3 px-1 text-xs text-muted-foreground">After time actions</p>
          <AdCard emoji="👀" title="Watch video" subtitle="In-App Interstitial"
            points={z.inapp.points} today={z.inapp.today} limit={z.inapp.limit}
            lastAt={user.last_inapp_at} cooldown={z.inapp.cooldown}
            loading={claimMut.isPending && claimMut.variables === "inapp"}
            sdkReady={loadedSdks.has(z.inapp.sdk_id)}
            onClick={() => watchAd("inapp", z.inapp.sdk_id, false)}
            banned={user.banned || user.flagged} />
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-xl font-bold tracking-tight">{children}</h2>;
}

function AdCard({
  emoji, title, subtitle, points, today, limit, lastAt, cooldown,
  loading, sdkReady, banned, onClick,
}: {
  emoji: string; title: string; subtitle: string;
  points: number; today: number; limit: number;
  lastAt: string | null; cooldown: number;
  loading: boolean; sdkReady: boolean; banned: boolean;
  onClick: () => void;
}) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!lastAt) { setLeft(0); return; }
    const tick = () => {
      const ms = new Date(lastAt).getTime() + cooldown * 1000 - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [lastAt, cooldown]);

  const limitReached = today >= limit;
  const disabled = loading || left > 0 || limitReached || banned || !sdkReady;

  return (
    <Card className="flex items-center gap-3 overflow-hidden p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">{emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5"><Zap className="h-3 w-3 text-primary" />+{points}</span>
          <span>·</span>
          <span>{today}/{limit} today</span>
        </div>
      </div>
      <Button size="sm" disabled={disabled} onClick={onClick} className="shrink-0 rounded-full px-4">
        {loading ? "..." : left > 0 ? (<><Clock className="mr-1 h-3 w-3" />{left}s</>)
          : limitReached ? "Done" : !sdkReady ? "..." : (<><MousePointerClick className="mr-1 h-3 w-3" />Claim</>)}
      </Button>
    </Card>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
