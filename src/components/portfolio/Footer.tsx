import Image from "next/image";
import { FooterGlyph } from "./FooterGlyph";
import { FooterLog } from "./FooterLog";

export function Footer() {
  return (
    <footer className="relative border-t border-[color:var(--color-line)] py-12">
      <div className="px-4 sm:px-8">
        <FooterLog />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div className="flex items-center gap-4">
          <Image src="/brand/mark-light.png" alt="" width={34} height={35} />
          <div>
            <p className="font-display font-semibold text-paper">Tryggport Dev</p>
            <p className="font-mono text-xs text-steel">© {new Date().getFullYear()} · construído com cuidado</p>
          </div>
        </div>
        <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-steel">
          <a href="#inicio" className="transition hover:text-paper">
            topo ↑
          </a>
          <span>build 1.1.0</span>
          <FooterGlyph />
        </div>
      </div>
    </footer>
  );
}
