"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useExperience } from "@/components/experience/ExperienceProvider";
import { ApiError, sendCommand } from "@/lib/terminal/client";
import { allowedLinkSet, offlineResponse } from "@/lib/terminal/offline";
import { MAX_INPUT_LENGTH, type Line, type Prompt } from "@/lib/terminal/protocol";
import { PUBLIC_COMMANDS } from "@/lib/terminal/public-commands";
import { projects } from "@/content/projects";
import { isAllowedExternalHref } from "@/content/site";
import { MARK_PATH, MARK_VIEWBOX } from "@/components/brand/mark-geometry";
import { CinematicVideo } from "@/components/media/CinematicVideo";
import { media } from "@/content/media";

type Banner = { title: string; tone: "chapter" | "ending" | "file" | "connection" | "memory" };
type ScreenLine = Line & { id: number; cmd?: boolean; prompt?: string; d?: number; fresh?: boolean; banner?: Banner };

/** Digitação animada para falas narrativas recém-chegadas (instantânea com movimento reduzido). */
function TypedText({ text, delay }: { text: string; delay: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    const step = Math.max(1, Math.ceil(text.length / 60));
    let i = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        i += step;
        setN(Math.min(text.length, i));
        if (i >= text.length && timer) clearInterval(timer);
      }, 16);
    }, delay);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [text, delay]);
  return (
    <>
      <span>{text.slice(0, n)}</span>
      <span className="sr-only">{text.slice(n)}</span>
    </>
  );
}

const QUICK = ["help", "projects", "ls", "hint", "clear"];

const BOOT_LINES: Array<{ line: Line; delay: number }> = [
  { line: { k: "accent", t: "TRYGGPORT DEV" }, delay: 120 },
  { line: { k: "dim", t: "DEVELOPMENT ENVIRONMENT" }, delay: 160 },
  { line: { k: "out", t: "" }, delay: 120 },
  { line: { k: "out", t: "Initializing system..." }, delay: 380 },
  { line: { k: "out", t: "Loading portfolio............ OK" }, delay: 230 },
  { line: { k: "out", t: "Loading projects............. OK" }, delay: 210 },
  { line: { k: "out", t: "Checking dependencies........ OK" }, delay: 210 },
  { line: { k: "out", t: "Establishing session......... OK" }, delay: 260 },
  { line: { k: "warn", t: "Memory verification.......... WARNING" }, delay: 620 },
  { line: { k: "out", t: "" }, delay: 120 },
  { line: { k: "err", t: "1 UNIDENTIFIED ARCHIVE DETECTED" }, delay: 520 },
  { line: { k: "out", t: "" }, delay: 160 },
  { line: { k: "out", t: "Welcome to Tryggport Dev." }, delay: 260 },
  { line: { k: "dim", t: "Type 'help' to explore the system." }, delay: 200 },
];

const MAX_LINES = 400;
const LOCAL_COMMANDS = new Set(["clear", "visual", "cls"]);
const PROMPT_DEFAULT: Prompt = { user: "visitor", host: "tryggport", cwd: "~" };

function promptText(p: Prompt) {
  return `${p.user}@${p.host}:${p.cwd}$`;
}

function readHistory(): string[] {
  try {
    const raw = sessionStorage.getItem("tp_hist");
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(-100) : [];
  } catch {
    return [];
  }
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Terminal() {
  const { mode, setMode, theme, queued, consumeQueued, applyEvents, glitch, signal } = useExperience();
  const fullscreen = mode === "terminal" || mode === "boot";
  const [lines, setLines] = useState<ScreenLine[]>([]);
  const [input, setInput] = useState("");
  const [prompt, setPrompt] = useState<Prompt>(PROMPT_DEFAULT);
  const [pending, setPending] = useState(false);
  const [booting, setBooting] = useState(false);
  const [completions, setCompletions] = useState<string[]>([]);
  const [entries, setEntries] = useState<string[]>([]);
  const history = useRef<string[]>([]);
  const histIdx = useRef<number>(-1);
  const idSeq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const bootAbort = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usedOnce = useRef(false);
  const links = useMemo(() => allowedLinkSet(), []);

  const append = useCallback((items: Array<Line & { cmd?: boolean; prompt?: string; banner?: Banner }>, animate = false) => {
    setLines((prev) =>
      [
        ...prev.map((l) => (l.fresh ? { ...l, fresh: false } : l)),
        ...items.map((l, i) => ({ ...l, id: ++idSeq.current, d: animate ? i : 0, fresh: animate })),
      ].slice(-MAX_LINES),
    );
  }, []);

  /* --------------------------- inicialização --------------------------- */
  const initDone = useRef(false);
  useEffect(() => {
    // Em desenvolvimento o StrictMode executa efeitos duas vezes: o boot só pode rodar uma vez.
    if (initDone.current) return;
    initDone.current = true;
    history.current = readHistory();
    let firstVisit = false;
    try {
      firstVisit = localStorage.getItem("tp_boot") !== "1";
    } catch {
      firstVisit = false;
    }
    document.documentElement.classList.add("boot-ready");
    if (firstVisit && mode === "visual" && !window.location.hash) {
      setMode("boot");
      setBooting(true);
      bootAbort.current = false;
      const reduced = prefersReducedMotion();
      (async () => {
        for (const step of BOOT_LINES) {
          if (bootAbort.current) break;
          if (!reduced) await new Promise((r) => setTimeout(r, step.delay));
          if (bootAbort.current) break;
          append([step.line]);
        }
        if (!bootAbort.current) {
          await new Promise((r) => setTimeout(r, reduced ? 300 : 900));
          finishBoot(false);
        }
      })();
    } else {
      append(BOOT_LINES.map((b) => b.line));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishBoot = useCallback(
    (skipped: boolean) => {
      if (bootAbort.current && !skipped) return;
      bootAbort.current = true;
      try {
        localStorage.setItem("tp_boot", "1");
      } catch {
        /* ignore */
      }
      setLines((prev) => {
        if (!skipped) return prev;
        idSeq.current += BOOT_LINES.length;
        return BOOT_LINES.map((b, i) => ({ ...b.line, id: idSeq.current - BOOT_LINES.length + i + 1 }));
      });
      setBooting(false);
      setMode("visual");
    },
    [setMode],
  );

  useEffect(() => {
    if (!booting) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        finishBoot(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booting, finishBoot]);

  /* ------------------------------ rolagem ------------------------------ */
  useEffect(() => {
    const el = screenRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, pending]);

  /* ------------------------ tela cheia e teclado ------------------------ */
  useEffect(() => {
    if (mode !== "terminal") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [mode]);

  /* --------------------------- silêncio (idle) -------------------------- */
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!usedOnce.current) return;
    idleTimer.current = setTimeout(() => {
      if (document.visibilityState === "visible" && document.activeElement === inputRef.current) signal("idle");
    }, 77_000);
  }, [signal]);
  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  /* ------------------------------ execução ------------------------------ */
  const execute = useCallback(
    async (raw: string) => {
      const value = raw.slice(0, MAX_INPUT_LENGTH);
      append([{ k: "out", t: value, cmd: true, prompt: promptText(prompt) }]);
      const trimmed = value.trim();
      if (!trimmed) return;

      if (history.current[history.current.length - 1] !== trimmed) history.current.push(trimmed);
      history.current = history.current.slice(-100);
      histIdx.current = -1;
      try {
        sessionStorage.setItem("tp_hist", JSON.stringify(history.current));
      } catch {
        /* ignore */
      }

      const [first = "", ...rest] = trimmed.split(/\s+/);
      const command = first.toLowerCase();
      if (LOCAL_COMMANDS.has(command)) {
        if (command === "visual") setMode("visual");
        else setLines([]);
        return;
      }

      setPending(true);
      usedOnce.current = true;
      try {
        const res = await sendCommand(trimmed);
        if (res.events?.some((e) => e.type === "clear")) setLines([]);
        const banners: Array<Line & { banner: Banner }> = [];
        for (const e of res.events ?? []) {
          if (e.type === "chapter") banners.push({ k: "accent", t: e.title, banner: { title: e.title, tone: "chapter" } });
          else if (e.type === "ending") banners.push({ k: "accent", t: e.title, banner: { title: e.title, tone: "ending" } });
          else if (e.type === "discovery") banners.push({ k: "accent", t: e.title, banner: { title: e.title, tone: e.tone ?? "file" } });
        }
        append([...res.lines, ...banners], true);
        setPrompt(res.prompt);
        if (res.completions) setCompletions(res.completions);
        if (res.entries) setEntries(res.entries);
        applyEvents(res.events);
      } catch (err) {
        if (err instanceof ApiError && err.status !== 0 && err.status < 500) {
          append([{ k: "err", t: err.message }]);
        } else {
          const fallback = offlineResponse(command, rest);
          append(
            fallback
              ? [...fallback, { k: "dim", t: "(servidor indisponível — resposta local)" }]
              : [{ k: "err", t: "conexão com o servidor falhou. tente novamente em instantes." }],
          );
        }
      } finally {
        setPending(false);
        armIdle();
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    },
    [append, applyEvents, armIdle, prompt, setMode],
  );

  useEffect(() => {
    if (!queued || pending || booting) return;
    consumeQueued();
    void execute(queued.command);
  }, [queued, pending, booting, consumeQueued, execute]);

  /* --------------------------- autocompletar --------------------------- */
  const complete = useCallback(() => {
    const parts = input.split(" ");
    if (parts.length === 1) {
      const pool = [...new Set([...PUBLIC_COMMANDS.map((c) => c.name), ...completions])];
      const matches = pool.filter((c) => c.startsWith(parts[0]!.toLowerCase())).sort();
      if (matches.length === 1) setInput(matches[0] + " ");
      else if (matches.length > 1) append([{ k: "out", t: input, cmd: true, prompt: promptText(prompt) }, { k: "dim", t: matches.join("   ") }]);
      return;
    }
    const cmd = parts[0]!.toLowerCase();
    const last = parts[parts.length - 1]!;
    const slash = last.lastIndexOf("/");
    const head = slash >= 0 ? last.slice(0, slash + 1) : "";
    const tail = slash >= 0 ? last.slice(slash + 1) : last;
    const pool = cmd === "project" ? projects.map((p) => p.slug) : cmd === "man" ? PUBLIC_COMMANDS.map((c) => c.name) : slash >= 0 ? [] : entries;
    const matches = pool.filter((e) => e.startsWith(tail));
    if (matches.length === 1) setInput([...parts.slice(0, -1), head + matches[0]].join(" "));
    else if (matches.length > 1) append([{ k: "out", t: input, cmd: true, prompt: promptText(prompt) }, { k: "dim", t: matches.join("   ") }]);
  }, [append, completions, entries, input, prompt]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    armIdle();
    if (e.key === "Enter") {
      e.preventDefault();
      if (pending) return;
      const v = input;
      setInput("");
      void execute(v);
    } else if (e.key === "Tab") {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      histIdx.current = histIdx.current < 0 ? h.length - 1 : Math.max(0, histIdx.current - 1);
      setInput(h[histIdx.current] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      if (histIdx.current < 0) return;
      histIdx.current += 1;
      if (histIdx.current >= h.length) {
        histIdx.current = -1;
        setInput("");
      } else setInput(h[histIdx.current] ?? "");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    } else if (e.key === "c" && e.ctrlKey && !window.getSelection()?.toString()) {
      e.preventDefault();
      append([{ k: "out", t: input + "^C", cmd: true, prompt: promptText(prompt) }]);
      setInput("");
    } else if (e.key === "Escape" && mode === "terminal") {
      e.preventDefault();
      setMode("visual");
    }
  };

  const focusInput = () => {
    if (window.getSelection()?.toString()) return;
    inputRef.current?.focus({ preventScroll: true });
  };

  const renderLine = (l: ScreenLine) => {
    const enter = l.fresh ? "term-enter" : "";
    const style = l.fresh ? ({ ["--d" as string]: l.d ?? 0 } as React.CSSProperties) : undefined;
    if (l.banner) {
      const label = { chapter: "capítulo", ending: "final", file: "arquivo recuperado", connection: "conexão", memory: "memória" }[l.banner.tone];
      return (
        <div key={l.id} className={`term-banner ${enter}`} style={style} data-tone={l.banner.tone === "ending" ? "ending" : l.banner.tone === "memory" ? "memory" : undefined}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--term-dim)]">▓ {label}</div>
          <div className="term-k-accent mt-1 text-base">{l.banner.title}</div>
        </div>
      );
    }
    if (l.cmd) {
      return (
        <div key={l.id} className="term-line mt-1">
          <span className="text-[color:var(--term-fg)]">{l.prompt}</span> <span className="term-k-cmd">{l.t}</span>
        </div>
      );
    }
    if (l.k === "link" && l.href && links.has(l.href) && isAllowedExternalHref(l.href)) {
      return (
        <div key={l.id} className={`term-line ${enter}`} style={style}>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className="term-k-accent underline decoration-dotted underline-offset-4 hover:decoration-solid">
            {l.t}
          </a>
        </div>
      );
    }
    if (l.k === "lys" && l.fresh && l.t) {
      return (
        <div key={l.id} className="term-line term-k-lys">
          <TypedText text={l.t} delay={(l.d ?? 0) * 90} />
        </div>
      );
    }
    return (
      <div key={l.id} className={`term-line term-k-${l.k === "link" ? "out" : l.k} ${enter}`} style={style}>
        {l.t || " "}
      </div>
    );
  };

  return (
    <>
      {/* reserva o espaço no hero enquanto o terminal está em tela cheia */}
      <div className={fullscreen ? "h-[24rem] sm:h-[28rem]" : "hidden"} aria-hidden />
      <motion.section
        layout
        transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.9 }}
        data-term-theme={theme}
        aria-label="Terminal da Tryggport Dev"
        className={[
          "terminal terminal-crt flex flex-col overflow-hidden border border-[color:var(--color-line-strong)] shadow-[0_40px_140px_-50px_rgba(54,217,154,0.45)]",
          fullscreen ? "terminal-fullscreen dvh-screen fixed inset-0 z-50 rounded-none" : "relative h-[24rem] rounded-2xl sm:h-[28rem]",
          glitch ? `glitch-${glitch}` : "",
        ].join(" ")}
        onClick={focusInput}
      >
        <motion.header
          layout="position"
          className="relative z-10 flex items-center justify-between gap-3 border-b border-[color:var(--color-line)] bg-[linear-gradient(180deg,rgba(112,224,177,0.06),transparent)] px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[color:var(--term-dim)]"
        >
          <span className="flex min-w-0 items-center gap-2.5 whitespace-nowrap">
            <svg viewBox={MARK_VIEWBOX} className="h-3.5 w-3.5 shrink-0 text-[color:var(--term-fg)]" aria-hidden>
              <path d={MARK_PATH} fillRule="evenodd" fill="currentColor" />
            </svg>
            <span className="text-[color:var(--term-fg)]">tryggport</span>
            <span className="hidden sm:inline">// console</span>
            <span className="hidden truncate normal-case tracking-normal text-[color:var(--term-dim)] md:inline">· {prompt.cwd}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {booting ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  finishBoot(true);
                }}
                className="rounded border border-[color:var(--color-line)] px-2.5 py-1 tracking-[0.14em] text-[color:var(--term-fg)] transition hover:bg-white/5"
              >
                pular ⏎
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMode(mode === "terminal" ? "visual" : "terminal");
                }}
                className="rounded border border-[color:var(--color-line)] px-2.5 py-1 tracking-[0.14em] transition hover:bg-white/5 hover:text-[color:var(--term-fg)]"
              >
                {mode === "terminal" ? (
                  <>
                    esc · modo visual<span className="sr-only"> (sair do terminal)</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>⤢ </span>tela cheia<span className="sr-only"> (abrir o terminal)</span>
                  </>
                )}
              </button>
            )}
          </span>
        </motion.header>

        <AnimatePresence>
          {booting && (
            // complemento visual da inicialização: o texto continua interativo e por cima
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.32 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              <CinematicVideo asset={media.boot} className="h-full w-full" />
            </motion.div>
          )}
        </AnimatePresence>
        <div
          ref={screenRef}
          className={`terminal-screen thin-scroll relative flex-1 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed sm:text-sm ${fullscreen ? "sm:px-10 sm:py-8" : ""}`}
        >
          <div role="log" aria-live="polite" aria-relevant="additions" className={fullscreen ? "mx-auto max-w-4xl" : ""}>
            {lines.map(renderLine)}
          </div>
          {!booting && (
            <div className={`term-line flex items-center gap-2 ${fullscreen ? "mx-auto max-w-4xl" : ""}`}>
              <label htmlFor="term-input" className="shrink-0 text-[color:var(--term-fg)]">
                {promptText(prompt)}
              </label>
              <span className="flex flex-1 items-center">
                <input
                  id="term-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                  onKeyDown={onKeyDown}
                  maxLength={MAX_INPUT_LENGTH}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  aria-label="Comando do terminal"
                  aria-describedby="term-hint"
                  className="term-input"
                  readOnly={pending}
                />
              </span>
            </div>
          )}
          <AnimatePresence>
            {pending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="term-line term-k-dim">
                ···
              </motion.div>
            )}
          </AnimatePresence>
          <p id="term-hint" className="sr-only">
            Digite um comando e pressione Enter. Use help para ver os comandos. Tab completa, setas navegam pelo histórico.
          </p>
        </div>
        {!booting && (
          <nav aria-label="Comandos rápidos" className="relative z-10 flex gap-2 overflow-x-auto border-t border-[color:var(--color-line)] px-3 py-2 sm:hidden">
            {QUICK.map((c) => (
              <button
                key={c}
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  void execute(c);
                }}
                className="shrink-0 rounded-full border border-[color:var(--color-line)] px-3 py-1.5 text-xs text-[color:var(--term-fg)] active:bg-white/10"
              >
                {c}
              </button>
            ))}
          </nav>
        )}
      </motion.section>
    </>
  );
}
