import { site } from "@/content/site";
import { SectionLabel } from "./SectionLabel";

export function About() {
  const [lead, ...rest] = site.about;
  return (
    <section id="sobre" aria-labelledby="sobre-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="hairline absolute inset-x-0 top-0" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel index="02" label="Sobre" beacon={{ count: 2, shape: "square", offset: 1.3 }} />
          <h2 id="sobre-title" data-reveal className="mt-6 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-5xl">
            Porta segura,
            <br />
            <span className="text-signal">experiência aberta.</span>
          </h2>
        </div>

        <div className="lg:col-span-7 lg:col-start-6">
          <p data-reveal className="text-[clamp(1.25rem,2.2vw,1.75rem)] leading-snug text-paper/90">
            {lead}
          </p>
          {rest.map((p, i) => (
            <p key={p} data-reveal style={{ ["--reveal-delay" as string]: 80 * (i + 1) }} className="mt-6 text-lg leading-relaxed text-paper/65">
              {p}
            </p>
          ))}

          <ul className="mt-14 divide-y divide-[color:var(--color-line)] border-y border-[color:var(--color-line)]">
            {site.principles.map((pr, i) => (
              <li
                key={pr.title}
                data-reveal
                style={{ ["--reveal-delay" as string]: 60 * i }}
                className="group grid grid-cols-[3rem_1fr] items-baseline gap-4 py-6 transition-colors hover:bg-white/[0.015] sm:grid-cols-[4rem_14rem_1fr]"
              >
                <span className="font-mono text-xs text-signal">0{i + 1}</span>
                <span className="font-display text-lg font-medium text-paper">{pr.title}</span>
                <span className="col-start-2 text-paper/60 sm:col-start-3">{pr.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
