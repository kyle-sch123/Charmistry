"use client";

import { CSSProperties, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  duration?: number;
  lightColor?: string;
  lightWidth?: number;
  borderWidth?: number;
  className?: string;
}

export default function BorderBeam({
  duration = 8,
  lightColor = "#C9A84C",
  lightWidth = 150,
  borderWidth = 1,
  className = "",
}: BorderBeamProps) {
  const pathRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePath = () => {
      if (!pathRef.current) return;
      const div = pathRef.current;
      div.style.setProperty(
        "--path",
        `path("M 0 0 H ${div.offsetWidth} V ${div.offsetHeight} H 0 V 0")`
      );
    };

    updatePath();
    window.addEventListener("resize", updatePath);
    return () => window.removeEventListener("resize", updatePath);
  }, []);

  return (
    <div
      ref={pathRef}
      style={
        {
          "--duration": duration,
          "--border-width": `${borderWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "absolute z-0 h-full w-full",
        "after:absolute after:inset-[var(--border-width)] after:content-['']",
        "border-[length:var(--border-width)]",
        "![mask-clip:padding-box,border-box]",
        "![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(red,red)]",
        "before:absolute before:inset-0 before:z-[-1] before:border-[length:var(--border-width)] before:border-white/5",
        className
      )}
    >
      <motion.div
        className="absolute inset-0 aspect-square"
        style={
          {
            background: `radial-gradient(ellipse at center, ${lightColor}, transparent, transparent)`,
            width: `${lightWidth}px`,
            offsetPath: "var(--path)",
          } as CSSProperties
        }
        animate={{
          offsetDistance: ["0%", "100%"],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
}
