"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { type MouseEvent, type ReactNode, useRef } from "react";

/**
 * Wraps a card with 3D tilt, cursor-following spotlight, and a conic
 * gradient border that lights up on hover. The wrapper is transparent
 * otherwise — child styles the card surface.
 */
export function TiltedSpotlight({
  children,
  className = "",
  maxTilt = 4,
  radius = "rounded-2xl",
  borderEffect = true,
  spotlightEffect = true,
  spotlightSize = 360,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  /** Tailwind class for the border radius — must match the child card. */
  radius?: string;
  /** Set false to skip the conic gradient border (e.g. small tiles). */
  borderEffect?: boolean;
  /** Set false to skip the radial spotlight (useful for small tiles where the glow dominates). */
  spotlightEffect?: boolean;
  /** Radius of the radial spotlight in px. Default 360. */
  spotlightSize?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const spotX = useMotionValue(0);
  const spotY = useMotionValue(0);
  const spotlightX = useSpring(spotX, { stiffness: 200, damping: 25 });
  const spotlightY = useSpring(spotY, { stiffness: 200, damping: 25 });

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(useTransform(ry, [-1, 1], [maxTilt, -maxTilt]), {
    stiffness: 200,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(rx, [-1, 1], [-maxTilt, maxTilt]), {
    stiffness: 200,
    damping: 20,
  });

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    spotX.set(e.clientX - rect.left);
    spotY.set(e.clientY - rect.top);
    rx.set(px * 2 - 1);
    ry.set(py * 2 - 1);
  }

  function reset() {
    rx.set(0);
    ry.set(0);
  }

  const background = useTransform(
    [spotlightX, spotlightY] as const,
    ([x, y]) =>
      `radial-gradient(${spotlightSize}px circle at ${x}px ${y}px, rgba(255,74,0,0.22), transparent 60%)`,
  );

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={reduce ? {} : { rotateX, rotateY, transformPerspective: 1200 }}
      className={`group relative ${radius} ${className}`}
    >
      {children}

      {spotlightEffect && (
        <motion.div
          aria-hidden
          style={reduce ? {} : { background }}
          className={`pointer-events-none absolute inset-0 ${radius} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />
      )}

      {borderEffect && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${radius} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,74,0,0.55) 90deg, transparent 180deg, rgba(255,74,0,0.3) 270deg, transparent 360deg)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "1.5px",
          }}
        />
      )}
    </motion.div>
  );
}
