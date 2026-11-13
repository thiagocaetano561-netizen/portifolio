import { MARK_PATH, MARK_VIEWBOX } from "./mark-geometry";

/**
 * Símbolo da Tryggport Dev vetorizado a partir do logotipo original.
 * Linhas luminosas desenham o contorno real da marca e então ela se preenche.
 * Sem JavaScript ou com movimento reduzido, a marca aparece pronta.
 */
export function MarkReveal({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={`mark-reveal overflow-visible ${className}`} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <filter id="mark-halo-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <path className="mark-halo" d={MARK_PATH} fillRule="evenodd" filter="url(#mark-halo-blur)" opacity={0.35} />
      <path d={MARK_PATH} fillRule="evenodd" pathLength={1} />
    </svg>
  );
}
