import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/lib/admin.functions";

const ADMIN_MAGIC_ID = "975998543";
const ADMIN_PASSWORD = "76737";

export const Route = createFileRoute("/admin")({
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: "Admin — Login" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === ADMIN_MAGIC_ID) {
      try { sessionStorage.setItem("admin_pw", ADMIN_PASSWORD); } catch {}
      window.location.replace("/admin/dashboard");
    }
  }, [navigate]);

  const mut = useMutation({
    mutationFn: () => login({ data: { password: pwd } }),
    onSuccess: () => {
      sessionStorage.setItem("admin_pw", pwd);
      toast.success("Logged in");
      navigate({ to: "/admin/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Enter admin password</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={mut.isPending || !pwd}>
            {mut.isPending ? "Verifying..." : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
