import { site } from "@/content/site";
import { projects } from "@/content/projects";
import { media } from "@/content/media";
import { Terminal } from "@/components/terminal/Terminal";
import { MarkReveal } from "@/components/brand/MarkReveal";
import { HeroScene } from "@/components/hero/HeroScene";
import { HeroGlyphs, HeroIndicator } from "@/components/hero/HeroClues";
import { CinematicVideo } from "@/components/media/CinematicVideo";
import { OpenTerminalButton } from "./OpenTerminalButton";

export function Hero() {
  return (
    // Sem `isolate`/transform aqui: o terminal em tela cheia (position: fixed, z-50)
    // precisa ficar acima da navegação, fora de qualquer contexto de empilhamento.
    <section id="inicio" aria-labelledby="hero-title" className="noise relative flex min-h-[100svh] flex-col overflow-hidden pt-24 sm:pt-28">
      {/* camadas cinematográficas: vídeo (quando configurado) + cena nativa + luz */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <CinematicVideo asset={media.hero} className="absolute inset-0 h-full w-full opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_72%_42%,rgba(54,217,154,0.16),transparent_70%)]" />
        {/* com o vídeo ativo (desktop), a cena em canvas vira só um véu de linhas por cima */}
        <HeroScene className={`absolute inset-0 ${media.hero ? "md:opacity-55" : ""}`} />
        <div className="grid-bg absolute inset-0" />
        <div className="vignette absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-4 pb-16 sm:px-8 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <div data-reveal className="flex flex-wrap items-center gap-3">
            <HeroIndicator />
          </div>

          <div data-reveal style={{ ["--reveal-delay" as string]: 60 }} className="mt-10 flex items-end gap-5">
            <span className="relative grid place-items-center">
              {/* filamentos de luz (vídeo) emoldurando a marca vetorial fiel ao logotipo */}
              <span className="pointer-events-none absolute left-1/2 top-1/2 h-[9.5rem] w-[17rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden opacity-70 mix-blend-screen [mask-image:radial-gradient(closest-side,black_35%,transparent)]" aria-hidden>
                <CinematicVideo asset={media.logoReveal} className="h-full w-full" />
              </span>
              <MarkReveal className="relative h-16 w-auto sm:h-20" />
            </span>
            <span className="mb-1 font-mono text-[11px] uppercase leading-relaxed tracking-[0.32em] text-steel">
              desenvolvimento
              <br />
              <span className="text-signal">&amp; experiências digitais</span>
            </span>
          </div>

          <h1 id="hero-title" className="hero-rise mt-8 font-display font-semibold uppercase leading-[0.86] tracking-[-0.045em]">
            <span className="text-gradient block text-[clamp(2.9rem,7.4vw,6.6rem)]">Tryggport</span>
            <span className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="text-outline text-[clamp(2.9rem,7.4vw,6.6rem)]">Dev</span>
              <span className="font-mono text-[clamp(0.75rem,1.3vw,0.95rem)] font-normal normal-case tracking-[0.3em] text-steel">— PORTFÓLIO</span>
            </span>
          </h1>

          <p className="hero-rise mt-8 max-w-xl text-lg leading-relaxed text-paper/80 sm:text-xl">
            {site.shortDescription}
          </p>

          <div data-reveal style={{ ["--reveal-delay" as string]: 300 }} className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#projetos"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-signal px-7 py-3.5 text-sm font-semibold text-ink shadow-[0_0_40px_-10px_rgba(54,217,154,0.8)] transition duration-500 hover:shadow-[0_0_60px_-6px_rgba(54,217,154,0.95)]"
            >
              <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.45),transparent)] transition duration-700 group-hover:translate-x-full" aria-hidden />
              Explorar projetos
              <span aria-hidden className="transition duration-300 group-hover:translate-y-0.5">
                ↓
              </span>
            </a>
            <OpenTerminalButton />
          </div>

          <HeroGlyphs />
        </div>

        <div className="relative lg:col-span-5">
          <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(112,224,177,0.14),transparent)] blur-2xl" aria-hidden />
          <Terminal />
          <p className="mt-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.2em] text-steel">
            <span>console interativo</span>
            <span>
              digite <kbd className="rounded border border-[color:var(--color-line)] px-1.5 py-0.5 text-signal">help</kbd>
            </span>
          </p>
        </div>
      </div>

      <dl className="relative mx-auto grid w-full max-w-7xl grid-cols-2 gap-6 border-t border-[color:var(--color-line)] px-4 py-6 font-mono text-[11px] uppercase tracking-[0.2em] text-steel sm:grid-cols-4 sm:px-8">
        <div>
          <dt>projetos</dt>
          <dd className="mt-1 text-base normal-case tracking-normal text-paper">{String(projects.length).padStart(2, "0")} publicados</dd>
        </div>
        <div>
          <dt>sessão</dt>
          <dd className="mt-1 text-base normal-case tracking-normal text-paper">anônima</dd>
        </div>
        <div>
          <dt>segurança</dt>
          <dd className="mt-1 text-base normal-case tracking-normal text-paper">por padrão</dd>
        </div>
        <div>
          <dt>memória</dt>
          <dd className="mt-1 text-base normal-case tracking-normal text-[#e8c46d]">99.7% verificada</dd>
        </div>
      </dl>
    </section>
  );
}
