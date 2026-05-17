import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LogOut, Settings, Wallet, Users, CreditCard, Check, X, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  adminGetAll,
  adminUpdateSettings,
  adminSaveMethod,
  adminDeleteMethod,
  adminProcessWithdraw,
  adminUpdateUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Dashboard" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminDashboard() {
  const navigate = useNavigate();
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    const pw = sessionStorage.getItem("admin_pw");
    if (!pw) navigate({ to: "/admin" });
    else setPassword(pw);
  }, [navigate]);

  if (!password) return null;
  return <DashboardInner password={password} />;
}

function DashboardInner({ password }: { password: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchAll = useServerFn(adminGetAll);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all"],
    queryFn: () => fetchAll({ data: { password } }),
  });

  const logout = () => {
    sessionStorage.removeItem("admin_pw");
    navigate({ to: "/admin" });
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const pending = data.withdraws.filter((w) => w.status === "pending");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Users" value={data.users.length} />
          <StatCard label="Total ads watched" value={data.total_ads} />
          <StatCard label="Pending withdraws" value={pending.length} accent />
          <StatCard
            label="Total paid"
            value={data.withdraws
              .filter((w) => w.status === "approved")
              .reduce((s, w) => s + Number(w.amount), 0)}
          />
        </div>

        <Tabs defaultValue="withdraws">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="withdraws">
              <Wallet className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Withdraws</span>
              {pending.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="methods">
              <CreditCard className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Methods</span>
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdraws" className="mt-4">
            <WithdrawsTab
              password={password}
              withdraws={data.withdraws}
              onChange={() => qc.invalidateQueries({ queryKey: ["admin-all"] })}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <SettingsTab
              password={password}
              settings={data.settings}
              onSaved={() => qc.invalidateQueries({ queryKey: ["admin-all"] })}
            />
          </TabsContent>

          <TabsContent value="methods" className="mt-4">
            <MethodsTab
              password={password}
              methods={data.methods}
              onChange={() => qc.invalidateQueries({ queryKey: ["admin-all"] })}
            />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UsersTab
              password={password}
              users={data.users}
              onChange={() => qc.invalidateQueries({ queryKey: ["admin-all"] })}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-warning" : ""}`}>
        {value.toLocaleString()}
      </div>
    </Card>
  );
}

// ---------------- Settings tab ----------------
function SettingsTab({
  password,
  settings,
  onSaved,
}: {
  password: string;
  settings: Record<string, string>;
  onSaved: () => void;
}) {
  const update = useServerFn(adminUpdateSettings);
  const [form, setForm] = useState<Record<string, string>>(settings);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () => update({ data: { password, settings: form } }),
    onSuccess: () => {
      toast.success("Settings saved");
      if (form.admin_password && form.admin_password !== password) {
        sessionStorage.setItem("admin_pw", form.admin_password);
      }
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Monetag Ads</h3>
        <Field label="Monetag Zone ID (data-zone)" value={form.monetag_zone_id ?? ""} onChange={(v) => set("monetag_zone_id", v)} />
        <Field label="Monetag SDK function ID (data-sdk, e.g. show_9518673)" value={form.monetag_sdk_id ?? ""} onChange={(v) => set("monetag_sdk_id", v)} />
        <Field label="Points per ad watched" type="number" value={form.points_per_ad ?? ""} onChange={(v) => set("points_per_ad", v)} />
        <Field label="Cooldown between ads (seconds)" type="number" value={form.ad_cooldown_seconds ?? ""} onChange={(v) => set("ad_cooldown_seconds", v)} />
        <Field label="Daily ad limit per user" type="number" value={form.daily_ad_limit ?? ""} onChange={(v) => set("daily_ad_limit", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Withdraw</h3>
        <Field label="Minimum withdraw amount (points)" type="number" value={form.min_withdraw ?? ""} onChange={(v) => set("min_withdraw", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Telegram Bot</h3>
        <Field label="Bot token (for notifications)" value={form.bot_token ?? ""} onChange={(v) => set("bot_token", v)} placeholder="123456:ABC-DEF..." />
        <Field label="Admin Telegram chat ID (receives notifications)" value={form.admin_chat_id ?? ""} onChange={(v) => set("admin_chat_id", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">App branding</h3>
        <Field label="App name" value={form.app_name ?? ""} onChange={(v) => set("app_name", v)} />
        <Field label="Welcome message" value={form.welcome_message ?? ""} onChange={(v) => set("welcome_message", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Security</h3>
        <Field label="Admin password" type="password" value={form.admin_password ?? ""} onChange={(v) => set("admin_password", v)} />
      </Card>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg" className="w-full">
        {mut.isPending ? "Saving..." : "Save all settings"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ---------------- Withdraws tab ----------------
type WithdrawRow = {
  id: string;
  chat_id: string;
  method_name: string;
  account: string;
  amount: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  note: string | null;
};

function WithdrawsTab({
  password,
  withdraws,
  onChange,
}: {
  password: string;
  withdraws: WithdrawRow[];
  onChange: () => void;
}) {
  const process = useServerFn(adminProcessWithdraw);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [noteFor, setNoteFor] = useState<string>("");
  const [noteText, setNoteText] = useState("");

  const list = useMemo(
    () => (filter === "all" ? withdraws : withdraws.filter((w) => w.status === filter)),
    [withdraws, filter],
  );

  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      process({ data: { password, ...v } }),
    onSuccess: () => {
      toast.success("Updated");
      setNoteFor("");
      setNoteText("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">No requests.</p>}
      {list.map((w) => (
        <Card key={w.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{w.method_name}</span>
                <Badge
                  variant={
                    w.status === "approved"
                      ? "default"
                      : w.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {w.status}
                </Badge>
              </div>
              <div className="mt-1 text-sm">
                <span className="text-muted-foreground">User:</span> {w.chat_id}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Account:</span>{" "}
                <span className="font-mono">{w.account}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(w.created_at).toLocaleString()}
              </div>
              {w.note && <div className="mt-1 text-xs italic">Note: {w.note}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{Number(w.amount).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">points</div>
            </div>
          </div>

          {w.status === "pending" && (
            <div className="mt-3 space-y-2">
              {noteFor === w.id && (
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Optional note to user..."
                  rows={2}
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => mut.mutate({ id: w.id, action: "approve", note: noteText || undefined })}
                  disabled={mut.isPending}
                >
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => mut.mutate({ id: w.id, action: "reject", note: noteText || undefined })}
                  disabled={mut.isPending}
                >
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNoteFor(noteFor === w.id ? "" : w.id);
                    setNoteText("");
                  }}
                >
                  {noteFor === w.id ? "Hide note" : "Add note"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ---------------- Methods tab ----------------
type MethodRow = {
  id: string;
  name: string;
  icon: string | null;
  min_amount: number;
  instructions: string | null;
  enabled: boolean;
  sort_order: number;
};

function MethodsTab({
  password,
  methods,
  onChange,
}: {
  password: string;
  methods: MethodRow[];
  onChange: () => void;
}) {
  const save = useServerFn(adminSaveMethod);
  const del = useServerFn(adminDeleteMethod);

  const [editing, setEditing] = useState<Partial<MethodRow> | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("nothing");
      return save({
        data: {
          password,
          method: {
            id: editing.id,
            name: editing.name ?? "",
            icon: editing.icon ?? "",
            min_amount: Number(editing.min_amount ?? 1000),
            instructions: editing.instructions ?? "",
            enabled: editing.enabled ?? true,
            sort_order: Number(editing.sort_order ?? 0),
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      setEditing(null);
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { password, id } }),
    onSuccess: () => {
      toast.success("Deleted");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing({ enabled: true, min_amount: 1000, sort_order: methods.length })}>
        <Plus className="mr-2 h-4 w-4" />
        Add method
      </Button>

      {editing && (
        <Card className="space-y-3 border-primary p-4">
          <h3 className="font-semibold">{editing.id ? "Edit method" : "New method"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs">Name</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Icon (emoji)</Label>
              <Input value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Min amount</Label>
              <Input type="number" value={editing.min_amount ?? ""} onChange={(e) => setEditing({ ...editing, min_amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Sort order</Label>
              <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Instructions for user</Label>
            <Textarea value={editing.instructions ?? ""} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.enabled ?? true} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
            <span className="text-sm">Enabled</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.name}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {methods.map((m) => (
        <Card key={m.id} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{m.icon || "💳"}</span>
            <div>
              <div className="font-medium">
                {m.name}{" "}
                {!m.enabled && (
                  <Badge variant="outline" className="ml-1">
                    disabled
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Min: {Number(m.min_amount)} pts</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ${m.name}?`)) delMut.mutate(m.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Users tab ----------------
type UserRow = {
  chat_id: string;
  points: number;
  total_earned: number;
  banned: boolean;
  created_at: string;
};

function UsersTab({
  password,
  users,
  onChange,
}: {
  password: string;
  users: UserRow[];
  onChange: () => void;
}) {
  const update = useServerFn(adminUpdateUser);
  const [search, setSearch] = useState("");

  const mut = useMutation({
    mutationFn: (v: { chatId: string; points?: number; banned?: boolean }) =>
      update({ data: { password, ...v } }),
    onSuccess: () => {
      toast.success("Updated");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (search ? users.filter((u) => u.chat_id.includes(search)) : users),
    [users, search],
  );

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by chat id..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Chat ID</th>
              <th className="px-3 py-2 text-right">Points</th>
              <th className="px-3 py-2 text-right">Earned</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.chat_id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{u.chat_id}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {Number(u.points).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {Number(u.total_earned).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center">
                  {u.banned ? <Badge variant="destructive">banned</Badge> : <Badge variant="secondary">active</Badge>}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const p = prompt(`Set points for ${u.chat_id}:`, String(u.points));
                        if (p !== null) {
                          const n = parseInt(p, 10);
                          if (!isNaN(n) && n >= 0) mut.mutate({ chatId: u.chat_id, points: n });
                        }
                      }}
                    >
                      Set pts
                    </Button>
                    <Button
                      size="sm"
                      variant={u.banned ? "default" : "destructive"}
                      onClick={() => mut.mutate({ chatId: u.chat_id, banned: !u.banned })}
                    >
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
