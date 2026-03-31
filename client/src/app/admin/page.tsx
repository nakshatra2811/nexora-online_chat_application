"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Unlock, CheckCircle, XCircle, Mail, Key, Settings, Upload, Save, Globe, Zap } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { nexoraFetch, API_BASE_URL, APP_NAME, APP_LOGO } from "@/lib/config";

// MOCK PENDING REQUESTS FOR AUTHORIZED NODES
const INITIAL_REQUESTS = [
  { id: "req_01", username: "Clearance_Account_99", email: "hiralchudasama2811@gmail.com", status: "pending", date: "2026-03-29", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop" },
  { id: "req_02", username: "Clearance_Account_Alpha", email: "admin@nexora.io", status: "pending", date: "2026-03-29", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" }
];

export default function AdminPanel() {
  const { isDark } = useTheme();
  
  const [setupMode, setSetupMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Forms
  const [newPassword, setNewPassword] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const SUPER_ADMIN_EMAIL = "Hiralchudasama2811@gmail.com";

  // Requests state
  const [requests, setRequests] = useState(INITIAL_REQUESTS);

  // Dynamic Site Config State
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [seoKey, setSeoKey] = useState("");
  const [logoB64, setLogoB64] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  
  // Email Customization Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [emailDraft, setEmailDraft] = useState({ subject: "", html: "" });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const applyConfiguration = async () => {
    setIsSavingConfig(true);
    try {
      const payload: any = { seo: {} };
      if (seoTitle) payload.seo.title = seoTitle;
      if (seoDesc) payload.seo.description = seoDesc;
      if (seoKey) payload.seo.keywords = seoKey;
      if (logoB64) payload.logoBase64 = logoB64;

      const res = await fetch(`${API_BASE_URL}/api/admin/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Nexora Core: Metadata & Brand overrides successfully deployed.");
      } else {
        alert("Failure deploying overrides. Check node console.");
      }
    } catch (e) {
      alert("Network Error saving configuration.");
    }
    setIsSavingConfig(false);
  };

  const onLogoUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = ev => setLogoB64(ev.target?.result as string);
      r.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const existingHash = localStorage.getItem("nexora_admin_hash");
    if (!existingHash) {
      setSetupMode(true);
    }
    const session = sessionStorage.getItem("nexora_admin_session");
    if (session === "active") {
      setIsAuthenticated(true);
      // Fetched announcement removed
    }
    setIsReady(true);
  }, []);

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    // Basic local hash simulation (btoa for demo, real implementations should use bcrypt)
    const encoded = btoa(newPassword);
    localStorage.setItem("nexora_admin_hash", encoded);
    setSetupMode(false);
    setErrorMsg("");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput !== SUPER_ADMIN_EMAIL) {
      setErrorMsg("Unrecognized Administrative Identity.");
      return;
    }
    const saved = localStorage.getItem("nexora_admin_hash");
    if (btoa(passInput) !== saved) {
      setErrorMsg("Invalid Credentials.");
      return;
    }
    sessionStorage.setItem("nexora_admin_session", "active");
    setIsAuthenticated(true);
    setErrorMsg("");
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    const req = requests.find(r => r.id === id);
    if (!req) return;

    if (action === "approve") {
      const defaultHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,0.06); border: 1px solid #eef2f7; }
                    .header { background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); padding: 60px 40px; text-align: center; position: relative; }
                    .logo-box { width: 90px; height: 90px; background: #fff; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
                    .brand-name { color: #ffffff; font-size: 32px; font-weight: 900; letter-spacing: -1.5px; margin: 0; }
                    .content { padding: 40px; text-align: center; }
                    .title { font-size: 32px; font-weight: 900; color: #1a1a2e; margin-bottom: 12px; }
                    .greeting { font-size: 18px; font-weight: 700; color: #6c5ce7; margin-bottom: 20px; }
                    .message { color: #64748b; font-size: 15px; line-height: 1.8; margin-bottom: 40px; margin-left: auto; margin-right: auto; }
                    .button { background: linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%); color: #ffffff !important; padding: 20px 45px; border-radius: 100px; text-decoration: none; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 20px 40px rgba(108,92,231,0.3); transition: all 0.3s ease; }
                    .footer { background: #f8fafc; padding: 40px; text-align: center; color: #94a3b8; border-top: 1px solid #f1f5f9; }
                    .copyright { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo-box">
                            <img src="${APP_LOGO}" alt="Nexora" style="width: 70px; height: 70px; object-fit: contain; border-radius: 16px;" />
                        </div>
                        <h1 class="brand-name">Nexora</h1>
                    </div>
                    <div class="content">
                        <h2 class="title">Authorization Granted.</h2>
                        <div class="greeting">Clearing: @${req.username} &bull; SECURE</div>
                        <p class="message">
                            Your administrative clearance has been verified. You now have full access to the Nexora Private Chat ecosystem. You may now log in using your registered credentials.
                        </p>
                        <a href="${window.location.origin}/auth" class="button">ACCESS SECURE TERMINAL</a>
                    </div>
                    <div class="footer">
                        <div class="copyright">&copy; 2026 NEXORA SYSTEMS &bull; PRIVACY PROTOCOL</div>
                        <p style="font-size: 10px; color: #94a3b8; line-height: 1.6; margin: 0; text-align: left;">
                            This is an automated encrypted transmission. If you did not request this authorization, please secure your account immediately.
                        </p>
                    </div>
                </div>
            </body>
            </html>
      `;
      setSelectedReq(req);
      setEmailDraft({
        subject: "Nexora Authorization: Access Granted",
        html: defaultHtml
      });
      setShowEmailModal(true);
      return;
    }
    
    setRequests(reqs => reqs.filter(r => r.id !== id));
  };

  const handleConfirmApprove = async () => {
    if (!selectedReq) return;
    setIsSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: selectedReq.username, 
          email: selectedReq.email,
          customSubject: emailDraft.subject,
          customHtml: emailDraft.html
        })
      });
      if (res.ok) {
        alert(`Success: Account @${selectedReq.username} authorized. Welcome protocol transmitted.`);
        setRequests(reqs => reqs.filter(r => r.id !== selectedReq.id));
        setShowEmailModal(false);
      } else {
        alert(`Error: Relay failure during authorization.`);
      }
    } catch (e) {
      alert("Network failure accessing relay console.");
    }
    setIsSendingEmail(false);
  };

  if (!isReady) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: "var(--bg-main)" }}>
      <AnimatePresence mode="wait">
        
        {/* =======================
            SETUP MODE 
        ========================*/}
        {setupMode && !isAuthenticated && (
          <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md p-8 rounded-3xl shadow-2xl glass-panel relative overflow-hidden"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--border-subtle)"}` }}>
            <div className="absolute top-0 right-0 p-8 w-64 h-64 bg-red-500 rounded-full blur-[80px] opacity-10 pointer-events-none" />
            
            <div className="flex flex-col items-center justify-center relative z-10 text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4"
                   style={{ background: "linear-gradient(135deg, #ff006e, #6c5ce7)" }}>
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter" style={{ color: "var(--text-primary)" }}>Admin Initialization</h1>
              <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>Register root credentials for <br/><strong className="text-[#ff006e]">{SUPER_ADMIN_EMAIL}</strong></p>
            </div>

            <form onSubmit={handleSetup} className="flex flex-col gap-4 relative z-10">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" placeholder="Create Master Password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
              </div>
              {errorMsg && <p className="text-xs font-bold text-[#ff006e] text-center">{errorMsg}</p>}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-4 mt-2 rounded-xl text-white font-bold tracking-wide shadow-lg"
                style={{ background: "linear-gradient(135deg, #ff006e, #6c5ce7)" }}>
                Initialize Root Access
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* =======================
            LOGIN MODE 
        ========================*/}
        {!setupMode && !isAuthenticated && (
          <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md p-8 rounded-3xl shadow-2xl glass-panel relative overflow-hidden"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--border-subtle)"}` }}>
            <div className="absolute top-0 right-0 p-8 w-64 h-64 bg-[#6c5ce7] rounded-full blur-[80px] opacity-10 pointer-events-none" />
            
            <div className="flex flex-col items-center justify-center relative z-10 text-center mb-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-4"
                   style={{ background: "linear-gradient(135deg, #00d4ff, #6c5ce7)" }}>
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter" style={{ color: "var(--text-primary)" }}>Admin Portal</h1>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4 relative z-10">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" placeholder="Admin Email" value={emailInput} onChange={e => setEmailInput(e.target.value)} required
                  className="w-full pl-11 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" placeholder="Access Code" value={passInput} onChange={e => setPassInput(e.target.value)} required
                  className="w-full pl-11 pr-4 py-3 rounded-xl outline-none transition-all"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
              </div>
              {errorMsg && <p className="text-xs font-bold text-[#ff006e] text-center">{errorMsg}</p>}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-4 mt-2 rounded-xl text-white font-bold tracking-wide shadow-lg"
                style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                Authenticate
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* =======================
            DASHBOARD 
        ========================*/}
        {isAuthenticated && (
          <motion.div key="dashboard" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl min-h-[80vh] rounded-[2.5rem] shadow-2xl glass-panel overflow-hidden flex flex-col"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "var(--border-subtle)"}` }}>
            
            {/* Header */}
            <header className="px-8 py-6 flex items-center justify-between"
                    style={{ borderBottom: `1px solid var(--border-subtle)`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl shadow-md"
                     style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                  <Shield className="text-white w-5 h-5"/>
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Central Command</h1>
                  <p className="text-xs font-bold text-[#ff006e]">Root Level: Hiralchudasama2811@gmail.com</p>
                </div>
              </div>
              <button onClick={() => { sessionStorage.removeItem("nexora_admin_session"); setIsAuthenticated(false); }}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-[#ff006e] text-white">
                Lock Terminal
              </button>
            </header>

            {/* Main Area */}
            <main className="flex-1 p-8 overflow-y-auto">
              <div>
                <h2 className="text-2xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Clearance Queue</h2>
                
                {requests.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed"
                       style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}>
                    No pending requests. Protocol is quiet.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {requests.map(req => (
                      <motion.div key={req.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                         className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl shadow-sm"
                         style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid var(--border-subtle)` }}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white shadow-lg uppercase overflow-hidden ${!req.avatarUrl ? 'bg-gradient-to-br from-[#ffbe0b] to-[#ff006e]' : ""}`}>
                             {req.avatarUrl ? (
                               <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" />
                             ) : (
                               (req.username?.[0] || "?").toUpperCase()
                             )}
                          </div>
                          <div>
                            <p className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>@{req.username}</p>
                            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Requested: {req.date}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          <button onClick={() => handleAction(req.id, "reject")}
                            className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ background: "rgba(255,0,110,0.1)", color: "#ff006e" }}>
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button onClick={() => handleAction(req.id, "approve")}
                            className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg text-white"
                            style={{ background: "linear-gradient(135deg, #2ed573, #15c35a)" }}>
                            <CheckCircle className="w-4 h-4" /> Authorize Account
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Protocol Configuration Dashboard */}
              <div className="mt-12">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Settings className="w-6 h-6 text-[#00d4ff]" /> Protocol Configuration
                </h2>
                
                <div className="p-6 rounded-3xl shadow-sm space-y-6"
                     style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", border: `1px solid var(--border-subtle)` }}>
                  
                  {/* SEO Config */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <Globe className="w-5 h-5 text-[#6c5ce7]" /> Search Engine Optimization (SEO)
                    </h3>
                    <input type="text" placeholder="Global Protocol Title" value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
                    <textarea placeholder="Global Protocol Description" value={seoDesc} onChange={e => setSeoDesc(e.target.value)} rows={3}
                      className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
                    <input type="text" placeholder="Keywords (comma separated)" value={seoKey} onChange={e => setSeoKey(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{ background: isDark ? "rgba(255,255,255,0.03)" : "#fff", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
                  </div>

                  {/* Brand Config */}
                  <div className="space-y-4 pt-6" style={{ borderTop: `1px solid var(--border-subtle)` }}>
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <Upload className="w-5 h-5 text-[#ff006e]" /> Master Logo Sync (Favicons & Navbar)
                    </h3>
                    <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors"
                           style={{ borderColor: "var(--border-subtle)", background: isDark ? "rgba(255,255,255,0.02)" : "#fff" }}
                           htmlFor="logo-upload">
                      <input id="logo-upload" type="file" accept="image/svg+xml,image/png,image/jpeg" className="hidden" onChange={onLogoUpload} />
                      {logoB64 ? (
                        <div className="flex flex-col items-center gap-2">
                           <img src={logoB64} className="w-16 h-16 drop-shadow-xl rounded-[10px]" alt="Preview" />
                           <span className="text-xs font-bold text-[#00d4ff]">Vector loaded into memory.</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="font-bold text-sm" style={{ color: "var(--text-secondary)" }}>Click to select SVG/PNG Asset</p>
                          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action deploys to `public/logo.svg` and `app/icon.svg` universally.</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Broadcast Alert Protocol Removed */}

                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={applyConfiguration}
                    disabled={isSavingConfig}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold tracking-wide shadow-lg mt-4"
                    style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)", opacity: isSavingConfig ? 0.7 : 1 }}>
                    <Save className="w-5 h-5" /> {isSavingConfig ? "Deploying Configuration..." : "Force Synapse Configuration"}
                  </motion.button>
                  
                  <div className="pt-6 mt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                    <button 
                      onClick={async () => {
                        const res = await fetch(`${API_BASE_URL}/api/admin/test-mail`, { method: "POST" });
                        if (res.ok) alert("Protocol Test: Transmission successful.");
                        else alert("Protocol Test: Transmission failure.");
                      }}
                      className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest border border-[#ff006e]/30 text-[#ff006e] hover:bg-[#ff006e]/5 transition-all"
                    >
                      Trigger SMTP Protocol Test
                    </button>
                  </div>
                </div>
              </div>

            </main>
          </motion.div>
        )}
        {/* =======================
            EMAIL PREVIEW MODAL 
        ========================*/}
        {showEmailModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl glass-panel overflow-hidden flex flex-col"
              style={{ border: `1px solid var(--border-subtle)` }}>
              
              <div className="px-8 py-5 flex items-center justify-between" style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                <div className="flex items-center gap-3">
                   <Mail className="w-5 h-5 text-[#6c5ce7]" />
                   <h2 className="text-xl font-bold">Preview Authorization Protocol</h2>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col lg:flex-row gap-8">
                {/* Editor Column */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6c5ce7] mb-1.5 block">Recipient</label>
                    <input type="text" value={selectedReq?.email} disabled
                      className="w-full px-4 py-3 rounded-xl opacity-60 cursor-not-allowed"
                      style={{ background: "rgba(0,0,0,0.1)", border: `1px solid var(--border-subtle)` }} />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6c5ce7] mb-1.5 block">Subject Line</label>
                    <input type="text" value={emailDraft.subject} onChange={e => setEmailDraft({...emailDraft, subject: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl outline-none"
                      style={{ background: "rgba(0,0,0,0.1)", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
                  </div>

                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6c5ce7] mb-1.5 block">HTML Body</label>
                    <textarea value={emailDraft.html} onChange={e => setEmailDraft({...emailDraft, html: e.target.value})}
                      className="flex-1 w-full p-4 rounded-xl outline-none font-mono text-sm resize-none"
                      style={{ background: "rgba(0,0,0,0.1)", border: `1px solid var(--border-subtle)`, color: "var(--text-primary)" }} />
                  </div>
                </div>

                {/* Preview Column */}
                <div className="flex-1 flex flex-col">
                   <label className="text-xs font-bold uppercase tracking-widest text-[#00d4ff] mb-1.5 block">Live Relay Preview</label>
                   <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 bg-white shadow-inner">
                      <div className="w-full h-full overflow-y-auto custom-scrollbar bg-[#0a0a12] p-4"
                           dangerouslySetInnerHTML={{ __html: emailDraft.html }} />
                   </div>
                   <p className="text-[10px] mt-2 opacity-50 text-center italic">Final transmission may vary slightly across mail clients.</p>
                </div>
              </div>

              <div className="px-8 py-5 flex items-center justify-end gap-3" style={{ borderTop: `1px solid var(--border-subtle)` }}>
                 <button onClick={() => setShowEmailModal(false)} className="px-6 py-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 transition-colors">
                    Discard Draft
                 </button>
                 <button onClick={handleConfirmApprove} disabled={isSendingEmail}
                    className="px-8 py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                    {isSendingEmail ? "Authorizing..." : "Transmit Authorization"}
                 </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
