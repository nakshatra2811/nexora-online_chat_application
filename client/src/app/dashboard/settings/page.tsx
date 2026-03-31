"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Shield, Palette, Lock, Moon, Zap, Video,
  KeyRound, Eye, EyeOff, ChevronRight, Check,
  HelpCircle, RefreshCw, Smartphone, X, LogOut
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { useTheme } from "@/lib/theme";
import { createPortal } from "react-dom";

/* ─── Security questions ─── */
const GLOBAL_CHAT_LOCK_QUESTIONS = [
  "What is your secret code name?",
  "What is your hidden sanctuary?",
  "What is the name of your first guardian?",
  "What is your most obscure memory?",
  "What city do you rule in secret?",
];

const APP_LOCK_QUESTIONS = [
  "What is your mother's maiden name?",
  "What is the name of your primary school?",
  "What was the make of your first car?",
  "What is your favorite sports team?",
  "What street did you live on as a child?",
];

const SETTINGS_SECTIONS = [
  {
    title: "Privacy & Security",
    icon: Shield,
    color: "from-[#6c5ce7] to-[#00d4ff]",
    items: [
      { label: "Secure Protocols", desc: "Advanced protection on all messages", toggle: true, value: true },
      { label: "Screenshot Detection", desc: "Notify when recipient screenshots", toggle: true, value: true },
      { label: "Disappearing Messages", desc: "Auto-delete messages after 1 hour", toggle: true, value: false },
      { label: "Two-Factor Auth (2FA)", desc: "TOTP-based additional layer", toggle: true, value: true },
    ]
  },
  {
    title: "Notifications",
    icon: Bell,
    color: "from-[#ff006e] to-[#ffbe0b]",
    items: [
      { label: "Push Notifications", desc: "New messages & requests", toggle: true, value: true },
      { label: "Message Previews", desc: "Show content in notifications", toggle: false, value: false },
      { label: "Story Alerts", desc: "When contacts post snaps", toggle: true, value: true },
    ]
  },
  {
    title: "Appearance",
    icon: Palette,
    color: "from-[#2ed573] to-[#1e90ff]",
    items: [
      { label: "Dark Mode", desc: "Dark theme across all panels", toggle: false, value: false },
      { label: "Glassmorphism FX", desc: "Blur & transparency effects", toggle: true, value: true },
      { label: "Reduced Motion", desc: "Limit animations", toggle: false, value: false },
    ]
  },
  {
    title: "Storage & Data",
    icon: Lock,
    color: "from-[#a29bfe] to-[#fd79a8]",
    items: [
      { label: "Vault Auto-Lock", desc: "Lock after 5 mins inactivity", toggle: true, value: true },
      { label: "Media Auto-Delete", desc: "Purge after 24h", toggle: true, value: false },
      { label: "Zero-Log Mode", desc: "No activity logs stored", toggle: true, value: true },
    ]
  },
];

// ─── PIN Input component ───
function PinInput({ value, onChange, label = "Enter PIN" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder={label}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        className="w-full px-4 py-3 pr-12 rounded-xl text-sm font-mono tracking-[0.4em] outline-none transition-all shadow-inner"
        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
      />
      <button onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 text-white">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── Lock Setup Modal ───
type LockType = "app" | "global_chat";
interface LockSetupProps {
  type: LockType;
  onClose: () => void;
  onSave: () => void;
  isDark: boolean;
}

function LockSetupModal({ type, onClose, onSave, isDark }: LockSetupProps) {
  const questions = type === "global_chat" ? GLOBAL_CHAT_LOCK_QUESTIONS : APP_LOCK_QUESTIONS;
  const prefix = type === "global_chat" ? "nexora_global_chat_lock" : "nexora_app_lock";
  const title = type === "global_chat" ? "Chat Page Lock Setup" : "App Lock Setup";
  const icon = type === "global_chat" ? "💬" : "📱";

  const [step, setStep] = useState<"pin" | "confirm" | "question">("pin");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [selectedQ, setSelectedQ] = useState(0);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  const handleNext = () => {
    setError("");
    if (step === "pin") {
      if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
      setStep("confirm");
    } else if (step === "confirm") {
      if (pin !== confirmPin) { setError("PINs don't match"); return; }
      setStep("question");
    } else {
      if (answer.trim().length < 2) { setError("Please provide a longer answer"); return; }
      localStorage.setItem(`${prefix}_enabled`, "true");
      localStorage.setItem(`${prefix}_pin`, pin);
      localStorage.setItem(`${prefix}_question`, questions[selectedQ]);
      localStorage.setItem(`${prefix}_answer`, answer.trim().toLowerCase());
      onSave();
      onClose();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        className="w-full max-w-sm rounded-[2rem] p-7 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col gap-5 border"
        style={{ background: isDark ? "rgba(16,16,30,0.95)" : "rgba(255,255,255,0.95)", borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(108,92,231,0.2)" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>{icon}</div>
            <div>
              <h2 className="font-extrabold text-base" style={{ color: "var(--text-primary)" }}>{title}</h2>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Step {step === "pin" ? "1" : step === "confirm" ? "2" : "3"} of 3
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl opacity-50 hover:opacity-100 text-white cursor-pointer z-50 relative">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          {["pin", "confirm", "question"].map((s, i) => (
            <div key={`step-${s}`} className="flex-1 h-1.5 rounded-full transition-all"
              style={{ background: ["pin", "confirm", "question"].indexOf(step) >= i ? "linear-gradient(90deg,#6c5ce7,#00d4ff)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }} />
          ))}
        </div>

        {/* Content */}
        {step === "pin" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Create a {title} PIN (4-6 digits)</p>
            <PinInput value={pin} onChange={setPin} label="Enter new PIN" />
          </div>
        )}
        {step === "confirm" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Confirm your PIN</p>
            <PinInput value={confirmPin} onChange={setConfirmPin} label="Re-enter PIN" />
          </div>
        )}
        {step === "question" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Choose a security question (for forgot password)</p>
            <select value={selectedQ} onChange={e => setSelectedQ(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all shadow-inner"
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
              {questions.map((q, i) => <option key={i} value={i} style={{ color: "#000" }}>{q}</option>)}
            </select>
            <input value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder="Your answer"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all shadow-inner"
              style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleNext}
          className="w-full py-3.5 rounded-2xl text-white font-bold shadow-lg text-sm"
          style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
          {step === "question" ? "Save Lock Settings" : "Continue →"}
        </motion.button>
      </motion.div>
    </div>,
    document.body
  );
}

// ─── Lock Card ─── (shown in settings for each lock type)
function LockCard({ type, isDark }: { type: LockType; isDark: boolean }) {
  const prefix = type === "global_chat" ? "nexora_global_chat_lock" : "nexora_app_lock";
  const title = type === "global_chat" ? "Chat Page Lock" : "App Lock";
  const desc = type === "global_chat" ? "Lock entire Chats Dashboard" : "Require PIN on app open after login";
  const color = type === "global_chat" ? "from-[#ff006e] to-[#a29bfe]" : "from-[#6c5ce7] to-[#00d4ff]";
  const Icon = type === "global_chat" ? KeyRound : Smartphone;

  const [enabled, setEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [newPin, setNewPin] = useState("");
  const [forgotStep, setForgotStep] = useState<"answer" | "newpin">("answer");
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    setEnabled(localStorage.getItem(`${prefix}_enabled`) === "true");
  }, [prefix]);

  const handleToggle = () => {
    if (!enabled) {
      setShowSetup(true);
    } else {
      localStorage.removeItem(`${prefix}_enabled`);
      localStorage.removeItem(`${prefix}_pin`);
      localStorage.removeItem(`${prefix}_question`);
      localStorage.removeItem(`${prefix}_answer`);
      setEnabled(false);
    }
  };

  const handleForgot = () => {
    setForgotError("");
    if (forgotStep === "answer") {
      const saved = localStorage.getItem(`${prefix}_answer`) || "";
      if (forgotAnswer.trim().toLowerCase() !== saved) {
        setForgotError("Incorrect answer. Try again.");
        return;
      }
      setForgotStep("newpin");
    } else {
      if (newPin.length < 4) { setForgotError("PIN must be 4+ digits"); return; }
      localStorage.setItem(`${prefix}_pin`, newPin);
      setShowForgot(false);
      setForgotAnswer(""); setNewPin(""); setForgotStep("answer");
    }
  };

  const savedQ = typeof window !== "undefined" ? localStorage.getItem(`${prefix}_question`) || "" : "";

  return (
    <>
      <div className="p-5 rounded-2xl border transition-all"
        style={{
          background: enabled ? (isDark ? "rgba(108,92,231,0.08)" : "rgba(108,92,231,0.04)") : "var(--bg-card)",
          borderColor: enabled ? "rgba(108,92,231,0.2)" : "var(--border-subtle)",
        }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-md`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
            </div>
          </div>
          {/* Toggle */}
          <motion.div
            onClick={handleToggle}
            className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${enabled ? "bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff]" : "bg-gray-300 dark:bg-gray-600"}`}
            whileTap={{ scale: 0.94 }}>
            <motion.div layout
              className="absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-md"
              animate={{ left: enabled ? "calc(100% - 22px)" : "2px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }} />
          </motion.div>
        </div>

        {enabled && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-2 flex gap-2 flex-wrap">
            <button onClick={() => setShowSetup(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
              style={{ background: "rgba(108,92,231,0.1)", color: "#6c5ce7" }}>
              <RefreshCw className="w-3 h-3" /> Change PIN
            </button>
            <button onClick={() => setShowForgot(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }}>
              <HelpCircle className="w-3 h-3" /> Forgot PIN
            </button>
          </motion.div>
        )}
      </div>

      {/* Setup Modal */}
      <AnimatePresence mode="wait">
        {showSetup && <LockSetupModal key={`${type}-setup`} type={type} isDark={isDark} onClose={() => setShowSetup(false)} onSave={() => setEnabled(true)} />}
      </AnimatePresence>

      {/* Forgot Password Modal */}
      <AnimatePresence mode="wait">
        {showForgot && (
          <div key={`${type}-forgot-overlay`} className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl" onClick={() => setShowForgot(false)}>
            <motion.div key={`${type}-forgot-modal`} initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-[2rem] p-7 shadow-2xl flex flex-col gap-4"
              style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(108,92,231,0.12)"}` }}>
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold text-base" style={{ color: "var(--text-primary)" }}>Forgot {title} PIN</h2>
                <button onClick={() => setShowForgot(false)} className="p-2 opacity-50 hover:opacity-100" style={{ color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {forgotStep === "answer" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold p-3 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", color: "var(--text-secondary)" }}>
                    {savedQ || "Security question not set"}
                  </p>
                  <input value={forgotAnswer} onChange={e => setForgotAnswer(e.target.value)}
                    placeholder="Your answer"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none border"
                    style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold text-green-500">✓ Answer correct! Set new PIN:</p>
                  <PinInput value={newPin} onChange={setNewPin} label="New PIN" />
                </div>
              )}

              {forgotError && <p className="text-xs text-red-500 font-semibold">{forgotError}</p>}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleForgot}
                className="w-full py-3.5 rounded-2xl text-white font-bold shadow-lg text-sm"
                style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
                {forgotStep === "answer" ? "Verify Answer" : "Reset PIN"}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Settings Page ───
export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(SETTINGS_SECTIONS);
  const { isDark, toggleTheme } = useTheme();
  const [confirmSetting, setConfirmSetting] = useState<{ si: number; ii: number; label: string; isDanger?: boolean } | null>(null);
  
  const [userRole, setUserRole] = useState<string>("Normal User");
  
  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )nexora_role=([^;]+)'));
    setUserRole(match ? match[2] : "Normal User");
  }, []);

  const toggleSetting = (sectionIdx: number, itemIdx: number, label: string) => {
    setConfirmSetting({ si: sectionIdx, ii: itemIdx, label });
  };

  const handleLogout = () => {
    // Clear cookies and local user data
    document.cookie = "nexora_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    localStorage.removeItem("nexora_assigned_role");
    localStorage.removeItem("nexora_signup_username");
    localStorage.removeItem("nexora_signup_name");
    localStorage.removeItem("nexora_signup_email");
    localStorage.removeItem("nexora_signup_phone");
    localStorage.removeItem("nexora_signup_color");
    router.push("/auth");
  };

  const handleDangerZone = (action: string) => {
    setConfirmSetting({ si: -1, ii: -1, label: action, isDanger: true });
  };

  const executeToggle = () => {
    if (!confirmSetting) return;
    const { si, ii, label, isDanger } = confirmSetting;
    setConfirmSetting(null);
    if (isDanger) return;
    if (label === "Dark Mode") { toggleTheme(); return; }
    setSettings(prev => prev.map((section, sIdx) =>
      sIdx !== si ? section : {
        ...section,
        items: section.items.map((item, iIdx) =>
          iIdx !== ii ? item : { ...item, value: !item.value }
        )
      }
    ));
  };

  return (
    <div className="relative flex flex-col w-full h-full overflow-y-auto pt-24 md:pt-8 p-6 md:p-8" style={{ color: "var(--text-primary)" }}>
      <FloatingOrbs opacity={0.05} orbs={[
        { size: 320, x: "65%", y: "-5%", color: "#6c5ce7", duration: 14, delay: 0, blur: 100 },
        { size: 260, x: "-5%", y: "55%", color: "#2ed573", duration: 16, delay: 3, blur: 90 },
      ]} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 w-full max-w-5xl">
        <div className="text-left">
          <h1 className="text-4xl font-extrabold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Shield className="w-4 h-4" /><span>Configure your Nexora privacy account.</span>
          </p>
        </div>
        
        <motion.button 
          whileHover={{ scale: 1.05 }} 
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-xl text-sm font-bold w-full sm:w-auto shadow-lg backdrop-blur-md transition-all border"
          style={{ background: "rgba(225, 29, 72, 0.15)", color: "#f43f5e", borderColor: "rgba(225, 29, 72, 0.3)" }}
        >
          <LogOut className="w-4 h-4" />
          <span>Secure Logout</span>
        </motion.button>
      </motion.div>

      {/* ─── LOCK SYSTEMS ─── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="relative z-10 mb-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] shadow-md">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-extrabold text-base" style={{ color: "var(--text-primary)" }}>Lock Systems</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(108,92,231,0.12)", color: "#6c5ce7" }}>INDEPENDENT</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <LockCard type="app" isDark={isDark} />
          {userRole === "Authorized Account" && (
            <LockCard type="global_chat" isDark={isDark} />
          )}
        </div>
      </motion.div>

      {/* ─── ADDITIONAL FEATURES ─── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="relative z-10 mb-6 max-w-5xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl shadow-md" style={{ background: "linear-gradient(135deg, #ff006e, #ffbe0b)" }}>
            <Video className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-extrabold text-base" style={{ color: "var(--text-primary)" }}>Additional Features</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/dashboard/cinema")}
            className="p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group"
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "var(--bg-card)",
              borderColor: "var(--border-subtle)",
            }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shadow-md flex items-center justify-center transition-all bg-gradient-to-br from-[#ff006e] to-[#ffbe0b]">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Cinema Lounge</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Watch movies together in sync</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: "var(--text-muted)" }} />
          </motion.div>
        </div>
      </motion.div>

      {/* ─── GENERAL SETTINGS ─── */}
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">
        {settings.map((section, si) => (
          <div key={`section-${section.title}`} className="p-6 shadow-lg h-full rounded-2xl glass-panel">
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${section.color} shadow-md`}>
                <section.icon className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-extrabold text-base" style={{ color: "var(--text-primary)" }}>{section.title}</h2>
            </div>
            <div className="space-y-1">
              {section.items.map((item, ii) => {
                const isActive = item.label === "Dark Mode" ? isDark : item.value;
                return (
                  <motion.div key={`item-${item.label}`} transition={{ duration: 0.15 }}
                    className="flex items-center justify-between p-3 rounded-xl cursor-pointer group transition-colors"
                    style={{ background: isActive ? "rgba(108,92,231,0.05)" : "transparent" }}
                    onClick={() => toggleSetting(si, ii, item.label)}>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-semibold text-sm transition-colors"
                        style={{ color: isActive ? "#6c5ce7" : "var(--text-primary)" }}>{item.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                    </div>
                    <motion.div
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${isActive ? "bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff]" : "bg-gray-300 dark:bg-gray-600"}`}
                      whileTap={{ scale: 0.94 }}>
                      <motion.div layout
                        className="absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-md"
                        animate={{ left: isActive ? "calc(100% - 22px)" : "2px" }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="relative z-10 mt-6 max-w-5xl">
        <div className="p-6 rounded-2xl border" style={{ background: "rgba(255,0,0,0.05)", borderColor: "rgba(255,0,0,0.2)" }}>
          <h2 className="font-extrabold text-[#ff4f8b] mb-4 flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5" fill="#ff4f8b" /><span>Danger Zone</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {["Wipe Vault Data", "Reset All Settings", "Delete Account"].map((action) => (
              <motion.button key={action} onClick={() => handleDangerZone(action)}
                whileHover={{ scale: 1.04, backgroundColor: "#ff4f8b", color: "#fff" }} whileTap={{ scale: 0.96 }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                style={{ borderColor: "#ff4f8b", color: "#ff4f8b" }}>
                {action}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Action Confirmation Modal */}
      <AnimatePresence mode="wait">
        {confirmSetting && (
          <div key="confirm-modal-overlay" className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
            <motion.div key="confirm-modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
            className="w-full max-w-sm rounded-[2rem] p-6 shadow-2xl border"
            style={{ background: isDark ? "rgba(20,20,36,0.95)" : "rgba(255,255,255,0.95)", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-white/10"
                style={{ border: `2px solid ${confirmSetting.isDanger ? "rgba(255,0,110,0.5)" : "rgba(108,92,231,0.5)"}` }}>
                <Shield className="w-8 h-8" style={{ color: confirmSetting.isDanger ? "#ff006e" : "#6c5ce7" }} />
              </div>
              <h2 className="text-xl font-extrabold mb-2" style={{ color: "var(--text-primary)" }}>Modify Setting</h2>
              <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
                Are you sure you want to {confirmSetting.isDanger ? "execute" : "toggle"} <strong>{confirmSetting.label}</strong>?
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmSetting(null)}
                  className="flex-1 py-3 rounded-xl font-bold transition-colors"
                  style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", color: "var(--text-primary)" }}>
                  Cancel
                </button>
                <button onClick={executeToggle}
                  className="flex-1 py-3 rounded-xl text-white font-bold shadow-lg transition-colors"
                  style={{ background: confirmSetting.isDanger ? "#ff006e" : "#6c5ce7" }}>
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </div>
  );
}
