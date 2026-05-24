import { useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: { id?: number };
          chat?: { id?: number };
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function validId(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) v = String(Math.trunc(v));
  if (typeof v !== "string") return null;
  return /^\d{3,20}$/.test(v) ? v : null;
}

function readTelegramId(): string | null {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram?.WebApp;
  const uid = tg?.initDataUnsafe?.user?.id ?? tg?.initDataUnsafe?.chat?.id;
  return validId(uid);
}

export function useChatIdFromSearch(): string | null {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const fromUrl = validId(search?.id);

  // Lazy read Telegram WebApp id (only when URL param missing).
  // The Telegram SDK populates initDataUnsafe synchronously once the script
  // is loaded, but on first render it may not be ready yet — re-check shortly.
  const [tgId, setTgId] = useState<string | null>(() => readTelegramId());
  useEffect(() => {
    if (fromUrl || tgId) return;
    let tries = 0;
    const i = setInterval(() => {
      const id = readTelegramId();
      if (id) { setTgId(id); clearInterval(i); return; }
      if (++tries > 20) clearInterval(i);
    }, 150);
    return () => clearInterval(i);
  }, [fromUrl, tgId]);

  return fromUrl ?? tgId;
}
