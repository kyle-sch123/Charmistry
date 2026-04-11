"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CSSProperties, ReactNode } from "react";

interface ShimmerTextProps {
  children: ReactNode;
  className?: string;
  shimmerColor?: string;
  baseColor?: string;
  duration?: number;
}

export default function ShimmerText({
  children,
  className = "",
  shimmerColor = "rgba(232, 212, 139, 1)",
  baseColor = "rgba(201, 168, 76, 0.7)",
  duration = 3,
}: ShimmerTextProps) {
  return (
    <motion.span
      className={cn("inline-block bg-clip-text text-transparent bg-[length:200%_100%]", className)}
      style={
        {
          backgroundImage: `linear-gradient(110deg, ${baseColor} 35%, ${shimmerColor} 50%, ${baseColor} 65%)`,
        } as CSSProperties
      }
      animate={{
        backgroundPosition: ["-200% 0", "200% 0"],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {children}
    </motion.span>
  );
}
