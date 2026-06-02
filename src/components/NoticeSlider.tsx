import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

export function NoticeSlider({ items, intervalMs = 4500 }: { items: string[]; intervalMs?: number }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!items || items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(t);
  }, [items, intervalMs]);

  if (!items || items.length === 0) return null;
  const current = items[idx] ?? items[0];

  return (
    <div className="border-b border-primary/20 bg-primary/10">
      <div className="mx-auto flex max-w-md items-center gap-2 overflow-hidden px-3 py-2">
        <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div key={idx} className="animate-in slide-in-from-right-4 fade-in flex-1 truncate text-[12px] font-medium text-foreground">
          {current}
        </div>
        {items.length > 1 && (
          <div className="flex gap-1">
            {items.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-1 rounded-full transition-all ${i === idx ? "w-3 bg-primary" : "bg-primary/30"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
