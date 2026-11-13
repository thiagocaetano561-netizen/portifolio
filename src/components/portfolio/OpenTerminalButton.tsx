"use client";

import { useExperience } from "@/components/experience/ExperienceProvider";

export function OpenTerminalButton({ command, children, className }: { command?: string; children?: React.ReactNode; className?: string }) {
  const { setMode, runInTerminal } = useExperience();
  return (
    <button
      type="button"
      onClick={() => (command ? runInTerminal(command) : setMode("terminal"))}
      className={
        className ??
        "group inline-flex items-center gap-3 rounded-full border border-[color:var(--color-line)] px-6 py-3 font-mono text-sm text-paper transition hover:border-signal/60 hover:bg-signal/5"
      }
    >
      {children ?? (
        <>
          <span className="text-signal" aria-hidden>
            &gt;_
          </span>
          Abrir terminal
        </>
      )}
    </button>
  );
}
