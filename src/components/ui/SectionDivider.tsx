/** SectionDivider — gold diamond rule with horizontal lines, between sections. */

"use client";

import { motion } from "framer-motion";

export default function SectionDivider() {
  return (
    <div
      className="bg-paper w-full flex items-center justify-center overflow-hidden"
      style={{ paddingBlock: "clamp(2.2rem, 4vw, 3.2rem)" }}
      aria-hidden="true"
    >
      <motion.div
        className="flex items-center gap-5 w-full max-w-7xl px-6 md:px-10 lg:px-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.8 }}
      >
        {/* Left rule */}
        <motion.div
          className="flex-1 h-px bg-ink/12"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "right" }}
        />

        {/* Ornament: outer rings + gold diamond */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-px h-3 bg-ink/20" />
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0"
          >
            {/* Outer diamond (faint) */}
            <rect
              x="6"
              y="0.5"
              width="7.78"
              height="7.78"
              fill="none"
              stroke="#C9A84C"
              strokeOpacity="0.35"
              strokeWidth="0.6"
              transform="rotate(45 6 6)"
            />
            {/* Inner diamond (solid gold) */}
            <rect
              x="6"
              y="3"
              width="4.24"
              height="4.24"
              fill="#C9A84C"
              transform="rotate(45 6 6)"
            />
          </svg>
          <div className="w-px h-3 bg-ink/20" />
        </div>

        {/* Right rule */}
        <motion.div
          className="flex-1 h-px bg-ink/12"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "left" }}
        />
      </motion.div>
    </div>
  );
}
