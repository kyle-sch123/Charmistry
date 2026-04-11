"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import Image from "next/image";
import TextReveal from "@/components/ui/TextReveal";

const stats = [
  { value: "15+", label: "Years of Craft" },
  { value: "2,400+", label: "Pieces Created" },
  { value: "98%", label: "Client Satisfaction" },
];

export default function BrandStory() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const imageY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.15, 0.85, 1],
    [0, 1, 1, 0],
  );

  return (
    <section
      ref={sectionRef}
      id="about"
      className="relative py-16 md:py-24 lg:py-36 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Images */}
          <div className="relative mb-16 lg:mb-0 lg:w-3/4">
            <motion.div
              className="relative aspect-[3/4] overflow-hidden"
              style={{ y: imageY }}
            >
              <Image
                src="https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800&q=80"
                alt="Artisan crafting jewelry"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian/40 to-transparent" />
            </motion.div>

            {/* Floating accent image */}
            <motion.div
              className="absolute -bottom-12 -right-2 md:-right-8 w-[40%] md:w-[45%] aspect-square overflow-hidden border-4 border-obsidian"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <Image
                src="https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400&q=80"
                alt="Diamond close-up"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 40vw, 25vw"
              />
            </motion.div>

            {/* Gold accent line — desktop only */}
            <motion.div
              className="hidden lg:block absolute -left-4 top-1/4 w-px bg-gold"
              initial={{ height: 0 }}
              whileInView={{ height: 120 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>

          {/* Right: Content */}
          <motion.div style={{ opacity: contentOpacity }}>
            <motion.div
              className="flex items-center gap-4 mb-6"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="h-px w-12 bg-gold" />
              <span className="text-gold text-xs tracking-[0.3em] uppercase font-body font-medium">
                Our Philosophy
              </span>
            </motion.div>

            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-light text-ivory leading-tight mb-4">
              <TextReveal text="Where Luxury" delay={0.1} />
              <br />
              <TextReveal text="Meets Artistry" delay={0.3} />
            </h2>

            <motion.div
              className="w-16 h-px bg-gold mb-8"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{ transformOrigin: "left" }}
            />

            <motion.p
              className="text-pearl/60 text-xl md:text-2xl font-body font-light leading-relaxed mb-6 text-right"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Every piece begins as a vision — refined through generations of
              craft, brought to life by hands that understand the language of
              precious metals and stones.
            </motion.p>

            <motion.p
              className="text-pearl/40 text-lg md:text-xl font-body font-light leading-relaxed mb-12 text-right"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              We believe in pieces that keep up with your everyday. That’s why
              our jewelry is made from high-quality stainless steel. waterproof,
              tarnish-resistant and designed to be worn daily.
            </motion.p>

            {/* Animated stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-6 pt-8">
              {stats.map((stat, i) => (
                <AnimatedStat
                  key={stat.label}
                  stat={stat}
                  delay={0.7 + i * 0.15}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AnimatedStat({
  stat,
  delay,
}: {
  stat: { value: string; label: string };
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      className="text-center lg:text-left"
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
    >
      <span className="font-display text-xl md:text-3xl lg:text-4xl text-gold font-light">
        {stat.value}
      </span>
      <p className="text-smoke text-[10px] md:text-xs tracking-[0.1em] uppercase font-body mt-1">
        {stat.label}
      </p>
    </motion.div>
  );
}
