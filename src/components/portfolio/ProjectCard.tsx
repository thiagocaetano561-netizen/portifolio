"use client";

import Image from "next/image";
import { useId, useRef, useState, type PointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { projectLinkIsLive, type Project } from "@/content/projects";
import { OpenTerminalButton } from "./OpenTerminalButton";
import { projectAmbience } from "@/content/media";
import { CinematicVideo } from "@/components/media/CinematicVideo";

const STATUS: Record<Project["linkStatus"], { label: string; dot: string }> = {
  online: { label: "no ar", dot: "bg-signal-bright" },
  unavailable: { label: "indisponível", dot: "bg-alert" },
  pending: { label: "em breve", dot: "bg-[#e8c46d]" },
};

function formatDate(iso: string) {
  return iso.split("-").reverse().join("/");
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const reversed = index % 2 === 1;
  const live = projectLinkIsLive(project);
  const status = STATUS[project.linkStatus];
  const ambient = projectAmbience[project.slug];

  // profundidade sutil: inclinação conforme o ponteiro (desativada com movimento reduzido via MotionConfig)
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-5, 5]), { stiffness: 120, damping: 18 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = frame.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    px.set(x - 0.5);
    py.set(y - 0.5);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const onLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <article className="group grid items-center gap-10 lg:grid-cols-12 lg:gap-14" aria-labelledby={`${detailsId}-title`}>
      <div data-reveal className={`lg:col-span-7 ${reversed ? "lg:order-2" : ""}`} style={{ perspective: 1400 }}>
        <motion.div ref={frame} onPointerMove={onMove} onPointerLeave={onLeave} style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="corner-ticks">
          {ambient && (
            // luz ambiente conceitual atrás da captura real. O vídeo já vem desfocado do
            // encode (sem filtro CSS sobre vídeo em reprodução, que custa caro a cada quadro).
            <div className="pointer-events-none absolute -inset-10 -z-10 overflow-hidden rounded-[2.5rem] opacity-45 transition-opacity duration-700 [mask-image:radial-gradient(closest-side,black_55%,transparent)] group-hover:opacity-75" aria-hidden>
              <CinematicVideo asset={ambient} className="h-full w-full" />
            </div>
          )}
          <div className="light-follow relative overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-ink-2 shadow-[0_50px_120px_-60px_rgba(0,0,0,1)]">
            {/* barra de janela: deixa claro que é a aplicação real */}
            <div className="flex items-center gap-3 border-b border-white/5 bg-ink/80 px-4 py-2.5 font-mono text-[11px] text-steel">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
              </span>
              <span className="truncate">{project.publicUrl?.replace(/^https:\/\//, "").replace(/\/$/, "") ?? project.slug}</span>
            </div>
            <div className="relative aspect-[16/10]">
              {project.video && (project.video.webm || project.video.mp4) ? (
                <video className="absolute inset-0 h-full w-full object-cover" poster={project.cover.src} muted loop playsInline autoPlay preload="none" aria-hidden>
                  {project.video.webm && <source src={project.video.webm} type="video/webm" />}
                  {project.video.mp4 && <source src={project.video.mp4} type="video/mp4" />}
                </video>
              ) : (
                <Image
                  src={project.cover.src}
                  alt={project.cover.alt}
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover transition duration-[1.6s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                />
              )}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 transition duration-700 group-hover:opacity-100"
                style={{ background: `radial-gradient(70% 60% at 50% 100%, ${project.accent}26, transparent)` }}
                aria-hidden
              />
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-steel" style={{ transform: "translateZ(30px)" }}>
            <span className="h-px w-6 bg-[color:var(--color-line-strong)]" aria-hidden />
            {project.cover.kind === "capture" && project.cover.capturedAt ? `captura real · ${formatDate(project.cover.capturedAt)}` : "ilustração conceitual"}
            {ambient && <span className="normal-case tracking-normal text-steel/80">· luz ao fundo: animação conceitual</span>}
          </p>
        </motion.div>
      </div>

      <div data-reveal style={{ ["--reveal-delay" as string]: 120 }} className={`lg:col-span-5 ${reversed ? "lg:order-1" : ""}`}>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.24em] text-steel">
          <span className="text-5xl font-light tracking-tight text-[#4f6b60]">{String(index + 1).padStart(2, "0")}</span>
          <span className="flex flex-col gap-1">
            <span>{project.kind}</span>
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
              {status.label}
            </span>
          </span>
        </div>
        <h3 id={`${detailsId}-title`} className="mt-5 font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[2.6rem]">
          {project.name}
        </h3>
        <p className="mt-4 text-lg text-paper/80">{project.tagline}</p>
        <p className="mt-4 text-[15px] leading-relaxed text-paper/60">{project.description[0]}</p>

        <ul className="mt-6 grid gap-x-6 gap-y-2 border-t border-[color:var(--color-line)] pt-5 text-sm text-paper/75 sm:grid-cols-2" aria-label="Destaques verificados">
          {project.highlights.slice(0, open ? undefined : 4).map((h) => (
            <li key={h} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-signal" aria-hidden />
              {h}
            </li>
          ))}
        </ul>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={detailsId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-6 space-y-3 border-l border-signal/30 pl-5 text-[15px] leading-relaxed text-paper/75">
                {project.description.slice(1).map((d) => (
                  <p key={d}>{d}</p>
                ))}
                <p className="font-mono text-xs text-steel">
                  tecnologias: {project.technologies.length ? project.technologies.join(" · ") : "a confirmar pelo autor"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {live ? (
            <a
              href={project.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group/btn inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition duration-300 hover:bg-signal"
            >
              Visitar projeto <span aria-hidden className="transition duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5">↗</span>
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-dashed border-[color:var(--color-line)] px-5 py-2.5 text-sm text-steel" aria-disabled="true">
              {project.linkNote ?? "Endereço indisponível"}
            </span>
          )}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-line)] px-5 py-2.5 text-sm text-paper transition hover:border-signal/60"
          >
            {open ? "Menos detalhes" : "Detalhes"}
            <motion.span animate={{ rotate: open ? 45 : 0 }} aria-hidden>
              +
            </motion.span>
          </button>
          <OpenTerminalButton
            command={`project ${project.slug}`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2.5 font-mono text-xs text-steel transition hover:text-signal"
          >
            &gt;_ project {project.slug}
          </OpenTerminalButton>
        </div>
      </div>
    </article>
  );
}
