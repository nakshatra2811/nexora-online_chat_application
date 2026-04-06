"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Copy, Check, Mail } from "lucide-react";
import { WhatsAppIcon, TelegramIcon, InstagramGradientIcon, SnapchatIcon, TwitterIcon } from "@/components/SocialIcons";

export function ShareProfileModal({ profile, onClose, isDark }: { profile: any; onClose: () => void; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`https://nexora.app/auth?connect=${profile?.username}`);
  const [displayUrl, setDisplayUrl] = useState(`https://nexora.app/auth?connect=********`);

  useEffect(() => {
    setShareUrl(`${window.location.origin}/auth?connect=${profile?.username}`);
    setDisplayUrl(`${window.location.origin}/auth?connect=********`);
  }, [profile?.username]);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

   const shareApps = [
     { name: "WhatsApp", icon: <WhatsAppIcon size={24} color="#25D366" />, color: "#25D366", bg: "rgba(37,211,102,0.12)", url: `https://wa.me/?text=${encodeURIComponent(`Connect with me on Nexora! ${shareUrl}`)}` },
     { name: "Telegram", icon: <TelegramIcon size={24} color="#2CA5E0" />, color: "#2CA5E0", bg: "rgba(44,165,224,0.12)", url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Connect with me on Nexora!")}` },
     { name: "Instagram", icon: <InstagramGradientIcon size={24} />, color: "#E1306C", bg: "rgba(225,48,108,0.12)", url: `https://instagram.com/direct/inbox/` }, // Redirect to DM to share
     { name: "Snapchat", icon: <SnapchatIcon size={24} color="#FFFC00" />, color: "#FFFC00", bg: "rgba(255,252,0,0.15)", url: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}` },
     { name: "Twitter/X", icon: <TwitterIcon size={24} color="#1DA1F2" />, color: "#1DA1F2", bg: "rgba(29,161,242,0.12)", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent("Connect with me on Nexora! " + shareUrl)}` },
     { name: "Email", icon: <Mail className="w-6 h-6" />, color: "#6c5ce7", bg: "rgba(108,92,231,0.12)", url: `mailto:?subject=Join me on Nexora&body=Connect with me on Nexora! ${shareUrl}` },
   ];

  const handleShareApp = (app: typeof shareApps[0]) => {
    if (typeof navigator !== "undefined" && navigator.share && app.name === "WhatsApp") {
      navigator.share({ title: `Connect with ${profile.name} on Nexora`, url: shareUrl }).catch((..._args: any[]) => {});
    } else {
      window.open(app.url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2rem] p-6 flex flex-col gap-5 shadow-2xl"
        style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(108,92,231,0.12)"}` }}>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>Share Your Profile</h2>
          <button onClick={onClose} className="p-2 rounded-xl opacity-50 hover:opacity-100" style={{ color: "var(--text-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile preview card */}
        <div className="p-4 rounded-2xl flex items-center gap-4"
          style={{ background: isDark ? "rgba(108,92,231,0.08)" : "rgba(108,92,231,0.05)", border: `1px solid rgba(108,92,231,0.15)` }}>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center text-white font-extrabold text-lg shadow-lg">
            <span className="uppercase leading-none drop-shadow-md">{profile.name?.charAt(0) || "N"}</span>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{profile.name}</p>
            <p className="text-xs font-semibold text-[#6c5ce7]">@{profile.username}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{displayUrl.replace('https://', '')}</p>
          </div>
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2 p-3 rounded-xl border"
          style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderColor: "var(--border-subtle)" }}>
          <p className="flex-1 text-xs truncate font-mono" style={{ color: "var(--text-muted)" }}>{displayUrl}</p>
          <motion.button whileTap={{ scale: 0.9 }} onClick={copyLink}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            style={{ background: copied ? "rgba(46,213,115,0.1)" : "rgba(108,92,231,0.1)", color: copied ? "#2ed573" : "#6c5ce7" }}>
            {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
          </motion.button>
        </div>

        {/* Social apps */}
        <div className="grid grid-cols-3 gap-3">
          {shareApps.map(app => (
            <motion.button key={app.name} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.93 }}
              onClick={() => handleShareApp(app)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl font-semibold text-xs transition-all"
              style={{ background: app.bg, color: app.color, border: `1px solid ${app.color}25` }}>
              <div className="w-12 h-12 rounded-full border-[1.5px] flex items-center justify-center shadow-inner bg-white/50 dark:bg-black/20 overflow-hidden" style={{ borderColor: `${app.color}40` }}>
                {app.icon}
              </div>
              <span className="tracking-wide uppercase text-[9px]">{app.name}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
