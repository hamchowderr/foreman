"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";

export function TiltCard({
  children,
  className = "",
  max = 6,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springX = useSpring(rotateX, { stiffness: 200, damping: 20 });
  const springY = useSpring(rotateY, { stiffness: 200, damping: 20 });
  const glareX = useTransform(springY, [-max, max], [0, 100]);
  const glareY = useTransform(springX, [max, -max], [100, 0]);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.12), transparent 50%)`;

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 2 * max);
    rotateX.set(-(py - 0.5) * 2 * max);
  }

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      style={
        reduce
          ? {}
          : {
              rotateX: springX,
              rotateY: springY,
              transformStyle: "preserve-3d",
              transformPerspective: 1000,
            }
      }
      className={`relative ${className}`}
    >
      {children}
      {!reduce && (
        <motion.div
          aria-hidden
          style={{ background: glareBg }}
          className="absolute inset-0 pointer-events-none rounded-[inherit]"
        />
      )}
    </motion.div>
  );
}
