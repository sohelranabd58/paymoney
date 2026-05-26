import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export type TgUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          chat?: { id?: number };
        };
        ready: () => void;
        expand: () => void;
        HapticFeedback?: { notificationOccurred: (t: string) => void };
      };
    };
  }
}

function validId(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) v = String(Math.trunc(v));
  if (typeof v !== "string") return null;
  return /^\d{3,20}$/.test(v) ? v : null;
}

function readTelegram(): TgUser | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  const u = tg?.initDataUnsafe?.user;
  const id = validId(u?.id ?? tg?.initDataUnsafe?.chat?.id);
  if (!id) return null;
  return {
    id,
    first_name: u?.first_name ?? null,
    last_name: u?.last_name ?? null,
    username: u?.username ?? null,
    photo_url: u?.photo_url ?? null,
  };
}

export function useChatIdFromSearch(): string | null {
  return useTelegramUser()?.id ?? null;
}

export function useTelegramUser(): TgUser | null {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const fromUrl = validId(search?.id);

  const [tg, setTg] = useState<TgUser | null>(() => readTelegram());
  useEffect(() => {
    if (tg) return;
    let tries = 0;
    const i = setInterval(() => {
      const got = readTelegram();
      if (got) { setTg(got); clearInterval(i); return; }
      if (++tries > 20) clearInterval(i);
    }, 150);
    return () => clearInterval(i);
  }, [tg]);

  if (tg) return tg;
  if (fromUrl) return { id: fromUrl };
  return null;
}
