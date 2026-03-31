"use client";

import { motion } from "framer-motion";

export default function DashboardLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-transparent">
      {/* Header Skeleton */}
      <div className="h-16 w-full border-b border-white/5 px-6 flex items-center justify-between">
         <div className="w-48 h-8 rounded-xl bg-white/5 animate-pulse" />
         <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
            <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
         </div>
      </div>

      <div className="flex-1 flex p-6 gap-6">
         {/* Sidebar Skeleton */}
         <div className="w-80 h-full rounded-2xl bg-white/5 animate-pulse hidden lg:block" />
         
         {/* Feed Skeleton */}
         <div className="flex-1 space-y-6">
            <div className="h-32 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-32 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-32 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-32 w-full rounded-2xl bg-white/5 animate-pulse" />
            <div className="h-32 w-full rounded-2xl bg-white/5 animate-pulse" />
         </div>
      </div>
    </div>
  );
}
