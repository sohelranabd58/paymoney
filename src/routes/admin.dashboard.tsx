import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Settings,
  Wallet,
  Users,
  CreditCard,
  Check,
  X,
  Trash2,
  Plus,
  BarChart3,
  ListChecks,
  Layers,
  Trophy,
  ShieldAlert,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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
  adminGetStats,
  adminUpdateSettings,
  adminSaveMethod,
  adminDeleteMethod,
  adminProcessWithdraw,
  adminUpdateUser,
  adminSaveTask,
  adminDeleteTask,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex, nofollow" }],
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
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-all"] });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <Tabs defaultValue="stats">
          <TabsList className="grid w-full grid-cols-4 md:grid-cols-8">
            <TabTrig value="stats" icon={BarChart3} label="Stats" />
            <TabTrig value="withdraws" icon={Wallet} label="Payouts" badge={pending.length} />
            <TabTrig value="settings" icon={Settings} label="Settings" />
            <TabTrig value="zones" icon={Layers} label="Ad Zones" />
            <TabTrig value="methods" icon={CreditCard} label="Methods" />
            <TabTrig value="tasks" icon={ListChecks} label="Tasks" />
            <TabTrig value="levels" icon={Trophy} label="Levels" />
            <TabTrig value="users" icon={Users} label="Users" />
          </TabsList>

          <TabsContent value="stats" className="mt-4">
            <StatsTab password={password} />
          </TabsContent>
          <TabsContent value="withdraws" className="mt-4">
            <WithdrawsTab password={password} withdraws={data.withdraws} onChange={refresh} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab password={password} settings={data.settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="zones" className="mt-4">
            <ZonesTab password={password} settings={data.settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="methods" className="mt-4">
            <MethodsTab password={password} methods={data.methods} onChange={refresh} />
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <TasksTab password={password} tasks={data.tasks} onChange={refresh} />
          </TabsContent>
          <TabsContent value="levels" className="mt-4">
            <LevelsTab password={password} settings={data.settings} onSaved={refresh} />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersTab password={password} users={data.users} onChange={refresh} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function TabTrig({
  value,
  icon: Icon,
  label,
  badge,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}) {
  return (
    <TabsTrigger value={value} className="relative">
      <Icon className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">{label}</span>
      {badge && badge > 0 ? (
        <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]">
          {badge}
        </Badge>
      ) : null}
    </TabsTrigger>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </Card>
  );
}

// ---------------- Stats ----------------
function StatsTab({ password }: { password: string }) {
  const fetchStats = useServerFn(adminGetStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats({ data: { password } }),
  });
  if (isLoading || !data) return <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total users" value={data.totals.users} />
        <StatCard label="New today" value={data.totals.users_today} accent="text-success" />
        <StatCard label="Ads watched" value={data.totals.ads} />
        <StatCard label="Ads today" value={data.totals.ads_today} accent="text-success" />
        <StatCard label="Tasks completed" value={data.totals.tasks_completed} />
        <StatCard label="Pending payouts" value={data.totals.pending_withdraws} accent="text-warning" />
        <StatCard label="Pending amount" value={data.totals.pending_amount} accent="text-warning" />
        <StatCard label="Total paid" value={data.totals.paid_amount} accent="text-primary" />
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Last 7 days</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="ads" stroke="oklch(0.7 0.18 155)" name="Ads" strokeWidth={2} />
              <Line type="monotone" dataKey="users" stroke="oklch(0.78 0.16 85)" name="New users" strokeWidth={2} />
              <Line type="monotone" dataKey="withdrawn" stroke="oklch(0.65 0.22 25)" name="Withdrawn" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Top 10 earners</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Chat ID</th>
                <th className="px-3 py-2 text-right">Earned</th>
                <th className="px-3 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((u, i) => (
                <tr key={u.chat_id} className="border-t border-border">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{u.chat_id}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {Number(u.total_earned).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {Number(u.points).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------- Settings ----------------
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
        <h3 className="font-semibold">App branding</h3>
        <Field label="App name" value={form.app_name ?? ""} onChange={(v) => set("app_name", v)} />
        <Field label="Welcome message" value={form.welcome_message ?? ""} onChange={(v) => set("welcome_message", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Withdraw</h3>
        <Field label="Global minimum withdraw (points)" type="number" value={form.min_withdraw ?? ""} onChange={(v) => set("min_withdraw", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold">Telegram Bot</h3>
        <Field label="Bot token" value={form.bot_token ?? ""} onChange={(v) => set("bot_token", v)} placeholder="123456:ABC-DEF..." />
        <Field label="Admin chat ID" value={form.admin_chat_id ?? ""} onChange={(v) => set("admin_chat_id", v)} />
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="font-semibold flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Anti-fraud</h3>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.anti_fraud_enabled === "true"}
            onCheckedChange={(v) => set("anti_fraud_enabled", v ? "true" : "false")}
          />
          <span className="text-sm">Enabled (IP-based multi-account block)</span>
        </div>
        <Field label="Max accounts per IP" type="number" value={form.max_accounts_per_ip ?? "3"} onChange={(v) => set("max_accounts_per_ip", v)} />
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

// ---------------- Ad Zones ----------------
function ZonesTab({
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
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const ZoneBlock = ({ type, title, emoji }: { type: string; title: string; emoji: string }) => (
    <Card className="space-y-3 p-5">
      <h3 className="flex items-center gap-2 font-semibold"><span className="text-xl">{emoji}</span> {title}</h3>
      <p className="text-xs text-muted-foreground">SDK function will be: <code>show_{form[`zone_${type}`] ?? ""}</code></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monetag Zone ID" value={form[`zone_${type}`] ?? ""} onChange={(v) => set(`zone_${type}`, v)} />
        <Field label="Points per ad" type="number" value={form[`points_${type}`] ?? ""} onChange={(v) => set(`points_${type}`, v)} />
        <Field label="Cooldown (sec)" type="number" value={form[`cooldown_${type}`] ?? ""} onChange={(v) => set(`cooldown_${type}`, v)} />
        <Field label="Daily limit" type="number" value={form[`daily_limit_${type}`] ?? ""} onChange={(v) => set(`daily_limit_${type}`, v)} />
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      <ZoneBlock type="interstitial" title="Rewarded Interstitial" emoji="🤩" />
      <ZoneBlock type="popup" title="Rewarded Popup" emoji="😎" />
      <ZoneBlock type="inapp" title="In-App Interstitial" emoji="👀" />
      <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg" className="w-full">
        {mut.isPending ? "Saving..." : "Save zone settings"}
      </Button>
    </div>
  );
}

// ---------------- Levels ----------------
function LevelsTab({
  password,
  settings,
  onSaved,
}: {
  password: string;
  settings: Record<string, string>;
  onSaved: () => void;
}) {
  const update = useServerFn(adminUpdateSettings);
  const [text, setText] = useState(settings.levels_json ?? "[]");
  const [err, setErr] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("Must be array");
        for (const l of parsed) {
          if (typeof l.level !== "number" || typeof l.min_ads !== "number" ||
              typeof l.multiplier !== "number" || typeof l.name !== "string") {
            throw new Error("Each level needs: level, min_ads, multiplier, name");
          }
        }
        setErr("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid JSON";
        setErr(msg);
        throw new Error(msg);
      }
      return update({ data: { password, settings: { levels_json: text } } });
    },
    onSuccess: () => { toast.success("Levels saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">VIP Levels (JSON)</h3>
      <p className="text-xs text-muted-foreground">
        Each level: <code>{`{level, min_ads, multiplier, name}`}</code>. Multiplier applies to ad points.
      </p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="font-mono text-xs" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save levels</Button>
    </Card>
  );
}

// ---------------- Withdraws ----------------
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
    onSuccess: () => { toast.success("Updated"); setNoteFor(""); setNoteText(""); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
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
                  variant={w.status === "approved" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}
                >
                  {w.status}
                </Badge>
              </div>
              <div className="mt-1 text-sm"><span className="text-muted-foreground">User:</span> {w.chat_id}</div>
              <div className="text-sm"><span className="text-muted-foreground">Account:</span> <span className="font-mono">{w.account}</span></div>
              <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
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
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Optional note..." rows={2} />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => mut.mutate({ id: w.id, action: "approve", note: noteText || undefined })} disabled={mut.isPending}>
                  <Check className="mr-1 h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => mut.mutate({ id: w.id, action: "reject", note: noteText || undefined })} disabled={mut.isPending}>
                  <X className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setNoteFor(noteFor === w.id ? "" : w.id); setNoteText(""); }}>
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

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ---------------- Methods ----------------
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
  password, methods, onChange,
}: { password: string; methods: MethodRow[]; onChange: () => void }) {
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
    onSuccess: () => { toast.success("Saved"); setEditing(null); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { password, id } }),
    onSuccess: () => { toast.success("Deleted"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button onClick={() => setEditing({ enabled: true, min_amount: 1000, sort_order: methods.length })}>
        <Plus className="mr-2 h-4 w-4" /> Add method
      </Button>

      {editing && (
        <Card className="space-y-3 border-primary p-4">
          <h3 className="font-semibold">{editing.id ? "Edit" : "New"} method</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Icon (emoji)" value={editing.icon ?? ""} onChange={(v) => setEditing({ ...editing, icon: v })} />
            <Field label="Min amount" type="number" value={String(editing.min_amount ?? "")} onChange={(v) => setEditing({ ...editing, min_amount: Number(v) })} />
            <Field label="Sort order" type="number" value={String(editing.sort_order ?? 0)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Instructions</Label>
            <Textarea value={editing.instructions ?? ""} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.enabled ?? true} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
            <span className="text-sm">Enabled</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.name}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {methods.map((m) => (
        <Card key={m.id} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{m.icon || "💳"}</span>
            <div>
              <div className="font-medium">
                {m.name} {!m.enabled && <Badge variant="outline" className="ml-1">disabled</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">Min: {Number(m.min_amount)} pts</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Delete ${m.name}?`)) delMut.mutate(m.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Tasks ----------------
type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  url: string | null;
  reward_points: number;
  task_type: string;
  verify_method: string;
  channel_username: string | null;
  active: boolean;
  sort_order: number;
};

function TasksTab({
  password, tasks, onChange,
}: { password: string; tasks: TaskRow[]; onChange: () => void }) {
  const save = useServerFn(adminSaveTask);
  const del = useServerFn(adminDeleteTask);
  const [editing, setEditing] = useState<Partial<TaskRow> | null>(null);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("nothing");
      return save({
        data: {
          password,
          task: {
            id: editing.id,
            title: editing.title ?? "",
            description: editing.description ?? "",
            icon: editing.icon ?? "",
            url: editing.url ?? "",
            reward_points: Number(editing.reward_points ?? 50),
            task_type: (editing.task_type as "join_channel" | "visit_url" | "custom") ?? "visit_url",
            verify_method: (editing.verify_method as "auto" | "manual" | "telegram_member") ?? "auto",
            channel_username: editing.channel_username ?? "",
            active: editing.active ?? true,
            sort_order: Number(editing.sort_order ?? 0),
          },
        },
      });
    },
    onSuccess: () => { toast.success("Saved"); setEditing(null); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { password, id } }),
    onSuccess: () => { toast.success("Deleted"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Button
        onClick={() =>
          setEditing({
            active: true, reward_points: 50, sort_order: tasks.length,
            task_type: "visit_url", verify_method: "auto", icon: "🎁",
          })
        }
      >
        <Plus className="mr-2 h-4 w-4" /> Add task
      </Button>

      {editing && (
        <Card className="space-y-3 border-primary p-4">
          <h3 className="font-semibold">{editing.id ? "Edit" : "New"} task</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} />
            <Field label="Icon (emoji)" value={editing.icon ?? ""} onChange={(v) => setEditing({ ...editing, icon: v })} />
            <Field label="URL" value={editing.url ?? ""} onChange={(v) => setEditing({ ...editing, url: v })} placeholder="https://t.me/yourchannel" />
            <Field label="Reward (points)" type="number" value={String(editing.reward_points ?? 50)} onChange={(v) => setEditing({ ...editing, reward_points: Number(v) })} />
            <div>
              <Label className="mb-1.5 block text-xs">Task type</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editing.task_type ?? "visit_url"}
                onChange={(e) => setEditing({ ...editing, task_type: e.target.value })}
              >
                <option value="visit_url">Visit URL</option>
                <option value="join_channel">Join channel</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Verify method</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editing.verify_method ?? "auto"}
                onChange={(e) => setEditing({ ...editing, verify_method: e.target.value })}
              >
                <option value="auto">Auto-approve</option>
                <option value="telegram_member">Telegram channel check</option>
                <option value="manual">Manual review</option>
              </select>
            </div>
            <Field label="Channel @username (for tg check)" value={editing.channel_username ?? ""} onChange={(v) => setEditing({ ...editing, channel_username: v })} placeholder="@yourchannel" />
            <Field label="Sort order" type="number" value={String(editing.sort_order ?? 0)} onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Description</Label>
            <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.title}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
      {tasks.map((t) => (
        <Card key={t.id} className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="text-2xl">{t.icon || "🎁"}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.title}</span>
                {!t.active && <Badge variant="outline">inactive</Badge>}
                <Badge variant="secondary">+{Number(t.reward_points)}</Badge>
              </div>
              {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
              <div className="text-[11px] text-muted-foreground">
                {t.task_type} · verify: {t.verify_method}
                {t.channel_username && ` · ${t.channel_username}`}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Delete ${t.title}?`)) delMut.mutate(t.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Users ----------------
type UserRow = {
  chat_id: string;
  points: number;
  total_earned: number;
  banned: boolean;
  flagged?: boolean;
  level?: number;
  last_ip?: string | null;
  created_at: string;
};

function UsersTab({
  password, users, onChange,
}: { password: string; users: UserRow[]; onChange: () => void }) {
  const update = useServerFn(adminUpdateUser);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged" | "banned">("all");

  const mut = useMutation({
    mutationFn: (v: { chatId: string; points?: number; banned?: boolean; flagged?: boolean }) =>
      update({ data: { password, ...v } }),
    onSuccess: () => { toast.success("Updated"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let r = users;
    if (filter === "flagged") r = r.filter((u) => u.flagged);
    if (filter === "banned") r = r.filter((u) => u.banned);
    if (search) r = r.filter((u) => u.chat_id.includes(search) || (u.last_ip ?? "").includes(search));
    return r;
  }, [users, search, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search chat id or IP..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        {(["all", "flagged", "banned"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left">Chat ID</th>
              <th className="px-3 py-2 text-right">Pts</th>
              <th className="px-3 py-2 text-right">Earned</th>
              <th className="px-3 py-2 text-center">Lvl</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.chat_id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{u.chat_id}</td>
                <td className="px-3 py-2 text-right font-semibold">{Number(u.points).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{Number(u.total_earned).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">{u.level ?? 1}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.last_ip ?? "—"}</td>
                <td className="px-3 py-2 text-center">
                  {u.banned ? <Badge variant="destructive">banned</Badge>
                    : u.flagged ? <Badge variant="outline" className="border-warning text-warning">flagged</Badge>
                    : <Badge variant="secondary">active</Badge>}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => {
                      const p = prompt(`Set points for ${u.chat_id}:`, String(u.points));
                      if (p !== null) {
                        const n = parseInt(p, 10);
                        if (!isNaN(n) && n >= 0) mut.mutate({ chatId: u.chat_id, points: n });
                      }
                    }}>Pts</Button>
                    {u.flagged && (
                      <Button size="sm" variant="outline" onClick={() => mut.mutate({ chatId: u.chat_id, flagged: false })}>
                        Unflag
                      </Button>
                    )}
                    <Button size="sm" variant={u.banned ? "default" : "destructive"} onClick={() => mut.mutate({ chatId: u.chat_id, banned: !u.banned })}>
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
