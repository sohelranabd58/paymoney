import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import {
  getPublicConfig,
  getUserState,
  submitSponsorTask,
  listMySponsorRequests,
} from "@/lib/app.functions";

export const Route = createFileRoute("/sponsor")({
  component: SponsorPage,
  head: () => ({ meta: [{ title: "Sponsor a Task — Promote with points" }] }),
});

function SponsorPage() {
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
  const fetchConfig = useServerFn(getPublicConfig);
  const fetchUser = useServerFn(getUserState);
  const fetchMine = useServerFn(listMySponsorRequests);
  const submit = useServerFn(submitSponsorTask);

  const cfg = useQuery({ queryKey: ["public-config"], queryFn: () => fetchConfig() });
  const me = useQuery({ queryKey: ["userState", chatId], queryFn: () => fetchUser({ data: { chatId } }) });
  const mine = useQuery({ queryKey: ["my-sponsor", chatId], queryFn: () => fetchMine({ data: { chatId } }) });

  const enabled = cfg.data?.settings.sponsor_tasks_enabled ?? true;
  const minReward = cfg.data?.settings.sponsor_min_reward ?? 10;
  const minSlots = cfg.data?.settings.sponsor_min_slots ?? 10;
  const balance = me.data?.user.points ?? 0;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🎁");
  const [url, setUrl] = useState("");
  const [reward, setReward] = useState(minReward);
  const [slots, setSlots] = useState(minSlots);
  const [taskType, setTaskType] = useState<"visit_url" | "join_channel">("visit_url");

  const cost = Math.max(0, reward * slots);
  const insufficient = balance < cost;

  const mut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          chatId,
          title: title.trim(),
          description: description.trim() || undefined,
          icon: icon || "🎁",
          url: url.trim(),
          task_type: taskType,
          reward,
          slots,
        },
      }),
    onSuccess: () => {
      toast.success("Sent for review");
      setTitle("");
      setDescription("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["my-sponsor", chatId] });
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-base font-semibold">Sponsor a Task</h1>
          <p className="text-xs text-muted-foreground">
            Spend your points to publish a task. Admin reviews before it goes live.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 px-4 py-5">
        {!enabled && (
          <Card className="border-warning/40 bg-warning/10 p-4 text-sm">
            <Megaphone className="mb-1 inline h-4 w-4 text-warning" /> Sponsor tasks are currently disabled by admin.
          </Card>
        )}

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">New sponsor task</div>
            <Badge variant="secondary">Balance: {balance.toLocaleString()} pts</Badge>
          </div>

          <div>
            <Label className="mb-1 block text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Join my channel" />
          </div>

          <div>
            <Label className="mb-1 block text-xs">Description / steps (one step per line)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder={"Tap Start\nJoin the channel\nCome back and claim"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Icon (emoji)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Type</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as "visit_url" | "join_channel")}
              >
                <option value="visit_url">Visit URL</option>
                <option value="join_channel">Join channel</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs">URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Points per user (min {minReward})</Label>
              <Input
                type="number"
                value={reward}
                min={minReward}
                onChange={(e) => setReward(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Total completions (min {minSlots})</Label>
              <Input
                type="number"
                value={slots}
                min={minSlots}
                onChange={(e) => setSlots(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-center">
            <div className="text-[11px] uppercase text-muted-foreground">Total cost</div>
            <div className="text-2xl font-bold">{cost.toLocaleString()} pts</div>
            {insufficient && <div className="mt-1 text-[11px] text-destructive">Insufficient balance</div>}
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={
              !enabled ||
              mut.isPending ||
              insufficient ||
              !title.trim() ||
              !url.trim() ||
              reward < minReward ||
              slots < minSlots
            }
            onClick={() => mut.mutate()}
          >
            <Send className="mr-2 h-4 w-4" />
            {mut.isPending ? "Submitting…" : `Submit & pay ${cost.toLocaleString()} pts`}
          </Button>
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Your submissions</div>
          {mine.data && mine.data.length === 0 && (
            <div className="text-xs text-muted-foreground">No submissions yet.</div>
          )}
          <div className="space-y-2">
            {mine.data?.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.total_slots} × {r.reward_points} = {r.total_cost.toLocaleString()} pts
                    </div>
                  </div>
                  <Badge
                    variant={
                      r.status === "approved"
                        ? "default"
                        : r.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {r.status}
                  </Badge>
                </div>
                {r.reviewer_note && (
                  <div className="mt-1 text-[11px] italic text-muted-foreground">{r.reviewer_note}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}
