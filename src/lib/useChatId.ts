import { useSearch } from "@tanstack/react-router";

export function useChatIdFromSearch(): string | null {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const id = search?.id;
  if (typeof id !== "string") return null;
  if (!/^\d{3,20}$/.test(id)) return null;
  return id;
}
