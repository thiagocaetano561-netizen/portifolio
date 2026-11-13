"use client";

import Image from "next/image";
import { useRef } from "react";
import { motion } from "motion/react";
import { useExperience } from "@/components/experience/ExperienceProvider";

const LINKS = [
  { href: "#projetos", label: "Projetos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#stack", label: "Stack" },
  { href: "#contato", label: "Contato" },
];

export function Nav() {
  const { mode, setMode, signal, progressPulse } = useExperience();
  const clicks = useRef<number[]>([]);

  const onMark = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 3500), now];
    if (clicks.current.length >= 7) {
      clicks.current = [];
      signal("logo_burst");
    }
  };

  return (
    // fundo quase opaco com desfoque leve: o vídeo do hero passa por trás a cada quadro
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[color:var(--color-line)] bg-ink/88 backdrop-blur-sm">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMark}
            aria-label="Marca Tryggport Dev"
            className="group relative grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/5"
          >
            <Image src="/brand/mark.png" alt="" width={26} height={27} priority className="transition duration-500 group-hover:drop-shadow-[0_0_10px_rgba(112,224,177,0.7)]" />
            <motion.span
              key={progressPulse}
              initial={{ opacity: progressPulse ? 0.9 : 0, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.8 }}
              transition={{ duration: 1.4 }}
              className="pointer-events-none absolute inset-0 rounded-lg border border-signal"
              aria-hidden
            />
          </button>
          <a href="#inicio" className="font-display text-[15px] font-semibold tracking-tight text-paper">
            Tryggport <span className="text-signal">Dev</span>
          </a>
        </div>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => mode === "terminal" && setMode("visual")}
                className="rounded-md px-3 py-2 text-sm text-steel transition hover:bg-white/5 hover:text-paper"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div role="group" aria-label="Modo de navegação" className="relative flex rounded-full border border-[color:var(--color-line)] bg-ink-2 p-1 font-mono text-[11px] uppercase tracking-[0.16em]">
          {(["visual", "terminal"] as const).map((m) => {
            const active = (mode === "boot" ? "terminal" : mode) === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(m)}
                className={`relative z-10 rounded-full px-3 py-1.5 transition-colors ${active ? "text-ink" : "text-steel hover:text-paper"}`}
              >
                {active && (
                  <motion.span layoutId="mode-pill" className="absolute inset-0 -z-10 rounded-full bg-signal" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                {m}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
