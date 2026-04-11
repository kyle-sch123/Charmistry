"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  direction?: "up" | "down";
  speed?: number;
  className?: string;
  pauseOnHover?: boolean;
}

export default function Marquee({
  children,
  direction = "up",
  speed = 20,
  className = "",
  pauseOnHover = true,
}: MarqueeProps) {
  const animateY = direction === "up" ? "-50%" : "50%";

  return (
    <div
      className={cn("overflow-hidden", className)}
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      <motion.div
        className={cn(
          "flex flex-col gap-6 pb-6",
          pauseOnHover && "[&:hover]:animation-play-state-paused"
        )}
        animate={{ y: animateY }}
        transition={{
          y: {
            duration: speed,
            repeat: Infinity,
            ease: "linear",
            repeatType: "loop",
          },
        }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
