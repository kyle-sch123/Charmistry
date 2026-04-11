"use client";

import { useState, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import TextReveal from "@/components/ui/TextReveal";
import { useEmailSubscribe } from "@/hooks/useEmailSubscribe";

export default function NewsletterCTA() {
  const [email, setEmail] = useState("");
  const { status, discountCode, subscribe } = useEmailSubscribe();

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const lineWidth = useTransform(scrollYProgress, [0.2, 0.5], ["0%", "100%"]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) {
      subscribe(email);
      setEmail("");
    }
  }

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="py-24 md:py-36 px-6 md:px-8 relative overflow-hidden"
    >
      {/* Background accent */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: useTransform(scrollYProgress, [0, 0.5], [0, 0.03]) }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gold blur-[200px]" />
      </motion.div>

      <div className="max-w-2xl mx-auto text-center relative z-10">
        <motion.div
          className="flex items-center justify-center gap-4 mb-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="h-px w-8 bg-gold" />
          <span className="text-gold text-xs tracking-[0.3em] uppercase font-body font-medium">
            Stay Connected
          </span>
          <div className="h-px w-8 bg-gold" />
        </motion.div>

        <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-light text-ivory mb-4">
          <TextReveal text="Join the Inner Circle" staggerChildren={0.04} />
        </h2>

        {/* Animated gold line */}
        <div className="flex justify-center mb-8">
          <motion.div className="h-px bg-gold" style={{ width: lineWidth }} />
        </div>

        <motion.p
          className="text-smoke text-base font-body font-light mb-10 leading-relaxed max-w-md mx-auto"
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Be the first to discover new collections, receive exclusive offers,
          and gain access to private events.
        </motion.p>

        <motion.form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            aria-label="Email address"
            disabled={status === "loading" || status === "success"}
            className="flex-1 bg-transparent border border-graphite px-5 py-3.5 text-ivory font-body text-sm placeholder:text-smoke/50 focus:outline-none focus:border-gold transition-colors duration-300 disabled:opacity-50"
          />
          <motion.button
            type="submit"
            disabled={status === "loading" || status === "success"}
            className="bg-gold text-obsidian px-8 py-3.5 text-xs tracking-[0.15em] uppercase font-body font-medium hover:bg-gold-light transition-colors duration-300 cursor-pointer disabled:opacity-50"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {status === "loading" ? "..." : "Subscribe"}
          </motion.button>
        </motion.form>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {status === "success" && discountCode && (
            <motion.div
              key="success"
              className="mt-5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-smoke text-xs font-body mb-2">
                You&apos;re in! Your welcome code:
              </p>
              <span className="text-gold font-body font-semibold tracking-[0.2em] text-sm">
                {discountCode}
              </span>
            </motion.div>
          )}
          {status === "duplicate" && (
            <motion.p
              key="dup"
              className="text-smoke/60 text-xs font-body mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              You&apos;re already on the list.
            </motion.p>
          )}
          {status === "error" && (
            <motion.p
              key="err"
              className="text-smoke/60 text-xs font-body mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              Something went wrong — please try again.
            </motion.p>
          )}
        </AnimatePresence>

        {status === "idle" && (
          <motion.p
            className="text-smoke/40 text-xs font-body mt-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
          >
            No spam, ever. Unsubscribe anytime.
          </motion.p>
        )}
      </div>
    </section>
  );
}
