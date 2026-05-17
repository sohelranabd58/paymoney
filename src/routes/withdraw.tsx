import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Wallet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { useChatIdFromSearch } from "@/lib/useChatId";
import { getUserState, listWithdrawMethods, submitWithdraw } from "@/lib/app.functions";

export const Route = createFileRoute("/withdraw")({
  component: WithdrawPage,
  head: () => ({ meta: [{ title: "Withdraw — Earn Rewards" }] }),
});

function WithdrawPage() {
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
  const fetchState = useServerFn(getUserState);
  const fetchMethods = useServerFn(listWithdrawMethods);
  const submit = useServerFn(submitWithdraw);

  const stateQ = useQuery({
    queryKey: ["userState", chatId],
    queryFn: () => fetchState({ data: { chatId } }),
  });
  const methodsQ = useQuery({
    queryKey: ["methods"],
    queryFn: () => fetchMethods(),
  });

  const [methodId, setMethodId] = useState<string>("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState<string>("");

  const selected = methodsQ.data?.find((m) => m.id === methodId);

  const submitMut = useMutation({
    mutationFn: () =>
      submit({
        data: {
          chatId,
          methodId,
          account: account.trim(),
          amount: parseInt(amount, 10),
        },
      }),
    onSuccess: () => {
      toast.success("Withdraw request submitted!");
      setAccount("");
      setAmount("");
      setMethodId("");
      qc.invalidateQueries({ queryKey: ["userState", chatId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = stateQ.data?.user.points ?? 0;
  const globalMin = stateQ.data?.settings.min_withdraw ?? 1000;

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-base font-semibold">Withdraw</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground">Available balance</div>
          <div className="mt-1 text-4xl font-bold text-primary">{balance.toLocaleString()}</div>
        </Card>

        <Card className="space-y-4 p-5">
          <div>
            <Label className="mb-2 block text-xs">Payment method</Label>
            <div className="grid grid-cols-1 gap-2">
              {methodsQ.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No methods available.</p>
              )}
              {methodsQ.data?.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethodId(m.id)}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    methodId === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/40 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.icon || "💳"}</span>
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Min: {Math.max(globalMin, Number(m.min_amount))} pts
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected && (
            <>
              {selected.instructions && (
                <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                  {selected.instructions}
                </p>
              )}
              <div>
                <Label htmlFor="account" className="mb-2 block text-xs">
                  Account / wallet
                </Label>
                <Input
                  id="account"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="amount" className="mb-2 block text-xs">
                  Amount (points)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`${Math.max(globalMin, Number(selected.min_amount))}`}
                />
              </div>
              <Button
                onClick={() => submitMut.mutate()}
                disabled={
                  submitMut.isPending ||
                  !account.trim() ||
                  !amount ||
                  parseInt(amount, 10) > balance
                }
                className="w-full"
                size="lg"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {submitMut.isPending ? "Submitting..." : "Submit request"}
              </Button>
            </>
          )}
        </Card>

        <p className="px-2 text-center text-xs text-muted-foreground">
          Pending requests are reviewed manually. You'll be notified on Telegram once processed.
        </p>
      </main>

      <BottomNav chatId={chatId} />
    </div>
  );
}
