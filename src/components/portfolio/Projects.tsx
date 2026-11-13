import { projects } from "@/content/projects";
import { ProjectCard } from "./ProjectCard";
import { SectionLabel } from "./SectionLabel";

export function Projects() {
  return (
    <section id="projetos" aria-labelledby="projetos-title" className="relative overflow-x-clip py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <SectionLabel index="01" label="Projetos" beacon={{ count: 4, shape: "triangle", offset: 0 }} />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <h2 id="projetos-title" data-reveal className="max-w-2xl font-display text-[clamp(2.2rem,5vw,3.8rem)] font-semibold leading-[1] tracking-[-0.03em]">
            Trabalhos publicados <span className="text-steel">e em construção.</span>
          </h2>
          <p data-reveal className="max-w-sm font-mono text-xs leading-relaxed text-steel">
            Cada projeto também pode ser aberto no terminal com <span className="text-signal">project &lt;nome&gt;</span>.
          </p>
        </div>

        <ol className="mt-16 space-y-24 sm:space-y-32">
          {projects.map((p, i) => (
            <li key={p.slug}>
              <ProjectCard project={p} index={i} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
