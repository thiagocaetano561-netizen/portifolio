"use client";

import { AnimatePresence, motion } from "motion/react";
import { useExperience } from "@/components/experience/ExperienceProvider";

/**
 * Primeiro mistério (nível 1, perceptível): um aviso discreto de arquivo
 * desconhecido. O texto padrão é público; variantes posteriores e a sequência
 * de formas só chegam do servidor quando a sessão as conquistou.
 */
export function HeroIndicator() {
  const { ui, signal, runInTerminal } = useExperience();
  const custom = ui["hero.indicator"]?.[0]?.t;
  return (
    <button
      type="button"
      onClick={() => {
        signal("hero_file");
        runInTerminal("cat /var/log/boot.log");
      }}
      className="group inline-flex items-center gap-2.5 rounded-full border border-[color:var(--color-line)] bg-ink/40 px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] text-steel backdrop-blur transition hover:border-alert/50 hover:text-paper"
    >
      <span className="sr-only">Aviso do sistema: </span>
      <span className={`h-1.5 w-1.5 rounded-full ${custom ? "bg-signal-bright" : "file-indicator-dot"}`} aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={custom ?? "default"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
          {custom ?? (
            <>
              1 arquivo não identificado <span className="text-alert/80">· 0x7A</span>
            </>
          )}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only"> — abrir o registro no terminal</span>
    </button>
  );
}

export function HeroGlyphs() {
  const { ui } = useExperience();
  const lines = ui["hero.glyphs"];
  return (
    <AnimatePresence>
      {lines && lines.length > 0 && (
        <motion.div
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.6 }}
          className="mt-5 inline-flex flex-col gap-1 rounded-lg border border-[color:var(--color-line)] bg-ink/50 px-4 py-3 font-mono backdrop-blur"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-steel">sequência gravada na vitrine</span>
          <span className="text-xl tracking-[0.5em] text-signal-bright">{lines[0]?.t}</span>
          {lines.slice(1).map((l, i) => (
            <span key={i} className="text-[11px] text-steel">
              {l.t}
            </span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
