import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserHistory } from "@/lib/app.functions";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "History — Earn Rewards" }] }),
});

function HistoryPage() {
  const chatId = useChatIdFromSearch();
  if (!chatId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <AlertCircle className="mx-auto h-10 w-10 text-warning" />
          <p className="mt-3 text-sm text-muted-foreground">Open from Telegram bot.</p>
        </div>
      </div>
    );
  }
  return <Inner chatId={chatId} />;
}

function Inner({ chatId }: { chatId: string }) {
  const fetchHistory = useServerFn(getUserHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["history", chatId],
    queryFn: () => fetchHistory({ data: { chatId } }),
  });

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-base font-semibold">History</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-5">
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Withdrawals
          </h2>
          {isLoading ? (
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          ) : data?.withdraws.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <div className="space-y-2">
              {data?.withdraws.map((w) => (
                <Card key={w.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{w.method_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{w.account}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(w.created_at).toLocaleString()}
                      </div>
                      {w.note && (
                        <div className="mt-1 text-xs italic text-muted-foreground">{w.note}</div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold">{Number(w.amount).toLocaleString()}</div>
                      <Badge
                        variant={
                          w.status === "approved"
                            ? "default"
                            : w.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                        className="mt-1"
                      >
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent ad rewards
          </h2>
          {data?.ads.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">No ads watched yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              {data?.ads.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between px-3 py-2 text-sm ${
                    i % 2 === 0 ? "bg-card" : "bg-muted/30"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.watched_at).toLocaleString()}
                  </span>
                  <span className="font-semibold text-primary">+{a.points}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}
