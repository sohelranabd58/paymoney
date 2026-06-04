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
  LayoutDashboard,
  ListChecks,
  Layers,
  Trophy,
  ShieldAlert,
  Search,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  adminGetUserDetail,
  adminBulkProcessWithdraw,
  adminResetAllPoints,
  adminListPendingTasks,
  adminReviewTask,
} from "@/lib/admin.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
  head: () => ({
    meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

type Section =
  | "overview"
  | "users"
  | "withdrawals"
  | "ads"
  | "tasks"
  | "reviews"
  | "methods"
  | "levels"
  | "settings";

const NAV: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "withdrawals", label: "Withdrawals", icon: Wallet },
  { id: "ads", label: "Ads & Zones", icon: Layers },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "reviews", label: "Task Reviews", icon: ShieldAlert },
  { id: "methods", label: "Methods", icon: CreditCard },
  { id: "levels", label: "Levels", icon: Trophy },
  { id: "settings", label: "Settings", icon: Settings },
];

// Slate/blue theme scoped to admin shell, overrides global tokens.
const ADMIN_THEME = `
.admin-shell {
  --background: oklch(0.18 0.02 250);
  --foreground: oklch(0.97 0.005 250);
  --card: oklch(0.22 0.025 250);
  --card-foreground: oklch(0.97 0.005 250);
  --popover: oklch(0.22 0.025 250);
  --popover-foreground: oklch(0.97 0.005 250);
  --primary: oklch(0.65 0.18 250);
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.28 0.02 250);
  --secondary-foreground: oklch(0.97 0.005 250);
  --muted: oklch(0.26 0.02 250);
  --muted-foreground: oklch(0.68 0.02 250);
  --accent: oklch(0.32 0.04 250);
  --accent-foreground: oklch(0.97 0.005 250);
  --destructive: oklch(0.6 0.22 25);
  --destructive-foreground: oklch(0.99 0 0);
  --border: oklch(0.3 0.02 250);
  --input: oklch(0.3 0.02 250);
  --ring: oklch(0.65 0.18 250);
  --success: oklch(0.7 0.18 155);
  --warning: oklch(0.78 0.16 85);
  background: var(--background);
  color: var(--foreground);
}
.admin-shell .num { font-variant-numeric: tabular-nums; }
`;

function noticeLinesFromJson(v: string | undefined): string {
  if (!v) return "";
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.filter((s) => typeof s === "string").join("\n");
  } catch { /* ignore */ }
  return "";
}
function noticeLinesToJson(text: string): string {
  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(lines);
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [password, setPassword] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("admin_pw");
  });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const pw = sessionStorage.getItem("admin_pw");
    if (pw) setPassword(pw);
    setChecked(true);
  }, []);

  useEffect(() => {
    if (checked && !password) navigate({ to: "/admin" });
  }, [checked, password, navigate]);

  if (!password) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }
  return (
    <>
      <style>{ADMIN_THEME}</style>
      <Shell password={password} />
    </>
  );
}

function Shell({ password }: { password: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const fetchAll = useServerFn(adminGetAll);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all"],
    queryFn: () => fetchAll({ data: { password } }),
  });

  const logout = () => {
    sessionStorage.removeItem("admin_pw");
    navigate({ to: "/admin" });
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-all"] });
  const pendingCount = data?.withdraws.filter((w) => w.status === "pending").length ?? 0;

  return (
    <div className="admin-shell min-h-screen">
      <div className="flex min-h-screen w-full">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Admin</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Control panel</div>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {NAV.map((n) => {
              const active = section === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2.5">
                    <n.icon className="h-4 w-4" />
                    {n.label}
                  </span>
                  {n.id === "withdrawals" && pendingCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
                      {pendingCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-border p-2">
            <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start text-muted-foreground">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur md:px-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Admin</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium capitalize">{section}</span>
            </div>
            {/* Mobile nav */}
            <div className="flex items-center gap-2 md:hidden">
              <select
                className="rounded-md border border-input bg-card px-2 py-1 text-sm"
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
              >
                {NAV.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                    {n.id === "withdrawals" && pendingCount > 0 ? ` (${pendingCount})` : ""}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">
            {isLoading || !data ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                {section === "overview" && <OverviewSection password={password} />}
                {section === "users" && <UsersSection password={password} users={data.users} onChange={refresh} />}
                {section === "withdrawals" && (
                  <WithdrawalsSection password={password} withdraws={data.withdraws} users={data.users} onChange={refresh} />
                )}
                {section === "ads" && <AdsSection password={password} settings={data.settings} onSaved={refresh} />}
                {section === "tasks" && <TasksSection password={password} tasks={data.tasks} onChange={refresh} />}
                {section === "reviews" && <ReviewsSection password={password} />}
                {section === "methods" && <MethodsSection password={password} methods={data.methods} onChange={refresh} />}
                {section === "levels" && <LevelsSection password={password} settings={data.settings} onSaved={refresh} />}
                {section === "settings" && <SettingsSection password={password} settings={data.settings} onSaved={refresh} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW
// ============================================================

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  const colorMap = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <Card className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${accent ? colorMap[accent] : ""}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function OverviewSection({ password }: { password: string }) {
  const fetchStats = useServerFn(adminGetStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats({ data: { password } }),
  });
  if (isLoading || !data) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total users" value={data.totals.users} hint={`+${data.totals.users_today} today`} />
        <StatCard label="Ads watched" value={data.totals.ads} hint={`+${data.totals.ads_today} today`} accent="primary" />
        <StatCard label="Pending payouts" value={data.totals.pending_withdraws} hint={`${data.totals.pending_amount.toLocaleString()} pts`} accent="warning" />
        <StatCard label="Total paid" value={data.totals.paid_amount} hint="points" accent="success" />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Last 7 days</h3>
          <span className="text-[11px] text-muted-foreground">Daily activity</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="day" fontSize={11} stroke="oklch(0.68 0.02 250)" />
              <YAxis fontSize={11} stroke="oklch(0.68 0.02 250)" />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.025 250)",
                  border: "1px solid oklch(0.3 0.02 250)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "oklch(0.97 0.005 250)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ads" stroke="oklch(0.65 0.18 250)" name="Ads" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="users" stroke="oklch(0.78 0.16 85)" name="New users" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="withdrawn" stroke="oklch(0.7 0.18 155)" name="Withdrawn" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Top 10 earners</h3>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Chat ID</th>
                <th className="px-3 py-2 text-right font-medium">Lifetime earned</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.top.map((u, i) => (
                <tr key={u.chat_id} className="border-t border-border">
                  <td className="px-3 py-2 num text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{u.chat_id}</td>
                  <td className="num px-3 py-2 text-right font-semibold">{Number(u.total_earned).toLocaleString()}</td>
                  <td className="num px-3 py-2 text-right text-muted-foreground">{Number(u.points).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// USERS
// ============================================================

type UserRow = {
  chat_id: string;
  points: number;
  pending_points?: number;
  total_earned: number;
  banned: boolean;
  flagged?: boolean;
  level?: number;
  last_ip?: string | null;
  created_at: string;
  tg_username?: string | null;
  tg_first_name?: string | null;
  tg_last_name?: string | null;
  tg_photo_url?: string | null;
};

function userDisplayName(u: UserRow) {
  const name = [u.tg_first_name, u.tg_last_name].filter(Boolean).join(" ").trim();
  return name || u.tg_username || u.chat_id;
}

function UsersSection({
  password,
  users,
  onChange,
}: {
  password: string;
  users: UserRow[];
  onChange: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged" | "banned">("all");
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const resetFn = useServerFn(adminResetAllPoints);
  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { password, confirm: "RESET" } }),
    onSuccess: (r) => {
      toast.success(`Reset ${r.affected} user(s) to 0 points`);
      setResetOpen(false);
      setResetConfirm("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let r = users;
    if (filter === "flagged") r = r.filter((u) => u.flagged);
    if (filter === "banned") r = r.filter((u) => u.banned);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (u) =>
          u.chat_id.includes(q) ||
          (u.last_ip ?? "").includes(q) ||
          (u.tg_username ?? "").toLowerCase().includes(q) ||
          (u.tg_first_name ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [users, search, filter]);

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search id, username, name or IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        {(["all", "flagged", "banned"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
            <Badge variant="secondary" className="ml-2 num">
              {f === "all" ? users.length : users.filter((u) => (f === "flagged" ? u.flagged : u.banned)).length}
            </Badge>
          </Button>
        ))}
        <Button
          size="sm"
          variant="destructive"
          className="ml-auto gap-1"
          onClick={() => setResetOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Reset all points
        </Button>
      </Card>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent className="admin-shell">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all user points?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets every user's current balance and pending points to <b>0</b>. Lifetime
              earnings (history) are preserved. This cannot be undone. Type <b>RESET</b> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="Type RESET"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirm("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetConfirm !== "RESET" || resetMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                resetMut.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetMut.isPending ? "Resetting…" : "Reset everyone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium">User</th>
              <th className="px-3 py-2.5 text-right font-medium">Points</th>
              <th className="px-3 py-2.5 text-right font-medium">Pending</th>
              <th className="px-3 py-2.5 text-right font-medium">Lifetime</th>
              <th className="px-3 py-2.5 text-center font-medium">Lvl</th>
              <th className="px-3 py-2.5 text-left font-medium">IP</th>
              <th className="px-3 py-2.5 text-center font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No users
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr
                key={u.chat_id}
                className="cursor-pointer border-t border-border transition-colors hover:bg-accent/40"
                onClick={() => setOpenChatId(u.chat_id)}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      {u.tg_photo_url && <AvatarImage src={u.tg_photo_url} />}
                      <AvatarFallback className="text-[10px]">
                        {userDisplayName(u).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{userDisplayName(u)}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {u.chat_id}
                        {u.tg_username && ` · @${u.tg_username}`}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="num px-3 py-2.5 text-right font-semibold">{Number(u.points).toLocaleString()}</td>
                <td className="num px-3 py-2.5 text-right text-warning">
                  {Number(u.pending_points ?? 0).toLocaleString()}
                </td>
                <td className="num px-3 py-2.5 text-right text-muted-foreground">
                  {Number(u.total_earned).toLocaleString()}
                </td>
                <td className="num px-3 py-2.5 text-center text-muted-foreground">{u.level ?? 1}</td>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{u.last_ip ?? "—"}</td>
                <td className="px-3 py-2.5 text-center">
                  {u.banned ? (
                    <Badge variant="destructive">banned</Badge>
                  ) : u.flagged ? (
                    <Badge variant="outline" className="border-warning text-warning">
                      flagged
                    </Badge>
                  ) : (
                    <Badge variant="secondary">active</Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-[11px] text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Sheet open={openChatId !== null} onOpenChange={(o) => !o && setOpenChatId(null)}>
        <SheetContent side="right" className="admin-shell w-full overflow-y-auto sm:max-w-md">
          {openChatId && (
            <UserDetail
              password={password}
              chatId={openChatId}
              onChange={() => {
                onChange();
              }}
              onClose={() => setOpenChatId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UserDetail({
  password,
  chatId,
  onChange,
  onClose,
}: {
  password: string;
  chatId: string;
  onChange: () => void;
  onClose: () => void;
}) {
  const fetchDetail = useServerFn(adminGetUserDetail);
  const update = useServerFn(adminUpdateUser);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user", chatId],
    queryFn: () => fetchDetail({ data: { password, chatId } }),
  });

  const mut = useMutation({
    mutationFn: (v: { points?: number; banned?: boolean; flagged?: boolean }) =>
      update({ data: { password, chatId, ...v } }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-user", chatId] });
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  const u = data.user as UserRow | null;
  if (!u) {
    return (
      <div>
        <SheetHeader>
          <SheetTitle>User not found</SheetTitle>
        </SheetHeader>
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            {u.tg_photo_url && <AvatarImage src={u.tg_photo_url} />}
            <AvatarFallback>{userDisplayName(u).slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">{userDisplayName(u)}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {u.chat_id}
              {u.tg_username && ` · @${u.tg_username}`}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-5 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
            <div className="num mt-0.5 text-lg font-bold">{Number(u.points).toLocaleString()}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</div>
            <div className="num mt-0.5 text-lg font-bold text-warning">
              {Number(u.pending_points ?? 0).toLocaleString()}
            </div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime</div>
            <div className="num mt-0.5 text-lg font-bold text-success">
              {Number(u.total_earned).toLocaleString()}
            </div>
          </Card>
        </div>

        {/* Actions */}
        <Card className="space-y-2 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const p = prompt(`Set balance for ${u.chat_id}:`, String(u.points));
                if (p !== null) {
                  const n = parseInt(p, 10);
                  if (!isNaN(n) && n >= 0) mut.mutate({ points: n });
                }
              }}
            >
              Set points
            </Button>
            <Button
              size="sm"
              variant={u.banned ? "default" : "destructive"}
              onClick={() => mut.mutate({ banned: !u.banned })}
            >
              {u.banned ? "Unban" : "Ban"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mut.mutate({ flagged: !u.flagged })}
            >
              {u.flagged ? "Unflag" : "Flag"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </Card>

        {/* Ads breakdown */}
        <Card className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ads by type
          </div>
          {Object.keys(data.ads_by_type).length === 0 ? (
            <div className="text-xs text-muted-foreground">No ads watched yet.</div>
          ) : (
            <div className="space-y-1">
              {Object.entries(data.ads_by_type).map(([type, v]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{type}</span>
                  <span className="num text-muted-foreground">
                    {v.count} ads · {v.points.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent withdrawals */}
        <Card className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent withdrawals ({data.withdrawals.length})
          </div>
          <ScrollArea className="max-h-48">
            {data.withdrawals.length === 0 ? (
              <div className="text-xs text-muted-foreground">None.</div>
            ) : (
              <div className="space-y-1.5">
                {data.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                    <div>
                      <div className="font-medium">{w.method_name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{w.account}</div>
                    </div>
                    <div className="text-right">
                      <div className="num font-semibold">{Number(w.amount).toLocaleString()}</div>
                      <Badge
                        variant={
                          w.status === "approved"
                            ? "default"
                            : w.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[9px]"
                      >
                        {w.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Devices */}
        <Card className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Devices / IPs ({data.devices.length})
          </div>
          {data.devices.length === 0 ? (
            <div className="text-xs text-muted-foreground">No device records.</div>
          ) : (
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {data.devices.slice(0, 10).map((d, i) => (
                  <div key={i} className="text-[11px]">
                    <span className="font-mono">{d.ip}</span>{" "}
                    <span className="text-muted-foreground">· {new Date(d.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Recent ads */}
        <Card className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent ads ({data.watches.length})
          </div>
          <ScrollArea className="max-h-40">
            <div className="space-y-1">
              {data.watches.slice(0, 30).map((w, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="capitalize text-muted-foreground">{w.ad_type}</span>
                  <span className="num">
                    +{w.points} · {new Date(w.watched_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </>
  );
}

// ============================================================
// WITHDRAWALS
// ============================================================

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
  redeem_code?: string | null;
};

function WithdrawalsSection({
  password,
  withdraws,
  users,
  onChange,
}: {
  password: string;
  withdraws: WithdrawRow[];
  users: UserRow[];
  onChange: () => void;
}) {
  const userMap = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of users) m.set(u.chat_id, u);
    return m;
  }, [users]);

  const process = useServerFn(adminProcessWithdraw);
  const bulk = useServerFn(adminBulkProcessWithdraw);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const list = useMemo(() => {
    let r = filter === "all" ? withdraws : withdraws.filter((w) => w.status === filter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (w) =>
          w.chat_id.includes(q) ||
          w.account.toLowerCase().includes(q) ||
          w.method_name.toLowerCase().includes(q),
      );
    }
    return r;
  }, [withdraws, filter, search]);

  const counts = useMemo(
    () => ({
      pending: withdraws.filter((w) => w.status === "pending").length,
      approved: withdraws.filter((w) => w.status === "approved").length,
      rejected: withdraws.filter((w) => w.status === "rejected").length,
      all: withdraws.length,
    }),
    [withdraws],
  );

  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject"; note?: string }) =>
      process({ data: { password, ...v } }),
    onSuccess: (res) => {
      toast.success(res.redeem_code ? `Approved · code ${res.redeem_code}` : "Updated");
      setExpanded(null);
      setNoteText("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      bulk({ data: { password, ids: Array.from(selected), action } }),
    onSuccess: (res) => {
      const okCount = res.results.filter((r) => r.ok).length;
      toast.success(`${okCount}/${res.results.length} processed`);
      setSelected(new Set());
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => {
              setFilter(f);
              setSelected(new Set());
            }}
            className="capitalize"
          >
            {f}
            <Badge variant="secondary" className="num ml-2">
              {counts[f]}
            </Badge>
          </Button>
        ))}
        <div className="relative ml-auto max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search id, account, method…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="flex items-center justify-between border-primary/40 bg-primary/5 p-3">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> selected
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => bulkMut.mutate("approve")} disabled={bulkMut.isPending}>
              <Check className="mr-1 h-4 w-4" /> Bulk approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => bulkMut.mutate("reject")} disabled={bulkMut.isPending}>
              <X className="mr-1 h-4 w-4" /> Bulk reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </Card>
      )}

      {list.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No requests in this view.</Card>
      )}

      <div className="space-y-2">
        {list.map((w) => {
          const user = userMap.get(w.chat_id);
          const isOpen = expanded === w.id;
          const isPending = w.status === "pending";
          return (
            <Card key={w.id} className="overflow-hidden p-0">
              <div className="flex items-start gap-3 p-3">
                {isPending && (
                  <input
                    type="checkbox"
                    checked={selected.has(w.id)}
                    onChange={() => toggleSelect(w.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 cursor-pointer accent-primary"
                  />
                )}
                <button
                  className="flex flex-1 cursor-pointer items-start gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : w.id)}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    {user?.tg_photo_url && <AvatarImage src={user.tg_photo_url} />}
                    <AvatarFallback className="text-[10px]">
                      {(user ? userDisplayName(user) : w.chat_id).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {user ? userDisplayName(user) : w.chat_id}
                      </span>
                      <Badge
                        variant={
                          w.status === "approved"
                            ? "default"
                            : w.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {w.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {w.method_name} · <span className="font-mono">{w.account}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(w.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-xl font-bold">{Number(w.amount).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">points</div>
                  </div>
                </button>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-border bg-muted/20 p-3">
                  {user && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded bg-card p-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                        <div className="num text-sm font-semibold">{Number(user.points).toLocaleString()}</div>
                      </div>
                      <div className="rounded bg-card p-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime</div>
                        <div className="num text-sm font-semibold text-success">
                          {Number(user.total_earned).toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded bg-card p-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                        <div className="text-sm font-semibold">
                          {user.banned ? "Banned" : user.flagged ? "Flagged" : "Active"}
                        </div>
                      </div>
                    </div>
                  )}

                  {w.redeem_code && (
                    <div className="rounded bg-success/10 p-2 text-xs">
                      <span className="text-muted-foreground">Redeem code: </span>
                      <span className="font-mono font-semibold">{w.redeem_code}</span>
                    </div>
                  )}
                  {w.note && (
                    <div className="rounded bg-card p-2 text-xs italic text-muted-foreground">Note: {w.note}</div>
                  )}

                  {isPending && (
                    <>
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Optional note / rejection reason…"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => mut.mutate({ id: w.id, action: "approve", note: noteText || undefined })}
                          disabled={mut.isPending}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve & generate code
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => mut.mutate({ id: w.id, action: "reject", note: noteText || undefined })}
                          disabled={mut.isPending}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject & refund
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ADS & ZONES
// ============================================================

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

function AdsSection({
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
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ZoneBlock = ({ type, title, emoji }: { type: string; title: string; emoji: string }) => (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          show_{form[`zone_${type}`] ?? ""}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monetag Zone ID" value={form[`zone_${type}`] ?? ""} onChange={(v) => set(`zone_${type}`, v)} />
        <Field
          label="Points per ad"
          type="number"
          value={form[`points_${type}`] ?? ""}
          onChange={(v) => set(`points_${type}`, v)}
        />
        <Field
          label="Cooldown (sec)"
          type="number"
          value={form[`cooldown_${type}`] ?? ""}
          onChange={(v) => set(`cooldown_${type}`, v)}
        />
        <Field
          label="Daily limit"
          type="number"
          value={form[`daily_limit_${type}`] ?? ""}
          onChange={(v) => set(`daily_limit_${type}`, v)}
        />
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      <ZoneBlock type="interstitial" title="Rewarded Interstitial" emoji="🤩" />
      <ZoneBlock type="popup" title="Rewarded Popup" emoji="😎" />
      <ZoneBlock type="inapp" title="In-App Interstitial" emoji="👀" />

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎁</span>
          <h3 className="font-semibold">Bonus Click Ad (cycle)</h3>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            show_{form.click_ad_zone ?? "9518673"}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          User earns pending points per ad. After "every N ads" they unlock a bonus click ad that moves pending
          points + bonus into their balance.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Click ad zone ID" value={form.click_ad_zone ?? ""} onChange={(v) => set("click_ad_zone", v)} />
          <Field
            label="Bonus points"
            type="number"
            value={form.click_ad_points ?? ""}
            onChange={(v) => set("click_ad_points", v)}
          />
          <Field
            label="Trigger every N ads"
            type="number"
            value={form.click_ad_every ?? ""}
            onChange={(v) => set("click_ad_every", v)}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
          <div className="pr-3">
            <div className="text-sm font-medium">Click-ad required</div>
            <div className="text-[11px] text-muted-foreground">
              When ON, ad rewards go to pending and users must watch a bonus click ad to unlock them. When OFF, rewards go straight to balance.
            </div>
          </div>
          <Switch
            checked={(form.click_ad_required ?? "false") === "true"}
            onCheckedChange={(v) => set("click_ad_required", v ? "true" : "false")}
          />
        </div>
      </Card>


      <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg" className="w-full">
        {mut.isPending ? "Saving…" : "Save zone & ad settings"}
      </Button>
    </div>
  );
}

// ============================================================
// METHODS
// ============================================================

type MethodRow = {
  id: string;
  name: string;
  icon: string | null;
  min_amount: number;
  instructions: string | null;
  enabled: boolean;
  sort_order: number;
};

function MethodsSection({
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
        <Plus className="mr-2 h-4 w-4" /> Add method
      </Button>

      {editing && (
        <Card className="space-y-3 border-primary/60 p-4">
          <h3 className="font-semibold">{editing.id ? "Edit" : "New"} method</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field
              label="Icon (emoji)"
              value={editing.icon ?? ""}
              onChange={(v) => setEditing({ ...editing, icon: v })}
            />
            <Field
              label="Min amount"
              type="number"
              value={String(editing.min_amount ?? "")}
              onChange={(v) => setEditing({ ...editing, min_amount: Number(v) })}
            />
            <Field
              label="Sort order"
              type="number"
              value={String(editing.sort_order ?? 0)}
              onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Instructions</Label>
            <Textarea
              value={editing.instructions ?? ""}
              onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={editing.enabled ?? true}
              onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
            />
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
        <Card key={m.id} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{m.icon || "💳"}</span>
            <div>
              <div className="font-medium">
                {m.name} {!m.enabled && <Badge variant="outline" className="ml-1">disabled</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">Min: {Number(m.min_amount).toLocaleString()} pts</div>
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

// ============================================================
// TASKS
// ============================================================

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
  require_proof?: boolean;
};

function TasksSection({
  password,
  tasks,
  onChange,
}: {
  password: string;
  tasks: TaskRow[];
  onChange: () => void;
}) {
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
            require_proof: Boolean(editing.require_proof),
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
      <Button
        onClick={() =>
          setEditing({
            active: true,
            reward_points: 50,
            sort_order: tasks.length,
            task_type: "visit_url",
            verify_method: "auto",
            icon: "🎁",
          })
        }
      >
        <Plus className="mr-2 h-4 w-4" /> Add task
      </Button>

      {editing && (
        <Card className="space-y-3 border-primary/60 p-4">
          <h3 className="font-semibold">{editing.id ? "Edit" : "New"} task</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} />
            <Field
              label="Icon (emoji)"
              value={editing.icon ?? ""}
              onChange={(v) => setEditing({ ...editing, icon: v })}
            />
            <Field
              label="URL"
              value={editing.url ?? ""}
              onChange={(v) => setEditing({ ...editing, url: v })}
              placeholder="https://t.me/yourchannel"
            />
            <Field
              label="Reward (points)"
              type="number"
              value={String(editing.reward_points ?? 50)}
              onChange={(v) => setEditing({ ...editing, reward_points: Number(v) })}
            />
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
            <Field
              label="Channel @username"
              value={editing.channel_username ?? ""}
              onChange={(v) => setEditing({ ...editing, channel_username: v })}
              placeholder="@yourchannel"
            />
            <Field
              label="Sort order"
              type="number"
              value={String(editing.sort_order ?? 0)}
              onChange={(v) => setEditing({ ...editing, sort_order: Number(v) })}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Description</Label>
            <Textarea
              value={editing.description ?? ""}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(editing.require_proof)}
              onCheckedChange={(v) => setEditing({ ...editing, require_proof: v })}
            />
            <span className="text-sm">Require screenshot proof (manual review)</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.title}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {tasks.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">No tasks yet.</Card>
      )}
      {tasks.map((t) => (
        <Card key={t.id} className="flex items-start justify-between gap-3 p-3">
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
            <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ${t.title}?`)) delMut.mutate(t.id);
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

// ============================================================
// LEVELS
// ============================================================

function LevelsSection({
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
          if (
            typeof l.level !== "number" ||
            typeof l.min_ads !== "number" ||
            typeof l.multiplier !== "number" ||
            typeof l.name !== "string"
          ) {
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
    onSuccess: () => {
      toast.success("Levels saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <h3 className="font-semibold">VIP Levels (JSON)</h3>
      <p className="text-xs text-muted-foreground">
        Each level: <code>{`{level, min_ads, multiplier, name}`}</code>. Multiplier applies to ad points.
      </p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} className="font-mono text-xs" />
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
        Save levels
      </Button>
    </Card>
  );
}

// ============================================================
// SETTINGS
// ============================================================

function SettingsSection({
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
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">App branding</h3>
        <Field label="App name" value={form.app_name ?? ""} onChange={(v) => set("app_name", v)} />
        <Field
          label="Welcome message"
          value={form.welcome_message ?? ""}
          onChange={(v) => set("welcome_message", v)}
        />
        <Field
          label="Marquee text (scrolling banner)"
          value={form.marquee_text ?? ""}
          onChange={(v) => set("marquee_text", v)}
          placeholder="🔥 New rewards! Invite friends…"
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Notice slides (one per line — slides on Home)</Label>
          <Textarea
            value={noticeLinesFromJson(form.notice_slides)}
            onChange={(e) => set("notice_slides", noticeLinesToJson(e.target.value))}
            placeholder={"🎉 Welcome to our app!\n💰 Withdraw min: 1000 pts\n📢 Invite friends & earn"}
            rows={4}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Each line shows as one rotating notice on Home. Leave blank to hide.
          </p>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Withdraw</h3>
        <Field
          label="Global minimum withdraw (points)"
          type="number"
          value={form.min_withdraw ?? ""}
          onChange={(v) => set("min_withdraw", v)}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Telegram bots</h3>
        <Field
          label="Main bot token (user notifications)"
          value={form.bot_token ?? ""}
          onChange={(v) => set("bot_token", v)}
          placeholder="123456:ABC-DEF…"
        />
        <Field
          label="Notify bot token (admin alerts) — optional"
          value={form.notify_bot_token ?? ""}
          onChange={(v) => set("notify_bot_token", v)}
          placeholder="leave blank to reuse main bot"
        />
        <Field
          label="Admin chat ID"
          value={form.admin_chat_id ?? ""}
          onChange={(v) => set("admin_chat_id", v)}
          placeholder="your telegram chat id"
        />
        <p className="text-[11px] text-muted-foreground">
          Tokens are masked after save. Leave field as-is or empty to keep current value.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Redeem API</h3>
        <Field
          label="Redeem API key (sohel.pp.ua)"
          value={form.redeem_api_key ?? ""}
          onChange={(v) => set("redeem_api_key", v)}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-warning" /> Anti-fraud
        </h3>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.anti_fraud_enabled === "true"}
            onCheckedChange={(v) => set("anti_fraud_enabled", v ? "true" : "false")}
          />
          <span className="text-sm">Enable IP-based multi-account detection</span>
        </div>
        <Field
          label="Max accounts per IP"
          type="number"
          value={form.max_accounts_per_ip ?? "3"}
          onChange={(v) => set("max_accounts_per_ip", v)}
        />
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Security</h3>
        <Field
          label="Admin password"
          type="password"
          value={form.admin_password ?? ""}
          onChange={(v) => set("admin_password", v)}
        />
      </Card>

      <Separator />

      <Button onClick={() => mut.mutate()} disabled={mut.isPending} size="lg" className="w-full">
        {mut.isPending ? "Saving…" : "Save all settings"}
      </Button>
    </div>
  );
}

// ============================================================
// TASK REVIEWS (manual verification with screenshots)
// ============================================================

function ReviewsSection({ password }: { password: string }) {
  const qc = useQueryClient();
  const list = useServerFn(adminListPendingTasks);
  const review = useServerFn(adminReviewTask);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-task-reviews"],
    queryFn: () => list({ data: { password } }),
  });

  const mut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) =>
      review({ data: { password, id: v.id, action: v.action, note: noteById[v.id] } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "approve" ? "Approved & paid" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-task-reviews"] });
      qc.invalidateQueries({ queryKey: ["admin-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <Card className="p-3 text-sm">
        Pending manual task submissions: <b>{data?.length ?? 0}</b>
      </Card>

      {data && data.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No pending submissions.
        </Card>
      )}

      {data?.map((r) => (
        <Card key={r.id} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{r.task_icon || "🎁"}</span>
                <span className="truncate font-semibold">{r.task_title}</span>
                <Badge variant="secondary">+{r.reward_points}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                User: <span className="font-mono">{r.chat_id}</span> · {new Date(r.completed_at).toLocaleString()}
              </div>
            </div>
          </div>

          {r.proof_url ? (
            <button
              type="button"
              onClick={() => setZoom(r.proof_url)}
              className="block w-full overflow-hidden rounded-md border border-border"
            >
              <img src={r.proof_url} alt="Proof" className="max-h-64 w-full object-contain bg-black/30" />
            </button>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              No screenshot attached.
            </div>
          )}

          <Textarea
            placeholder="Note to user (optional)"
            rows={2}
            value={noteById[r.id] ?? ""}
            onChange={(e) => setNoteById({ ...noteById, [r.id]: e.target.value })}
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => mut.mutate({ id: r.id, action: "approve" })}
              disabled={mut.isPending}
            >
              <Check className="mr-1 h-4 w-4" /> Approve & pay
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => mut.mutate({ id: r.id, action: "reject" })}
              disabled={mut.isPending}
            >
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
          </div>
        </Card>
      ))}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="Proof" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </div>
  );
}
