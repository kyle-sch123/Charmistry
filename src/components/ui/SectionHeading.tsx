"use client";

import ScrollReveal from "./ScrollReveal";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: SectionHeadingProps) {
  const alignClass = align === "center" ? "text-center items-center" : "text-left items-start";

  return (
    <ScrollReveal>
      <div className={`flex flex-col gap-4 mb-12 md:mb-16 ${alignClass}`}>
        {eyebrow && (
          <span className="text-gold text-xs tracking-[0.25em] uppercase font-body font-medium">
            {eyebrow}
          </span>
        )}
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-ivory leading-tight">
          {title}
        </h2>
        <div className="w-12 h-px bg-gold" />
        {subtitle && (
          <p className="text-smoke text-base md:text-lg max-w-lg font-light">
            {subtitle}
          </p>
        )}
      </div>
    </ScrollReveal>
  );
}
