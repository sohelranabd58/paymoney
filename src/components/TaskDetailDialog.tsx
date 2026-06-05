import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, ExternalLink, Upload, X } from "lucide-react";
import { toast } from "sonner";

export type TaskDetailData = {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  url?: string | null;
  reward_points: number;
  task_type: string;
  verify_method: string;
  require_proof?: boolean;
  source?: string;
  completion_status: string | null;
  repeat_available_at?: string | null;
  repeat_locked?: boolean;
};

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  task: TaskDetailData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (proofDataUrl?: string) => void;
  isSubmitting: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofData, setProofData] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    try {
      setOpened(localStorage.getItem(`task_opened_${task.id}`) === "1");
    } catch { /* noop */ }
    setProofPreview(null);
    setProofData(null);
  }, [task]);

  if (!task) return null;

  const completed = task.completion_status === "approved" && !task.repeat_locked;
  const pending = task.completion_status === "pending";
  const rejected = task.completion_status === "rejected";
  const locked = Boolean(task.repeat_locked);
  const needsOpen = Boolean(task.url) && !opened;
  const needsProof = task.verify_method === "manual" && Boolean(task.require_proof);

  const steps = (task.description ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  function handleOpen() {
    try { localStorage.setItem(`task_opened_${task!.id}`, "1"); } catch {}
    setOpened(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) return toast.error("Use PNG, JPG, or WEBP");
    if (f.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
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
    onSubmit(proofData ?? undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-3xl">
            {task.icon || "🎁"}
          </div>
          <DialogTitle className="text-center">{task.title}</DialogTitle>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="secondary">+{Number(task.reward_points)} pts</Badge>
            {task.source === "sponsor" && <Badge variant="outline">Sponsor</Badge>}
            {needsProof && <Badge variant="outline">Screenshot required</Badge>}
          </div>
        </DialogHeader>

        <div className="mt-2">
          {steps.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              Open the link, follow the instructions, then come back to claim your reward.
            </p>
          )}
        </div>

        {rejected && (
          <p className="text-[12px] text-destructive">Previous submission was rejected.</p>
        )}
        {locked && task.repeat_available_at && (
          <p className="text-[12px] text-muted-foreground">
            <Clock className="mr-1 inline h-3 w-3" />
            Available again {new Date(task.repeat_available_at).toLocaleString()}
          </p>
        )}

        {needsProof && opened && !completed && !pending && !locked && (
          <div className="rounded-md border border-dashed border-border p-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFile}
            />
            {proofPreview ? (
              <div className="relative">
                <img src={proofPreview} alt="Proof" className="max-h-48 w-full rounded object-contain" />
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
              <Button size="sm" variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1 h-3 w-3" /> Upload screenshot proof
              </Button>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">PNG / JPG / WEBP, max 5MB.</p>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          {task.url && !completed && !pending && !locked && (
            <Button asChild size="lg" variant={opened ? "secondary" : "default"}>
              <a href={task.url} target="_blank" rel="noopener noreferrer" onClick={handleOpen}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {opened ? "Open again" : "Start"}
              </a>
            </Button>
          )}

          {completed ? (
            <Button size="lg" variant="secondary" disabled>
              <Check className="mr-1 h-4 w-4" /> Completed
            </Button>
          ) : pending ? (
            <Button size="lg" variant="secondary" disabled>
              <Clock className="mr-1 h-4 w-4" /> Pending review
            </Button>
          ) : locked ? (
            <Button size="lg" variant="outline" disabled>
              <Clock className="mr-1 h-4 w-4" /> Locked
            </Button>
          ) : needsOpen ? (
            <Button size="lg" variant="outline" disabled>
              Tap Start first
            </Button>
          ) : (
            <Button size="lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : needsProof ? "Submit for review" : "Verify & claim"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
