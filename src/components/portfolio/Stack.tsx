import { site } from "@/content/site";
import { SectionLabel } from "./SectionLabel";

export function Stack() {
  const techs = site.technologies;
  return (
    <section id="stack" aria-labelledby="stack-title" className="relative py-24 sm:py-32">
      <div className="hairline absolute inset-x-0 top-0" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionLabel index="03" label="Stack" beacon={{ count: 1, shape: "circle", offset: 2.1 }} />
          <h2 id="stack-title" data-reveal className="mt-6 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
            O que roda
            <br />
            por baixo.
          </h2>
          <p data-reveal className="mt-6 max-w-md text-lg leading-relaxed text-paper/65">
            Tecnologias efetivamente usadas na construção deste site — verificáveis no próprio código.
          </p>
        </div>

        <div data-reveal className="lg:col-span-7">
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-ink-2/60">
            <div className="flex items-center justify-between border-b border-[color:var(--color-line)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-steel">
              <span>npm ls --depth=0</span>
              <span className="text-signal">{techs.length} pacotes</span>
            </div>
            <ul className="p-5 font-mono text-sm sm:p-7" aria-label="Tecnologias">
              <li className="mb-2 text-paper">tryggport-dev@1.0.0</li>
              {techs.map((t, i) => (
                <li key={t.name} className="group flex items-baseline gap-3 rounded px-1 py-1 transition-colors hover:bg-signal/[0.06]">
                  <span className="text-steel/60" aria-hidden>
                    {i === techs.length - 1 ? "└──" : "├──"}
                  </span>
                  <span className="text-signal transition group-hover:drop-shadow-[0_0_8px_rgba(112,224,177,0.6)]">{t.name}</span>
                  <span className="hidden flex-1 border-b border-dotted border-white/10 sm:block" aria-hidden />
                  <span className="text-xs text-steel">{t.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
