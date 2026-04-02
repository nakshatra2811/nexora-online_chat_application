"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import {
  MessageSquare, LayoutTemplate, Lock, Users, Settings, User, Search,
  LogOut, Sun, Moon, Shield, Menu, X, Eye, EyeOff, KeyRound, HelpCircle, ChevronLeft,
  Bell, Check, UserPlus, Share2
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { nexoraFetch, APP_LOGO } from "@/lib/config";
import { socketService } from "@/lib/socket";
import { pushService } from "@/lib/push";
import { NotificationSkeleton } from "@/components/Skeleton";
import { ShareProfileModal } from "@/components/ShareProfileModal";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { PermissionGate } from "@/components/PermissionGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [userRole, setUserRole] = useState("Standard Account");
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);

  // Global Share Profile
  const [showGlobalShare, setShowGlobalShare] = useState(false);
  const [globalProfile, setGlobalProfile] = useState({ name: "", username: "", email: "", avatarUrl: "" });

  // Notifications
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{ id: number; from: string; fromName: string; fromColor: string; time: string; avatarUrl?: string }[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [generalNotifications, setGeneralNotifications] = useState<any[]>([]);
  const [actionedIds, setActionedIds] = useState<number[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true);
  const notifRef = useRef<HTMLDivElement>(null);

  // Global action confirmation state
  const [confirmState, setConfirmState] = useState<{ step: number; href: string | null; type: string | null }>({ step: 0, href: null, type: null });
  const [isLocked, setIsLocked] = useState(false);

  // App Lock
  const [appLocked, setAppLocked] = useState(false);
  const [appLockPin, setAppLockPin] = useState("");
  const [appLockError, setAppLockError] = useState("");
  const [showAppLockPin, setShowAppLockPin] = useState(false);
  const [appForgotMode, setAppForgotMode] = useState(false);
  const [appForgotAnswer, setAppForgotAnswer] = useState("");
  const [appForgotNewPin, setAppForgotNewPin] = useState("");
  const [appForgotStep, setAppForgotStep] = useState<"answer" | "newpin">("answer");
  const [appForgotError, setAppForgotError] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const match = document.cookie.match(new RegExp('(^| )nexora_role=([^;]+)'));
    if (!match) {
      router.replace("/auth");
      return;
    }
    const role = match[2];
    setUserRole(role);
    if (localStorage.getItem("nexora_app_lock_enabled") === "true") {
      setAppLocked(true);
    }
    if (typeof window !== "undefined" && window.visualViewport) {
      const handleResize = () => {
        if (!window.visualViewport) return;
        setIsKeyboardVisible(window.visualViewport.height < window.innerHeight * 0.85);
      };
      window.visualViewport.addEventListener("resize", handleResize);
      const observer = new MutationObserver(() => {
        setIsChatActive(document.body.classList.contains("chat-active"));
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      // Initial check (non-blocking)
      setIsChatActive(document.body.classList.contains("chat-active"));

      return () => {
        window.visualViewport?.removeEventListener("resize", handleResize);
        observer.disconnect();
      };
    }
  }, []);

  useEffect(() => {
    // Load local profile for global sharing
    if (typeof window !== "undefined") {
      const signupEmail = localStorage.getItem("nexora_signup_email") || "user@nexora.io";
      const name = localStorage.getItem("nexora_signup_name") || signupEmail.split("@")[0];
      const username = localStorage.getItem("nexora_signup_username") || signupEmail.split("@")[0];
      setGlobalProfile({ name, username, email: signupEmail, avatarUrl: localStorage.getItem("nexora_avatar_url") || "" });
    }
  }, []);

  // ═══ Global Action Notification Protocol ═══
  useEffect(() => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    if (!username) return;

    const socket = socketService.connect();
    socket.emit("register", username);

    // Proactive Push Subscription Protocol
    pushService.subscribe(username).catch((..._args: any[]) => {});

      const fetchRequests = async () => {
        setIsLoadingNotifs(true);
        try {
          const [received, sent, notifs] = await Promise.all([
            nexoraFetch(`/api/connections/requests?username=${encodeURIComponent(username)}`),
            nexoraFetch(`/api/connections/sent?username=${encodeURIComponent(username)}`),
            nexoraFetch(`/api/notifications?username=${encodeURIComponent(username)}`)
          ]);
          
          if (received?.requests) setPendingRequests(received.requests);
          if (sent?.requests) setSentRequests(sent.requests);
          if (notifs?.notifications) setGeneralNotifications(notifs.notifications);
        } catch (err) {
          ((..._args: any[]) => {})("Global protocol fetch failed", err);
        } finally {
          setIsLoadingNotifs(false);
        }
      };

      fetchRequests();

      // Listen for real-time connection events
      const handleNewRequest = (data: any) => {
        setPendingRequests(prev => {
          if (prev.find(r => r.from === data.from)) return prev;
          const newReq = {
            id: Date.now() + Math.random(), 
            from: data.from,
            fromName: data.fromName || data.from,
            fromColor: data.fromColor || "from-purple-500 to-indigo-500",
            time: "Just now"
          };
          return [newReq, ...prev];
        });
      };

      const handleAccepted = (data: any) => {
        setPendingRequests(prev => prev.filter(r => r.from !== data.by));
        setSentRequests(prev => prev.filter(r => r.to !== data.by));
        // Add to general notifications to show accepted state globally
        setGeneralNotifications(prev => [{
          id: Date.now() + Math.random(),
          type: 'request_accepted',
          message: `${data.byName || data.by} accepted your follow request.`,
          from_username: data.by,
          time: 'Just now'
        }, ...prev]);
      };

      const handleNewNotification = (data: any) => {
        setGeneralNotifications(prev => [{
          id: data.id || (Date.now() + Math.random()),
          type: data.type,
          message: data.message,
          from_username: data.from_username,
          time: 'Just now'
        }, ...prev]);
      };

      socket.on("connection_request", handleNewRequest);
      socket.on("connection_accepted", handleAccepted);
      socket.on("new_notification", handleNewNotification);

      return () => {
        socket.off("connection_request", handleNewRequest);
        socket.off("connection_accepted", handleAccepted);
        socket.off("new_notification", handleNewNotification);
      };
  }, []);

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleFollowBack = async (targetUsername: string) => {
    const me = localStorage.getItem("nexora_signup_username") || "";
    try {
      await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ from: me, fromName: me, to: targetUsername }),
      });
      alert(`Follow request sent to @${targetUsername}`);
      // Add to actioned to animate out
      const notifId = generalNotifications.find(n => n.from_username === targetUsername && n.type === 'request_back_prompt')?.id;
      if (notifId) setActionedIds(prev => [...prev, notifId]);
      
      setTimeout(() => {
        setGeneralNotifications(prev => prev.filter(n => n.from_username !== targetUsername || n.type !== 'request_back_prompt'));
        if (notifId) setActionedIds(prev => prev.filter(id => id !== notifId));
      }, 400);
    } catch (err) {
      ((..._args: any[]) => {})("Follow back failed");
    }
  };

  const handleRespond = async (req: typeof pendingRequests[0], action: "accept" | "decline") => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    setActionedIds(prev => [...prev, req.id]);
    try {
      await nexoraFetch("/api/connections/respond", {
        method: "POST",
        body: JSON.stringify({ username, requestId: req.id, action }),
      });
      if (action === "accept") {
        // Show follow back prompt immediately in activity
        setGeneralNotifications(prev => [{
          id: Date.now() + Math.random(),
          type: 'request_back_prompt',
          message: `${req.fromName} started following you.`,
          from_username: req.from,
          time: 'Just now'
        }, ...prev]);

        // Add to secure connections in localStorage so chats page picks it up
        const colors = [
          "from-purple-500 to-indigo-500", "from-cyan-500 to-blue-500",
          "from-green-400 to-teal-500", "from-pink-500 to-rose-500",
          "from-orange-400 to-red-500"
        ];
        const existing = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
        const alreadyExists = existing.find((t: any) => t.username === req.from);
        if (!alreadyExists) {
          const newThread = {
            id: req.id,
            username: req.from,
            name: req.fromName || req.from,
            color: req.fromColor || colors[req.id % colors.length],
            online: true,
            preview: "Connected! Start chatting.",
            unread: 1,
          };
          localStorage.setItem("nexora_secure_connections", JSON.stringify([...existing, newThread]));
          window.dispatchEvent(new Event("storage"));
        }
      }
    } catch {}
    setTimeout(() => {
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
      setActionedIds(prev => prev.filter(id => id !== req.id));
    }, 400);
  };

  const handleAppLockUnlock = () => {
    const saved = localStorage.getItem("nexora_app_lock_pin") || "";
    if (appLockPin === saved) {
      setAppLocked(false);
      setAppLockPin("");
      setAppLockError("");
    } else {
      setAppLockError("Incorrect PIN. Try again.");
      setAppLockPin("");
    }
  };

  const handleAppForgot = () => {
    setAppForgotError("");
    if (appForgotStep === "answer") {
      const saved = localStorage.getItem("nexora_app_lock_answer") || "";
      if (appForgotAnswer.trim().toLowerCase() !== saved) {
        setAppForgotError("Incorrect answer."); return;
      }
      setAppForgotStep("newpin");
    } else {
      if (appForgotNewPin.length < 4) { setAppForgotError("PIN must be 4+ digits"); return; }
      localStorage.setItem("nexora_app_lock_pin", appForgotNewPin);
      setAppForgotMode(false);
      setAppForgotStep("answer");
      setAppForgotAnswer(""); setAppForgotNewPin("");
      setAppForgotError(""); setAppLockError(""); setAppLockPin("");
    }
  };

  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

  const navItems = [
    { name: "Chats", icon: MessageSquare, href: "/dashboard/chats" },
    { name: "Stories", icon: LayoutTemplate, href: "/dashboard/stories" },
    ...(userRole === "Admin"
      ? [{ name: "Vault", icon: Lock, href: "/dashboard/vault" }]
      : []),
    { name: "Profile", icon: User, href: "/dashboard/profile" },
    { name: "Settings", icon: Settings, href: "/dashboard/settings" },
  ];

  // Items shown in the bottom pill: now Chats, Stories, Profile, Settings
  const bottomNavItems = navItems.filter(item =>
    ["Chats", "Stories", "Profile", "Settings"].includes(item.name)
  );
  // Extra items that need a hamburger (e.g., Vault specifically)
  const extraNavItems = navItems.filter(item =>
    !["Chats", "Stories", "Profile", "Settings"].includes(item.name)
  );

  const handleLogout = () => {
    document.cookie = "nexora_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax;";
    router.push("/");
  };

  const triggerAction = (href: string | null, type: string = "navigate") => {
    if (type === "navigate" && href) {
      router.push(href);
      setMobileMenuOpen(false);
      return;
    }
    setConfirmState({ step: 1, href, type });
  };

  const handleConfirmYes = () => {
    setIsLocked(true);
    const { href, type } = confirmState;
    setConfirmState({ step: 0, href: null, type: null });
    
    // Simulate screen lock/processing before navigation
    setTimeout(() => {
      if (type === "logout") {
        handleLogout();
      } else if (href) {
        router.push(href);
      }
      setIsLocked(false);
      setMobileMenuOpen(false);
    }, 1200);
  };

  const handleConfirmNo = () => {
    setConfirmState({ step: 0, href: null, type: null });
  };

  return (
    <PermissionGate>
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>

      {/* ═══ APP LOCK SCREEN ═══ */}
      <AnimatePresence>
        {appLocked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center p-6"
            style={{ background: isDark ? "#0a0a14" : "#f0f2f8" }}>
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(108,92,231,0.15) 0%, transparent 70%)" }} />

            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", damping: 25 }}
              className="relative w-full max-w-sm flex flex-col items-center gap-6">

              {/* Lock icon */}
              <div className="w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl"
                style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", boxShadow: "0 0 60px rgba(108,92,231,0.35)" }}>
                <KeyRound className="w-10 h-10 text-white" />
              </div>

              <div className="text-center">
                <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>Nexora Locked</h1>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Enter your App Lock PIN to continue</p>
              </div>

              {!appForgotMode ? (
                <div className="w-full flex flex-col gap-3">
                  {/* PIN dots visual */}
                  <div className="flex justify-center gap-3 my-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-3 h-3 rounded-full transition-all"
                        style={{ background: i < appLockPin.length ? "#6c5ce7" : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }} />
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type={showAppLockPin ? "text" : "password"}
                      value={appLockPin}
                      onChange={e => setAppLockPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      onKeyDown={e => e.key === "Enter" && handleAppLockUnlock()}
                      placeholder="Enter PIN"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus
                      className="w-full px-6 py-4 rounded-2xl text-center text-2xl font-mono tracking-[0.5em] outline-none border transition-all"
                      style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.9)", borderColor: appLockError ? "#ff006e" : "var(--border-subtle)", color: "var(--text-primary)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                    />
                    <button onClick={() => setShowAppLockPin(s => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80"
                      style={{ color: "var(--text-muted)" }}>
                      {showAppLockPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {appLockError && (
                    <p className="text-center text-sm text-red-500 font-semibold">{appLockError}</p>
                  )}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleAppLockUnlock}
                    className="w-full py-4 rounded-2xl text-white font-extrabold text-lg shadow-xl"
                    style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", boxShadow: "0 8px 30px rgba(108,92,231,0.35)" }}>
                    Unlock
                  </motion.button>
                  <button onClick={() => setAppForgotMode(true)}
                    className="text-sm font-semibold text-center w-full flex items-center justify-center gap-1.5 mt-1"
                    style={{ color: "var(--text-muted)" }}>
                    <HelpCircle className="w-4 h-4" /> Forgot PIN?
                  </button>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <p className="text-sm font-semibold text-center" style={{ color: "var(--text-secondary)" }}>
                    {appForgotStep === "answer" ? (
                      localStorage.getItem("nexora_app_lock_question") || "Security question"
                    ) : "Set your new PIN"}
                  </p>
                  {appForgotStep === "answer" ? (
                    <input value={appForgotAnswer} onChange={e => setAppForgotAnswer(e.target.value)}
                      placeholder="Your answer"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none border"
                      style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                  ) : (
                    <input type="password" value={appForgotNewPin}
                      onChange={e => setAppForgotNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="New PIN (4-6 digits)"
                      inputMode="numeric"
                      className="w-full px-4 py-3 rounded-xl text-sm font-mono tracking-widest text-center outline-none border"
                      style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                  )}
                  {appForgotError && <p className="text-xs text-red-500 font-semibold text-center">{appForgotError}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setAppForgotMode(false); setAppForgotStep("answer"); setAppForgotAnswer(""); setAppForgotNewPin(""); setAppForgotError(""); }}
                      className="flex-1 py-3 rounded-xl font-bold text-sm"
                      style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", color: "var(--text-secondary)" }}>Back</button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleAppForgot}
                      className="flex-1 py-3 rounded-xl text-white font-bold text-sm shadow-lg"
                      style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
                      {appForgotStep === "answer" ? "Verify" : "Save PIN"}
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          DESKTOP TOP NAVBAR — Glassmorphic
      ═══════════════════════════════════════ */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex items-center justify-between h-[60px] px-8 z-[100] shrink-0 sticky top-0"
        style={{
          background: isDark ? "rgba(10, 10, 16, 0.75)" : "rgba(255, 255, 255, 0.65)",
          backdropFilter: "blur(40px) saturate(2)",
          WebkitBackdropFilter: "blur(40px) saturate(2)",
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
          boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.5)" : "0 4px 30px rgba(0,0,0,0.04)",
          pointerEvents: "auto",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Brand Identity */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="flex items-center gap-3.5 cursor-pointer select-none group"
            onClick={() => triggerAction("/dashboard/chats")}
          >
            <div className="relative">
              <div className="absolute -inset-1.5 bg-[#6c5ce7] opacity-0 group-hover:opacity-20 blur-xl rounded-full transition-opacity duration-500" />
              <img src={APP_LOGO} alt="Nexora" className="w-8 h-8 shrink-0 object-contain drop-shadow-xl rounded-[10px] relative z-10" />
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-lg font-[900] tracking-tighter leading-none" style={{ color: "var(--text-primary)" }}>Nexora</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#6c5ce7]">The Private Chat Protocol</span>
                <span className="text-[7.5px] font-bold opacity-30 uppercase tracking-widest">v1.2</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Center Navigation Protocol */}
        <div className="flex items-center gap-1.5 h-full">
          {navItems.map((item, i) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <motion.button
                key={item.name}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.05, ease: "easeOut" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => triggerAction(item.href)}
                className="relative flex items-center gap-2.5 px-4 h-10 rounded-2xl transition-all duration-300 cursor-pointer active:scale-95"
                style={{
                  color: isActive ? "#6c5ce7" : "var(--text-secondary)",
                  background: isActive ? (isDark ? "rgba(108,92,231,0.12)" : "rgba(108,92,231,0.08)") : "transparent",
                  pointerEvents: "auto",
                }}
              >
                <item.icon className="h-[15px] w-[15px]" strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[12.5px] tracking-tight ${isActive ? "font-black" : "font-semibold"}`}>
                  {item.name}
                </span>

                {/* Subtle Hover / Active Glow Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="topNavActive"
                    className="absolute inset-0 border border-[#6c5ce7]/20 rounded-2xl z-[-1]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">

          {/* ════ NOTIFICATION BELL ════ */}
          <div className="relative" ref={notifRef}>
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
              onClick={() => setShowNotifPanel(v => !v)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all relative"
              style={{
                background: showNotifPanel
                  ? (isDark ? "rgba(108,92,231,0.2)" : "rgba(108,92,231,0.12)")
                  : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                color: showNotifPanel ? "#6c5ce7" : "var(--text-secondary)",
              }}
            >
              <Bell className="h-4 w-4" />
              {(pendingRequests.length + generalNotifications.length) > 0 && (
                <motion.span
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full text-[9px] font-black text-white flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg,#ff006e,#ff4f8b)", boxShadow: "0 0 8px rgba(255,0,110,0.5)" }}
                >
                  {pendingRequests.length + generalNotifications.length}
                </motion.span>
              )}
            </motion.button>

            {/* Notification Dropdown Panel */}
            <AnimatePresence>
              {showNotifPanel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden z-[200] shadow-2xl"
                  style={{
                    background: isDark ? "rgba(14,14,22,0.98)" : "rgba(255,255,255,0.98)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                    backdropFilter: "blur(24px)",
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                     <div className="flex items-center gap-2">
                       <Bell className="w-4 h-4 text-[#6c5ce7]" />
                       <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Notifications</span>
                     </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {isLoadingNotifs ? (
                      <div className="py-12">
                         <LoadingAnimation variant="spinner" size="md" color="#6c5ce7" text="Syncing Activity..." />
                      </div>
                    ) : (pendingRequests.length === 0 && generalNotifications.length === 0) ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
                         <Bell className="w-6 h-6 text-muted-foreground" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No Activity</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <AnimatePresence mode="popLayout">
                          {pendingRequests.length > 0 && (
                            <div key="pending-requests-header" className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Pending Requests</span>
                            </div>
                          )}
                          {pendingRequests.map((req) => (
                            <motion.div key={`req-${req.id}`} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: actionedIds.includes(req.id) ? 0 : 1, x: 0 }} exit={{ opacity: 0 }}
                              className="px-4 py-4 border-b flex items-center gap-3" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-lg overflow-hidden shrink-0 ${!req.avatarUrl ? 'bg-gradient-to-br ' + (req.fromColor || "from-purple-500 to-indigo-500") : ""}`}>
                              {req.avatarUrl ? (
                                <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (req.fromName || req.from)?.[0]?.toUpperCase()
                              )}
                           </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold"><span className="text-[#6c5ce7]">@{req.from}</span> requested.</p>
                                <p className="text-[8px] opacity-30 uppercase font-black">{req.time}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleRespond(req, "accept")} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-xl">Confirm</button>
                                <button onClick={() => handleRespond(req, "decline")} className="p-2 rounded-lg opacity-40 hover:opacity-100 transition-opacity" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </motion.div>
                          ))}

                          {generalNotifications.length > 0 && (
                            <div key="activity-header" className="px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Recent Activity</span>
                            </div>
                          )}
                          {generalNotifications.map((notif) => (
                            <motion.div key={`notif-${notif.id}`} layout initial={{ opacity: 0 }} animate={{ opacity: actionedIds.includes(notif.id) ? 0 : 1 }} exit={{ opacity: 0 }}
                              className="px-4 py-4 border-b flex items-center gap-3 last:border-0" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${notif.type.includes('story') ? 'from-pink-500 to-rose-500' : 'from-indigo-500 to-blue-500'} flex items-center justify-center text-white font-black text-[10px]`}>{(notif.from_username || "N")[0].toUpperCase()}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] leading-tight"><span className="font-bold">@{notif.from_username}</span> {notif.message}</p>
                                <p className="text-[9px] opacity-30 mt-0.5">{notif.time || "Recently"}</p>
                              </div>
                              {notif.type === 'request_back_prompt' && (
                                <button onClick={() => handleFollowBack(notif.from_username)} className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase text-[#00d4ff] border border-[#00d4ff]/20 bg-[#00d4ff]/5">Follow Back</button>
                               )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                    <div className="p-3 border-t text-center" style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}>
                       <button onClick={() => { router.push('/dashboard/profile'); setShowNotifPanel(false); }} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all">Manage All In Vault</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Share Profile */}
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setShowGlobalShare(true)}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20"
            title="Share Profile"
          >
            <Share2 className="h-4 w-4" />
          </motion.button>

          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.08, rotate: isDark ? 180 : 0 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              color: isDark ? "#ffbe0b" : "var(--text-secondary)",
            }}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.button>

          {/* Logout */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
            onClick={() => triggerAction(null, "logout")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold transition-all"
            style={{ color: "#ff006e" }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">Log Out</span>
          </motion.button>
        </div>
      </motion.nav>

      {/* ═══════════════════════════════════════
          MAIN CONTENT AREA
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {showGlobalShare && globalProfile && (
           <ShareProfileModal key="global-share" profile={globalProfile} onClose={() => setShowGlobalShare(false)} isDark={isDark} />
        )}
      </AnimatePresence>

      <main className={`flex-1 relative w-full overflow-hidden flex ${(!isKeyboardVisible && !isChatActive) ? "pb-[72px]" : "pb-0"} md:pb-0 safe-bottom`}>
        {/* Ambient glow blobs */}
        <div className="absolute top-0 right-0 h-80 w-80 rounded-full pointer-events-none"
             style={{
               background: isDark
                 ? "radial-gradient(circle, rgba(108,92,231,0.1), transparent 70%)"
                 : "radial-gradient(circle, rgba(0,212,255,0.08), transparent 70%)",
               filter: "blur(80px)",
             }} />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full pointer-events-none"
             style={{
               background: isDark
                 ? "radial-gradient(circle, rgba(0,212,255,0.06), transparent 70%)"
                 : "radial-gradient(circle, rgba(108,92,231,0.05), transparent 70%)",
               filter: "blur(80px)",
             }} />
        {children}
      </main>

      {/* ═══════════════════════════════════════
          MOBILE TOP BACK NAVIGATION (Floating)
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {(pathname !== "/dashboard/chats" && !isChatActive) && (
          <motion.button
            key="mobile-back-button"
            initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => router.back()}
            className="md:hidden fixed top-2 left-4 z-[90] flex items-center justify-center w-10 h-10 rounded-full shadow-xl backdrop-blur-xl"
            style={{ 
              background: isDark ? "rgba(16,16,30,0.85)" : "rgba(255,255,255,0.9)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(108,92,231,0.15)"}`,
              color: "var(--text-primary)"
            }}>
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          MOBILE BOTTOM NAVIGATION (Telegram-Style Floating Pill)
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {!isKeyboardVisible && !isChatActive && (
          <motion.div
            key="mobile-bottom-nav"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="md:hidden fixed z-[200] rounded-full flex justify-center shadow-2xl"
            style={{
              background: isDark ? "rgba(16,16,24,0.92)" : "rgba(255,255,255,0.95)",
              backdropFilter: "blur(40px) saturate(2)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"}`,
              bottom: "calc(10px + env(safe-area-inset-bottom))",
              left: "12px", right: "12px",
              pointerEvents: "auto",
              boxShadow: isDark ? "0 10px 40px rgba(0,0,0,0.4)" : "0 8px 30px rgba(108,92,231,0.08)",
            }}>
            <div className="flex w-full items-center justify-around px-2 py-2">
              {bottomNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard/chats" && pathname.startsWith(item.href));
                const isProfile = item.name === "Profile";
                
                return (
                  <motion.button key={item.name} whileTap={{ scale: 0.8 }} onClick={() => triggerAction(item.href)}
                    className="relative flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer active:scale-95 px-3 py-1.5 rounded-2xl"
                    style={{ 
                      background: isActive ? (isDark ? "rgba(108,92,231,0.12)" : "rgba(108,92,231,0.06)") : "transparent",
                    }}>
                    {isProfile ? (
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm border overflow-hidden transition-all duration-300 ${isActive ? 'ring-2 ring-[#6c5ce7] ring-offset-2 scale-110' : 'scale-100'}`}
                           style={{ 
                             background: "linear-gradient(135deg, #6c5ce7, #00d4ff)",
                             borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                             borderWidth: isActive ? "2px" : "1px"
                           }}>
                        {globalProfile.avatarUrl ? (
                          <img src={globalProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (globalProfile.name?.[0] || globalProfile.username?.[0] || "?").toUpperCase()
                        )}
                      </div>
                    ) : (
                      <item.icon className="h-[20px] w-[20px] transition-all duration-300" 
                                 fill={isActive ? "#6c5ce7" : "none"}
                                 style={{ 
                                   color: isActive ? "#6c5ce7" : "var(--text-secondary)", 
                                   transform: isActive ? "scale(1.1)" : "scale(1)" 
                                 }} />
                    )}
                    
                    <span className="text-[9px] font-bold leading-none tracking-tight transition-colors duration-300"
                          style={{ color: isActive ? "#6c5ce7" : "var(--text-muted)" }}>
                      {item.name}
                    </span>

                    {isActive && (
                      <motion.div layoutId="mobileNavDot" className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#6c5ce7]" />
                    )}
                  </motion.button>
                );
              })}

              {extraNavItems.length > 0 && (
                <motion.button whileTap={{ scale: 0.8 }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="flex items-center justify-center p-2.5 rounded-2xl transition-colors duration-300">
                  <Menu className="h-[22px] w-[22px]" style={{ color: "var(--text-secondary)" }} />
                  {mobileMenuOpen && (
                     <motion.div layoutId="mobileNavDot" className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#6c5ce7]" />
                  )}
                </motion.button>
              )}
            </div>

            {/* Mobile Notification Slide-Up */}
            <AnimatePresence>
              {showNotifPanel && (
                <motion.div
                  key="mobile-notif-slideup"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-full mb-3 left-0 right-0 mx-4 rounded-2xl overflow-hidden shadow-2xl z-[200]"
                  style={{
                    background: isDark ? "rgba(14,14,22,0.98)" : "rgba(255,255,255,0.98)",
                    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                    backdropFilter: "blur(24px)",
                  }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" style={{ color: "#6c5ce7" }} />
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Notifications</span>
                    </div>
                    {pendingRequests.length > 0 && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,0,110,0.12)", color: "#ff006e" }}>
                        {pendingRequests.length} pending
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {pendingRequests.length === 0 ? (
                      <div className="flex items-center justify-center py-8 gap-2">
                        <Bell className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                        <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>No new notifications</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {pendingRequests.map((req) => (
                          <motion.div key={`mobile-req-${req.id}`}
                            initial={{ opacity: 0 }} animate={{ opacity: actionedIds.includes(req.id) ? 0 : 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-3 px-4 py-3 border-b last:border-0"
                            style={{ borderColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden ${!req.avatarUrl ? 'bg-gradient-to-br ' + (req.fromColor || "from-purple-500 to-indigo-500") : ""}`}>
                               {req.avatarUrl ? (
                                 <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 (req.fromName || req.from)?.[0]?.toUpperCase()
                               )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                                <span style={{ color: "#6c5ce7" }}>{req.fromName || req.from}</span> wants to connect
                              </p>
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{req.time}</p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <motion.button whileTap={{ scale: 0.85 }}
                                onClick={() => handleRespond(req, "decline")}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: "rgba(255,0,110,0.1)", color: "#ff006e" }}>
                                <X className="w-3.5 h-3.5" />
                              </motion.button>
                              <motion.button whileTap={{ scale: 0.85 }}
                                onClick={() => handleRespond(req, "accept")}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", color: "#fff" }}>
                                <Check className="w-3.5 h-3.5" />
                              </motion.button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE SLIDE-UP MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div key="mobile-menu-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-[60]"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
              onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              key="mobile-menu-content"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl p-6 pb-10 safe-bottom"
              style={{
                background: isDark ? "rgba(20,20,40,0.95)" : "rgba(255,255,255,0.95)",
                backdropFilter: "blur(40px)",
                borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}`,
              }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-6"
                   style={{ background: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
              <div className="grid grid-cols-4 gap-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <motion.button key={item.name} whileTap={{ scale: 0.9 }}
                      onClick={() => triggerAction(item.href)}
                      className="flex flex-col items-center gap-2 py-3 rounded-2xl"
                      style={{ background: isActive ? (isDark ? "rgba(108,92,231,0.15)" : "rgba(108,92,231,0.08)") : "transparent" }}>
                      <item.icon className="h-6 w-6" style={{ color: isActive ? "#6c5ce7" : "var(--text-muted)" }} />
                      <span className="text-[11px] font-semibold" style={{ color: isActive ? "#6c5ce7" : "var(--text-secondary)" }}>
                        {item.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <div className="mt-6 flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={toggleTheme}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }}>
                  {isDark ? <Sun className="h-4 w-4 text-[#ffbe0b]" /> : <Moon className="h-4 w-4" />}
                  <span className="text-xs font-bold">{isDark ? "Light" : "Dark"}</span>
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => triggerAction(null, "logout")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[#ff006e]"
                  style={{ background: "rgba(255,0,110,0.08)" }}>
                  <LogOut className="h-4 w-4" /><span className="text-xs font-bold">Log Out</span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════
          DOUBLE CONFIRMATION MODAL & LOCK SCREEN
      ═══════════════════════════════════════ */}
      <AnimatePresence>
        {confirmState.step > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border"
              style={{ background: isDark ? "rgba(20,20,36,0.95)" : "rgba(255,255,255,0.95)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-white/10"
                     style={{ border: `2px solid ${isDark ? "rgba(108,92,231,0.5)" : "rgba(108,92,231,0.3)"}` }}>
                  <Shield className="w-8 h-8" style={{ color: "#6c5ce7" }} />
                </div>
                <h2 className="text-xl font-extrabold mb-2 text-white">
                  Action Confirmation
                </h2>
                <p className="text-sm text-white/60 mb-8">
                  Are you sure you want to proceed with this {confirmState.type}?
                </p>
                <div className="flex gap-3 w-full">
                  <button onClick={handleConfirmNo} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleConfirmYes} className="flex-1 py-3 rounded-xl text-white font-bold shadow-lg bg-[#6c5ce7] hover:bg-[#5b4cdb] transition-colors">
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLocked && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-16 h-16 border-4 border-t-[#00d4ff] border-r-[#6c5ce7] border-b-transparent border-l-transparent rounded-full mb-4" />
            <h2 className="text-white font-bold text-xl tracking-widest uppercase">Processing Lock</h2>
            <p className="text-[#00d4ff] mt-2 font-mono text-sm tracking-widest">EXECUTING TASK...</p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </PermissionGate>
  );
}
