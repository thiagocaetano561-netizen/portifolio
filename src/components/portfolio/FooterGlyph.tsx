"use client";

import { useExperience } from "@/components/experience/ExperienceProvider";

export function FooterGlyph() {
  const { signal } = useExperience();
  return (
    <button
      type="button"
      onClick={() => signal("footer_glyph")}
      aria-label="Símbolo"
      className="text-base text-steel/40 transition hover:text-signal hover:drop-shadow-[0_0_6px_rgba(112,224,177,0.8)]"
    >
      ⌁
    </button>
  );
}
