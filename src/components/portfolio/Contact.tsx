import { isAllowedExternalHref, site } from "@/content/site";
import { OpenTerminalButton } from "./OpenTerminalButton";
import { SectionLabel } from "./SectionLabel";

export function Contact() {
  const links = site.contact.filter((c) => isAllowedExternalHref(c.href));
  return (
    <section id="contato" aria-labelledby="contato-title" className="relative overflow-hidden py-24 sm:py-32">
      <div className="hairline absolute inset-x-0 top-0" aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-signal-deep/30 blur-[120px]" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionLabel index="04" label="Contato" beacon={{ count: 3, shape: "diamond", offset: 0.7 }} />
        <h2 id="contato-title" data-reveal className="mt-6 max-w-4xl font-display text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
          Vamos construir <span className="text-outline">algo</span> <span className="text-signal">seguro?</span>
        </h2>

        {links.length > 0 ? (
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <li key={l.href} data-reveal>
                <a
                  href={l.href}
                  target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-[color:var(--color-line)] px-6 py-5 transition hover:border-signal/60 hover:bg-signal/5"
                >
                  <span>
                    <span className="block font-mono text-xs uppercase tracking-[0.2em] text-steel">{l.label}</span>
                    <span className="mt-1 block text-lg text-paper">{l.handle ?? l.href.replace(/^mailto:|^https:\/\//, "")}</span>
                  </span>
                  <span aria-hidden className="text-signal transition group-hover:translate-x-1">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div data-reveal className="mt-14 flex flex-col gap-6 rounded-2xl border border-dashed border-[color:var(--color-line)] p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-steel">status</p>
              <p className="mt-2 text-lg text-paper/80">Os canais de contato serão publicados em breve.</p>
            </div>
            <OpenTerminalButton command="contact" />
          </div>
        )}
      </div>
    </section>
  );
}
