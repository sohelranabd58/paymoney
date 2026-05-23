import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ExternalLink, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { listTasks, claimTask } from "@/lib/app.functions";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — Earn Rewards" }] }),
});

function TasksPage() {
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
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const claim = useServerFn(claimTask);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", chatId],
    queryFn: () => fetchTasks({ data: { chatId } }),
  });

  const mut = useMutation({
    mutationFn: (taskId: string) => claim({ data: { chatId, taskId } }),
    onSuccess: (res) => {
      if (res.status === "approved") toast.success(`+${res.earned} points!`);
      else toast.success("Submitted for review");
      qc.invalidateQueries({ queryKey: ["tasks", chatId] });
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-base font-semibold">Offers & Tasks</h1>
          <p className="text-xs text-muted-foreground">Complete tasks for bonus points</p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 py-5">
        {isLoading && (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
          </div>
        )}
        {data && data.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No tasks available right now. Check back later!
          </Card>
        )}
        {data?.map((t) => {
          const completed = t.completion_status === "approved";
          const pending = t.completion_status === "pending";
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
                  {t.icon || "🎁"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{t.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      +{Number(t.reward_points)}
                    </Badge>
                  </div>
                  {t.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.url && !completed && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={t.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> Open
                        </a>
                      </Button>
                    )}
                    {completed ? (
                      <Button size="sm" variant="secondary" disabled>
                        <Check className="mr-1 h-3 w-3" /> Completed
                      </Button>
                    ) : pending ? (
                      <Button size="sm" variant="secondary" disabled>
                        <Clock className="mr-1 h-3 w-3" /> Pending review
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => mut.mutate(t.id)}
                        disabled={mut.isPending}
                      >
                        Verify & claim
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}
