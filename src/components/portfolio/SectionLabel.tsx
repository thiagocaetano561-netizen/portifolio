import { Beacon, type BeaconShape } from "./Beacon";

export function SectionLabel({ index, label, beacon }: { index: string; label: string; beacon?: { count: number; shape: BeaconShape; offset?: number } }) {
  return (
    <div data-reveal className="flex items-center gap-4 font-mono text-xs uppercase tracking-[0.28em] text-steel">
      <span className="text-signal">{index}</span>
      <span className="h-px w-12 bg-[color:var(--color-line)]" aria-hidden />
      <span>{label}</span>
      {beacon && <Beacon {...beacon} />}
    </div>
  );
}
