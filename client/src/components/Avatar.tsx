"use client";

import React from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  name?: string;
  color?: string; // Expecting "from-[#...] to-[#...]" or similar
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;
  className?: string;
  borderColor?: string;
  showBorder?: boolean;
  animate?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  timestamp?: string | number;
}

const sizeMap = {
  xs: "h-6 w-6 text-[8px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-14 w-14 text-base",
  "2xl": "h-16 w-16 text-xl",
  "3xl": "h-24 w-24 text-3xl",
  "4xl": "h-36 w-36 text-5xl",
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = "?",
  color = "from-[#6c5ce7] to-[#00d4ff]",
  size = "md",
  className = "",
  borderColor = "rgba(255,255,255,0.1)",
  showBorder = true,
  animate = true,
  onClick,
  icon,
  timestamp,
}) => {
  const sizeClass = typeof size === "string" ? sizeMap[size as keyof typeof sizeMap] : "";
  const customSizeStyle = typeof size === "number" ? { width: size, height: size, fontSize: size * 0.4 } : {};

  // Extract colors for mesh gradient if it's a standard from-to pair
  const extractHex = (str: string) => {
    const match = str.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g);
    return match || ["#6c5ce7", "#00d4ff"];
  };

  const colors = extractHex(color);
  const c1 = colors[0];
  const c2 = colors[1] || colors[0];
  
  // Create a richer mesh gradient by adding intermediate colors
  const meshStyle: React.CSSProperties = {
    background: `radial-gradient(at 0% 0%, ${c1} 0px, transparent 50%),
                radial-gradient(at 50% 0%, ${c2} 0px, transparent 50%),
                radial-gradient(at 100% 0%, ${c1} 0px, transparent 50%),
                radial-gradient(at 0% 50%, ${c2} 0px, transparent 50%),
                radial-gradient(at 100% 100%, ${c1} 0px, transparent 50%),
                radial-gradient(at 0% 100%, ${c2} 0px, transparent 50%)`,
    backgroundColor: c1,
  };

  const initial = (name[0] || "?").toUpperCase();

  const content = (
    <div
      className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-lg ${sizeClass} ${className}`}
      style={{ 
        ...customSizeStyle,
        border: showBorder ? `1px solid ${borderColor}` : "none",
        ...(!src ? meshStyle : {})
      }}
      onClick={onClick}
    >
      {src ? (
        <img 
          src={timestamp ? `${src}${src.includes('?') ? '&' : '?'}v=${timestamp}` : src} 
          alt={name} 
          className="w-full h-full object-cover rounded-full" 
        />
      ) : (
        <>
          {/* Glassmorphism Overlay */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5 pointer-events-none rounded-full" />
          
          {/* Sub-pixel inner border for depth */}
          <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)]" />

          {/* Initials with better typography */}
          <span className="relative z-10 font-black text-white tracking-tighter drop-shadow-md select-none">
            {initial}
          </span>
        </>
      )}
    </div>
  );

  if (animate) {
    return (
      <motion.div 
        whileHover={{ scale: 1.05 }} 
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className="inline-block rounded-full"
        style={{ transform: "translateZ(0)" }} // Fixes clipping issues in some browsers
      >
        {content}
      </motion.div>
    );
  }

  return content;
};
