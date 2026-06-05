import { Link, useLocation } from "@tanstack/react-router";
import { Home, Wallet, History, ListChecks, Zap, Megaphone } from "lucide-react";

export function BottomNav({ chatId }: { chatId: string }) {
  const { pathname } = useLocation();
  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/earn", label: "Earn", icon: Zap },
    { to: "/tasks", label: "Tasks", icon: ListChecks },
    { to: "/sponsor", label: "Sponsor", icon: Megaphone },
    { to: "/withdraw", label: "Withdraw", icon: Wallet },
    { to: "/history", label: "History", icon: History },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto grid max-w-md grid-cols-6">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              search={{ id: chatId }}
              className={`flex flex-col items-center gap-1 py-3 text-[9px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

