import { useServerFn } from "@tanstack/react-start";
import { createFileRoute as createRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Sparkles, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserState, claimAdReward } from "@/lib/app.functions";

export const Route = createRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Earn Rewards — Watch & Earn" },
      { name: "description", content: "Open from your Telegram bot to start earning." },
    ],
  }),
});

declare global {
  interface Window {
    Telegram?: { WebApp?: { ready: () => void; expand: () => void; HapticFeedback?: { notificationOccurred: (t: string) => void } } };
    // dynamic monetag fns are accessed via (window as any)[sdkId]
  }
}

function HomePage() {
  const chatId = useChatIdFromSearch();

  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();
    } catch {}
  }, []);

  if (!chatId) return <MissingIdScreen />;
  return <EarnScreen chatId={chatId} />;
}

function MissingIdScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-warning" />
        <h1 className="mt-4 text-2xl font-bold">Open from Telegram</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This app must be opened from your Telegram bot button. Missing chat id in URL.
        </p>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Expected URL: <code>?id=&lt;telegram_chat_id&gt;</code>
        </p>
      </div>
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

  // load monetag SDK once we know zone id
  const zoneId = data?.settings.monetag_zone_id;
  const sdkId = data?.settings.monetag_sdk_id;
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    if (!zoneId || !sdkId) return;
    const existing = document.querySelector(`script[data-zone="${zoneId}"]`);
    if (existing) {
      setSdkReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "//libtl.com/sdk.js";
    s.async = true;
    s.setAttribute("data-zone", zoneId);
    s.setAttribute("data-sdk", sdkId);
    s.onload = () => setSdkReady(true);
    s.onerror = () => setSdkReady(false);
    document.head.appendChild(s);
  }, [zoneId, sdkId]);

  const [cooldownLeft, setCooldownLeft] = useState(0);
  const cooldownSec = data?.settings.ad_cooldown_seconds ?? 30;
  useEffect(() => {
    if (!data?.user.last_ad_at) return;
    const update = () => {
      const last = new Date(data.user.last_ad_at as string).getTime();
      const left = Math.max(0, Math.ceil((last + cooldownSec * 1000 - Date.now()) / 1000));
      setCooldownLeft(left);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [data?.user.last_ad_at, cooldownSec]);

  const claimMut = useMutation({
    mutationFn: () => claim({ data: { chatId } }),
    onSuccess: (res) => {
      toast.success(`+${res.earned} points!`, { icon: <Sparkles className="h-4 w-4" /> });
      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      } catch {}
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const watchAd = useCallback(async () => {
    if (!sdkReady || !sdkId) {
      toast.error("Ad SDK not ready. Try again in a moment.");
      return;
    }
    const fn = (window as unknown as Record<string, undefined | (() => Promise<void> | void)>)[sdkId];
    if (typeof fn !== "function") {
      toast.error("Ad function unavailable.");
      return;
    }
    try {
      await fn();
      claimMut.mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ad failed");
    }
  }, [sdkReady, sdkId, claimMut]);

  const limitReached = useMemo(() => {
    if (!data) return false;
    return data.ads_today >= data.settings.daily_ad_limit;
  }, [data]);

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;
  if (!data) return null;

  const disabled =
    claimMut.isPending || cooldownLeft > 0 || limitReached || !sdkReady || data.user.banned;

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="text-sm font-semibold text-muted-foreground">{data.settings.app_name}</div>
          <div className="text-xs text-muted-foreground">ID: {chatId.slice(-4)}</div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        {/* Balance card */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-card to-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" />
            Your balance
          </div>
          <div className="mt-1 text-5xl font-bold tracking-tight">
            {data.user.points.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Lifetime: {data.user.total_earned.toLocaleString()} points
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Per ad</div>
            <div className="mt-1 text-2xl font-bold text-primary">+{data.settings.points_per_ad}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Today</div>
            <div className="mt-1 text-2xl font-bold">
              {data.ads_today}
              <span className="text-sm text-muted-foreground">/{data.settings.daily_ad_limit}</span>
            </div>
          </Card>
        </div>

        {/* Watch button */}
        <Card className="p-6 text-center">
          <div className="mb-4 text-sm text-muted-foreground">{data.settings.welcome_message}</div>
          <Button
            size="lg"
            disabled={disabled}
            onClick={watchAd}
            className="h-16 w-full text-lg font-bold"
          >
            <Play className="mr-2 h-6 w-6" />
            {claimMut.isPending
              ? "Loading ad..."
              : limitReached
                ? "Daily limit reached"
                : data.user.banned
                  ? "Account banned"
                  : cooldownLeft > 0
                    ? `Wait ${cooldownLeft}s`
                    : !sdkReady
                      ? "Loading SDK..."
                      : `Watch Ad → +${data.settings.points_per_ad}`}
          </Button>
          {data.user.points >= data.settings.min_withdraw && (
            <p className="mt-4 text-xs text-success">
              ✓ You can withdraw now (min {data.settings.min_withdraw} points)
            </p>
          )}
        </Card>
      </main>

      <BottomNav chatId={chatId} />
    </div>
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

// suppress unused import for createFileRoute (template provided)
void createFileRoute;
