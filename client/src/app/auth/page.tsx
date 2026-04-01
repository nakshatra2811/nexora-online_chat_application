"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User, Lock, Shield, CheckCircle, Clock, Phone, Eye, EyeOff, XCircle } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Loader, OverlayLoader, ButtonLoader } from "@/components/Loader";
import { nexoraFetch, APP_NAME, APP_LOGO } from "@/lib/config";

function AuthContent() {
  const router = useRouter();
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const [isLogin, setIsLogin] = useState(mode !== "signup");
  const [isForgot, setIsForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  // Removed isAuthorized state
  const [pendingApproval, setPendingApproval] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"none" | "checking" | "available" | "taken">("none");
  const [announcement, setAnnouncement] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [successOverlay, setSuccessOverlay] = useState<{ show: boolean; isLogin: boolean; name: string } | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOTP, setForgotOTP] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [connectedUser, setConnectedUser] = useState<any | null>(null);
  const [fetchingTarget, setFetchingTarget] = useState(false);

  // Real-time Username Availability Check (Database)
  useEffect(() => {
    if (!username || isLogin) {
      setUsernameStatus("none");
      return;
    }
    if (username.length < 3) {
      setUsernameStatus("none");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const data = await nexoraFetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`);
        if (data?.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
        }
      } catch {
        setUsernameStatus("none");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [username, isLogin]);

  useEffect(() => {
    // Announcement fetching removed
  }, []);

  // Fetch target user metadata if 'connect' param is present
  useEffect(() => {
    const target = searchParams.get("connect");
    if (target) {
      setFetchingTarget(true);
      const fetchTarget = async () => {
        try {
          const data = await nexoraFetch(`/api/users/public/${encodeURIComponent(target)}`);
          if (data && !data.error) {
            setConnectedUser(data);
          }
        } catch (e) {
          console.error("Connect Protocol Error");
        } finally {
          setFetchingTarget(false);
        }
      };
      fetchTarget();
    }
  }, [searchParams]);

  // Removed handleToggleAtithi

  const handleRecovery = async () => {
    if (!forgotEmail) return;
    setIsSendingRecovery(true);
    setForgotError("");
    try {
      const data = await nexoraFetch("/api/auth/recovery", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail })
      });
      if (data && data.status === "success") {
        setForgotStep(2);
      } else {
        setForgotError("Recovery Protocol: Error transmitting code.");
      }
    } catch (e) {
      setForgotError("Network failure accessing relay console.");
    }
    setIsSendingRecovery(false);
  };

  const handleVerifyOTP = async () => {
    if (!forgotOTP || forgotOTP.length !== 6) {
      setForgotError("Please enter a valid 6-digit code.");
      return;
    }
    setIsSendingRecovery(true);
    setForgotError("");
    try {
      const data = await nexoraFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail, otp: forgotOTP })
      });
      if (data && data.status === "verified") {
        setForgotError("");
        setForgotStep(3);
      } else {
        setForgotError(data?.error || "Invalid verification code.");
      }
    } catch (e) {
      setForgotError("Network failure accessing relay console.");
    }
    setIsSendingRecovery(false);
  };

  const handleResetPassword = async () => {
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters.");
      return;
    }
    setIsSendingRecovery(true);
    setForgotError("");
    try {
      const data = await nexoraFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword })
      });
      if (data && data.status === "success") {
        setIsForgot(false);
        setForgotStep(1);
        setForgotEmail("");
        setForgotOTP("");
        setForgotNewPassword("");
        alert("Password anchor reset successfully. You can now log in.");
      } else {
        setForgotError(data?.error || "Failed to finalize reset.");
      }
    } catch (e) {
      setForgotError("Network failure accessing relay console.");
    }
    setIsSendingRecovery(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isLogin) {
        const data = await nexoraFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        if (data && data._httpError) {
          alert(data.message || "Authentication failed: Invalid credentials.");
        } else if (data && data.status === "success") {
          const role = data.role || "Standard";
          document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`; // 30 days persistence
          localStorage.setItem("nexora_assigned_role", role);
          localStorage.setItem("nexora_signup_username", data.username);
          localStorage.setItem("nexora_signup_name", data.fullName);
          localStorage.setItem("nexora_signup_email", data.email);
          localStorage.setItem("nexora_signup_phone", data.phoneNumber || "Not Set");
          localStorage.setItem("nexora_signup_color", data.color);
          localStorage.removeItem("nexora_user_profile");
          setSuccessOverlay({ show: true, isLogin: true, name: data.fullName || username });
          setTimeout(() => router.push("/dashboard/chats"), 2200);
        } else {
          alert("Authentication failed: Server unreachable.");
        }
      } else {
        if (password !== confirmPassword) {
          alert("Protocol Breach: Passports must match perfectly.");
          setIsLoading(false);
          return;
        }
        const data = await nexoraFetch("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            username,
            password,
            email,
            fullName,
            phoneNumber,
            isAuthorized: false
          })
        });

        if (data && data._httpError) {
          // Server returned an error (e.g. username taken)
          alert(data.error || "Signup failed: Protocol error.");
          if (data.error?.includes("Username")) {
            setUsernameStatus("taken");
          }
        } else if (data) {
          if (data.status === "pending") {
            setPendingApproval(true);
            localStorage.setItem("nexora_pending_authorized", "true");
            setIsLoading(false);
            return;
          } else if (data.status === "success" && data.user) {
            const u = data.user;
            const role = u.role || "Standard";
            document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`; // 30 days persistence
            localStorage.setItem("nexora_assigned_role", role);
            localStorage.setItem("nexora_signup_username", u.username);
            localStorage.setItem("nexora_signup_name", u.fullName);
            localStorage.setItem("nexora_signup_email", u.email);
            localStorage.setItem("nexora_signup_phone", u.phoneNumber || "Not Set");
            localStorage.setItem("nexora_signup_color", u.color);
            localStorage.removeItem("nexora_user_profile");
            setSuccessOverlay({ show: true, isLogin: false, name: u.fullName || u.username });
            setTimeout(() => router.push("/dashboard/chats"), 2200);
          }
        } else {
          alert("Signup failed: Server unreachable.");
        }
      }
    } catch (err) {
      alert("Connectivity error: High-load during tunnel establishment.");
    } finally {
      setIsLoading(false);
    }
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as any } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  };

  // UI: Pending Approval
  if (pendingApproval) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4" style={{ background: "var(--bg-base)" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-panel p-12 max-w-md text-center space-y-6">
          <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }}
            className="w-20 h-20 rounded-full mx-auto flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(255,190,11,0.15), rgba(108,92,231,0.15))" }}>
            <Clock className="w-10 h-10 text-[#ffbe0b]" />
          </motion.div>
          <h2 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>Awaiting Account Clearance</h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Your <span className="font-bold text-[#6c5ce7]">Authorized Account</span> access request has been submitted.
            An administrator will review and resolve your connection.
          </p>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { setPendingApproval(false); router.push("/dashboard/chats"); }}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-[#6c5ce7]/20"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
            Enter Standard Protocol
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // UI: Forgot Password
  if (isForgot) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center p-3 sm:p-6" style={{ background: "var(--bg-base)" }}>
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="glass-panel p-8 sm:p-12 w-full max-w-md shadow-2xl space-y-8 text-left">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
              {forgotStep === 1 ? "Account Recovery" : forgotStep === 2 ? "Verify Identity" : "Reset Anchor"}
            </h2>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {forgotStep === 1 ? "Enter your registered protocol email." :
                forgotStep === 2 ? "Enter the 6-digit code sent to your mail." :
                  "Secure your account with a new password anchor."}
            </p>
          </div>
          <div className="space-y-4">
            {forgotError && (
              <div className="text-red-500 text-sm font-bold text-center bg-red-500/10 py-2 rounded-xl">
                {forgotError}
              </div>
            )}
            {forgotStep === 1 && (
              <div className="space-y-4">
                {/* Broadcast Alert Protocol Removed */}
                <input type="email" placeholder="Email Address" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  className="neumorphic-input w-full p-4 rounded-2xl outline-none" style={{ color: "var(--text-primary)" }} />
                <button onClick={handleRecovery} disabled={isSendingRecovery}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6c5ce7] py-4 font-bold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50">
                  {isSendingRecovery ? <><ButtonLoader /> <span>Transmitting...</span></> : "Initialize Recovery"}
                </button>
              </div>
            )}
            {forgotStep === 2 && (
              <div className="space-y-4">
                <input type="text" placeholder="######" maxLength={6} value={forgotOTP} onChange={e => setForgotOTP(e.target.value)}
                  className="neumorphic-input w-full p-4 rounded-2xl outline-none text-center font-black tracking-widest text-2xl uppercase" style={{ color: "#6c5ce7", textTransform: "uppercase" }} />
                <p className="text-[10px] text-center font-bold text-gray-400 uppercase">Check your email for the verification code.</p>
                <button onClick={handleVerifyOTP} disabled={isSendingRecovery} 
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6c5ce7] py-4 font-bold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50">
                  {isSendingRecovery ? <><ButtonLoader /> <span>Verifying...</span></> : "Verify Account Identity"}
                </button>
              </div>
            )}
            {forgotStep === 3 && (
              <div className="space-y-4">
                <input type="password" placeholder="New Password Anchor" value={forgotNewPassword} onChange={e => setForgotNewPassword(e.target.value)} className="neumorphic-input w-full p-4 rounded-2xl outline-none" style={{ color: "var(--text-primary)" }} />
                <button onClick={handleResetPassword} disabled={isSendingRecovery}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] py-4 font-bold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50">
                  {isSendingRecovery ? <><ButtonLoader /> <span>Finalizing...</span></> : "Finalize Reset"}
                </button>
              </div>
            )}
            <button onClick={() => { setIsForgot(false); setForgotStep(1); setForgotError(""); setForgotOTP(""); setForgotNewPassword(""); setForgotEmail(""); }} className="w-full text-center text-xs font-bold uppercase tracking-widest text-[#6c5ce7] hover:opacity-70 transition-opacity">
              Back to Terminal
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* ── SUCCESS OVERLAY ── */}
      <AnimatePresence>
        {successOverlay?.show && (
          <motion.div
            key="success-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ background: "var(--bg-base)" }}
          >
            {/* Blurred glow blobs */}
            <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full blur-[120px] pointer-events-none" style={{ background: "rgba(108,92,231,0.25)" }} />
            <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full blur-[120px] pointer-events-none" style={{ background: "rgba(0,212,255,0.18)" }} />

            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.08 }}
              className="relative z-10 flex flex-col items-center gap-6 text-center px-6"
            >
              {/* Glowing logo ring */}
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}
                />
                <div className="relative w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl border border-white/10"
                  style={{ background: "linear-gradient(135deg,rgba(108,92,231,0.15),rgba(0,212,255,0.10))", backdropFilter: "blur(20px)" }}>
                  <img src={APP_LOGO} alt="Nexora" className="w-14 h-14 object-contain drop-shadow-2xl" />
                </div>
              </div>

              {/* Welcome text */}
              <div className="space-y-2">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="text-3xl font-black tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {successOverlay.isLogin ? `Welcome back` : `Welcome to Nexora`} 👋
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="text-base font-semibold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {successOverlay.isLogin ? `Logging you in...` : `Your account is ready. Entering Nexora...`}
                </motion.p>
              </div>

              {/* Animated progress bar */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="w-56 h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(108,92,231,0.18)" }}
              >
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg,#6c5ce7,#00d4ff)" }}
                />
              </motion.div>

              {/* Spinning dots */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex gap-2"
              >
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18, ease: "easeInOut" }}
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ background: i === 0 ? "#6c5ce7" : i === 1 ? "#a855f7" : "#00d4ff" }}
                  />
                ))}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="flex min-h-[100dvh] w-full items-center justify-center p-3 sm:p-6" style={{ background: "var(--bg-base)" }}>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel flex h-full max-h-[850px] w-full max-w-[1200px] overflow-hidden shadow-2xl">

        {/* Left Side: Branding */}
        <div className="hidden w-1/2 flex-col justify-between p-12 lg:flex relative overflow-hidden"
          style={{ background: "var(--bg-surface)", backdropFilter: "blur(20px)", borderRight: "1px solid var(--border-subtle)" }}>
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="Nexora Logo" className="w-12 h-12 shrink-0 object-contain drop-shadow-lg rounded-[14px]" />
              <h1 className="text-4xl font-extrabold tracking-tighter" style={{ color: "var(--text-primary)" }}>Nexora.</h1>
            </div>
            <p className="mt-2 font-medium" style={{ color: "var(--text-secondary)" }}>The Premium Privacy Protocol</p>
          </motion.div>
          <div className="relative">
            <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
              className="absolute -left-10 -top-20 h-64 w-64 rounded-full bg-[#6c5ce7] blur-3xl flex-shrink-0" style={{ opacity: 0.2 }} />
            <div className="relative z-10 space-y-6">
              <h2 className="text-5xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>Connect.<br /><span style={{ color: "var(--text-secondary)" }}>In the clear.</span></h2>
              <p className="leading-relaxed max-w-sm" style={{ color: "var(--text-secondary)" }}>Secure real-time communication, unifying the world in a seamless glass interface.</p>
            </div>
          </div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>&copy; {new Date().getFullYear()} Nexora Systems. Deeply Encrypted.</div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex w-full flex-col justify-center p-6 sm:p-12 lg:p-16 lg:w-1/2 relative overflow-y-auto custom-scrollbar" style={{ background: "var(--bg-surface)" }}>

          {/* Mobile Top Logo (lg:hidden) */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-2">
              <img src={APP_LOGO} alt="Nexora Logo" className="w-10 h-10 object-contain drop-shadow-lg rounded-xl" />
              <h1 className="text-2xl font-extrabold tracking-tighter" style={{ color: "var(--text-primary)" }}>{APP_NAME}.</h1>
            </motion.div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-40">Privacy Protocol</p>
          </div>

          <div className="mx-auto w-full max-w-sm py-6 sm:py-8 text-center sm:text-left">

            {/* Announcement Banner Removed from here and moved to top-center navbar */}

            {/* Toggle Login/Signup */}
            <div className="mb-8 flex rounded-full p-1 w-max mx-auto sm:mx-0" style={{ background: "var(--bg-surface-solid)", border: "1px solid var(--border-subtle)" }}>
              <button onClick={() => { setIsLogin(true); }} className="rounded-full px-6 py-2 text-sm font-bold transition-all duration-300"
                style={{ background: isLogin ? "var(--bg-surface-solid)" : "transparent", color: isLogin ? "#6c5ce7" : "var(--text-muted)" }}>Log In</button>
              <button onClick={() => setIsLogin(false)} className="rounded-full px-6 py-2 text-sm font-bold transition-all duration-300"
                style={{ background: !isLogin ? "var(--bg-surface-solid)" : "transparent", color: !isLogin ? "#6c5ce7" : "var(--text-muted)" }}>Sign Up</button>
            </div>

            {/* ── PROFILE CONNECTION CARD ── */}
            <AnimatePresence>
              {connectedUser && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="mb-8 p-6 rounded-[2rem] border overflow-hidden relative group"
                  style={{ 
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(108,92,231,0.05)",
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(108,92,231,0.2)"
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6c5ce710] to-[#00d4ff10] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex flex-col items-center text-center gap-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-xl ring-[5px] ring-white/10 bg-gradient-to-br ${connectedUser.color || "from-[#6c5ce7] to-[#00d4ff]"} overflow-hidden uppercase`}>
                      {connectedUser.avatar_url ? (
                        <img src={connectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        connectedUser.fullName?.[0] || connectedUser.username?.[0]
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Connect with {connectedUser.fullName}</h3>
                      <p className="text-sm font-bold text-[#6c5ce7] mt-0.5">@{connectedUser.username}</p>
                      {connectedUser.bio && (
                        <p className="text-xs mt-2 px-4 leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                          {connectedUser.bio}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Ready to Secure Connection</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <h2 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
            {signupSuccess && isLogin && (
              <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: "rgba(0,212,100,0.12)", border: "1px solid rgba(0,212,100,0.3)", color: "#00d464" }}>
                <CheckCircle className="h-4 w-4 shrink-0" />
                Account created! Now log in with your credentials.
              </div>
            )}
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>{isLogin ? "Enter your credentials to access your secure vault." : "Join the world's most secure communication protocol."}</p>

            {/* Secure Account Extension Header Removed */}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-4">
                  <div className="neumorphic-input flex items-center rounded-xl px-4 py-3">
                    <User className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="ml-3 w-full bg-transparent outline-none" placeholder="Full Name" style={{ color: "var(--text-primary)" }} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="neumorphic-input flex flex-1 items-center rounded-xl px-4 py-3">
                      <Mail className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ml-3 w-full bg-transparent outline-none" placeholder="Email Address" style={{ color: "var(--text-primary)" }} />
                    </div>
                    <div className="neumorphic-input flex flex-1 items-center rounded-xl px-4 py-3">
                      <Phone className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="ml-3 w-full bg-transparent outline-none" placeholder="Phone (Optional)" style={{ color: "var(--text-primary)" }} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="neumorphic-input flex items-center rounded-xl px-4 py-3 relative">
                  <User className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input 
                    type="text" 
                    required 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    className="ml-3 w-full bg-transparent outline-none pr-8" 
                    placeholder={isLogin ? "Username or Email" : "Username"} 
                    style={{ color: "var(--text-primary)" }} 
                  />
                  <div className="absolute right-4 flex items-center">
                    {usernameStatus === "checking" && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                    {usernameStatus === "available" && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {usernameStatus === "taken" && <XCircle className="h-5 w-5 text-red-500" />}
                  </div>
                </div>
                {!isLogin && (
                  <div className="flex px-1">
                    {usernameStatus === "checking" && <p className="text-[10px] text-blue-400">Checking availability...</p>}
                    {usernameStatus === "taken" && <p className="text-[10px] text-red-400 font-bold uppercase tracking-tighter">Protocol Error: Handle Taken</p>}
                    {usernameStatus === "available" && <p className="text-[10px] text-green-400 font-bold uppercase tracking-tighter">Identity Verified</p>}
                  </div>
                )}
              </div>

              <div className="neumorphic-input flex items-center rounded-xl px-4 py-3 relative">
                <Lock className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="ml-3 w-full bg-transparent outline-none pr-8" 
                  placeholder="Password" 
                  style={{ color: "var(--text-primary)" }} 
                />
                {password && (
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {!isLogin && (
                <div className="neumorphic-input flex items-center rounded-xl px-4 py-3 relative">
                  <Shield className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    required 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className="ml-3 w-full bg-transparent outline-none pr-8" 
                    placeholder="Confirm Password" 
                    style={{ color: "var(--text-primary)" }} 
                  />
                  {confirmPassword && (
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end pr-2">
                  <button type="button" onClick={() => setIsForgot(true)} className="text-xs font-bold text-[#6c5ce7] hover:opacity-70 transition-opacity">Forgot password?</button>
                </div>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} type="submit" disabled={isLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                {isLoading ? <><ButtonLoader /> <span>{isLogin ? "Establishing Tunnel..." : "Generating Vault..."}</span></> : (isLogin ? "Enter Void" : "Sign Up")}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center" style={{ background: "var(--bg-base)" }}><Loader size="lg" text="Initializing Secure Link..." /></div>}>
      <AuthContent />
    </Suspense>
  );
}
