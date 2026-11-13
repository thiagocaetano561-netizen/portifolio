"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "@/content/media";

/**
 * Vídeo decorativo controlado pela aplicação: só baixa quando visível, não
 * toca com movimento reduzido, economia de dados ou (por padrão) no celular,
 * pausa fora da tela e cai para o poster em caso de falha.
 */
export function CinematicVideo({ asset, className = "" }: { asset: MediaAsset | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"poster" | "video">("poster");

  useEffect(() => {
    if (!asset || (!asset.webm && !asset.mp4)) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const small = window.matchMedia("(max-width: 767px)").matches;
    if (reduced || conn?.saveData || (small && !asset.allowMobile)) return;
    setMode("video");
  }, [asset]);

  useEffect(() => {
    const v = ref.current;
    if (!v || mode !== "video") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && document.visibilityState === "visible") void v.play().catch(() => setMode("poster"));
        else v.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    const onVis = () => (document.visibilityState === "visible" ? undefined : v.pause());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode]);

  if (!asset) return null;
  if (mode === "poster") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.poster} alt="" aria-hidden className={`object-cover ${className}`} decoding="async" loading="lazy" fetchPriority="low" />;
  }
  return (
    <video
      ref={ref}
      className={`object-cover ${className}`}
      poster={asset.poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      onError={() => setMode("poster")}
    >
      {asset.webm && <source src={asset.webm} type="video/webm" />}
      {asset.mp4 && <source src={asset.mp4} type="video/mp4" />}
    </video>
  );
}
