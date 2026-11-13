import Image from "next/image";
import { LostSignal } from "./lost-signal";

export default function NotFound() {
  return (
    <main className="noise relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="beam" aria-hidden />
      <div className="relative max-w-lg text-center">
        <Image src="/brand/mark.png" alt="" width={56} height={58} className="mx-auto opacity-80" />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-signal">erro 404</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Porta não encontrada.</h1>
        <p className="mt-4 text-paper/65">Nenhuma luz alcança este caminho. Talvez ele nunca tenha existido — ou ainda não foi aberto.</p>
        <a href="/" className="mt-10 inline-flex items-center gap-2 rounded-full bg-signal px-6 py-3 text-sm font-semibold text-ink">
          ← Voltar ao início
        </a>
      </div>
      <LostSignal />
    </main>
  );
}
