"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MessageSquare, Phone, Video, UserMinus, QrCode, Share2,
  Copy, Check, Shield, ShieldOff, MapPin, ChevronLeft, Mail
} from "lucide-react";
import {
  WhatsAppIcon, TelegramIcon, InstagramGradientIcon, DiscordIcon,
  SnapchatIcon
} from "./SocialIcons";
import { Avatar } from "./Avatar";
import { LastSeenBadge } from "./LastSeenBadge";
import { ConnectionButton, ConnectionStatus } from "./ConnectionButton";
import { socketService } from "@/lib/socket";

// ─── Unique QR per username (same canvas logic but seeded on username) ───
function generateUniqueQR(username: string, size = 160): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const modules = 21, pad = 12, cell = (size - pad * 2) / modules;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#6c5ce7"); grad.addColorStop(1, "#00d4ff");
  // Deterministic seed per username
  const seed = username.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 7), 0);
  const rng = (i: number) => { const x = Math.sin(seed * 0.0013 + i * 2.7) * 99999; return x - Math.floor(x); };
  let k = 0;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const tl = r < 7 && c < 7, tr = r < 7 && c >= modules - 7, bl = r >= modules - 7 && c < 7;
      let fill = false;
      if (tl || tr || bl) {
        const lr = tl ? r : tr ? r : r - (modules - 7), lc = tl ? c : tr ? c - (modules - 7) : c;
        fill = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else fill = rng(k) > 0.45;
      if (fill) {
        ctx.fillStyle = grad;
        const x = pad + c * cell, y = pad + r * cell, s = cell - 1;
        ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + s - 2, y);
        ctx.quadraticCurveTo(x + s, y, x + s, y + 2); ctx.lineTo(x + s, y + s - 2);
        ctx.quadraticCurveTo(x + s, y + s, x + s - 2, y + s); ctx.lineTo(x + 2, y + s);
        ctx.quadraticCurveTo(x, y + s, x, y + s - 2); ctx.lineTo(x, y + 2);
        ctx.quadraticCurveTo(x, y, x + 2, y); ctx.closePath(); ctx.fill();
      }
      k++;
    }
  }
  // Center N mark
  ctx.fillStyle = "#ffffff"; ctx.fillRect(size / 2 - 14, size / 2 - 14, 28, 28);
  ctx.fillStyle = "#6c5ce7"; ctx.font = "bold 13px Inter,sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("N", size / 2, size / 2 + 1);
  return canvas.toDataURL("image/png");
}

interface Friend {
  id: number;
  name: string;
  username: string;
  color: string;
  online: boolean;
  bio?: string;
  joinedDate?: string;
  friendSince?: string;
  avatarUrl?: string;
  lastVisit?: number | string | null;
}

interface UserProfileModalProps {
  friend: Friend;
  isDark: boolean;
  onClose: () => void;
  onChat: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onBlock: () => void;
  isChatLocked?: boolean;
  onToggleLock?: () => void;
  connectionStatus?: ConnectionStatus;
  requestId?: number;
  onConnectionChange?: (newStatus: ConnectionStatus, peerData?: any) => void;
}

export function UserProfileModal({ friend, isDark, onClose, onChat, onVoiceCall, onVideoCall, onBlock, isChatLocked, onToggleLock, connectionStatus: initialConnectionStatus = "none", requestId, onConnectionChange }: UserProfileModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(initialConnectionStatus);
  const [shareMode, setShareMode] = useState(false);

  const [displayFriend, setDisplayFriend] = useState(friend);

  useEffect(() => {
    setQrUrl(generateUniqueQR(friend.username));
    setDisplayFriend(friend);
  }, [friend.username, friend]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleAvatarUpdate = (data: { username: string; avatarUrl: string }) => {
      if (data.username?.toLowerCase() === friend.username?.toLowerCase()) {
        setDisplayFriend(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      }
    };

    socket.on("user:avatar_update", handleAvatarUpdate);
    return () => {
      socket.off("user:avatar_update", handleAvatarUpdate);
    };
  }, [friend.username]);

  const [profileUrl, setProfileUrl] = useState(`https://nexora31.vercel.app/auth?connect=${friend.username}`);
  const [displayUrl, setDisplayUrl] = useState(`https://nexora31.vercel.app/auth?connect=********`);

  useEffect(() => {
    const APP_URL = window.location.origin;
    setProfileUrl(`${APP_URL}/auth?connect=${friend.username}`);
    setDisplayUrl(`${APP_URL}/auth?connect=********`);
  }, [friend.username]);

  const copyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareApps = [
    { name: "WhatsApp", icon: <WhatsAppIcon size={20} color="#25D366" />, color: "#25D366", url: `https://wa.me/?text=${encodeURIComponent(`🔐 Connect with me on Nexora — The Private Chat Protocol.\n${profileUrl}`)}` },
    { name: "Telegram", icon: <TelegramIcon size={20} color="#2CA5E0" />, color: "#2CA5E0", url: `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(`🔐 Connect with me on Nexora — encrypted private chat.`)}` },
    { name: "Instagram", icon: <InstagramGradientIcon size={20} />, color: "#E1306C", url: `https://instagram.com/direct/inbox/` },
    { name: "Snapchat", icon: <SnapchatIcon size={20} color="#FFFC00" />, color: "#FFFC00", url: `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(profileUrl)}` },
  ];


  const downloadQR = () => {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `nexora_qr_${friend.username}.png`;
    a.click();
  };

  const shareQRToFriend = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: `${friend.name}'s Nexora QR`, url: profileUrl }).catch((..._args: any[]) => { });
    } else {
      copyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-0"
      style={{ background: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)", backdropFilter: "blur(24px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full h-full sm:h-auto sm:max-w-3xl sm:my-auto sm:rounded-[2.5rem] overflow-y-auto flex flex-col relative"
        style={{ background: isDark ? "rgba(16,16,28,0.98)" : "rgba(255,255,255,0.98)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(108,92,231,0.12)"}` }}
      >
        {/* Header/Cover Section */}
        <div className="relative">
          {/* Cover gradient */}
          <div className="h-32 sm:h-48 relative" style={{ background: `linear-gradient(135deg, var(--c1), var(--c2))` }}>
            <style>{`
            .user-modal-cover { --c1: ${friend.color.includes("ff006e") ? "#ff006e" : "#6c5ce7"}; --c2: ${friend.color.includes("ffbe0b") ? "#ffbe0b" : "#00d4ff"}; }
          `}</style>
            <div className="user-modal-cover absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${friend.color.includes("ff006e") ? "#ff006e" : "#6c5ce7"}, ${friend.color.includes("ffbe0b") ? "#ffbe0b" : "#00d4ff"})`, opacity: 0.9 }} />

            {/* Close Button (Visible on all sizes now) */}
            <button onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center z-50"
              style={{ background: "rgba(0,0,0,0.35)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}>
              <X className="w-5 h-5 drop-shadow-md" />
            </button>
            {/* Avatar */}
            <div className="absolute -bottom-12 left-6 sm:left-10">
              <motion.div
                animate={{ boxShadow: ["0 0 0px rgba(108,92,231,0)", "0 0 30px rgba(108,92,231,0.5)", "0 0 0px rgba(108,92,231,0)"] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="relative z-10"
              >
                <div className="hidden sm:block">
                  <Avatar
                    src={displayFriend.avatarUrl}
                    name={displayFriend.name || displayFriend.username}
                    color={displayFriend.color}
                    size={128}
                    animate={true}
                    showBorder={true}
                    className="ring-[6px] shadow-2xl"
                    borderColor={isDark ? "rgba(16,16,28,1)" : "#fff"}
                  />
                </div>
                <div className="sm:hidden">
                  <Avatar
                    src={displayFriend.avatarUrl}
                    name={displayFriend.name || displayFriend.username}
                    color={displayFriend.color}
                    size={96}
                    animate={true}
                    showBorder={true}
                    className="ring-[6px] shadow-2xl"
                    borderColor={isDark ? "rgba(16,16,28,1)" : "#fff"}
                  />
                </div>
              </motion.div>
              {friend.online && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#2ed573] border-4"
                  style={{ borderColor: isDark ? "#10101c" : "#fff", boxShadow: "0 0 15px rgba(46,213,115,0.6)" }} />
              )}
            </div>
          </div>
        </div>

          <div className="pt-16 sm:pt-20 px-6 sm:px-10 pb-8 flex flex-col gap-5 sm:gap-7">
            {/* Name, username, bio */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>{friend.name}</h2>
                  <p className="text-base sm:text-lg font-bold text-[#6c5ce7] mt-0.5">@{friend.username}</p>
                </div>
                <div className="flex flex-col items-end gap-1 pt-1">
                  <LastSeenBadge isOnline={friend.online} lastVisit={friend.lastVisit} username={friend.username} />
                </div>
              </div>
              {friend.bio && (
                <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{friend.bio}</p>
              )}
            </div>

            {/* Meta info */}
            <div className="grid grid-cols-2 gap-2">
              {friend.joinedDate && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: "var(--text-secondary)" }}>
                  <Shield className="w-3.5 h-3.5 text-[#6c5ce7] shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>Joined</p>
                    <p className="font-semibold">{friend.joinedDate}</p>
                  </div>
                </div>
              )}
              {friend.friendSince && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", color: "var(--text-secondary)" }}>
                  <MapPin className="w-3.5 h-3.5 text-[#2ed573] shrink-0" />
                  <div>
                    <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: "var(--text-muted)" }}>Friends since</p>
                    <p className="font-semibold">{friend.friendSince}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-4">
              {/* Friends: show Message / Voice / Video */}
              {connectionStatus === "friends" && (
                <div className={`grid gap-3 ${friend.username === "nexora_31" ? "grid-cols-1" : "grid-cols-3"}`}>
                  {[
                    { label: "Message", icon: MessageSquare, color: "#6c5ce7", bg: isDark ? "rgba(108,92,231,0.15)" : "rgba(108,92,231,0.08)", action: onChat },
                    { label: "Voice", icon: Phone, color: "#2ed573", bg: isDark ? "rgba(46,213,115,0.15)" : "rgba(46,213,115,0.08)", action: onVoiceCall },
                    { label: "Video", icon: Video, color: "#00d4ff", bg: isDark ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.08)", action: onVideoCall },
                  ]
                    .filter(btn => !(friend.username === 'nexora_31' && (btn.label === 'Voice' || btn.label === 'Video')))
                    .map(btn => (
                      <motion.button key={btn.label} whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}
                        onClick={btn.action}
                        className="flex flex-col items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all border border-transparent hover:border-current"
                        style={{ background: btn.bg, color: btn.color }}>
                        <btn.icon className="w-6 h-6" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{btn.label}</span>
                      </motion.button>
                    ))}
                </div>
              )}

              {/* Not friends: show ConnectionButton + gating message */}
              {connectionStatus !== "friends" && friend.username !== "nexora_31" && (
                <div className="flex flex-col gap-3">
                  <ConnectionButton
                    targetUsername={friend.username}
                    initialStatus={connectionStatus}
                    requestId={requestId}
                    size="lg"
                    fullWidth
                    onStatusChange={(newStatus, peerData) => {
                      setConnectionStatus(newStatus);
                      onConnectionChange?.(newStatus, peerData);
                    }}
                  />
                  <div className="flex items-center justify-center gap-2 py-3 rounded-2xl"
                    style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
                    <Shield className="w-3.5 h-3.5 opacity-30" />
                    <p className="text-[11px] font-bold uppercase tracking-widest opacity-30">Become friends to chat &amp; call</p>
                  </div>
                </div>
              )}

              {friend.username !== "nexora_31" && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={onBlock}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                  style={{ background: isDark ? "rgba(255,0,110,0.1)" : "rgba(255,0,110,0.05)", color: "#ff006e", border: "1px solid rgba(255,0,110,0.15)" }}>
                  <UserMinus className="w-4 h-4" />
                  Restrict Node Identity (Block)
                </motion.button>
              )}
            </div>

            {/* QR + Share row */}
            <div className="flex flex-wrap gap-2">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShowQR(!showQR)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-bold"
                style={{ background: isDark ? "rgba(108,92,231,0.1)" : "rgba(108,92,231,0.07)", color: "#6c5ce7", border: `1px solid rgba(108,92,231,0.2)` }}>
                <QrCode className="w-3.5 h-3.5" /> {showQR ? "Hide" : "Show"} QR
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShareMode(!shareMode)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-bold"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-secondary)", border: `1px solid var(--border-subtle)` }}>
                <Share2 className="w-3.5 h-3.5" /> Share
              </motion.button>
              {onToggleLock && (
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                  onClick={onToggleLock}
                  className="flex-[1.2] flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[11px] font-bold transition-colors"
                  style={{ background: isChatLocked ? "rgba(255,0,110,0.1)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: isChatLocked ? "#ff006e" : "var(--text-secondary)", border: `1px solid ${isChatLocked ? "rgba(255,0,110,0.2)" : "var(--border-subtle)"}` }}>
                  {isChatLocked ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />} {isChatLocked ? "Unlock Chat" : "Lock Chat"}
                </motion.button>
              )}
            </div>

            {/* QR Panel */}
            <AnimatePresence>
              {showQR && qrUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="flex flex-col items-center gap-3 py-3">
                    <div className="p-3 rounded-2xl border-2" style={{ borderColor: "rgba(108,92,231,0.2)", background: "#fff" }}>
                      <img src={qrUrl} alt="QR Code" className="w-36 h-36" />
                    </div>
                    <div className="text-center">
                      <p className="font-extrabold text-sm text-[#6c5ce7]">@{friend.username}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Joined {friend.joinedDate}</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <motion.button whileTap={{ scale: 0.94 }} onClick={downloadQR}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{ background: "rgba(108,92,231,0.1)", color: "#6c5ce7" }}>
                        ⬇ Download
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.94 }} onClick={shareQRToFriend}
                        className="flex-1 py-2 rounded-xl text-xs font-bold"
                        style={{ background: "rgba(46,213,115,0.1)", color: "#2ed573" }}>
                        ↗ Share QR
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Share panel */}
            <AnimatePresence>
              {shareMode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="flex flex-col gap-3 py-2">
                    {/* Copy link */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: "var(--border-subtle)" }}>
                      <p className="flex-1 text-xs truncate font-mono" style={{ color: "var(--text-muted)" }}>{displayUrl}</p>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={copyLink}
                        className="px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                        style={{ background: copied ? "rgba(46,213,115,0.1)" : "rgba(108,92,231,0.1)", color: copied ? "#2ed573" : "#6c5ce7" }}>
                        {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </motion.button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {shareApps.map(app => (
                        <motion.button key={app.name} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
                          onClick={() => window.open(app.url, "_blank")}
                          className="flex flex-col items-center gap-2 py-3 rounded-2xl text-[10px] font-bold shadow-sm transition-all"
                          style={{ background: `${app.color}08`, color: app.color, border: `1px solid ${app.color}20` }}>
                          <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-inner bg-white/50 dark:bg-black/20 overflow-hidden" style={{ borderColor: `${app.color}40` }}>
                            {app.icon}
                          </div>
                          <span className="tracking-wide uppercase">{app.name}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
