"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, User, Lock, Shield, CheckCircle, Clock, Phone, Eye, EyeOff, XCircle, ShieldCheck, FileText, ChevronLeft, Flag } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Loader, OverlayLoader, ButtonLoader } from "@/components/Loader";
import { nexoraFetch, APP_NAME, APP_LOGO } from "@/lib/config";
import { signInWithGoogle } from "@/lib/firebase";
import { Avatar } from "@/components/Avatar";

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
  const [showLegalStep, setShowLegalStep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [savedAccount, setSavedAccount] = useState<{username: string, name: string, color: string, avatar?: string} | null>(null);

  // Quick Login Auto-Verify (Garena Style)
  useEffect(() => {
    const token = localStorage.getItem("nexora_token");
    if (token) {
      setIsLoading(true);
      nexoraFetch("/api/auth/me").then(data => {
        if (data && !data.error) {
          // Valid session, automatic redirect
          setSuccessOverlay({ show: true, isLogin: true, name: localStorage.getItem("nexora_signup_name") || data.username });
          setTimeout(() => router.push("/dashboard/chats"), 1800);
        } else {
          // Token expired or invalid, clear and stay on login
          localStorage.removeItem("nexora_token");
          setIsLoading(false);
        }
      }).catch(() => {
        setIsLoading(false);
      });
    }

    // Hydrate saved account info for Quick Login
    const savedUsername = localStorage.getItem("nexora_signup_username");
    const savedName = localStorage.getItem("nexora_signup_name");
    const savedColor = localStorage.getItem("nexora_signup_color");
    const savedAvatar = localStorage.getItem("nexora_signup_avatar");
    
    if (savedUsername && savedName) {
      setSavedAccount({
        username: savedUsername,
        name: savedName,
        color: savedColor || "from-[#6c5ce7] to-[#00d4ff]",
        avatar: savedAvatar || undefined
      });
    }
  }, []);

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
  const [forgotError, setForgotError] = useState("");
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [connectedUser, setConnectedUser] = useState<any | null>(null);
  const [fetchingTarget, setFetchingTarget] = useState(false);

  // New states for OTP Login
  const [loginMethod, setLoginMethod] = useState<"otp" | "password">("otp");
  const [loginOTP, setLoginOTP] = useState("");
  const [isLoginOtpSent, setIsLoginOtpSent] = useState(false);
  const [otpEmailHint, setOtpEmailHint] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [forgotNewPassword, setForgotNewPassword] = useState("");

  // New state for Google OAuth Signup
  const [googleUserInfo, setGoogleUserInfo] = useState<{ email: string, displayName: string, uid: string, photoURL: string | null, idToken: string } | null>(null);

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
          ((..._args: any[]) => {})("Connect Protocol Error");
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
        // DEV FALLBACK
        if (data.devOtp || (data.message && data.message.includes("Dev Fallback"))) {
          alert(data.message || `Dev Fallback OTP: ${data.devOtp}`);
        }
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

  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithGoogle();
      if (!result) return;
      setIsLoading(true);

      const data = await nexoraFetch("/api/auth/google-login", {
        method: "POST",
        body: JSON.stringify({ email: result.email, googleUid: result.uid, idToken: result.idToken })
      });

      if (data && data.status === "not_found") {
        setGoogleUserInfo(result);
        setIsLogin(false);
        setUsername("");
        setFullName(result.displayName);
        setEmail(result.email);
      } else if (data && data.status === "success") {
        const role = data.role || "Standard";
        if (data.token) localStorage.setItem("nexora_token", data.token);
        document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`;
        localStorage.setItem("nexora_assigned_role", role);
        localStorage.setItem("nexora_signup_username", data.username);
        localStorage.setItem("nexora_signup_name", data.fullName);
        localStorage.setItem("nexora_signup_email", data.email);
        localStorage.setItem("nexora_signup_phone", data.phoneNumber || "Not Set");
        localStorage.setItem("nexora_signup_color", data.color);
        localStorage.setItem("nexora_signup_avatar", data.avatarUrl || "");
        localStorage.removeItem("nexora_user_profile");
        localStorage.removeItem("nexora_active_thread_id");

        setSuccessOverlay({ show: true, isLogin: true, name: data.fullName || result.displayName });
        setTimeout(() => router.push("/dashboard/chats"), 2200);
      } else {
        alert(data?.error || "Google Auth failed.");
      }
    } catch (e) {
      alert("Google Auth Error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendLoginOtp = async () => {
    if (!username) { alert("Enter Username or Email"); return; }
    setIsLoading(true);
    try {
      const data = await nexoraFetch("/api/auth/send-login-otp", {
        method: "POST",
        body: JSON.stringify({ identifier: username })
      });
      if (data && data.status === "success") {
        setIsLoginOtpSent(true);
        // Show masked email hint
        if (data.email) {
          const [local, domain] = data.email.split("@");
          const masked = local.slice(0, 2) + "***@" + domain;
          setOtpEmailHint(masked);
        }
        // Start 60s resend countdown
        setOtpCountdown(60);
        const timer = setInterval(() => {
          setOtpCountdown(c => {
            if (c <= 1) { clearInterval(timer); return 0; }
            return c - 1;
          });
        }, 1000);
        // Auto-fill OTP silently (devOtp is always present as fallback)
        if (data.devOtp) {
          setLoginOTP(data.devOtp);
        }
      } else {
        alert(data?.error || "Failed to dispatch OTP");
      }
    } catch (e) {
      alert("Network Error");
    }
    setIsLoading(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isLogin && !username && !password && savedAccount) {
        const token = localStorage.getItem("nexora_token");
        if (token) {
          const data = await nexoraFetch("/api/auth/me");
          if (data && !data.error) {
            setSuccessOverlay({ show: true, isLogin: true, name: savedAccount.name });
            setTimeout(() => router.push("/dashboard/chats"), 1500);
            return;
          }
        }
        // If token invalid or missing, just pre-fill and let user see it
        setUsername(savedAccount.username);
        setLoginMethod("password");
        setIsLoading(false);
        return;
      }
      if (isLogin) {
        if (loginMethod === "otp" && isLoginOtpSent) {
            if (!loginOTP || loginOTP.length !== 6) {
                alert("Please enter a valid 6-digit verification code.");
                setIsLoading(false);
                return;
            }
            const data = await nexoraFetch("/api/auth/verify-login-otp", {
              method: "POST",
              body: JSON.stringify({ identifier: username, otp: loginOTP })
            });
            if (data && data.status === "success") {
              const role = data.role || "Standard";
              if (data.token) localStorage.setItem("nexora_token", data.token);
              document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`;
              localStorage.setItem("nexora_assigned_role", role);
              localStorage.setItem("nexora_signup_username", data.username);
              localStorage.setItem("nexora_signup_name", data.fullName);
              localStorage.setItem("nexora_signup_email", data.email);
              localStorage.setItem("nexora_signup_phone", data.phoneNumber || "Not Set");
              localStorage.setItem("nexora_signup_color", data.color);
              localStorage.setItem("nexora_signup_avatar", data.avatarUrl || "");
              localStorage.removeItem("nexora_user_profile");
              localStorage.removeItem("nexora_active_thread_id");
              setSuccessOverlay({ show: true, isLogin: true, name: data.fullName || data.username });
              setTimeout(() => router.push("/dashboard/chats"), 2200);
              return;
            } else {
              alert(data?.error || "Invalid Verification Segment.");
              setIsLoading(false);
              return;
            }
        } else if (loginMethod === "otp" && !isLoginOtpSent) {
            await handleSendLoginOtp();
            return;
        }

        const data = await nexoraFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password })
        });

        if (data && data._httpError) {
          alert(data.message || "Authentication failed: Invalid credentials.");
          setIsLoading(false);
          return;
        } else if (data && data.status === "success") {
          const role = data.role || "Standard";
          if (data.token) localStorage.setItem("nexora_token", data.token);
          document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`; // 30 days persistence
          localStorage.setItem("nexora_assigned_role", role);
          localStorage.setItem("nexora_signup_username", data.username);
          localStorage.setItem("nexora_signup_name", data.fullName);
          localStorage.setItem("nexora_signup_email", data.email);
          localStorage.setItem("nexora_signup_phone", data.phoneNumber || "Not Set");
          localStorage.setItem("nexora_signup_color", data.color);
          localStorage.setItem("nexora_signup_avatar", data.avatarUrl || "");
          localStorage.removeItem("nexora_user_profile");
          localStorage.removeItem("nexora_active_thread_id"); // Clear last chat session

          setSuccessOverlay({ show: true, isLogin: true, name: data.fullName || username });
          setTimeout(() => router.push("/dashboard/chats"), 2200);
        } else {
          alert("Authentication failed: Server unreachable.");
        }
      } else {
        if (!googleUserInfo && password !== confirmPassword) {
          alert("Protocol Breach: Passports must match perfectly.");
          return;
        }
        
        setShowLegalStep(true);
        return;
      }
    } catch (err) {
      alert("Connectivity error: High-load during tunnel establishment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSignup = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const endpoint = googleUserInfo ? "/api/auth/complete-google-signup" : "/api/auth/signup";
      const payload = googleUserInfo ? {
        username,
        email: email,
        fullName,
        googleUid: googleUserInfo.uid,
        idToken: googleUserInfo.idToken,
        avatarUrl: googleUserInfo.photoURL
      } : {
        username,
        password,
        email,
        fullName,
        phoneNumber,
        isAuthorized: false
      };

      const data = await nexoraFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (data && data._httpError) {
        alert(data.error || "Signup failed: Protocol error.");
        if (data.error?.includes("Username")) {
          setUsernameStatus("taken");
        }
        setShowLegalStep(false);
      } else if (data) {
        if (data.status === "pending") {
          setPendingApproval(true);
          localStorage.setItem("nexora_pending_authorized", "true");
        } else if (data.status === "success" && data.user) {
          const u = data.user;
          const role = u.role || "Standard";
          if (data.token) localStorage.setItem("nexora_token", data.token);
          document.cookie = `nexora_role=${role}; path=/; SameSite=Lax; max-age=2592000`; // 30 days persistence
          localStorage.setItem("nexora_assigned_role", role);
          localStorage.setItem("nexora_signup_username", u.username);
          localStorage.setItem("nexora_signup_name", u.fullName);
          localStorage.setItem("nexora_signup_email", u.email);
          localStorage.setItem("nexora_signup_phone", u.phoneNumber || "Not Set");
          localStorage.setItem("nexora_signup_color", u.color);
          localStorage.setItem("nexora_signup_avatar", u.avatarUrl || "");
          localStorage.removeItem("nexora_user_profile");
          localStorage.removeItem("nexora_active_thread_id");

          setSuccessOverlay({ show: true, isLogin: false, name: u.fullName || u.username });
          setTimeout(() => router.push("/dashboard/chats"), 2200);
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

  // UI: Legal Agreement Step
  if (showLegalStep) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center p-3 sm:p-6" style={{ background: "var(--bg-base)" }}>
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="glass-panel p-8 sm:p-12 w-full max-w-lg shadow-2xl space-y-8 text-left relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#6c5ce7]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-[#6c5ce7]/10 text-[#6c5ce7]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                Security Protocol
              </h2>
            </div>
            <p className="text-sm font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--text-secondary)" }}>
              Identity Verification & Privacy Agreement
            </p>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="grid gap-4 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-[#6c5ce7]">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-black uppercase">Zero-Knowledge Encryption</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-70" style={{ color: "var(--text-primary)" }}>
                  Nexora is architected on a zero-knowledge framework. We do not store or have access to your private keys. Your messages are encrypted locally on your device before transmission.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-pink-500">
                  <User className="w-4 h-4" />
                  <span className="text-xs font-black uppercase">Identity & Accountability</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-70" style={{ color: "var(--text-primary)" }}>
                   Your account is tied to your public handle. You are solely responsible for the content you transmit. Nexora does not index or search user messages.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-orange-500">
                  <Flag className="w-4 h-4" />
                  <span className="text-xs font-black uppercase">Prohibited Conduct</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-70" style={{ color: "var(--text-primary)" }}>
                  Any use of Nexora for illegal activities—including harassment, fraud, or the distribution of prohibited materials—is a violation of our protocol and will lead to account termination.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-1 relative">
                  <input 
                    type="checkbox" 
                    checked={acceptedTerms} 
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${acceptedTerms ? 'bg-[#6c5ce7] border-[#6c5ce7]' : 'border-gray-400 group-hover:border-[#6c5ce7]'}`}>
                    {acceptedTerms && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <span className="text-[11px] font-bold leading-tight" style={{ color: "var(--text-secondary)" }}>
                  I have read and agree to the <Link href="/policies" className="text-[#6c5ce7] underline">Terms of Service</Link> and <Link href="/policies" className="text-[#6c5ce7] underline">Privacy Policy</Link>.
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button 
                type="button"
                onClick={() => setShowLegalStep(false)}
                className="flex-1 py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest border border-gray-400/20 transition-all active:scale-95 hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--text-secondary)" }}
              >
                Decline
              </button>
              <button 
                type="button"
                onClick={handleFinalSignup}
                disabled={!acceptedTerms || isLoading}
                className="flex-[2] py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}
              >
                {isLoading ? <><ButtonLoader /> <span className="ml-2">Establishing...</span></> : "Accept & Join Nexora"}
              </button>
            </div>
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
          <div className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>&copy; {new Date().getFullYear()} Hiral Chudasama. Deeply Encrypted.</div>
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
              <button onClick={() => { setIsLogin(true); setIsLoginOtpSent(false); setLoginOTP(""); setOtpEmailHint(""); setOtpCountdown(0); }} className="rounded-full px-6 py-2 text-sm font-bold transition-all duration-300"
                style={{ background: isLogin ? "var(--bg-surface-solid)" : "transparent", color: isLogin ? "#6c5ce7" : "var(--text-muted)" }}>Log In</button>
              <button onClick={() => { setIsLogin(false); setIsLoginOtpSent(false); setLoginOTP(""); setOtpEmailHint(""); setOtpCountdown(0); }} className="rounded-full px-6 py-2 text-sm font-bold transition-all duration-300"
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
                    <Avatar 
                      src={connectedUser.avatar_url} 
                      name={connectedUser.fullName || connectedUser.username} 
                      color={connectedUser.color} 
                      size={80} 
                      animate={true} 
                      showBorder={true}
                      className="ring-[5px] ring-white/10 shadow-xl"
                    />
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

            {/* ── QUICK LOGIN (Garena style) ── */}
            {isLogin && savedAccount && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                <button 
                  type="button"
                  onClick={async () => {
                    setIsLoading(true);
                    const token = localStorage.getItem("nexora_token");
                    if (token) {
                      // Attempt real-time session resumption
                      try {
                        const data = await nexoraFetch("/api/auth/me");
                        if (data && !data.error) {
                          setSuccessOverlay({ show: true, isLogin: true, name: savedAccount.name });
                          setTimeout(() => router.push("/dashboard/chats"), 1500);
                          return;
                        }
                      } catch (e) {}
                      
                      // Fallback: verification failed
                      localStorage.removeItem("nexora_token");
                    }
                    
                    // Direct to manual login with username pre-filled
                    setUsername(savedAccount.username);
                    setLoginMethod("password");
                    setIsLoading(false);
                  }}
                  className="w-full group relative p-5 rounded-[2.5rem] border transition-all active:scale-95 overflow-hidden"
                  style={{ 
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(108,92,231,0.05)",
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(108,92,231,0.2)"
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#6c5ce715] to-[#00d4ff15] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-4 relative z-10">
                    <Avatar 
                      src={savedAccount.avatar} 
                      name={savedAccount.name || savedAccount.username} 
                      color={savedAccount.color} 
                      size={64} 
                      animate={false} 
                      showBorder={false}
                      className="shadow-xl"
                    />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#6c5ce7]">Connected Profile</p>
                      <h3 className="text-lg font-black truncate" style={{ color: "var(--text-primary)" }}>{savedAccount.name}</h3>
                      <p className="text-xs font-medium opacity-60 truncate">@{savedAccount.username}</p>
                    </div>
                  </div>
                </button>
                <div className="my-6 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-20">
                  <div className="h-px flex-1 bg-current" />
                  <span>OR MANUAL AUTH</span>
                  <div className="h-px flex-1 bg-current" />
                </div>
              </motion.div>
            )}

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
              {/* Login Method Toggle */}
              {isLogin && (
                <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 mb-6 border border-black/5 dark:border-white/5">
                  <button type="button" onClick={() => { setLoginMethod("otp"); setIsLoginOtpSent(false); setLoginOTP(""); setOtpEmailHint(""); setOtpCountdown(0); }} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === "otp" ? "bg-[#6c5ce7] text-white shadow-lg" : "text-gray-500 hover:text-gray-400"}`}>OTP Code</button>
                  <button type="button" onClick={() => { setLoginMethod("password"); setIsLoginOtpSent(false); setLoginOTP(""); setOtpEmailHint(""); setOtpCountdown(0); }} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === "password" ? "bg-[#6c5ce7] text-white shadow-lg" : "text-gray-500 hover:text-gray-400"}`}>Password</button>
                </div>
              )}

              {/* Google OAuth Button */}
              {!isLogin && !googleUserInfo && (
                <div className="mb-6">
                  <button type="button" onClick={handleGoogleAuth} disabled={isLoading} className="flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 font-bold transition-all active:scale-95 border border-white/5 bg-white shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] text-gray-800 dark:bg-[#1a1a1e] dark:text-white dark:border-[#2a2a2e]">
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Continue with Google
                  </button>
                  <div className="my-6 flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <div className="h-px flex-1 bg-gray-500/20"></div>
                    <span>OR standard method</span>
                    <div className="h-px flex-1 bg-gray-500/20"></div>
                  </div>
                </div>
              )}

              {/* Only show these standard fields if NOT google signup */}
              {!isLogin && !googleUserInfo && (
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
                    placeholder={isLogin ? "Username or Email" : "Choose a Unique Handle"} 
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

              {isLogin && loginMethod === "otp" && isLoginOtpSent && (
                <div className="space-y-3">
                  {/* OTP Email hint */}
                  {otpEmailHint && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                      style={{ background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.15)", color: "var(--text-secondary)" }}>
                      <Shield className="w-3.5 h-3.5 text-[#6c5ce7] shrink-0" />
                      OTP sent to <span className="text-[#6c5ce7] ml-1">{otpEmailHint}</span>
                    </div>
                  )}

                  {/* OTP input */}
                  <div className="neumorphic-input flex items-center rounded-xl px-4 py-3 relative">
                    <Lock className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
                    <input
                      type="text"
                      required
                      value={loginOTP}
                      onChange={(e) => setLoginOTP(e.target.value.replace(/[^0-9]/g, ""))}
                      className="ml-3 w-full bg-transparent outline-none tracking-[0.35em] font-black text-xl text-center"
                      placeholder="○ ○ ○ ○ ○ ○"
                      maxLength={6}
                      style={{ color: "#6c5ce7" }}
                    />
                  </div>

                  {/* Resend OTP */}
                  <div className="flex justify-end pr-1">
                    {otpCountdown > 0 ? (
                      <p className="text-xs opacity-40" style={{ color: "var(--text-muted)" }}>
                        Resend in <span className="font-black text-[#6c5ce7]">{otpCountdown}s</span>
                      </p>
                    ) : (
                      <button type="button" onClick={handleSendLoginOtp} disabled={isLoading}
                        className="text-xs font-bold text-[#6c5ce7] hover:opacity-70 transition-opacity">
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}

              {(!isLogin && !googleUserInfo) || (isLogin && loginMethod === "password") ? (
                <>
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
              </>
              ) : null}

              {isLogin && loginMethod === "password" && (
                <div className="flex justify-end pr-2">
                  <button type="button" onClick={() => setIsForgot(true)} className="text-xs font-bold text-[#6c5ce7] hover:opacity-70 transition-opacity">Forgot password?</button>
                </div>
              )}

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} type="submit" disabled={isLoading}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold text-white shadow-lg ${isLoading ? 'opacity-60' : ''}`}
                style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                {isLoading
                  ? <><ButtonLoader /> <span>{isLogin ? "Establishing Tunnel..." : "Generating Vault..."}</span></>
                  : isLogin && loginMethod === "otp" && !isLoginOtpSent
                    ? "Send OTP →"
                    : isLogin && loginMethod === "otp" && isLoginOtpSent
                      ? "Verify & Sign In"
                      : isLogin
                        ? "Enter Nexora"
                        : "Create Account"
                }
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
