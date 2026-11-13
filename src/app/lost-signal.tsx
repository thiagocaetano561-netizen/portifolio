"use client";

import { useEffect, useState } from "react";
import { sendSignal } from "@/lib/terminal/client";
import type { Line } from "@/lib/terminal/protocol";

export function LostSignal() {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    sendSignal("lost")
      .then((r) => setLines(r.lines))
      .catch(() => undefined);
  }, []);
  if (!lines.length) return null;
  return (
    <div className="terminal absolute bottom-6 left-1/2 w-[min(92vw,26rem)] -translate-x-1/2 rounded-xl border border-[color:var(--color-line)] px-4 py-3 text-[13px]" role="status">
      {lines.map((l, i) => (
        <div key={i} className={`term-line term-k-${l.k === "link" ? "out" : l.k}`}>
          {l.t}
        </div>
      ))}
    </div>
  );
}
