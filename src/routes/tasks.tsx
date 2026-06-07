import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ExternalLink, Check, Clock, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { listTasks, claimTask, getPublicConfig } from "@/lib/app.functions";
import { Marquee } from "@/components/earn-ui";


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

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  url?: string | null;
  reward_points: number;
  task_type: string;
  verify_method: string;
  require_proof?: boolean;
  completion_status: string | null;
};

function Inner({ chatId }: { chatId: string }) {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const fetchCfg = useServerFn(getPublicConfig);
  const claim = useServerFn(claimTask);

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", chatId],
    queryFn: () => fetchTasks({ data: { chatId } }),
  });
  const cfgQ = useQuery({
    queryKey: ["publicConfig"],
    queryFn: () => fetchCfg(),
    refetchOnWindowFocus: false,
  });


  const mut = useMutation({
    mutationFn: (vars: { taskId: string; proofDataUrl?: string }) =>
      claim({ data: { chatId, taskId: vars.taskId, proofDataUrl: vars.proofDataUrl } }),
    onSuccess: (res, vars) => {
      if (res.status === "approved") toast.success(`+${res.earned} points!`);
      else toast.success("Submitted for review");
      try {
        localStorage.removeItem(`task_opened_${vars.taskId}`);
      } catch {
        /* noop */
      }
      qc.invalidateQueries({ queryKey: ["tasks", chatId] });
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen pb-24">
      <Marquee text={cfgQ.data?.settings.marquee_tasks_text || cfgQ.data?.settings.marquee_text || ""} />
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
        {data?.map((t) => (
          <TaskCard
            key={t.id}
            task={t as TaskRow}
            onClaim={(proofDataUrl) => mut.mutate({ taskId: t.id, proofDataUrl })}
            isClaiming={mut.isPending && mut.variables?.taskId === t.id}
          />
        ))}
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}

function TaskCard({
  task,
  onClaim,
  isClaiming,
}: {
  task: TaskRow;
  onClaim: (proofDataUrl?: string) => void;
  isClaiming: boolean;
}) {
  const completed = task.completion_status === "approved";
  const pending = task.completion_status === "pending";
  const rejected = task.completion_status === "rejected";

  const openedKey = `task_opened_${task.id}`;
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    try {
      setOpened(localStorage.getItem(openedKey) === "1");
    } catch {
      /* noop */
    }
  }, [openedKey]);

  const needsOpen = Boolean(task.url) && !opened;
  const needsProof = task.verify_method === "manual" && Boolean(task.require_proof);

  const fileRef = useRef<HTMLInputElement>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofData, setProofData] = useState<string | null>(null);

  function handleOpen() {
    try {
      localStorage.setItem(openedKey, "1");
    } catch {
      /* noop */
    }
    setOpened(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) {
      toast.error("Use PNG, JPG, or WEBP");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setProofData(url);
      setProofPreview(url);
    };
    reader.readAsDataURL(f);
  }

  function handleSubmit() {
    if (needsProof && !proofData) {
      toast.error("Upload a screenshot first");
      return;
    }
    onClaim(proofData ?? undefined);
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
          {task.icon || "🎁"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{task.title}</h3>
            <Badge variant="secondary" className="text-[10px]">
              +{Number(task.reward_points)}
            </Badge>
            {needsProof && !completed && !pending && (
              <Badge variant="outline" className="text-[10px]">
                Screenshot
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
          )}
          {rejected && (
            <p className="mt-1 text-[11px] text-destructive">
              Previous submission was rejected. Contact support.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {task.url && !completed && !pending && (
              <Button size="sm" variant={opened ? "secondary" : "default"} asChild>
                <a href={task.url} target="_blank" rel="noopener noreferrer" onClick={handleOpen}>
                  <ExternalLink className="mr-1 h-3 w-3" />
                  {opened ? "Open again" : "Open"}
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
            ) : needsOpen ? (
              <Button size="sm" variant="outline" disabled>
                Open link first
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={isClaiming}>
                {isClaiming ? "Submitting…" : needsProof ? "Submit for review" : "Verify & claim"}
              </Button>
            )}
          </div>

          {/* Screenshot uploader for manual tasks */}
          {needsProof && !completed && !pending && opened && (
            <div className="mt-3 rounded-md border border-dashed border-border p-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFile}
              />
              {proofPreview ? (
                <div className="relative">
                  <img
                    src={proofPreview}
                    alt="Proof"
                    className="max-h-48 w-full rounded object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setProofPreview(null);
                      setProofData(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" /> Upload screenshot proof
                </Button>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                PNG / JPG / WEBP, max 5MB. Admin will review.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
