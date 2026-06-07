import { useServerFn } from "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Sparkles, Trophy, UserCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserState, claimAdReward, claimClickAdReward, getPublicConfig, markClickAdOpened } from "@/lib/app.functions";
import { Switch } from "@/components/ui/switch";

import {
  Marquee, useMonetagSdks, playAd, SectionTitle, AdCard, ClickAdDialog, LoadingScreen, ErrorScreen,
} from "@/components/earn-ui";

export const Route = createFileRoute("/earn")({
  component: EarnPage,
  head: () => ({
    meta: [
      { title: "Earn — Watch Ads" },
      { name: "description", content: "Watch ads and earn points." },
    ],
  }),
});

type AdType = "interstitial" | "popup" | "inapp";

function EarnPage() {
  const chatId = useChatIdFromSearch();
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
    } catch {}
  }, []);
  return chatId ? <EarnLoggedIn chatId={chatId} /> : <EarnGuest />;
}

function EarnHeader({
  appName, points, pendingPoints, totalEarned, totalAds, badge,
}: { appName: string; points: number; pendingPoints?: number; totalEarned: number; totalAds: number; badge: React.ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/30 via-card to-background pb-6 pt-5">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.7_0.18_155/.25),transparent_60%)]" />
      <div className="relative z-10 mx-auto max-w-md px-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">{appName}</div>
          {badge}
        </div>
        <div className="mt-4 flex items-end gap-2">
          <Coins className="mb-1.5 h-6 w-6 text-primary" />
          <div className="text-5xl font-bold tracking-tight">{points.toLocaleString()}</div>
          <div className="mb-2 text-xs text-muted-foreground">pts</div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Lifetime: {totalEarned.toLocaleString()} · {totalAds} ads watched
        </div>
        {pendingPoints !== undefined && pendingPoints > 0 && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning">
            ⏳ Pending: {pendingPoints.toLocaleString()} pts (claim via bonus ad)
          </div>
        )}
      </div>
    </header>
  );
}

function EarnLoggedIn({ chatId }: { chatId: string }) {
  const qc = useQueryClient();
  const fetchState = useServerFn(getUserState);
  const claim = useServerFn(claimAdReward);
  const claimClick = useServerFn(claimClickAdReward);
  const markOpened = useServerFn(markClickAdOpened);
  const [clickOpen, setClickOpen] = useState(false);
  const [autoNext, setAutoNext] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("auto_next_ad") === "1";
  });
  const [autoLeft, setAutoLeft] = useState(0);
  useEffect(() => {
    try { localStorage.setItem("auto_next_ad", autoNext ? "1" : "0"); } catch { /* ignore */ }
  }, [autoNext]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["userState", chatId],
    queryFn: () => fetchState({ data: { chatId } }),
    refetchOnWindowFocus: false,
  });

  const loadedSdks = useMonetagSdks(data?.settings.zones);

  const claimMut = useMutation({
    mutationFn: (adType: AdType) => claim({ data: { chatId, adType } }),
    onSuccess: (res, adType) => {
      if (res.earned === 0 && res.pending_points > 0) {
        toast.success(`+${res.pending_points} pending (${res.cycle_ads} ads)`, { icon: <Sparkles className="h-4 w-4" /> });
      } else {
        toast.success(`+${res.earned} points!`, { icon: <Sparkles className="h-4 w-4" /> });
      }
      try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
      if (res.needs_click_ad) setClickOpen(true);
      // Auto-next only for "Watch short ads" (interstitial)
      if (autoNext && adType === "interstitial" && !res.needs_click_ad) {
        setAutoLeft(16);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clickMut = useMutation({
    mutationFn: () => claimClick({ data: { chatId } }),
    onSuccess: (res) => {
      toast.success(`+${res.moved + res.bonus} points added to balance!`, { icon: <Sparkles className="h-4 w-4" /> });
      setClickOpen(false);
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const watchAd = useCallback(async (adType: AdType, sdkId: string, popup: boolean) => {
    if (!loadedSdks.has(sdkId)) { toast.error("Ad SDK loading... try again"); return; }
    try { await playAd(sdkId, popup); claimMut.mutate(adType); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ad failed"); }
  }, [loadedSdks, claimMut]);

  // Mark click ad opened (server) whenever the bonus dialog opens, so view-seconds gating works
  useEffect(() => {
    if (clickOpen) {
      markOpened({ data: { chatId } }).catch(() => { /* ignore */ });
    }
  }, [clickOpen, chatId, markOpened]);

  // Auto-next countdown -> triggers next short ad when it reaches 0
  const autoArmedRef = useState({ armed: false })[0];
  useEffect(() => {
    if (autoLeft <= 0) {
      if (autoArmedRef.armed && autoNext && data) {
        autoArmedRef.armed = false;
        const zi = data.settings.zones.interstitial;
        const limitReached = zi.today >= zi.limit;
        const cooldownLeftMs = data.user.last_ad_at
          ? new Date(data.user.last_ad_at).getTime() + zi.cooldown * 1000 - Date.now()
          : 0;
        if (!limitReached && cooldownLeftMs <= 0 && !data.user.banned && !data.user.flagged) {
          watchAd("interstitial", zi.sdk_id, false);
        }
      }
      return;
    }
    autoArmedRef.armed = true;
    const id = setInterval(() => setAutoLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [autoLeft, autoNext, data, watchAd, autoArmedRef]);


  const playClickAd = useCallback(async () => {
    if (!data) return;
    const sdkId = data.settings.click_ad.sdk_id;
    if (!loadedSdks.has(sdkId)) { toast.error("Bonus ad loading..."); return; }
    try {
      await markOpened({ data: { chatId } });
      await playAd(sdkId, true);
      clickMut.mutate();
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "Ad failed"); }
  }, [data, loadedSdks, clickMut, markOpened, chatId]);


  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;
  if (!data) return null;

  const { user, level, settings } = data;
  const z = settings.zones;
  const clickReady = loadedSdks.has(settings.click_ad.sdk_id);

  return (
    <div className="min-h-screen pb-24">
      <Marquee text={settings.marquee_text} />
      <EarnHeader
        appName={settings.app_name}
        points={user.points}
        pendingPoints={user.pending_points}
        totalEarned={user.total_earned}
        totalAds={user.total_ads}
        badge={
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Trophy className="h-3 w-3" /> {level.current.name} ×{level.current.multiplier}
          </Badge>
        }
      />

      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        {user.flagged && (
          <Card className="border-destructive/50 bg-destructive/10 p-3 text-xs">
            ⚠️ Your account has been flagged. Contact admin.
          </Card>
        )}
        {user.pending_points > 0 && (
          <Card
            className="cursor-pointer border-primary/50 bg-gradient-to-r from-primary/15 to-success/15 p-3"
            onClick={() => setClickOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎁</div>
              <div className="flex-1 text-xs">
                <div className="font-semibold">Bonus ad ready!</div>
                <div className="text-muted-foreground">
                  Claim {user.pending_points} pending + {settings.click_ad.points} bonus
                </div>
              </div>
              <div className="text-xs font-semibold text-primary">Tap →</div>
            </div>
          </Card>
        )}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <SectionTitle>Rewarded Ads</SectionTitle>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium">
              <span>Auto-next</span>
              <Switch checked={autoNext} onCheckedChange={setAutoNext} />
            </label>
          </div>
          <p className="mb-3 px-1 text-xs text-muted-foreground">
            Get rewards for actions · Cycle: {user.cycle_ads}/{settings.click_ad.every}
            {autoNext && autoLeft > 0 && (
              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-medium text-primary">
                Next ad in {autoLeft}s
              </span>
            )}
          </p>

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

      <ClickAdDialog
        open={clickOpen}
        onOpenChange={setClickOpen}
        pendingPoints={user.pending_points}
        bonus={settings.click_ad.points}
        sdkReady={clickReady}
        loading={clickMut.isPending}
        onClaim={playClickAd}
      />

      <BottomNav chatId={chatId} />
    </div>
  );
}

function EarnGuest() {
  const fetchCfg = useServerFn(getPublicConfig);
  const { data, isLoading, error } = useQuery({
    queryKey: ["publicConfig"],
    queryFn: () => fetchCfg(),
    refetchOnWindowFocus: false,
  });

  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAds, setTotalAds] = useState(0);
  const [todayCounts, setTodayCounts] = useState<Record<AdType, number>>({ interstitial: 0, popup: 0, inapp: 0 });
  const [lastAt, setLastAt] = useState<Record<AdType, string | null>>({ interstitial: null, popup: null, inapp: null });
  const [pendingType, setPendingType] = useState<AdType | null>(null);

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
    for (let i = 0; i < sorted.length; i++) {
      if (totalAds >= sorted[i].min_ads) { current = sorted[i]; }
    }
    return { current };
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
      <EarnHeader
        appName={s.app_name}
        points={points}
        totalEarned={totalEarned}
        totalAds={totalAds}
        badge={
          <Badge variant="outline" className="gap-1 text-[10px]">
            <UserCircle2 className="h-3 w-3" /> Guest mode
          </Badge>
        }
      />
      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        <Card className="border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning">
          ⚠️ Open from the Telegram bot to save points & withdraw. In guest mode points are not stored.
        </Card>
        <section>
          <SectionTitle>Rewarded Ads</SectionTitle>
          <div className="mt-3 space-y-2">
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
          <div className="mt-3">
            <AdCard emoji="👀" title="Watch video" subtitle="In-App Interstitial"
              points={z.inapp.points} today={todayCounts.inapp} limit={z.inapp.limit}
              lastAt={lastAt.inapp} cooldown={z.inapp.cooldown}
              loading={pendingType === "inapp"} sdkReady={loadedSdks.has(z.inapp.sdk_id)} banned={false}
              onClick={() => watch("inapp", false)} />
          </div>
        </section>
      </main>
    </div>
  );
}
