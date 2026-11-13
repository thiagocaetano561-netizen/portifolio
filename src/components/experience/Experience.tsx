import { ExperienceProvider } from "./ExperienceProvider";
import { GlobalEffects } from "./GlobalEffects";
import { Toasts } from "./Toasts";
import { SceneOverlay } from "./SceneOverlay";
import { Nav } from "@/components/portfolio/Nav";
import { Hero } from "@/components/portfolio/Hero";
import { Projects } from "@/components/portfolio/Projects";
import { About } from "@/components/portfolio/About";
import { Stack } from "@/components/portfolio/Stack";
import { Contact } from "@/components/portfolio/Contact";
import { Footer } from "@/components/portfolio/Footer";

/** Os dois modos compartilham a mesma página, os mesmos projetos e o mesmo terminal. */
export function Experience({ initialMode }: { initialMode: "visual" | "terminal" }) {
  return (
    <ExperienceProvider initialMode={initialMode}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="boot-curtain" aria-hidden />
      <Nav />
      <main id="conteudo">
        <Hero />
        <Projects />
        <About />
        <Stack />
        <Contact />
      </main>
      <Footer />
      <Toasts />
      <SceneOverlay />
      <GlobalEffects />
      <noscript>
        <p className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-[color:var(--color-line)] bg-ink-2 p-4 text-sm text-steel">
          O terminal interativo precisa de JavaScript. Todo o portfólio continua disponível nesta página.
        </p>
      </noscript>
    </ExperienceProvider>
  );
}
