"use client";

import { motion } from "framer-motion";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: "circle" | "rectangle" | "rounded";
  className?: string;
  count?: number;
}

export function Skeleton({ 
  width = "100%", 
  height = "20px", 
  variant = "rounded", 
  className = "",
  count = 1 
}: SkeletonProps) {
  const borderRadius = variant === "circle" ? "50%" : variant === "rounded" ? "12px" : "0px";

  const renderSkeleton = (index: number) => (
    <motion.div
      key={index}
      initial={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: "easeInOut",
        delay: index * 0.1 
      }}
      className={`bg-gray-200 dark:bg-white/10 ${className}`}
      style={{
        width,
        height,
        borderRadius,
      }}
    />
  );

  return (
    <>
      {Array.from({ length: count }).map((_, i) => renderSkeleton(i))}
    </>
  );
}

export function StorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Skeleton width={84} height={84} variant="circle" />
      <Skeleton width={60} height={12} variant="rounded" />
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
      <Skeleton width={44} height={44} variant="circle" />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={14} variant="rounded" />
        <Skeleton width="40%" height={10} variant="rounded" />
      </div>
    </div>
  );
}

export function ConnectionSkeleton() {
  return (
    <div className="p-5 rounded-[32px] bg-white/5 border border-white/5 flex flex-col items-center text-center">
      <Skeleton width={80} height={80} variant="rounded" className="mb-4 !rounded-[24px]" />
      <Skeleton width="70%" height={16} variant="rounded" className="mb-2" />
      <Skeleton width="50%" height={12} variant="rounded" className="mb-4" />
      <div className="flex gap-2 w-full mt-auto">
        <Skeleton width="100%" height={40} variant="rounded" className="!rounded-2xl" />
        <Skeleton width="40px" height={40} variant="rounded" className="!rounded-2xl" />
      </div>
    </div>
  );
}
