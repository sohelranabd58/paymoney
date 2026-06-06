import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { HighPerfBanner } from "@/components/HighPerfBanner";

import appCss from "../styles.css?url";


const ADMIN_MAGIC_ID = "975998543";
const ADMIN_PASSWORD = "76737";

function getAdminParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("admin");
}

const initialAdminParam = typeof window !== "undefined" ? getAdminParam() : null;
const shouldRedirectInitially = initialAdminParam === ADMIN_MAGIC_ID;

function AdminAutoLogin({ onState }: { onState: (s: "redirecting" | "invalid" | "idle") => void }) {
  useEffect(() => {
    const param = getAdminParam();
    if (param === null) {
      onState("idle");
      return;
    }
    if (param === ADMIN_MAGIC_ID) {
      try {
        sessionStorage.setItem("admin_pw", ADMIN_PASSWORD);
      } catch {}
      onState("redirecting");
      window.location.replace("/admin/dashboard");
      return;
    }
    onState("invalid");
    toast.error("Invalid admin link. Access denied.");
  }, [onState]);
  return null;
}

function AdminRedirectScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you into admin…</p>
      </div>
    </div>
  );
}

function AdminInvalidScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-destructive">Invalid admin link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin token in this URL is missing or incorrect. Use the correct magic link, or sign in manually.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <a href="/admin" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go to admin login
          </a>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground break-words">
          {error.message || "Something went wrong on our end."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Earn Rewards" },
      { name: "description", content: "Watch ads and earn rewards" },
      { name: "theme-color", content: "#0a0a0a" },
      { property: "og:title", content: "Earn Rewards" },
      { name: "twitter:title", content: "Earn Rewards" },
      { property: "og:description", content: "Watch ads and earn rewards" },
      { name: "twitter:description", content: "Watch ads and earn rewards" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e10286d8-bf18-4ec1-b2b0-db7e549eff8f/id-preview-0adbe4fd--8dcb1fb3-7304-4ba8-a3bc-ff82bb2c4ad5.lovable.app-1779007257764.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e10286d8-bf18-4ec1-b2b0-db7e549eff8f/id-preview-0adbe4fd--8dcb1fb3-7304-4ba8-a3bc-ff82bb2c4ad5.lovable.app-1779007257764.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [adminState, setAdminState] = useState<"redirecting" | "invalid" | "idle">(
    shouldRedirectInitially ? "redirecting" : "idle",
  );
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const hideBanner = pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAutoLogin onState={setAdminState} />
      {adminState === "redirecting" ? (
        <AdminRedirectScreen />
      ) : adminState === "invalid" ? (
        <AdminInvalidScreen />
      ) : (
        <>
          <Outlet />
          {!hideBanner && <GlobalBanner />}
        </>
      )}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

function GlobalBanner() {
  // Lazy: only on client to avoid SSR hydration noise.
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-16 z-20 px-2">
      <HighPerfBanner />
    </div>
  );
}


