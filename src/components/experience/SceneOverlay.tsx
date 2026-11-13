"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { media } from "@/content/media";
import { CinematicVideo } from "@/components/media/CinematicVideo";
import { HeroScene } from "@/components/hero/HeroScene";
import { useExperience } from "./ExperienceProvider";

/**
 * Cena narrativa "ambiente desconhecido", disparada só por eventos autorizados
 * pelo servidor. Não contém pistas essenciais; pode ser fechada a qualquer momento.
 */
export function SceneOverlay() {
  const { scene, closeScene } = useExperience();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scene) return;
    const t = setTimeout(closeScene, 9000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeScene();
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [scene, closeScene]);

  return (
    <AnimatePresence>
      {scene && (
        <motion.div
          key={scene.id}
          role="dialog"
          aria-modal="true"
          aria-label={scene.title ?? "Evento"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
          className="dvh-screen fixed inset-0 z-[70] overflow-hidden bg-[#05070a]"
        >
          <div className="absolute inset-0">
            <CinematicVideo asset={media.void} className="absolute inset-0 h-full w-full opacity-70" />
            <HeroScene variant="void" className="absolute inset-0" />
            <div className="vignette absolute inset-0" />
          </div>
          <div className="relative grid h-full place-items-center px-6 text-center">
            <motion.div initial={{ opacity: 0, y: 12, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.8, duration: 1.4 }}>
              <p className="font-mono text-xs uppercase tracking-[0.4em] text-[#cbbcff]/80">evento</p>
              <p className="mt-4 font-display text-4xl font-semibold tracking-tight text-paper sm:text-6xl">{scene.title ?? "..."}</p>
            </motion.div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeScene}
            className="absolute right-4 top-4 rounded-full border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-paper/80 transition hover:bg-white/5"
          >
            continuar · esc
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
