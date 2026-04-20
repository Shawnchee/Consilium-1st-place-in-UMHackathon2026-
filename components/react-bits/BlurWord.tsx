"use client";

import { motion } from "motion/react";
import { CSSProperties, useEffect, useRef, useState } from "react";

type BlurWordProps = {
  children: string;
  delay?: number;
  direction?: "top" | "bottom";
  threshold?: number;
  className?: string;
  style?: CSSProperties;
};

export default function BlurWord({
  children,
  delay = 0,
  direction = "top",
  threshold = 0.2,
  className = "",
  style,
}: BlurWordProps) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);

  const yFrom = direction === "top" ? -18 : 18;

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ display: "inline-block", willChange: "transform, filter, opacity", ...style }}
      initial={{ filter: "blur(10px)", opacity: 0, y: yFrom }}
      animate={
        inView
          ? { filter: "blur(0px)", opacity: 1, y: 0 }
          : { filter: "blur(10px)", opacity: 0, y: yFrom }
      }
      transition={{ duration: 0.7, delay: delay / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
