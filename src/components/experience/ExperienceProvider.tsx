"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import type { Line, SignalKind, TerminalEvent, UiStateResponse } from "@/lib/terminal/protocol";
import { fetchUi, hasActiveSession, sendSignal } from "@/lib/terminal/client";

export type Mode = "visual" | "terminal" | "boot";
export type TermTheme = "green" | "amber" | "ice";

export interface Toast {
  id: number;
  title: string;
  lines: Line[];
  tone: "signal" | "achievement" | "chapter";
}

interface ExperienceValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  theme: TermTheme;
  queued: { id: number; command: string } | null;
  runInTerminal: (command: string) => void;
  consumeQueued: () => void;
  applyEvents: (events: TerminalEvent[] | undefined) => void;
  signal: (kind: SignalKind) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  glitch: "low" | "high" | null;
  progressPulse: number;
  /** Pistas da interface autorizadas pelo servidor para esta sessão. */
  ui: UiStateResponse["slots"];
  refreshUi: () => void;
  scene: { title?: string; id: number } | null;
  closeScene: () => void;
}

const Ctx = createContext<ExperienceValue | null>(null);

export function useExperience() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ExperienceProvider ausente");
  return v;
}

function readTheme(): TermTheme {
  try {
    const t = localStorage.getItem("tp_term_theme");
    if (t === "amber" || t === "ice" || t === "green") return t;
  } catch {
    /* armazenamento indisponível */
  }
  return "green";
}

export function ExperienceProvider({ children, initialMode }: { children: ReactNode; initialMode: "visual" | "terminal" }) {
  const [mode, setModeState] = useState<Mode>(initialMode);
  const [theme, setTheme] = useState<TermTheme>("green");
  const [queued, setQueued] = useState<{ id: number; command: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [glitch, setGlitch] = useState<"low" | "high" | null>(null);
  const [progressPulse, setProgressPulse] = useState(0);
  const [ui, setUi] = useState<UiStateResponse["slots"]>({});
  const [scene, setScene] = useState<{ title?: string; id: number } | null>(null);
  const seq = useRef(0);
  const glitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setTheme(readTheme()), []);

  const refreshUi = useCallback(() => {
    fetchUi()
      .then((r) => setUi(r.slots ?? {}))
      .catch(() => undefined);
  }, []);

  // Só consulta o estado visual de quem já interagiu (evita criar tráfego para visitantes casuais).
  useEffect(() => {
    if (hasActiveSession()) refreshUi();
  }, [refreshUi]);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    if (m !== "boot") {
      const url = m === "terminal" ? "/terminal" : "/";
      if (window.location.pathname !== url && (window.location.pathname === "/" || window.location.pathname === "/terminal")) {
        window.history.replaceState(null, "", url + window.location.hash);
      }
    }
  }, []);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((prev) => [...prev.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 7000);
  }, []);

  const applyEvents = useCallback(
    (events: TerminalEvent[] | undefined) => {
      if (!events) return;
      for (const e of events) {
        if (e.type === "glitch") {
          setGlitch(e.intensity ?? "low");
          if (glitchTimer.current) clearTimeout(glitchTimer.current);
          glitchTimer.current = setTimeout(() => setGlitch(null), e.intensity === "high" ? 1900 : 500);
        } else if (e.type === "theme") {
          setTheme(e.value);
          try {
            localStorage.setItem("tp_term_theme", e.value);
          } catch {
            /* ignore */
          }
        } else if (e.type === "achievement") {
          pushToast({ title: "Conquista desbloqueada", lines: [{ k: "accent", t: e.title }], tone: "achievement" });
        } else if (e.type === "chapter" || e.type === "ending") {
          setProgressPulse((n) => n + 1);
          pushToast({ title: e.type === "ending" ? "Fim" : "Novo capítulo", lines: [{ k: "accent", t: e.title }], tone: "chapter" });
        } else if (e.type === "discovery") {
          setProgressPulse((n) => n + 1);
          pushToast({ title: "Descoberta", lines: [{ k: "accent", t: e.title }], tone: "achievement" });
        } else if (e.type === "scene") {
          setScene({ title: e.title, id: ++seq.current });
        } else if (e.type === "ui") {
          refreshUi();
        }
      }
    },
    [pushToast, refreshUi],
  );

  const signal = useCallback(
    (kind: SignalKind) => {
      sendSignal(kind)
        .then((res) => {
          if (res.lines.length) pushToast({ title: "sinal", lines: res.lines, tone: "signal" });
          applyEvents(res.events);
        })
        .catch(() => undefined);
    },
    [applyEvents, pushToast],
  );

  const runInTerminal = useCallback(
    (command: string) => {
      setMode("terminal");
      setQueued({ id: ++seq.current, command });
    },
    [setMode],
  );

  const value = useMemo<ExperienceValue>(
    () => ({
      mode,
      setMode,
      theme,
      queued,
      runInTerminal,
      consumeQueued: () => setQueued(null),
      applyEvents,
      signal,
      toasts,
      dismissToast: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
      glitch,
      progressPulse,
      ui,
      refreshUi,
      scene,
      closeScene: () => setScene(null),
    }),
    [mode, setMode, theme, queued, runInTerminal, applyEvents, signal, toasts, glitch, progressPulse, ui, refreshUi, scene],
  );

  return (
    <MotionConfig reducedMotion="user">
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </MotionConfig>
  );
}
