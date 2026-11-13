"use client";

import { useEffect } from "react";
import { useExperience } from "./ExperienceProvider";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Revelação no scroll, sequência de teclas clássica e a mensagem do console. */
export function GlobalEffects() {
  const { signal } = useExperience();

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = key === KONAMI[pos] ? pos + 1 : key === KONAMI[0] ? 1 : 0;
      if (pos === KONAMI.length) {
        pos = 0;
        signal("konami");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signal]);

  useEffect(() => {
    const w = window as unknown as { __tpConsole?: boolean };
    if (w.__tpConsole) return;
    w.__tpConsole = true;
    console.log(
      "%c▲ TRYGGPORT DEV\n%cvocê abriu o console. curioso, hein?\nnão há segredos no navegador — eles moram no servidor.\nmas experimente digitar `inspect` no terminal.",
      "color:#70E0B1;font:700 14px monospace",
      "color:#87958E;font:12px monospace",
    );
  }, []);

  return null;
}
