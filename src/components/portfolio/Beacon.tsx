"use client";

import { useExperience } from "@/components/experience/ExperienceProvider";

export type BeaconShape = "triangle" | "square" | "circle" | "diamond";

const SHAPE_NAME: Record<BeaconShape, string> = {
  triangle: "triângulo",
  square: "quadrado",
  circle: "círculo",
  diamond: "losango",
};

function ShapeIcon({ shape }: { shape: BeaconShape }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.4 } as const;
  return (
    <svg viewBox="0 0 12 12" className="beacon-shape h-3 w-3 text-signal/70" aria-hidden>
      {shape === "triangle" && <path d="M6 1.5 10.8 10H1.2Z" {...common} />}
      {shape === "square" && <rect x="2" y="2" width="8" height="8" {...common} />}
      {shape === "circle" && <circle cx="6" cy="6" r="4.2" {...common} />}
      {shape === "diamond" && <path d="M6 1 11 6 6 11 1 6Z" {...common} />}
    </svg>
  );
}

/**
 * Sinal luminoso discreto ao lado do título de uma seção. É uma pista pública
 * e inerte: o significado (se houver) só existe no servidor. Contagem e forma
 * também estão em texto acessível — nunca dependem só de cor ou de movimento.
 */
export function Beacon({ count, shape, offset = 0 }: { count: number; shape: BeaconShape; offset?: number }) {
  const { ui } = useExperience();
  const aligned = Boolean(ui["beacons.state"]);
  const label = `sinal luminoso: ${count} ${count === 1 ? "lampejo" : "lampejos"}, forma de ${SHAPE_NAME[shape]}${aligned ? ", aceso" : ""}`;
  return (
    <span
      className="beacon inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-line)] px-2 py-1"
      data-aligned={aligned ? "" : undefined}
      role="img"
      aria-label={label}
      title={label}
    >
      <ShapeIcon shape={shape} />
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="beacon-dot" style={{ ["--i" as string]: i, ["--offset" as string]: `${offset}s` }} />
        ))}
      </span>
    </span>
  );
}
