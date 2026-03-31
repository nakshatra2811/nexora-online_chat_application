"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit3, Camera, Shield, Zap, MapPin, Network, Link2, UserCheck, X,
  QrCode, Share2, Copy, Check, UserPlus, Mail, Phone, Search,
  MessageCircle, Send, ShieldOff, Bell, UserX, Clock, RefreshCcw
} from "lucide-react";
import { nexoraFetch } from "@/lib/config";
import { socketService } from "@/lib/socket";

/* ─── Mock contacts ─── */
const MOCK_CONTACTS: any[] = [];

/* ─── QR Code generator using canvas ─── */
function generateQRPattern(text: string, size = 200): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const modules = 21;
  const pad = 16;
  const cellSize = (size - pad * 2) / modules;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // Gradient for QR
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#6c5ce7");
  grad.addColorStop(1, "#00d4ff");

  // Generate pseudo-random pattern from text
  const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const seed = hash;

  const pseudoRand = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  let k = 0;
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      // Finder patterns (corners)
      const inTopLeft = r < 7 && c < 7;
      const inTopRight = r < 7 && c >= modules - 7;
      const inBottomLeft = r >= modules - 7 && c < 7;

      let filled = false;
      if (inTopLeft || inTopRight || inBottomLeft) {
        const lr = inTopLeft ? r : inTopRight ? r : r - (modules - 7);
        const lc = inTopLeft ? c : inTopRight ? c - (modules - 7) : c;
        filled = (lr === 0 || lr === 6 || lc === 0 || lc === 6) || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        filled = pseudoRand(k++) > 0.5;
      }

      if (filled) {
        ctx.fillStyle = grad;
        const x = pad + c * cellSize;
        const y = pad + r * cellSize;
        const s = cellSize - 1;
        const r2 = Math.min(2, s / 2);
        ctx.beginPath();
        ctx.moveTo(x + 0.5 + r2, y + 0.5);
        ctx.lineTo(x + 0.5 + s - r2, y + 0.5);
        ctx.quadraticCurveTo(x + 0.5 + s, y + 0.5, x + 0.5 + s, y + 0.5 + r2);
        ctx.lineTo(x + 0.5 + s, y + 0.5 + s - r2);
        ctx.quadraticCurveTo(x + 0.5 + s, y + 0.5 + s, x + 0.5 + s - r2, y + 0.5 + s);
        ctx.lineTo(x + 0.5 + r2, y + 0.5 + s);
        ctx.quadraticCurveTo(x + 0.5, y + 0.5 + s, x + 0.5, y + 0.5 + s - r2);
        ctx.lineTo(x + 0.5, y + 0.5 + r2);
        ctx.quadraticCurveTo(x + 0.5, y + 0.5, x + 0.5 + r2, y + 0.5);
        ctx.closePath();
        ctx.fill();
      }
      k++;
    }
  }

  // Add Nexora logo in center
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(size / 2 - 18, size / 2 - 18, 36, 36);
  ctx.fillStyle = "#6c5ce7";
  ctx.font = "bold 14px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", size / 2, size / 2 + 1);

  return canvas.toDataURL("image/png");
}

/* ─── Share Profile Modal ─── */
function ShareProfileModal({ profile, onClose, isDark }: { profile: any; onClose: () => void; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `https://nexora.app/u/${profile.username}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareApps = [
    { name: "WhatsApp", icon: "💬", color: "#25D366", bg: "rgba(37,211,102,0.12)", url: `https://wa.me/?text=Connect with me on Nexora! ${shareUrl}` },
    { name: "Telegram", icon: "✈️", color: "#2CA5E0", bg: "rgba(44,165,224,0.12)", url: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("Connect with me on Nexora!")}` },
    { name: "Instagram", icon: "📸", color: "#E1306C", bg: "rgba(225,48,108,0.12)", url: `https://instagram.com` },
    { name: "Snapchat", icon: "👻", color: "#FFFC00", bg: "rgba(255,252,0,0.15)", url: `https://snapchat.com` },
    { name: "Twitter/X", icon: "𝕏", color: "#1DA1F2", bg: "rgba(29,161,242,0.12)", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent("Connect with me on Nexora! " + shareUrl)}` },
    { name: "Email", icon: "✉️", color: "#6c5ce7", bg: "rgba(108,92,231,0.12)", url: `mailto:?subject=Join me on Nexora&body=Connect with me on Nexora! ${shareUrl}` },
  ];

  const handleShareApp = (app: typeof shareApps[0]) => {
    if (typeof navigator !== "undefined" && navigator.share && app.name === "WhatsApp") {
      navigator.share({ title: `Connect with ${profile.name} on Nexora`, url: shareUrl }).catch(() => {});
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
            {profile.name[0]}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{profile.name}</p>
            <p className="text-xs font-semibold text-[#6c5ce7]">@{profile.username}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>nexora.app/u/{profile.username}</p>
          </div>
        </div>

        {/* Copy link */}
        <div className="flex items-center gap-2 p-3 rounded-xl border"
          style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderColor: "var(--border-subtle)" }}>
          <p className="flex-1 text-xs truncate font-mono" style={{ color: "var(--text-muted)" }}>{shareUrl}</p>
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
              <span className="text-2xl leading-none">{app.icon}</span>
              {app.name}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Contacts Modal ─── */
function ContactsModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [search, setSearch] = useState("");

  const inviteApps = [
    { name: "WhatsApp", icon: "💬", color: "#25D366" },
    { name: "Telegram", icon: "✈️", color: "#2CA5E0" },
    { name: "Snapchat", icon: "👻", color: "#FFFC00" },
    { name: "Instagram", icon: "📸", color: "#E1306C" },
    { name: "SMS", icon: "📱", color: "#6c5ce7" },
  ];

  const handleInvite = (id: number) => {
    setContacts(prev => {
      const contact = prev.find(c => c.id === id);
      if (contact) {
        const savedRequests = JSON.parse(localStorage.getItem("nexora_pending_requests") || "[]");
        const newReq = { id: Math.random(), name: contact.name, color: contact.color, time: "Just now" };
        localStorage.setItem("nexora_pending_requests", JSON.stringify([newReq, ...savedRequests]));
        window.dispatchEvent(new Event("storage"));
      }
      return prev.map(c => c.id === id ? { ...c, invited: true } : c);
    });
  };

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] rounded-[2rem] flex flex-col shadow-2xl overflow-hidden"
        style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(108,92,231,0.12)"}` }}>

        {/* Header */}
        <div className="p-6 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>Contacts & Invite</h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Import from your device & send invitations</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl opacity-50 hover:opacity-100" style={{ color: "var(--text-muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Invite via apps row */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {inviteApps.map(app => (
              <motion.button key={app.name} whileTap={{ scale: 0.92 }}
                onClick={() => {
                  const url = app.name === "WhatsApp"
                    ? `https://wa.me/?text=${encodeURIComponent("Join me on Nexora — the privacy-first secure chat app! Download at https://nexora.app")}`
                    : app.name === "Telegram"
                    ? `https://t.me/share/url?url=https://nexora.app&text=${encodeURIComponent("Join me on Nexora!")}`
                    : "https://nexora.app";
                  window.open(url, "_blank");
                }}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap"
                style={{ background: `${app.color}18`, color: app.color, border: `1px solid ${app.color}30` }}>
                <span>{app.icon}</span> {app.name}
              </motion.button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
            style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", borderColor: "var(--border-subtle)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-primary)" }} />
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-2">
          {filtered.map(contact => (
            <div key={contact.id}
              className="flex items-center justify-between p-3.5 rounded-2xl"
              style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.025)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${contact.color} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                  {contact.avatar}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{contact.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{contact.phone}</p>
                </div>
              </div>
              {contact.isUser ? (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                  onClick={() => window.location.href = '/dashboard/chats'}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  style={{
                    background: "rgba(108,92,231,0.15)",
                    color: "#6c5ce7",
                    border: "1px solid rgba(108,92,231,0.2)"
                  }}>
                  <MessageCircle className="w-3.5 h-3.5" /> Msg
                </motion.button>
              ) : (
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    // Trigger SMS intent with body
                    window.location.href = `sms:${contact.phone.replace(/\s+/g, '')}?body=${encodeURIComponent("Join me on Nexora — the privacy-first secure chat app! Download at https://nexora.app")}`;
                    handleInvite(contact.id);
                  }}
                  disabled={contact.invited}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  style={{
                    background: contact.invited ? "rgba(46,213,115,0.15)" : "rgba(255,190,11,0.15)",
                    color: contact.invited ? "#2ed573" : "#ffbe0b",
                    border: `1px solid ${contact.invited ? "rgba(46,213,115,0.2)" : "rgba(255,190,11,0.2)"}`
                  }}>
                  {contact.invited ? <><Check className="w-3.5 h-3.5" /> Sent</> : <><UserPlus className="w-3.5 h-3.5" /> Connect</>}
                </motion.button>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Main Profile Page ─── */
export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState("Standard Account");
  const [profile, setProfile] = useState({
    name: "Loading...",
    username: "...",
    email: "...",
    phone: "Not Set",
    bio: "Nexora Privacy Account",
    joinedDate: "March 2026",
  });

  const [tempEmail, setTempEmail] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpInput, setOtpInput] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      // 1. Get Role
      const match = document.cookie.match(new RegExp('(^| )nexora_role=([^;]+)'));
      const role = match ? match[2] : "Standard Account";
      setUserRole(role === "Authorized Account" ? "Authorized Account" : "Standard Account");

      // 2. Base defaults
      const signupEmail = localStorage.getItem("nexora_signup_email") || "user@nexora.io";
      const signupName = localStorage.getItem("nexora_signup_name") || signupEmail.split("@")[0];
      const signupUsername = localStorage.getItem("nexora_signup_username") || signupEmail.split("@")[0];
      const signupPhone = localStorage.getItem("nexora_signup_phone") || "+91 00000 00000";
      
      let currentProfile = {
        name: signupName,
        username: signupUsername,
        email: signupEmail,
        phone: signupPhone,
        bio: role === "Authorized Account" ? "Chief Protocol Officer." : "Protocol Enthusiast.",
        joinedDate: "March 2026",
      };

      // 3. Try fetching from server
      try {
        const { nexoraFetch } = await import("@/lib/config");
        if (signupUsername) {
            const data = await nexoraFetch(`/api/users/profile?username=${encodeURIComponent(signupUsername)}`);
            if (data && data.user && !data._httpError) {
                currentProfile.name = data.user.fullName || currentProfile.name;
                currentProfile.email = data.user.email || currentProfile.email;
                currentProfile.phone = data.user.phoneNumber || currentProfile.phone;
                if (data.user.created_at) {
                    const d = new Date(data.user.created_at);
                    currentProfile.joinedDate = `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
                }
            }
        }
      } catch (err) {
        console.error("Failed to fetch fresh profile data", err);
      }

      const saved = localStorage.getItem("nexora_user_profile");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          currentProfile.bio = parsed.bio || currentProfile.bio;
          // Only sync back if not already set by DB
          if (currentProfile.phone === "+91 00000 00000") currentProfile.phone = parsed.phone || currentProfile.phone;
        } catch (e) {
          console.error("Failed to load local profile overrides", e);
        }
      }

      setProfile(currentProfile);
      localStorage.setItem("nexora_user_profile", JSON.stringify(currentProfile));
    };

    loadProfile();
  }, []);

  const [friends, setFriends] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [blockedThreads, setBlockedThreads] = useState<number[]>([]);

  const fetchIncomingRequests = async () => {
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    if (!myUsername) return;
    try {
      const data = await nexoraFetch(`/api/connections/requests?username=${encodeURIComponent(myUsername)}`);
      if (data && data.requests) {
        setPendingReceived(data.requests);
      }
    } catch (e) {
      console.error("Failed to fetch incoming requests:", e);
    }
  };

  const handleRespond = async (reqId: number, fromUsername: string, action: "accept" | "decline") => {
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    try {
      const resp = await nexoraFetch("/api/connections/respond", {
        method: "POST",
        body: JSON.stringify({ username: myUsername, requestId: reqId, action })
      });
      if (resp && (resp.status === "accepted" || resp.status === "declined")) {
        setPendingReceived(prev => prev.filter(r => r.id !== reqId));
        if (action === "accept") {
          // Trigger a refresh of connections
          const data = await nexoraFetch(`/api/connections?username=${encodeURIComponent(myUsername)}`);
          if (data && data.connections) {
            setFriends(data.connections);
            localStorage.setItem("nexora_secure_connections", JSON.stringify(data.connections));
          }
        }
      }
    } catch (e) {
      console.error("Response failed:", e);
    }
  };

  useEffect(() => {
    // Load dynamic data
    const defaultThreads: any[] = [];
    
    const threadsStr = localStorage.getItem("nexora_secure_connections");
    const threads = threadsStr ? JSON.parse(threadsStr) : defaultThreads;
    
    const blocked = JSON.parse(localStorage.getItem("nexora_blocked_threads") || "[]");
    setBlockedThreads(blocked);
    setFriends(threads.filter((t: any) => !blocked.includes(t.id)));

    const storedPending = localStorage.getItem("nexora_pending_requests");
    if (storedPending) setPendingSent(JSON.parse(storedPending));

    const totalSent = localStorage.getItem("nexora_stats_messages_sent") || "0";
    setSentCount(parseInt(totalSent));
  }, []);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    // Generate QR code
    const url = `https://nexora.app/u/${profile.username}`;
    const qr = generateQRPattern(url, 200);
    setQrDataUrl(qr);

    // Initial fetch
    fetchIncomingRequests();

    // Socket real-time updates
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    if (myUsername) {
      const socket = socketService.connect();
      socket.emit("register", myUsername);

      const handleRequest = (data: any) => {
        setPendingReceived(prev => {
          if (prev.find(r => r.from === data.from)) return prev;
          return [{
            id: Date.now(),
            from: data.from,
            fromName: data.fromName || data.from,
            fromColor: data.fromColor || "from-purple-500 to-indigo-500",
            time: "Just now"
          }, ...prev];
        });
      };

      const handleAccepted = (data: any) => {
        // If someone accepted OUR request, refresh friends
        const threadsStr = localStorage.getItem("nexora_secure_connections");
        if (threadsStr) setFriends(JSON.parse(threadsStr));
      };

      socket.on("connection_request", handleRequest);
      socket.on("connection_accepted", handleAccepted);

      return () => {
        socket.off("connection_request", handleRequest);
        socket.off("connection_accepted", handleAccepted);
      };
    }

    // Load blocked threads
    const stored = localStorage.getItem("nexora_blocked_threads");
    if (stored) setBlockedThreads(JSON.parse(stored));

    // Listen for storage changes (to sync between tabs)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "nexora_blocked_threads") {
        setBlockedThreads(JSON.parse(e.newValue || "[]"));
      } else if (e.key === "nexora_pending_requests") {
        setPendingSent(JSON.parse(e.newValue || "[]"));
      } else if (e.key === "nexora_secure_connections") {
        const defaultThreads: any[] = [];
        const threads = e.newValue ? JSON.parse(e.newValue) : defaultThreads;
        const currentBlocked = JSON.parse(localStorage.getItem("nexora_blocked_threads") || "[]");
        setFriends(threads.filter((t: any) => !currentBlocked.includes(t.id)));
      } else if (e.key === "nexora_stats_messages_sent") {
        setSentCount(parseInt(e.newValue || "0"));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [profile.username]);

  const handleUnblock = (id: number) => {
    const updated = blockedThreads.filter(tid => tid !== id);
    setBlockedThreads(updated);
    localStorage.setItem("nexora_blocked_threads", JSON.stringify(updated));
  };

  const handleDisconnect = (id: number) => setFriends(prev => prev.filter(f => f.id !== id));
  const handleCancelRequest = (id: number) => setPendingSent(prev => prev.filter(r => r.id !== id));

  return (
    <>
      <div className="flex flex-col lg:flex-row w-full h-full overflow-y-auto pt-24 lg:pt-6 p-4 sm:p-6 gap-6 safe-bottom" style={{ color: "var(--text-primary)" }}>

        {/* LEFT: Profile Card */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
          className="w-full lg:w-80 shrink-0 flex flex-col gap-5">

          {/* Profile Card */}
          <div className="glass-panel p-7 flex flex-col items-center text-center relative shadow-lg"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <button onClick={() => setIsEditing(!isEditing)}
              className="absolute top-4 right-4 p-2 rounded-full transition-all cursor-pointer"
              style={{ color: "var(--text-muted)" }}>
              <Edit3 className="w-5 h-5 hover:text-[#6c5ce7]" />
            </button>

            {/* Avatar */}
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center text-white text-4xl font-extrabold shadow-xl border-4"
                style={{ borderColor: "var(--bg-surface-solid)" }}>
                {profile.name[0]}
              </div>
              <button className="absolute bottom-1 right-1 p-2 rounded-full shadow-lg border hover:scale-110 transition-transform cursor-pointer"
                style={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-subtle)", color: "#6c5ce7" }}>
                <Camera className="w-4 h-4" />
              </button>
            </div>

            {isEditing ? (
              <div className="w-full space-y-3">
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                  className="neumorphic-input w-full p-2.5 text-center rounded-xl font-bold bg-transparent outline-none"
                  style={{ color: "var(--text-primary)" }} placeholder="Name" />
                <textarea value={profile.bio} onChange={e => {
                    const words = e.target.value.split(/\s+/).filter(w => w.length > 0);
                    if (words.length <= 300) {
                      setProfile({ ...profile, bio: e.target.value });
                    }
                  }}
                  className="neumorphic-input w-full p-4 text-left rounded-xl text-sm bg-transparent outline-none resize-none h-32"
                  style={{ color: "var(--text-primary)" }} placeholder="About me (Tell us your story... Max 300 words)" />
                <p className="text-[10px] text-right px-2 opacity-50" style={{ color: "var(--text-muted)" }}>
                   {profile.bio.split(/\s+/).filter(w => w.length > 0).length} / 300 words
                </p>
                
                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                  <p className="text-[10px] text-left uppercase font-bold text-[#6c5ce7] px-2">Contact Protocols</p>
                  <input value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
                    className="neumorphic-input w-full p-2.5 text-center rounded-xl text-xs bg-transparent outline-none"
                    style={{ color: "var(--text-secondary)" }} placeholder="Email (Requires OTP if changed)" />
                  <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}
                    className="neumorphic-input w-full p-2.5 text-center rounded-xl text-xs bg-transparent outline-none"
                    style={{ color: "var(--text-secondary)" }} placeholder="Phone Number" />
                </div>

                <button onClick={() => {
                  const saved = localStorage.getItem("nexora_user_profile");
                  const oldProfile = saved ? JSON.parse(saved) : null;
                  
                  if (oldProfile && oldProfile.email !== profile.email) {
                    setTempEmail(profile.email);
                    // Revert email in current state temporarily for OTP flow
                    setProfile({ ...profile, email: oldProfile.email });
                    setShowOTPModal(true);
                  } else {
                    localStorage.setItem("nexora_user_profile", JSON.stringify(profile));
                    setIsEditing(false);
                  }
                }}
                  className="w-full py-2.5 mt-4 bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white rounded-2xl font-bold shadow-lg hover:opacity-90 transition-opacity cursor-pointer">
                  Save Changes
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{profile.name}</h2>
                <div className="flex flex-col items-center gap-1 mb-3">
                  <p className="text-sm font-bold text-[#6c5ce7]">@{profile.username}</p>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-[#6c5ce7]/10 text-[#6c5ce7]">
                    {userRole}
                  </span>
                </div>
                <div className="w-full text-left bg-black/[0.02] dark:bg-white/[0.02] p-4 rounded-2xl border border-[var(--border-subtle)]">
                  <p className="text-[10px] uppercase font-black tracking-widest mb-2 opacity-40">About me</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar" style={{ color: "var(--text-secondary)" }}>{profile.bio || "No data transmitted."}</p>
                </div>
                
                <div className="w-full mt-5 space-y-2">
                  <div className="flex items-center gap-2 text-sm p-2.5 rounded-xl"
                    style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                    <Shield className="w-4 h-4 text-[#2ed573] shrink-0" />
                    <span>Online &amp; Encrypted</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="w-full mt-4 grid grid-cols-2 gap-2">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setShowShare(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", color: "white", boxShadow: "0 4px 15px rgba(108,92,231,0.3)" }}>
                    <Share2 className="w-3.5 h-3.5" /> Share Profile
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setShowContacts(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-secondary)", border: `1px solid var(--border-subtle)` }}>
                    <UserPlus className="w-3.5 h-3.5" /> Contacts
                  </motion.button>
                </div>
              </>
            )}
          </div>
          
          {/* About You Card */}
          <div className="glass-panel p-6 shadow-xl rounded-2xl"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-4 border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
              <Mail className="w-4 h-4 text-[#6c5ce7]" />
              <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>About You</h3>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#6c5ce7]/10 text-[#6c5ce7]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black" style={{ color: "var(--text-muted)" }}>Email Protocol</p>
                  <p className="text-sm font-bold truncate max-w-[180px]" style={{ color: "var(--text-primary)" }}>{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#2ed573]/10 text-[#2ed573]">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-black" style={{ color: "var(--text-muted)" }}>Phone Anchor</p>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{profile.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="glass-panel p-6 flex flex-col items-center gap-3 shadow-lg rounded-2xl"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-2 w-full mb-1">
              <QrCode className="w-4 h-4 text-[#6c5ce7]" />
              <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>My QR Code</h3>
            </div>

            {/* QR Image */}
            {qrDataUrl && (
              <div className="p-3 rounded-2xl border-2" style={{ borderColor: "rgba(108,92,231,0.2)", background: "#fff" }}>
                <img src={qrDataUrl} alt="Profile QR Code" className="w-40 h-40" />
              </div>
            )}

            {/* Username and joined date below QR */}
            <div className="text-center">
              <p className="font-extrabold text-sm text-[#6c5ce7]">@{profile.username}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Joined {profile.joinedDate}</p>
            </div>

            <p className="text-[10px] text-center tracking-wider uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
              Scan to connect on Nexora
            </p>
          </div>

          {/* Stats Card */}
          <div className="glass-panel p-6 shadow-xl rounded-2xl"
            style={{ background: "linear-gradient(135deg, #1a1a2e, #2d3436)", color: "white", borderColor: "rgba(255,255,255,0.1)" }}>
            <h3 className="font-bold text-sm uppercase tracking-widest mb-5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Zap className="w-4 h-4 text-[#00d4ff]" /> Protocol Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Active Nodes", value: friends.length, color: "text-[#00d4ff]" },
                { label: "Vault Sync", value: "Active", color: "text-[#ff006e]" },
                { label: "Messages Sent", value: sentCount > 0 ? sentCount : "0", color: "text-[#2ed573]" },
                { label: "E2E Tunnels", value: friends.length, color: "text-[#ffbe0b]" },
              ].map(stat => (
                <div key={stat.label} className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{stat.label}</p>
                  <p className={`text-2xl font-extrabold mt-1 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Friends & Pending */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}
          className="flex-1 flex flex-col gap-5">

          {/* Friends List */}
          <div className="glass-panel p-7 shadow-lg rounded-2xl" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                <Network className="w-5 h-5 text-[#6c5ce7]" /> Secure Connections
              </h2>
              <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ background: "rgba(46,213,115,0.15)", color: "#2ed573" }}>
                {friends.filter(f => f.online).length} Active
              </span>
            </div>
            <AnimatePresence>
              <div className="flex flex-col gap-3">
                {friends.map((friend, idx) => (
                  <motion.div key={friend.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.04 }}
                    className="group flex items-center justify-between p-4 rounded-2xl transition-all"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-4">
                      <div className={`relative w-12 h-12 rounded-full bg-gradient-to-tr ${friend.color} flex justify-center items-center text-white font-bold text-lg shadow-md shrink-0`}>
                        {friend.name[0]}
                        <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 ${friend.online ? "bg-[#2ed573]" : "bg-gray-400"}`}
                          style={{ borderColor: "var(--bg-card)" }} />
                      </div>
                      <div>
                        <h4 className="font-bold transition-colors truncate max-w-[120px] sm:max-w-none" style={{ color: "var(--text-primary)" }}>{friend.name}</h4>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{friend.preview}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:block px-3 py-1 border rounded-full text-xs font-bold"
                        style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                        {friend.unread > 0 ? `${friend.unread} New` : "Synced"}
                      </span>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => handleDisconnect(friend.id)}
                        className="p-2 rounded-full transition-colors cursor-pointer"
                        style={{ background: "var(--bg-surface-solid)", color: "var(--text-muted)" }}>
                        <X className="w-4 h-4 hover:text-red-500" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
                {friends.length === 0 && (
                  <p className="text-center text-sm py-4" style={{ color: "var(--text-muted)" }}>No active connections.</p>
                )}
              </div>
            </AnimatePresence>
          </div>

          {/* (NEW) Incoming Requests Section */}
          <div className="glass-panel p-7 shadow-lg rounded-2xl" 
            style={{ background: "var(--bg-surface)", borderColor: "rgba(108,92,231,0.2)", border: "2px solid rgba(108,92,231,0.1)" }}>
            <div className="flex justify-between items-center mb-5 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                <Bell className="w-5 h-5 text-[#6c5ce7]" /> Pending Connections
              </h2>
              <div className="flex items-center gap-2">
                {pendingReceived.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse" style={{ background: "rgba(108,92,231,0.15)", color: "#6c5ce7" }}>
                    {pendingReceived.length} NEW
                  </span>
                )}
                <motion.button
                  whileHover={{ rotate: 180 }}
                  transition={{ duration: 0.4 }}
                  onClick={fetchIncomingRequests}
                  className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#6c5ce7]"
                  title="Refresh Requests"
                >
                  <RefreshCcw className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
            <AnimatePresence>
              <div className="flex flex-col gap-3">
                {pendingReceived.map((req, idx) => (
                  <motion.div key={req.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl gap-4"
                    style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(108,92,231,0.03)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${req.fromColor || 'from-purple-500 to-indigo-500'} flex items-center justify-center text-white font-black text-lg shadow-md border-2 border-white dark:border-[#161622]`}>
                        {req.fromName?.[0] || req.from?.[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>@{req.from}</h4>
                        <p className="text-xs opacity-60 font-medium" style={{ color: "var(--text-muted)" }}>{req.fromName || "Sent a request"}</p>
                        <div className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest opacity-40">
                          <Clock className="w-2.5 h-2.5" /> {req.time}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <motion.button whileTap={{ scale: 0.93 }}
                        onClick={() => handleRespond(req.id, req.from, "decline")}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: "var(--text-muted)" }}>
                        Remove
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.93 }}
                        onClick={() => handleRespond(req.id, req.from, "accept")}
                        className="flex-1 sm:sm:flex-none px-6 py-2 rounded-xl text-xs font-black text-white shadow-lg"
                        style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
                        Confirm
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
                {pendingReceived.length === 0 && (
                  <div className="text-center py-8 opacity-40">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-bold">No incoming requests</p>
                    <p className="text-[10px] mt-1">Your connection vault is currently empty.</p>
                  </div>
                )}
              </div>
            </AnimatePresence>
          </div>

          {/* Pending Sent Requests */}
          <div className="glass-panel p-7 shadow-lg rounded-2xl" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex justify-between items-center mb-5 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                <UserCheck className="w-5 h-5 text-[#ffbe0b]" /> Sent Requests
              </h2>
              <span className="text-sm px-3 py-1 rounded-full font-bold" style={{ background: "rgba(255,190,11,0.2)", color: "#d97706" }}>
                {pendingSent.length}
              </span>
            </div>
            <AnimatePresence>
              <div className="flex flex-col gap-3">
                {pendingSent.map((req, idx) => (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: idx * 0.07 }}
                    className="flex items-center justify-between p-4 rounded-2xl"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${req.color} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {req.name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm truncate max-w-[100px] sm:max-w-none" style={{ color: "var(--text-primary)" }}>{req.name}</h4>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{req.time}</p>
                      </div>
                    </div>
                    <button onClick={() => handleCancelRequest(req.id)}
                      className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-xl cursor-pointer"
                      style={{ background: "rgba(255,0,0,0.1)" }}>
                      Cancel
                    </button>
                  </motion.div>
                ))}
                {pendingSent.length === 0 && (
                  <p className="text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>No pending requests.</p>
                )}
              </div>
            </AnimatePresence>
          </div>

          {/* Blocked Protocols Section */}
          <div className="glass-panel p-7 shadow-lg rounded-2xl" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
            <div className="flex justify-between items-center mb-5 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <h2 className="text-xl font-extrabold flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
                <ShieldOff className="w-5 h-5 text-red-500" /> Blocked Protocols
              </h2>
              <span className="text-sm px-3 py-1 rounded-full font-bold" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                {blockedThreads.length}
              </span>
            </div>
            <AnimatePresence>
              <div className="flex flex-col gap-3">
                {blockedThreads.map((id, idx) => {
                  // Find name from mocks (for demo)
                  const savedConnections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
                  const user = savedConnections.find((u: any) => u.id === id) || { name: `Unknown Account ${id}`, color: "from-gray-500 to-gray-700" };
                  
                  return (
                    <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-4 rounded-2xl group transition-all"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${user.color} flex items-center justify-center text-white font-bold text-sm shadow-sm opacity-50 grayscale`}>
                          {user.name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)] opacity-70">{user.name}</h4>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-red-500/80">Restricted</p>
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => handleUnblock(id)}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg cursor-pointer transition-all"
                        style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                        Unblock
                      </motion.button>
                    </motion.div>
                  );
                })}
                {blockedThreads.length === 0 && (
                  <p className="text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>No blocked users.</p>
                )}
              </div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showShare && <ShareProfileModal profile={profile} onClose={() => setShowShare(false)} isDark={isDark} />}
        {showContacts && <ContactsModal onClose={() => setShowContacts(false)} isDark={isDark} />}
        
        {showOTPModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowOTPModal(false)}
              className="absolute inset-0 bg-[#0c0c14]/80 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-panel p-8 text-center bg-white/95 rounded-[32px] border border-white/50 shadow-2xl">
              <div className="mx-auto w-16 h-16 bg-[#6c5ce7]/10 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-[#6c5ce7]" />
              </div>
              <h3 className="text-2xl font-black text-[#1a1a2e] mb-2">Verify Protocol</h3>
              <p className="text-sm text-[#64748b] mb-8">
                // Authorized Account Global Chat Lock
                An authorization code has been dispatched to <span className="text-[#6c5ce7] font-bold">{tempEmail}</span>. Enter it to confirm identity.
              </p>
              
              <div className="space-y-4">
                <input value={otpInput} onChange={e => setOtpInput(e.target.value)} maxLength={6}
                  className="neumorphic-input w-full p-4 text-center text-2xl font-black tracking-[0.5em] rounded-2xl bg-transparent outline-none border-2 border-[#6c5ce7]/20 focus:border-[#6c5ce7] transition-all"
                  style={{ color: "#1a1a2e" }} placeholder="000000" />
                
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Experimental Account: Use 123456</p>

                <div className="flex gap-3 pt-4">
                  <button onClick={() => setShowOTPModal(false)}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-[#64748b] bg-gray-100 hover:bg-gray-200 transition-colors">
                    Discard
                  </button>
                  <button onClick={() => {
                    if (otpInput === "123456") {
                      const updatedProfile = { ...profile, email: tempEmail };
                      setProfile(updatedProfile);
                      localStorage.setItem("nexora_user_profile", JSON.stringify(updatedProfile));
                      setShowOTPModal(false);
                      setIsEditing(false);
                      setOtpInput("");
                    } else {
                      alert("Invalid Protocol Code.");
                    }
                  }}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] shadow-lg hover:opacity-90 transition-opacity">
                    Verify & Link
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
