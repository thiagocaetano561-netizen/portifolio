"use client";

import { AnimatePresence, motion } from "motion/react";
import { useExperience } from "@/components/experience/ExperienceProvider";

/** Registro fictício do rodapé — só existe para sessões autorizadas pelo servidor. */
export function FooterLog() {
  const { ui } = useExperience();
  const lines = ui["footer.log"];
  return (
    <AnimatePresence>
      {lines && lines.length > 0 && (
        <motion.section
          aria-label="Registro do sistema fictício"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
        >
          <div className="terminal terminal-crt relative mx-auto mb-10 max-w-7xl overflow-x-auto rounded-xl border border-[color:var(--color-line)] px-5 py-4 text-[12px] leading-relaxed sm:text-[13px]">
            {lines.map((l, i) => (
              <div key={i} className={`term-line whitespace-pre term-k-${l.k === "link" ? "out" : l.k}`}>
                {l.t || " "}
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
