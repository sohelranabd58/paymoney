import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, Megaphone, Zap, Clock, MousePointerClick, Gift, Sparkles } from "lucide-react";

export function Marquee({ text }: { text: string }) {
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

export function useMonetagSdks(zones: Record<string, { zone: string; sdk_id: string }> | undefined) {
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

export async function playAd(sdkId: string, popup: boolean) {
  const fn = (window as unknown as Record<string, undefined | ((arg?: string) => Promise<void> | void)>)[sdkId];
  if (typeof fn !== "function") throw new Error("Ad function unavailable");
  await (popup ? fn("pop") : fn());
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 text-xl font-bold tracking-tight">{children}</h2>;
}

export function AdCard({
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
  const progress = cooldown > 0 ? Math.max(0, Math.min(100, ((cooldown - left) / cooldown) * 100)) : 100;

  return (
    <Card className="relative flex items-center gap-3 overflow-hidden p-3">
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

      {/* Cooldown overlay sitting on top of the ad card */}
      {left > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="16" fill="none" stroke="oklch(0.3 0.02 240 / 0.4)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke="oklch(0.7 0.18 155)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(progress / 100) * 100.5} 100.5`}
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <div className="text-center">
              <div className="text-base font-bold leading-none">{left}</div>
              <div className="text-[8px] uppercase tracking-wide text-muted-foreground">sec</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function ClickAdDialog({
  open, onOpenChange, pendingPoints, bonus, sdkReady, loading, onClaim,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingPoints: number;
  bonus: number;
  sdkReady: boolean;
  loading: boolean;
  onClaim: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-success/30">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Bonus Ad Unlocked!</DialogTitle>
          <DialogDescription className="text-center">
            Click this special ad to claim your pending points <span className="font-semibold text-foreground">+{bonus}</span> bonus.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">You will receive</div>
          <div className="mt-1 text-3xl font-bold text-primary">
            +{pendingPoints + bonus}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {pendingPoints} pending + {bonus} click bonus
          </div>
        </div>
        <Button size="lg" onClick={onClaim} disabled={loading || !sdkReady} className="w-full">
          {loading ? "Loading..." : !sdkReady ? "Ad loading..." : (<><Sparkles className="mr-2 h-4 w-4" />Click & Claim</>)}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Skip and your pending balance stays — claim later.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
