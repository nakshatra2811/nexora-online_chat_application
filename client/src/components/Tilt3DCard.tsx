"use client";

import { useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Tilt3DCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  depth?: number;
}

export function Tilt3DCard({ children, className = "", glowColor = "#6c5ce7", depth = 20 }: Tilt3DCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 200, damping: 20 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [depth, -depth]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-depth, depth]), springConfig);
  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), springConfig);
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), springConfig);
  const scale = useSpring(1, springConfig);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) / rect.width);
    y.set((e.clientY - centerY) / rect.height);
    scale.set(1.02);
  }, [x, y, scale]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [x, y, scale]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d", perspective: 1000 }}
      className={`relative ${className}`}
    >
      {/* Glow spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-10 opacity-0 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glowColor}22, transparent 60%)`,
          opacity: useTransform(scale, [1, 1.02], [0, 1]),
        }}
      />
      {children}
    </motion.div>
  );
}
