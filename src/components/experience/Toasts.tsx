"use client";

import { AnimatePresence, motion } from "motion/react";
import { useExperience } from "./ExperienceProvider";

export function Toasts() {
  const { toasts, dismissToast } = useExperience();
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-start gap-3 sm:right-auto sm:w-96" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="terminal pointer-events-auto w-full overflow-hidden rounded-xl border border-[color:var(--color-line)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--term-dim)]">
              <span>
                {t.tone === "achievement" ? "✦ " : t.tone === "chapter" ? "▓ " : "⌁ "}
                {t.title}
              </span>
              <button type="button" onClick={() => dismissToast(t.id)} className="px-1 hover:text-[color:var(--term-fg)]" aria-label="Fechar aviso">
                ×
              </button>
            </div>
            <div className="space-y-0.5 px-4 py-3 text-[13px]">
              {t.lines.map((l, i) => (
                <div key={i} className={`term-line term-k-${l.k === "link" ? "out" : l.k}`}>
                  {l.t || " "}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
