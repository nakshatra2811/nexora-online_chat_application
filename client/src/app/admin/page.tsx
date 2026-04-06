"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Lock, Mail, Key, Users, BarChart3, Image, Link2, Settings, Send,
  Trash2, CheckCircle, XCircle, Search, RefreshCw, Eye, EyeOff, UserCog,
  Activity, Globe, Upload, Save, Zap, ChevronDown, X, AlertTriangle,
  LogOut, Heart, MessageSquare, Wifi, WifiOff, Crown, Ban, UserCheck,
  KeyRound, FileText, LineChart, Hash, MonitorSmartphone, Map, FileCode2,
  GitPullRequest, ClipboardList, Palette, TrendingUp, Presentation,
  Network, SearchCode, Database, Cpu, PieChart, ShieldCheck, Clock,
  TerminalSquare, Maximize, FilePlus2, UploadCloud, FileEdit, Flag
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { API_BASE_URL, APP_LOGO } from "@/lib/config";
import { Avatar } from "@/components/Avatar";

// Removed Hardcoded Credentials. Using Zero-Knowledge API.

// ─── TYPES ───
interface UserRecord {
  id: number; fullName: string; email: string; username: string;
  role: string; status: string; color: string; createdAt: string;
  phoneNumber: string; avatarUrl: string; bio: string; online: boolean;
}
interface ConnectionRecord {
  id: number; user_a: string; user_b: string; created_at: string;
  name_a: string; name_b: string; color_a: string; color_b: string;
}
interface Stats {
  totalUsers: number; totalStories: number; totalConnections: number;
  pendingRequests: number; onlineUsers: number;
}
interface EmailTemplate {
  subject: string; html: string; description: string;
  variables: string[]; isCustomized: boolean;
}

export type TabId = 
    "overview" | "users" | "connections" | "config" | "security" | "templates" | "broadcast" |
    "blog" | "gallery" | "seo_manager" | "keywords" | "analytics" | 
    "audit_logs" | "google_bing" | "indexing" | "safety";

export const TABS: { id: TabId; label: string; icon: any; color: string; group?: string }[] = [
  // Core
  { id: "overview", label: "Overview", icon: BarChart3, color: "#6c5ce7", group: "Core" },
  { id: "users", label: "Users", icon: Users, color: "#00d4ff", group: "Core" },
  { id: "connections", label: "Connections", icon: Link2, color: "#2ed573", group: "Core" },
  
  // Content & CMS
  { id: "blog", label: "Blog", icon: FileText, color: "#ff006e", group: "Content" },
  { id: "gallery", label: "Gallery", icon: Image, color: "#ffbe0b", group: "Content" },
  
  // Marketing & Communications
  { id: "templates", label: "Email Templates", icon: Mail, color: "#ff006e", group: "Marketing" },
  { id: "broadcast", label: "Broadcast", icon: Send, color: "#a29bfe", group: "Marketing" },
  
  // SEO Engine
  { id: "seo_manager", label: "SEO Manager", icon: Search, color: "#6c5ce7", group: "SEO" },
  { id: "keywords", label: "Keywords", icon: Hash, color: "#00d4ff", group: "SEO" },
  { id: "google_bing", label: "Google & Bing SEO", icon: Network, color: "#00d4ff", group: "SEO" },
  { id: "indexing", label: "Indexing", icon: SearchCode, color: "#6c5ce7", group: "SEO" },
  
  // Analytics & Logs
  { id: "analytics", label: "Analytics", icon: LineChart, color: "#00d4ff", group: "Analytics" },
  { id: "audit_logs", label: "Audit Logs", icon: ClipboardList, color: "#2ed573", group: "Analytics" },
  
  // System
  { id: "safety", label: "Safety & Reports", icon: Flag, color: "#ff4757", group: "System" },
  { id: "config", label: "Configuration", icon: Settings, color: "#ffbe0b", group: "System" },
  { id: "security", label: "Security", icon: ShieldCheck, color: "#ff006e", group: "System" },
];

// ─── HELPERS ───
async function adminFetch(endpoint: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
  try {
    const token = localStorage.getItem("nexora_token");
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": token ? `Bearer ${token}` : "",
        ...options.headers 
      },
    });
    clearTimeout(timeout);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") return { error: "Request timed out. Server may be busy." };
    return null;
  }
}

// ─── STAT CARD ───
function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number | string; color: string; sub?: string;
}) {
  const { isDark } = useTheme();
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ type: "spring", stiffness: 400 }}
      className="p-5 rounded-2xl border flex flex-col gap-3"
      style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
      <div className="flex items-center justify-between">
        <div className="p-2.5 rounded-xl shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {sub && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}>{sub}</span>}
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </motion.div>
  );
}

// ─── CONFIRM MODAL ───
function ConfirmModal({ title, message, onConfirm, onCancel, danger }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  const { isDark } = useTheme();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onCancel}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        className="w-full max-w-sm rounded-[2rem] p-7 shadow-2xl border" onClick={e => e.stopPropagation()}
        style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: danger ? "rgba(255,0,110,0.1)" : "rgba(108,92,231,0.1)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: danger ? "#ff006e" : "#6c5ce7" }} />
          </div>
          <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
          <div className="flex gap-3 w-full mt-2">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold transition-colors"
              style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-primary)" }}>Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-white shadow-lg"
              style={{ background: danger ? "#ff006e" : "#6c5ce7" }}>Confirm</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════
function OverviewTab({ stats, onRefresh }: { stats: Stats; onRefresh: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>System Overview</h2>
        <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
          style={{ background: "rgba(108,92,231,0.1)", color: "#6c5ce7" }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="#6c5ce7" sub="LIVE" />
        <StatCard icon={Wifi} label="Online Now" value={stats.onlineUsers} color="#2ed573" sub="REAL-TIME" />
        <StatCard icon={Image} label="Total Stories" value={stats.totalStories} color="#ff006e" />
        <StatCard icon={Link2} label="Connections" value={stats.totalConnections} color="#00d4ff" />
        <StatCard icon={MessageSquare} label="Pending Requests" value={stats.pendingRequests} color="#ffbe0b" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════
function UsersTab() {
  const { isDark } = useTheme();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ type: string; user: UserRecord } | null>(null);
  const [pwModal, setPwModal] = useState<UserRecord | null>(null);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch("/api/admin/users");
    if (data?.users) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (username: string, role: string) => {
    await adminFetch(`/api/admin/users/${username}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    setRoleDropdown(null);
    fetchUsers();
  };

  const handleStatusToggle = async (user: UserRecord) => {
    const newStatus = user.status === "Active" ? "Suspended" : "Active";
    await adminFetch(`/api/admin/users/${user.username}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    fetchUsers();
  };

  const handleDelete = async (username: string) => {
    await adminFetch(`/api/admin/users/${username}`, { method: "DELETE" });
    setConfirm(null);
    fetchUsers();
  };

  const handleResetPw = async () => {
    if (!pwModal || newPw.length < 6) return;
    await adminFetch(`/api/admin/users/${pwModal.username}/password`, { method: "PATCH", body: JSON.stringify({ newPassword: newPw }) });
    setPwModal(null);
    setNewPw("");
  };

  const roles = ["Standard", "Admin", "PendingAuthorized"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>User Management</h2>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
          </div>
          <button onClick={fetchUsers} className="p-2.5 rounded-xl" style={{ background: "rgba(108,92,231,0.1)", color: "#6c5ce7" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User List */}
      <div className="overflow-y-auto custom-scrollbar rounded-2xl" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div className="space-y-3 pr-1">
        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
            No users found
          </div>
        ) : filtered.map(user => (
          <motion.div key={user.username} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
            style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: user.status === "Suspended" ? "rgba(255,0,110,0.2)" : "var(--border-subtle)" }}>

            {/* User Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative shrink-0">
                <Avatar 
                  src={user.avatarUrl} 
                  name={user.fullName} 
                  color={user.color} 
                  size={44} 
                  animate={true} 
                  showBorder={false}
                />
                {user.online && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#2ed573] border-2 animate-pulse" 
                    style={{ borderColor: isDark ? "#10101e" : "#fff" }} 
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{user.fullName}</p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{
                      background: user.role === "Admin" ? "rgba(108,92,231,0.12)" : user.role === "PendingAuthorized" ? "rgba(255,190,11,0.12)" : "rgba(0,212,255,0.08)",
                      color: user.role === "Admin" ? "#6c5ce7" : user.role === "PendingAuthorized" ? "#ffbe0b" : "#00d4ff"
                    }}>{user.role}</span>
                  {user.status === "Suspended" && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#ff006e]/10 text-[#ff006e]">SUSPENDED</span>}
                </div>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>@{user.username} · {user.email}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {/* Role dropdown */}
              <div className="relative">
                <button onClick={() => setRoleDropdown(roleDropdown === user.username ? null : user.username)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(108,92,231,0.08)", color: "#6c5ce7" }}>
                  <Crown className="w-3 h-3" /> Role <ChevronDown className="w-3 h-3" />
                </button>
                {roleDropdown === user.username && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl shadow-xl border overflow-hidden"
                    style={{ background: isDark ? "#1a1a2e" : "#fff", borderColor: "var(--border-subtle)" }}>
                    {roles.map(r => (
                      <button key={r} onClick={() => handleRoleChange(user.username, r)}
                        className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-white/5 transition-colors flex items-center justify-between"
                        style={{ color: user.role === r ? "#6c5ce7" : "var(--text-primary)" }}>
                        {r} {user.role === r && <CheckCircle className="w-3 h-3" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Status toggle */}
              <button onClick={() => handleStatusToggle(user)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                style={{
                  background: user.status === "Active" ? "rgba(255,0,110,0.08)" : "rgba(46,213,115,0.08)",
                  color: user.status === "Active" ? "#ff006e" : "#2ed573"
                }}>
                {user.status === "Active" ? <><Ban className="w-3 h-3" /> Suspend</> : <><UserCheck className="w-3 h-3" /> Activate</>}
              </button>

              {/* Reset password */}
              <button onClick={() => { setPwModal(user); setNewPw(""); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(255,190,11,0.08)", color: "#ffbe0b" }}>
                <KeyRound className="w-3 h-3" /> Reset PW
              </button>

              {/* Delete */}
              <button onClick={() => setConfirm({ type: "delete", user })}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                style={{ background: "rgba(255,0,110,0.08)", color: "#ff006e" }}>
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </motion.div>
        ))}
        </div>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirm?.type === "delete" && (
          <ConfirmModal key="del" danger title="Delete User" message={`Are you sure you want to permanently delete @${confirm.user.username}? This will remove all their data.`}
            onConfirm={() => handleDelete(confirm.user.username)} onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>

      {/* Password reset modal */}
      <AnimatePresence>
        {pwModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setPwModal(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="w-full max-w-sm rounded-[2rem] p-7 shadow-2xl border" onClick={e => e.stopPropagation()}
              style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
              <h3 className="text-lg font-black mb-4" style={{ color: "var(--text-primary)" }}>Reset Password for @{pwModal.username}</h3>
              <div className="relative mb-4">
                <input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password (min 6 chars)"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none"
                  style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100" style={{ color: "var(--text-muted)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPwModal(null)} className="flex-1 py-3 rounded-xl font-bold"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={handleResetPw} disabled={newPw.length < 6}
                  className="flex-1 py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40"
                  style={{ background: "#6c5ce7" }}>Reset Password</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════
// STORIES TAB
// ═══════════════════════════════════════
// EMAIL TEMPLATES TAB
// ═══════════════════════════════════════
const TEMPLATE_TYPES = [
  { id: "welcome", label: "Welcome Email", color: "#6c5ce7", desc: "Sent on new signup" },
  { id: "otp", label: "OTP / Recovery", color: "#00d4ff", desc: "Recovery code email" },
  { id: "login_alert", label: "Login Alert", color: "#e11d48", desc: "Sent on every login" },
];

function EmailTemplatesTab() {
  const { isDark } = useTheme();
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [selected, setSelected] = useState("welcome");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const fetchTemplates = useCallback(async () => {
    const data = await adminFetch("/api/admin/email-templates");
    if (data?.templates) {
      setTemplates(data.templates);
      const t = data.templates[selected];
      if (t) { setSubject(t.subject); setHtml(t.html); }
    }
  }, [selected]);

  useEffect(() => { fetchTemplates(); }, []);

  // When switching templates, load that template's content
  const handleSelectTemplate = (id: string) => {
    setSelected(id);
    const t = templates[id];
    if (t) { setSubject(t.subject); setHtml(t.html); }
    setSavedMsg("");
  };

  // Build preview with dummy variable substitution
  const buildPreview = () => {
    const sampleVars: Record<string, string> = {
      "{{username}}": "sample_user",
      "{{otp}}": "847291",
      "{{APP_LOGO}}": "https://res.cloudinary.com/dzpci7b5j/image/upload/v1774956459/logo_zsgzf2.svg",
      "{{CLIENT_URL}}": "https://nexora31.vercel.app",
      "{{YEAR}}": new Date().getFullYear().toString(),
      "{{TIMESTAMP}}": new Date().toLocaleString(),
    };
    let out = html;
    for (const [k, v] of Object.entries(sampleVars)) out = out.split(k).join(v);
    setPreviewHtml(out);
    setTab("preview");
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await adminFetch(`/api/admin/email-templates/${selected}`, {
      method: "PUT",
      body: JSON.stringify({ subject, html }),
    });
    setSaving(false);
    setSavedMsg(res?.status === "success" ? "✓ Template saved!" : "✗ Save failed");
    // refresh
    const data = await adminFetch("/api/admin/email-templates");
    if (data?.templates) setTemplates(data.templates);
  };

  const handleReset = async () => {
    await adminFetch(`/api/admin/email-templates/${selected}`, { method: "DELETE" });
    const data = await adminFetch("/api/admin/email-templates");
    if (data?.templates) {
      setTemplates(data.templates);
      const t = data.templates[selected];
      if (t) { setSubject(t.subject); setHtml(t.html); }
    }
    setSavedMsg("↺ Reset to default");
  };

  const inputStyle = { background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" };
  const currentMeta = TEMPLATE_TYPES.find(t => t.id === selected);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Email Templates</h2>

      {/* Template selector */}
      <div className="flex flex-wrap gap-3">
        {TEMPLATE_TYPES.map(t => {
          const tmpl = templates[t.id];
          const active = selected === t.id;
          return (
            <button key={t.id} onClick={() => handleSelectTemplate(t.id)}
              className="flex flex-col items-start px-5 py-3 rounded-2xl border text-left transition-all"
              style={{
                background: active ? `${t.color}10` : (isDark ? "rgba(255,255,255,0.02)" : "#fff"),
                borderColor: active ? t.color : "var(--border-subtle)",
                boxShadow: active ? `0 0 0 1px ${t.color}40` : "none"
              }}>
              <span className="text-sm font-bold" style={{ color: active ? t.color : "var(--text-primary)" }}>{t.label}</span>
              <span className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t.desc}</span>
              {tmpl?.isCustomized && (
                <span className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded-md" style={{ background: `${t.color}15`, color: t.color }}>CUSTOM</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Variables reference */}
      {templates[selected]?.variables && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Variables:</span>
          {templates[selected].variables.map(v => (
            <code key={v} className="text-[11px] px-2 py-0.5 rounded-lg font-mono cursor-pointer select-all"
              style={{ background: isDark ? "rgba(108,92,231,0.1)" : "rgba(108,92,231,0.07)", color: "#6c5ce7" }}
              title="Click to copy" onClick={() => navigator.clipboard.writeText(v)}>{v}</code>
          ))}
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>click to copy</span>
        </div>
      )}

      {/* Edit / Preview tabs */}
      <div className="flex gap-2">
        {(["edit", "preview"] as const).map(t => (
          <button key={t} onClick={() => { if (t === "preview") buildPreview(); else setTab("edit"); }}
            className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all"
            style={{
              background: tab === t ? (currentMeta?.color || "#6c5ce7") + "15" : "transparent",
              color: tab === t ? (currentMeta?.color || "#6c5ce7") : "var(--text-muted)",
              border: `1px solid ${tab === t ? (currentMeta?.color || "#6c5ce7") + "40" : "var(--border-subtle)"}`
            }}>
            {t === "edit" ? "✏️ Editor" : "👁 Live Preview"}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: currentMeta?.color || "#6c5ce7" }}>Subject Line</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} />
          </div>
          {/* HTML Editor */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: currentMeta?.color || "#6c5ce7" }}>HTML Body</label>
            <textarea value={html} onChange={e => setHtml(e.target.value)} rows={20}
              className="w-full p-4 rounded-xl outline-none font-mono text-xs resize-y"
              style={{ ...inputStyle, lineHeight: 1.6, minHeight: "400px" }}
              spellCheck={false} />
          </div>
        </div>
      ) : (
        /* Live Preview */
        <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: "var(--border-subtle)", minHeight: "500px" }}>
          <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border-subtle)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
            <div className="flex gap-1.5">
              {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
            </div>
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Email Preview — {subject}</span>
          </div>
          <iframe
            srcDoc={previewHtml}
            className="w-full"
            style={{ height: "600px", border: "none" }}
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${currentMeta?.color || "#6c5ce7"}, #6c5ce7)` }}>
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Template"}
        </motion.button>
        <button onClick={handleReset}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold border transition-colors"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}>
          <RefreshCw className="w-4 h-4" /> Reset to Default
        </button>
        {savedMsg && (
          <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            className="text-sm font-bold" style={{ color: savedMsg.startsWith("✓") ? "#2ed573" : savedMsg.startsWith("↺") ? "#00d4ff" : "#ff006e" }}>
            {savedMsg}
          </motion.span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// BROADCAST TAB (was EmailTab)
// ═══════════════════════════════════════
function BroadcastTab() {
  const { isDark } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<"email" | "chat">("chat");
  
  // Email States
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Chat States
  const [chatMessage, setChatMessage] = useState("");
  const [chatStatus, setChatStatus] = useState<any>(null);
  const [isRefreshingChat, setIsRefreshingChat] = useState(false);

  const fetchChatStatus = async () => {
    const data = await adminFetch("/api/admin/broadcast-chat/status");
    if (data) setChatStatus(data);
  };

  useEffect(() => {
    fetchChatStatus();
    const interval = setInterval(() => {
      if (chatStatus?.isRunning) fetchChatStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [chatStatus?.isRunning]);

  const handleEmailBroadcast = async () => {
    if (!subject || !htmlBody) { alert("Subject and HTML body are required."); return; }
    setIsSendingEmail(true);
    setEmailResult(null);
    const data = await adminFetch("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ subject, html: htmlBody })
    });
    if (data) setEmailResult({ sent: data.sent, failed: data.failed, total: data.total });
    setIsSendingEmail(false);
  };

  const handleStartChatBroadcast = async () => {
    if (!chatMessage.trim()) { alert("Message content required."); return; }
    const data = await adminFetch("/api/admin/broadcast-chat", {
      method: "POST",
      body: JSON.stringify({ message: chatMessage })
    });
    if (data) fetchChatStatus();
  };

  const handleStopChatBroadcast = async () => {
    await adminFetch("/api/admin/broadcast-chat/stop", { method: "POST" });
    fetchChatStatus();
  };

  const inputStyle = {
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-white/5 pb-1">
        <button onClick={() => setActiveSubTab("chat")} className={`pb-3 px-2 text-sm font-black transition-all relative ${activeSubTab === 'chat' ? 'text-[#00d4ff]' : 'text-muted-foreground opacity-50'}`}>
          DIRECT MESSAGES (START)
          {activeSubTab === 'chat' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00d4ff]" />}
        </button>
        <button onClick={() => setActiveSubTab("email")} className={`pb-3 px-2 text-sm font-black transition-all relative ${activeSubTab === 'email' ? 'text-[#a29bfe]' : 'text-muted-foreground opacity-50'}`}>
          EMAIL BROADCAST
          {activeSubTab === 'email' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#a29bfe]" />}
        </button>
      </div>

      {activeSubTab === "chat" ? (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
           <div className="p-6 rounded-[2rem] bg-gradient-to-br from-[#00d4ff]/10 to-transparent border border-[#00d4ff]/10">
              <h3 className="text-xl font-black mb-2" style={{ color: "#00d4ff" }}>Snapchat-Style Chat Broadcast</h3>
              <p className="text-xs font-bold opacity-60 mb-6 uppercase tracking-widest">Sends a Direct Message from the official Nexora account to every registered user.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 block text-[#00d4ff]">Message Broadcast Payload</label>
                  <textarea 
                    value={chatMessage} 
                    onChange={e => setChatMessage(e.target.value)}
                    placeholder="Enter official broadcast message..."
                    className="w-full p-5 rounded-3xl outline-none text-sm font-bold resize-none min-h-[150px] transition-all focus:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                    style={inputStyle}
                  />
                </div>

                <div className="flex items-center gap-3">
                  {!chatStatus?.isRunning ? (
                    <motion.button 
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleStartChatBroadcast}
                      className="flex-1 py-4 rounded-2xl bg-[#00d4ff] text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#00d4ff]/20"
                    >
                      START BROADCAST
                    </motion.button>
                  ) : (
                    <div className="flex gap-3 w-full">
                       <div className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-ping" />
                          <span className="text-[10px] font-black uppercase text-[#00d4ff] tracking-widest">Sequence Active...</span>
                       </div>
                       <button onClick={handleStopChatBroadcast} className="px-8 py-4 rounded-2xl bg-red-500/10 text-red-500 font-black text-xs uppercase tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all">
                          STOP
                       </button>
                    </div>
                  )}
                </div>
              </div>
           </div>

           {chatStatus && (
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Target Users</p>
                  <p className="text-xl font-black">{chatStatus.total}</p>
               </div>
               <div className="p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Delivered</p>
                  <p className="text-xl font-black text-[#00d4ff]">{chatStatus.sent}</p>
               </div>
               <div className="p-5 rounded-3xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Processing</p>
                  <p className="text-xl font-black">{chatStatus.total > 0 ? Math.round((chatStatus.sent / chatStatus.total) * 100) : 0}%</p>
               </div>
             </div>
           )}

           {chatStatus?.isRunning && (
             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(chatStatus.sent / chatStatus.total) * 100}%` }}
                  className="h-full bg-gradient-to-r from-[#00d4ff] to-[#6c5ce7]" 
                />
             </div>
           )}
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Send a custom HTML email to all registered users.</p>

          {/* Subject */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "#a29bfe" }}>Subject Line</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..."
              className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} />
          </div>

          {/* Edit / Preview toggle */}
          <div className="flex gap-2">
            {(["edit", "preview"] as const).map(t => (
              <button key={t} onClick={() => setPreviewMode(t === "preview")}
                className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all"
                style={{
                  background: (previewMode ? t === "preview" : t === "edit") ? "rgba(162,155,254,0.15)" : "transparent",
                  color: (previewMode ? t === "preview" : t === "edit") ? "#a29bfe" : "var(--text-muted)",
                  border: `1px solid ${(previewMode ? t === "preview" : t === "edit") ? "rgba(162,155,254,0.4)" : "var(--border-subtle)"}`
                }}>
                {t === "edit" ? "✏️ Editor" : "👁 Preview"}
              </button>
            ))}
          </div>

          {!previewMode ? (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "#a29bfe" }}>HTML Body</label>
              <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} rows={12} placeholder="<html>...</html>"
                className="w-full p-4 rounded-xl outline-none font-mono text-xs resize-y"
                style={{ ...inputStyle, lineHeight: 1.6, minHeight: "300px" }} spellCheck={false} />
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden bg-white" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="px-4 py-2 border-b flex items-center gap-2"
                style={{ borderColor: "var(--border-subtle)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                <div className="flex gap-1.5">
                  {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Broadcast Preview — {subject || "No subject"}</span>
              </div>
              <iframe srcDoc={htmlBody} className="w-full" style={{ height: "450px", border: "none" }}
                title="Broadcast Preview" sandbox="allow-same-origin" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleEmailBroadcast} disabled={isSendingEmail}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #a29bfe, #6c5ce7)" }}>
              <Send className="w-4 h-4" /> {isSendingEmail ? "Broadcasting..." : "Send to All Users"}
            </motion.button>

            {emailResult && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(46,213,115,0.08)", color: "#2ed573", border: "1px solid rgba(46,213,115,0.15)" }}>
                <CheckCircle className="w-4 h-4" /> Sent: {emailResult.sent} · Failed: {emailResult.failed} · Total: {emailResult.total}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════
// SAFETY & REPORTS TAB
// ═══════════════════════════════════════
interface SafetyRecord {
  id: number;
  reporter: string;
  target: string;
  reason: string;
  category: string;
  evidence: string; // JSON
  status: string;
  created_at: string;
}

function SafetyTab() {
  const { isDark } = useTheme();
  const [reports, setReports] = useState<SafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch("/api/admin/reports");
    if (data?.reports) setReports(data.reports);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleUpdateStatus = async (id: number, status: string) => {
    await adminFetch(`/api/admin/reports/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    fetchReports();
  };

  const handleUserStatus = async (username: string, status: string) => {
    if (status === "Suspended" && !confirm(`Are you absolutely sure you want to PERMANENTLY SUSPEND @${username}? This will block all access to the protocol immediately.`)) {
      return;
    }
    await adminFetch(`/api/admin/users/${username}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    alert(`Protocol ${status === 'Suspended' ? 'TERMINATED' : 'RESTORED'} for @${username}.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Safety Protocol Center</h2>
          <p className="text-xs font-bold opacity-50 uppercase tracking-widest mt-1">Evidence-Based Abuse Reporting</p>
        </div>
        <button onClick={fetchReports} className="p-2.5 rounded-xl" style={{ background: "rgba(255,71,87,0.1)", color: "#ff4757" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl opacity-40">No active reports.</div>
        ) : reports.map(report => (
          <motion.div key={report.id} layout className="border rounded-3xl overflow-hidden shadow-sm"
            style={{ 
              background: isDark ? "rgba(255,255,255,0.02)" : "#fff", 
              borderColor: report.status === "Pending" ? "#ff475730" : "var(--border-subtle)" 
            }}>
            
            <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-red-500/10 text-red-500">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black uppercase text-red-500 bg-red-500/5 px-2 py-0.5 rounded-md">
                      {report.category}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      report.status === 'Pending' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    Report against <span className="text-[#00d4ff]">@{report.target}</span>
                  </h3>
                  <p className="text-xs opacity-60" style={{ color: "var(--text-secondary)" }}>
                    By @{report.reporter} · {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-white/5 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" /> {expandedReport === report.id ? "Hide Evidence" : "View Evidence"}
                </button>
                <div className="h-6 w-[1px] bg-white/10 mx-1" />
                <button onClick={() => handleUpdateStatus(report.id, "Resolved")} className="p-2 rounded-xl text-green-500 hover:bg-green-500/10 transition-all" title="Mark Resolved">
                  <CheckCircle className="w-5 h-5" />
                </button>
                <button onClick={() => handleUpdateStatus(report.id, "Dismissed")} className="p-2 rounded-xl text-orange-500 hover:bg-orange-500/10 transition-all" title="Dismiss Report">
                   <XCircle className="w-5 h-5" />
                </button>
                <button onClick={() => handleUserStatus(report.target, "Suspended")} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all" title="Suspend User">
                  <Ban className="w-5 h-5" />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedReport === report.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-[#6c5ce7] tracking-widest mb-2">Reporter Context</h4>
                      <div className="p-4 rounded-2xl bg-white/5 text-sm font-medium italic" style={{ color: "var(--text-primary)" }}>
                        "{report.reason}"
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-black uppercase text-[#00d4ff] tracking-widest">Chat Evidence (Last 5 Messages)</h4>
                        <span className="text-[10px] font-bold opacity-30 uppercase italic">Unencrypted Review Mode</span>
                      </div>
                      <div className="space-y-2">
                        {(() => {
                            try {
                              const evidence = typeof report.evidence === 'string' ? JSON.parse(report.evidence) : report.evidence;
                              if (!evidence || evidence.length === 0) return <p className="text-xs opacity-40">No message evidence attached for this incident.</p>;
                              return evidence.map((m: any, i: number) => (
                                <div key={i} className={`flex flex-col p-3 rounded-2xl border ${m.from === report.target ? 'bg-red-500/5 border-red-500/10' : 'bg-blue-500/5 border-blue-500/10'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: m.from === report.target ? "#ff4757" : "#6c5ce7" }}>
                                      {m.from === report.target ? "REPORTED USER" : "REPORTER"} (@{m.from})
                                    </span>
                                    <span className="text-[9px] opacity-40 font-mono">SEQ_ID: {m.id?.slice(-6) || i}</span>
                                  </div>
                                  <p className="text-xs font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>{m.text}</p>
                                  {m.type === 'image' && <div className="mt-2 text-[9px] font-bold text-orange-500 uppercase">📷 Attachment: {m.imageName || 'Media File'}</div>}
                                </div>
                              ));
                            } catch (e) {
                              return <p className="text-xs text-red-400">Security Exception: Failed to decode evidence hash.</p>;
                            }
                         })()}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                       <button onClick={() => handleUpdateStatus(report.id, "In Review")} className="flex-1 py-3 rounded-2xl bg-[#6c5ce7] text-white font-black text-[10px] uppercase tracking-widest">
                         Promote to Review Queue
                       </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ConnectionsTab() {
  const { isDark } = useTheme();
  const [connections, setConnections] = useState<ConnectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<ConnectionRecord | null>(null);
  const [search, setSearch] = useState("");

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch("/api/admin/connections");
    if (data?.connections) setConnections(data.connections);
    setLoading(false);
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const filtered = connections.filter(c =>
    c.user_a.includes(search.toLowerCase()) || c.user_b.includes(search.toLowerCase()) ||
    (c.name_a || "").toLowerCase().includes(search.toLowerCase()) || (c.name_b || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/connections/${id}`, { method: "DELETE" });
    setConfirm(null);
    fetchConnections();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Connections</h2>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-56 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
          </div>
          <button onClick={fetchConnections} className="p-2.5 rounded-xl" style={{ background: "rgba(46,213,115,0.1)", color: "#2ed573" }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto custom-scrollbar rounded-2xl" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div className="space-y-3 pr-1">
        {loading ? (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>Loading connections...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
            No connections found
          </div>
        ) : filtered.map(conn => (
          <motion.div key={conn.id} layout className="p-4 rounded-2xl border flex items-center justify-between gap-4"
            style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                  {(conn.name_a || conn.user_a)?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{conn.name_a || conn.user_a}</p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>@{conn.user_a}</p>
                </div>
              </div>

              <div className="px-3 shrink-0">
                <Link2 className="w-5 h-5" style={{ color: "#2ed573" }} />
              </div>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, #ff006e, #ffbe0b)" }}>
                  {(conn.name_b || conn.user_b)?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>{conn.name_b || conn.user_b}</p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>@{conn.user_b}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-mono hidden sm:block" style={{ color: "var(--text-muted)" }}>
                {new Date(conn.created_at).toLocaleDateString()}
              </span>
              <button onClick={() => setConfirm(conn)}
                className="p-2 rounded-xl hover:bg-[#ff006e]/10 transition-colors" style={{ color: "#ff006e" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
        </div>
      </div>

      <AnimatePresence>
        {confirm && (
          <ConfirmModal key="del-conn" danger title="Remove Connection"
            message={`Remove connection between @${confirm.user_a} and @${confirm.user_b}?`}
            onConfirm={() => handleDelete(confirm.id)} onCancel={() => setConfirm(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════
// DYNAMIC CONFIG & SEO TAB
// ═══════════════════════════════════════
function DynamicConfigTab({ activeTab }: { activeTab: TabId }) {
  const { isDark } = useTheme();
  const [seo, setSeo] = useState({
    title: "", titleTemplate: "", description: "", keywords: "",
    siteUrl: "", ogImage: "", twitterHandle: "", author: "",
    themeColor: "#6c5ce7", language: "en", category: "Technology",
    canonicalUrl: "", robots: "", indexing: true,
    googleVerification: "", bingVerification: "",
  });
  const [logoB64, setLogoB64] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/config").then(data => {
      if (data?.seo) setSeo(prev => ({ ...prev, ...data.seo }));
      setLoading(false);
    });
  }, []);

  const onLogoUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = ev => setLogoB64(ev.target?.result as string);
      r.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedMsg("");
    const payload: any = { seo };
    if (logoB64) payload.logoBase64 = logoB64;
    const res = await adminFetch("/api/admin/config", { method: "POST", body: JSON.stringify(payload) });
    setIsSaving(false);
    setSavedMsg(res?.status === "success" ? "✓ Configuration deployed!" : "✗ Deploy failed");
    setTimeout(() => setSavedMsg(""), 3000);
  };

  const inputStyle = {
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    border: "1px solid var(--border-subtle)",
    color: "var(--text-primary)"
  };
  const labelStyle = "text-[10px] font-bold uppercase tracking-widest mb-1 block";

  if (loading) return <div className="text-center py-20 animate-pulse" style={{ color: "var(--text-muted)" }}>Initializing module securely...</div>;

  const tabTitles: Record<string, string> = {
    config: "System Configuration",
    seo_manager: "Core SEO & Metadata",
    keywords: "Keyword Engine",
    google_bing: "Google & Bing Visibility",
    indexing: "Crawling & Indexing Rules"
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
        {tabTitles[activeTab] || "Settings"}
      </h2>
      {/* ── INDEXING TAB ── */}
      {/* ── INDEXING TAB ── */}
      {activeTab === "indexing" && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border flex items-center justify-between gap-4"
            style={{ background: seo.indexing ? "rgba(46,213,115,0.05)" : "rgba(255,0,110,0.05)", borderColor: seo.indexing ? "rgba(46,213,115,0.2)" : "rgba(255,0,110,0.2)" }}>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{seo.indexing ? "🟢 Search Engine Indexing: ENABLED" : "🔴 Search Engine Indexing: DISABLED"}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{seo.indexing ? "Google, Bing & other crawlers can index this site." : "All crawlers blocked via robots.txt (noindex, nofollow)."}</p>
            </div>
            <button onClick={() => setSeo(prev => ({ ...prev, indexing: !prev.indexing }))}
              className="relative w-14 h-7 rounded-full transition-all flex-shrink-0" style={{ background: seo.indexing ? "#2ed573" : "#ff006e" }}>
              <span className="absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all" style={{ left: seo.indexing ? "calc(100% - 26px)" : "2px" }} />
            </button>
          </div>
          
          <div className="p-6 rounded-2xl border space-y-4 flex flex-col" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
             <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest" style={{ color: "#00d4ff" }}>Included Website Routes</h3>
             <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
               {[
                 { route: "/", desc: "Main Landing Page", status: "Indexed" },
                 { route: "/auth", desc: "Authentication Portal", status: "Indexed" },
                 { route: "/dashboard", desc: "Private Chat Dashboard", status: "NoIndex (Protected)" },
                 { route: "/admin", desc: "Admin Control Panel", status: "NoIndex (Protected)" },
                 { route: "/blog", desc: "Company Technical Blog", status: "Indexed" },
                 { route: "/policies", desc: "Legal & Privacy Terms", status: "Indexed" }
               ].map((page, i) => (
                 <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                   <div className="flex items-center gap-3">
                     <span className="text-xs font-mono font-bold" style={{ color: "#a29bfe" }}>{page.route}</span>
                     <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{page.desc}</span>
                   </div>
                   <span className="text-[10px] font-bold px-2 py-0.5 rounded border" 
                     style={{ 
                       background: page.status.includes("NoIndex") ? "rgba(255,0,110,0.1)" : "rgba(46,213,115,0.1)", 
                       color: page.status.includes("NoIndex") ? "#ff006e" : "#2ed573",
                       borderColor: page.status.includes("NoIndex") ? "#ff006e20" : "#2ed57320" 
                     }}>
                     {page.status}
                   </span>
                 </div>
               ))}
             </div>
          </div>

          <div className="p-6 rounded-2xl border" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <label className={labelStyle} style={{ color: "var(--text-muted)" }}>Custom Robots Directive</label>
            <input type="text" value={seo.robots} onChange={e => setSeo(p => ({ ...p, robots: e.target.value }))} placeholder="index, follow, max-image-preview:large" className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} />
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Leave blank to use defaults. Top-level toggle overrides this if disabled.</p>
          </div>

          <div className="p-6 rounded-2xl border" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest mb-3" style={{ color: "#2ed573" }}>Index Request Delivery</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Manually trigger search engine crawlers to parse your latest website metadata, keywords, and blogs. This speeds up your appearance on Google.</p>
            <button type="button" onClick={() => {
              adminFetch("/api/admin/ping-search-engines", { method: "POST" })
                .then(res => alert(res?.status==="success" ? "✓ PING SUCCESS: Google & Bing have been notified to re-index the website. Crawling takes 24-48 hours." : "✗ PING FAILED: Network Error."));
            }} className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all hover:bg-[#2ed573]/10 text-[#2ed573] border-[#2ed573]/30 shadow">
              <Globe className="w-4 h-4 inline mr-2 -mt-0.5" /> Submit to Google & Bing
            </button>
          </div>
        </div>
      )}

      {/* ── SEO MANAGER TAB ── */}
      {activeTab === "seo_manager" && (
        <div className="p-6 rounded-2xl border space-y-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Site Title</label><input type="text" value={seo.title} onChange={e => setSeo(p => ({ ...p, title: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Title Template</label><input type="text" value={seo.titleTemplate} onChange={e => setSeo(p => ({ ...p, titleTemplate: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
            </div>
            <div>
              <label className={labelStyle} style={{ color: "var(--text-muted)" }}>Meta Description</label>
              <textarea value={seo.description} onChange={e => setSeo(p => ({ ...p, description: e.target.value }))} rows={4} className="w-full px-4 py-3 rounded-xl outline-none text-sm resize-none" style={inputStyle} />
              <div className="mt-1 flex justify-between text-[10px]">
                 <span style={{ color: "var(--text-muted)" }}>Used for search snippet</span>
                 <span style={{ color: seo.description.length > 160 ? "#ff006e" : "var(--text-muted)" }}>{seo.description.length} / 160 chars</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Author</label><input type="text" value={seo.author} onChange={e => setSeo(p => ({ ...p, author: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
               <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Category</label><input type="text" value={seo.category} onChange={e => setSeo(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
               <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Language</label><input type="text" value={seo.language} onChange={e => setSeo(p => ({ ...p, language: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
            </div>
        </div>
      )}

      {/* ── KEYWORDS TAB ── */}
      {activeTab === "keywords" && (
        <div className="p-6 rounded-2xl border space-y-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
          <div>
            <label className={labelStyle} style={{ color: "var(--text-muted)" }}>Global SEO Keywords (comma separated)</label>
            <textarea value={seo.keywords || ""} onChange={e => setSeo(p => ({ ...p, keywords: e.target.value }))} rows={4} className="w-full px-4 py-3 rounded-xl outline-none text-sm resize-none leading-relaxed" style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-2 mt-4 p-4 rounded-xl border" style={{ borderColor: "var(--border-subtle)", background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)" }}>
             {(seo.keywords||"").split(",").map(k => k.trim()).filter(Boolean).map((kw, i) => (
                <span key={i} className="px-3 py-1.5 bg-[#00d4ff]/10 text-[#00d4ff] rounded-lg text-xs font-mono border border-[#00d4ff]/20 flex items-center gap-1 shadow-sm">
                  <Hash className="w-3 h-3" /> {kw}
                </span>
             ))}
             {!(seo.keywords||"").trim() && <span className="text-xs text-gray-500">No keywords defined.</span>}
          </div>
        </div>
      )}

      {/* ── GOOGLE & BING SEO TAB ── */}
      {activeTab === "google_bing" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <h3 className="text-base font-black flex items-center gap-2" style={{ color: "#2ed573" }}>Webmaster Verification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Google Site Verification</label><input type="text" value={seo.googleVerification || ""} onChange={e => setSeo(p => ({ ...p, googleVerification: e.target.value }))} placeholder="Verification Token..." className="w-full px-4 py-3 rounded-xl outline-none text-sm font-mono" style={inputStyle} /></div>
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Bing Site Verification</label><input type="text" value={seo.bingVerification || ""} onChange={e => setSeo(p => ({ ...p, bingVerification: e.target.value }))} placeholder="Verification Token..." className="w-full px-4 py-3 rounded-xl outline-none text-sm font-mono" style={inputStyle} /></div>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>This injects &lt;meta name="google-site-verification"&gt; tags natively into the document head.</p>
          </div>
          
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <h3 className="text-base font-black flex items-center gap-2" style={{ color: "#00d4ff" }}>URLs & Social Graph</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Site URL</label><input type="url" value={seo.siteUrl} onChange={e => setSeo(p => ({ ...p, siteUrl: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Canonical URL</label><input type="url" value={seo.canonicalUrl} onChange={e => setSeo(p => ({ ...p, canonicalUrl: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>OG Image URL</label><input type="url" value={seo.ogImage} onChange={e => setSeo(p => ({ ...p, ogImage: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
              <div><label className={labelStyle} style={{ color: "var(--text-muted)" }}>Twitter Handle</label><input type="text" value={seo.twitterHandle} onChange={e => setSeo(p => ({ ...p, twitterHandle: e.target.value }))} className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={inputStyle} /></div>
            </div>
            {seo.ogImage && (
               <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
                 <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)" }}>OG Image Preview</div>
                 <img src={seo.ogImage} alt="OG" className="w-full max-h-40 object-cover" onError={() => {}} />
               </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIG TAB ── */}
      {activeTab === "config" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border flex items-center gap-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
             <div className="flex-1">
               <label className={labelStyle} style={{ color: "var(--text-muted)" }}>Theme Color</label>
               <div className="flex gap-3 items-center">
                 <input type="color" value={seo.themeColor} onChange={e => setSeo(p => ({ ...p, themeColor: e.target.value }))} className="w-12 h-12 rounded-xl border cursor-pointer p-1" style={{ borderColor: "var(--border-subtle)", background: isDark ? "rgba(255,255,255,0.04)" : "#fff" }} />
                 <input type="text" value={seo.themeColor} onChange={e => setSeo(p => ({ ...p, themeColor: e.target.value }))} className="flex-1 px-4 py-3 rounded-xl outline-none text-sm font-mono" style={inputStyle} />
               </div>
             </div>
          </div>
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
            <h3 className="text-base font-black flex items-center gap-2" style={{ color: "#ff006e" }}>Logo Upload</h3>
            <label className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-colors" style={{ borderColor: "var(--border-subtle)" }} htmlFor="logo">
              <input id="logo" type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
              {logoB64 ? <img src={logoB64} className="w-16 h-16 rounded-xl shadow-xl" alt="Preview"/> : <p className="font-bold text-sm" style={{ color: "var(--text-secondary)" }}>Click to select logo</p>}
            </label>
          </div>
          <button onClick={async () => {
             const res = await adminFetch("/api/admin/test-mail", { method: "POST" });
             alert(res?.status === "success" ? "✓ SMTP successful!" : "✗ SMTP failed.");
          }} className="w-full py-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all hover:bg-[#ff006e]/10 text-[#ff006e] border-[#ff006e]/30">
            ⚡ Test SMTP Protocol
          </button>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-3 pt-6">
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 px-6 py-4 rounded-xl text-white text-[11px] uppercase tracking-widest font-black shadow-[0_0_20px_rgba(108,92,231,0.3)] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
          <Save className="w-4 h-4" /> {isSaving ? "Deploying Node..." : "Apply & Publish Updates"}
        </motion.button>
        {savedMsg && (
          <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 bg-[#2ed573]/10 text-[#2ed573] border border-[#2ed573]/20 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider">
            <CheckCircle className="w-4 h-4" /> {savedMsg}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CMS & CONTENT TABS (Blog, Gallery, Pages)
// ═══════════════════════════════════════════════════════════
function BlogTab() {
  const { isDark } = useTheme();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<any | null>(null);

  useEffect(() => {
    adminFetch("/api/blogs").then(data => {
      if (data?.blogs) setPosts(data.blogs);
      setLoading(false);
    });
  }, []);

  const savePosts = async (newPosts: any[]) => {
    setPosts(newPosts);
    await adminFetch("/api/blogs", { method: "POST", body: JSON.stringify({ blogs: newPosts }) });
  };

  const handleCreate = () => {
    const fresh = { 
      id: Date.now(), title: "New Draft Post", excerpt: "Start writing here...", 
      status: "Draft", date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 
      author: "Admin", category: "News", image: "https://images.unsplash.com/photo-1620021976092-23f0d4ca0411?auto=format&fit=crop&q=80&w=2000" 
    };
    const freshPosts = [...posts, fresh];
    savePosts(freshPosts);
    setEditingPost(fresh);
  };

  const handleDelete = (id: number) => {
    savePosts(posts.filter(x => x.id !== id));
  };
  
  const toggleStatus = (id: number) => {
    savePosts(posts.map(x => x.id === id ? { ...x, status: x.status === "Published" ? "Draft" : "Published" } : x));
  };

  const saveEdit = () => {
    if (!editingPost) return;
    savePosts(posts.map(x => x.id === editingPost.id ? editingPost : x));
    setEditingPost(null);
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-gray-500">Loading Blog CMS...</div>;

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Blog CMS</h2>
        <button onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl text-white shadow transition-all hover:opacity-80" style={{ background: "#ff006e" }}>
          <FilePlus2 className="w-4 h-4" /> Create Post
        </button>
      </div>
      <div className="overflow-y-auto custom-scrollbar rounded-2xl" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div className="grid gap-3 pr-1">
        {posts.map(p => (
           <div key={p.id} className="p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
             <div className="flex items-center gap-4">
               <img src={p.image} alt="Blog thumbnail" className="w-16 h-16 rounded-lg object-cover" />
               <div>
                 <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{p.title}</p>
                 <p className="text-[10px] uppercase font-bold tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>{p.date} • {p.author} • {p.category}</p>
                 <p className="text-xs mt-1 max-w-md truncate" style={{ color: "var(--text-secondary)" }}>{p.excerpt}</p>
               </div>
             </div>
             <div className="flex items-center gap-3">
               <button onClick={() => toggleStatus(p.id)} className="text-[10px] font-bold px-2 py-1 rounded border hover:opacity-80 transition-opacity whitespace-nowrap" style={{ color: p.status === "Published" ? "#2ed573" : "#ffbe0b", borderColor: "transparent", background: "rgba(0,0,0,0.1)" }}>{p.status}</button>
               <button className="p-2 rounded-xl border hover:bg-black/5 transition-colors" style={{ borderColor: "var(--border-subtle)", color: "#00d4ff" }} onClick={() => setEditingPost(p)}><FileEdit className="w-4 h-4" /></button>
               <button className="p-2 rounded-xl border hover:bg-black/5 transition-colors" style={{ borderColor: "var(--border-subtle)", color: "#ff006e" }} onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></button>
             </div>
           </div>
        ))}
        {posts.length === 0 && <div className="text-center py-10 text-sm text-gray-500">No blog posts yet.</div>}
        </div>
      </div>

      {editingPost && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={() => setEditingPost(null)}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-7 shadow-2xl border"
            style={{ background: isDark ? "rgba(16,16,30,0.98)" : "rgba(255,255,255,0.98)", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
            <h3 className="text-xl font-black mb-6" style={{ color: "var(--text-primary)" }}>Edit Blog Post</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-muted)" }}>Title</label>
                <input type="text" value={editingPost.title} onChange={e => setEditingPost({...editingPost, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-muted)" }}>Author</label>
                  <input type="text" value={editingPost.author} onChange={e => setEditingPost({...editingPost, author: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-muted)" }}>Category</label>
                  <input type="text" value={editingPost.category} onChange={e => setEditingPost({...editingPost, category: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-muted)" }}>Image URL</label>
                <input type="text" value={editingPost.image} onChange={e => setEditingPost({...editingPost, image: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--text-muted)" }}>Excerpt / Content</label>
                <textarea value={editingPost.excerpt} onChange={e => setEditingPost({...editingPost, excerpt: e.target.value})} rows={5}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm resize-y" style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingPost(null)} className="flex-1 py-3 rounded-xl font-bold transition-colors"
                style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={saveEdit} className="flex-1 py-3 rounded-xl font-bold text-white shadow-lg"
                style={{ background: "#ff006e" }}>Save Changes</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function GalleryTab() {
  const { isDark } = useTheme();
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    const data = await adminFetch("/api/admin/media");
    if (data?.assets) setImages(data.assets);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleUpload = async (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = async ev => {
        const payload = {
          url: ev.target?.result as string,
          name: file.name,
          size: (file.size/1024).toFixed(1)+" KB",
          type: file.type
        };
        await adminFetch("/api/admin/media", { method: "POST", body: JSON.stringify(payload) });
        fetchMedia();
      };
      r.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/media/${id}`, { method: "DELETE" });
    fetchMedia();
  };

  if (loading) return <div className="text-center py-20 animate-pulse text-gray-500">Syncing Media Protocol...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <Image className="w-6 h-6 text-[#ffbe0b]" /> Media Gallery
        </h2>
        <label className="flex items-center gap-2 px-4 py-2 font-bold text-xs rounded-xl text-[#ffbe0b] border border-[#ffbe0b]/30 bg-[#ffbe0b]/10 cursor-pointer hover:bg-[#ffbe0b]/20 transition-all">
          <UploadCloud className="w-4 h-4" /> Upload Asset
          <input type="file" hidden accept="image/*" onChange={handleUpload} />
        </label>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {images.map(img => (
          <div key={img.id} className="relative group rounded-2xl overflow-hidden border bg-white/5 aspect-square" style={{ borderColor: "var(--border-subtle)" }}>
             <img src={img.url} className="w-full h-full object-cover" alt={img.name} />
             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-none">
               <p className="text-xs text-white font-bold truncate">{img.name}</p>
               <p className="text-[10px] text-gray-300">{img.size}</p>
             </div>
             <button onClick={() => handleDelete(img.id)} className="absolute top-2 right-2 p-1.5 bg-[#ff006e] text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:scale-110">
               <Trash2 className="w-3 h-3" />
             </button>
          </div>
        ))}
        {images.length === 0 && (
          <div className="col-span-full py-20 text-center rounded-3xl border border-dashed border-white/10" style={{ color: "var(--text-muted)" }}>
             No assets cached in the cloud.
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const { isDark } = useTheme();
  const [analytics, setAnalytics] = useState<{ growth: any[], roles: any[] }>({ growth: [], roles: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/analytics").then(data => {
      if (data) setAnalytics(data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-20 animate-pulse text-gray-500">Loading Analytics...</div>;

  const maxCount = Math.max(...analytics.growth.map(d => d.count), 1);
  const color = "#00d4ff";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <LineChart className="w-8 h-8" style={{ color }} /> Analytics
        </h2>
      </div>

      <div className="p-6 rounded-2xl border flex flex-col gap-8" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
         <div>
           <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>User Growth (Last 30 Days)</h3>
           <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Real-time database signups</p>
         </div>
         
         <div className="flex items-end gap-1.5 h-40 w-full">
           {analytics.growth.map((d, i) => (
             <div key={i} className="flex-1 rounded-t-lg transition-all hover:brightness-125 relative group" 
               style={{ height: `${(d.count / maxCount) * 100}%`, background: `linear-gradient(to top, ${color}40, ${color})` }}>
               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                 {d.date}: {d.count} users
               </div>
             </div>
           ))}
           {analytics.growth.length === 0 && <div className="w-full text-center text-xs text-gray-500 pb-10 italic">Insufficient data for growth trends.</div>}
         </div>

         <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t" style={{ borderColor: "var(--border-subtle)" }}>
            {analytics.roles.map(r => (
              <div key={r.role}>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{r.role}</p>
                 <p className="text-2xl font-black mt-1" style={{ color }}>{r.count}</p>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}

function AuditLogsTab() {
  const { isDark } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/audit-logs").then(data => {
      if (data?.logs) setLogs(data.logs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-20 animate-pulse text-gray-500">Decrypting Module Data...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-tight flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
          <ClipboardList className="w-8 h-8 text-[#2ed573]" /> Audit Logs
        </h2>
      </div>

      <div className="rounded-2xl border bg-black font-mono text-[10px] overflow-hidden flex flex-col" style={{ borderColor: "var(--border-subtle)", minHeight: "300px" }}>
         <div className="flex gap-2 p-4 border-b border-white/10 bg-white/5">
           {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
           <span className="text-gray-500 ml-2 uppercase tracking-widest text-[9px]">Secure Audit Terminal</span>
         </div>
         <div className="p-4 space-y-1 overflow-y-auto max-h-[600px] custom-scrollbar">
           {logs.map((l, i) => (
             <p key={i} className="text-[#2ed573] leading-relaxed">
               <span className="opacity-50">[{new Date(l.timestamp).toLocaleString()}]</span> 
               <span className="text-[#00d4ff] mx-2">[{l.admin_username}]</span>
               <span className="font-bold">{l.action}</span> 
               {l.target && <span className="text-white"> → {l.target}</span>}
               {l.details && <span className="opacity-70 ml-2 italic">({l.details})</span>}
             </p>
           ))}
           {logs.length === 0 && <p className="text-gray-600">No administrative logs recorded in current epoch.</p>}
         </div>
      </div>
    </div>
  );
}


function SecurityTab() {
  const { isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", msg: "" });
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !password) return;
    setLoading(true);
    setStatus({ type: "", msg: "" });
    const res = await adminFetch("/api/admin/update-credentials", {
      method: "POST",
      body: JSON.stringify({ newEmail: email, newPassword: password })
    });
    setLoading(false);
    if (res?.status === "success") {
      setStatus({ type: "success", msg: "Security credentials updated successfully. Next login will require these." });
      setEmail("");
      setPassword("");
    } else {
      setStatus({ type: "error", msg: res?.error || "Failed to update security context." });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4 border-b pb-6" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: "linear-gradient(135deg, #ff006e, #ffbe0b)" }}>
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Security Config</h2>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Manage Admin Access Identity</p>
        </div>
      </div>

      <div className="p-6 rounded-3xl border relative overflow-hidden group" style={{ background: isDark ? "rgba(255,255,255,0.02)" : "#fff", borderColor: "var(--border-subtle)" }}>
        <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 rounded-full blur-[80px] pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity" style={{ background: "radial-gradient(circle, #ff006e 0%, transparent 70%)" }} />
        
        <form onSubmit={handleUpdate} className="relative z-10 flex flex-col gap-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-secondary)" }}>Update Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="email" placeholder="New Email Address" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl outline-none text-sm font-medium transition-all"
                style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: "var(--text-secondary)" }}>Update Master Password</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="password" placeholder="Leave blank to keep current" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl outline-none text-sm font-medium transition-all"
                style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {status.msg && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className={`text-xs font-bold px-4 py-3 rounded-xl border flex items-center gap-2 ${status.type === 'success' ? 'bg-[#2ed573]/10 text-[#2ed573] border-[#2ed573]/20' : 'bg-[#ff006e]/10 text-[#ff006e] border-[#ff006e]/20'}`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {status.msg}
            </motion.p>
          )}

          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} disabled={loading || (!email && !password)} type="submit"
            className="w-full py-4 rounded-xl text-white font-black tracking-widest uppercase text-xs shadow-xl disabled:opacity-50 transition-all border border-white/10 mt-2"
            style={{ background: "linear-gradient(135deg, #ff006e, #ffbe0b)" }}>
            {loading ? "Deploying Update..." : "Confirm Security Changes"}
          </motion.button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN ADMIN PANEL
// ═══════════════════════════════════════════════════════════
export default function AdminPanel() {
  const { isDark } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [otpStep, setOtpStep] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalStories: 0, totalConnections: 0, pendingRequests: 0, onlineUsers: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const session = sessionStorage.getItem("nexora_admin_session");
    if (session === "active") setIsAuthenticated(true);
    setIsReady(true);
  }, []);

  const fetchStats = useCallback(async () => {
    const data = await adminFetch("/api/admin/stats");
    if (data) setStats(data);
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated, fetchStats]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      if (otpStep) {
        const res = await adminFetch("/api/admin/verify-login", {
          method: "POST", body: JSON.stringify({ email: emailInput, otp: otpInput })
        });
        
        if (res?.status === "success" && res?.token) {
          localStorage.setItem("nexora_token", res.token);
          sessionStorage.setItem("nexora_admin_session", "active");
          setIsAuthenticated(true);
        } else {
          setErrorMsg(res?.error || "Invalid OTP segment.");
        }
      } else {
        const res = await adminFetch("/api/admin/login", {
          method: "POST", body: JSON.stringify({ email: emailInput, password: passInput })
        });

        if (res?.status === "success" && res?.requireOtp) {
          setOtpStep(true);
          
          // DEV FALLBACK
          if (res.devOtp || (res.message && res.message.includes("Dev Fallback"))) {
            alert(res.message || `Dev Fallback ADMIN OTP: ${res.devOtp}`);
          }
        } else {
          setErrorMsg(res?.error || "Authentication Intercepted.");
        }
      }
    } catch (err) {
      setErrorMsg("Protocol Error: Uplink failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("nexora_admin_session");
    setIsAuthenticated(false);
    setActiveTab("overview");
  };

  if (!isReady) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-main)" }}>
      <AnimatePresence mode="wait">
        {/* ═════════════ LOGIN ═════════════ */}
        {!isAuthenticated && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}
            className="flex items-center justify-center min-h-screen p-6">

            {/* Background glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: "rgba(108,92,231,0.12)" }} />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px]" style={{ background: "rgba(0,212,255,0.08)" }} />
            </div>

            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-md p-9 rounded-[2rem] shadow-[0_0_80px_rgba(108,92,231,0.08)] border relative overflow-hidden"
              style={{ background: isDark ? "rgba(16,16,30,0.85)" : "rgba(255,255,255,0.85)", borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", backdropFilter: "blur(40px)" }}>

              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
                style={{ background: "rgba(108,92,231,0.12)" }} />

              <div className="flex flex-col items-center text-center relative z-10 mb-8">
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl mb-5"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                  <Shield className="w-8 h-8 text-white" />
                </motion.div>
                <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Admin Portal</h1>
                <p className="text-xs font-medium mt-2" style={{ color: "var(--text-muted)" }}>Nexora Central Command System</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-4 relative z-10">
                <AnimatePresence mode="popLayout">
                  {!otpStep ? (
                    <motion.div key="creds" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        <input type="email" placeholder="Admin Email" value={emailInput} onChange={e => setEmailInput(e.target.value)} required
                          className="w-full pl-11 pr-4 py-3.5 rounded-xl outline-none text-sm transition-all"
                          style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                      </div>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        <input type={showPass ? "text" : "password"} placeholder="Access Code" value={passInput} onChange={e => setPassInput(e.target.value)} required
                          className="w-full pl-11 pr-12 py-3.5 rounded-xl outline-none text-sm transition-all"
                          style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100" style={{ color: "var(--text-muted)" }}>
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="otp" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        <input type="text" placeholder="6-Digit OTP" value={otpInput} onChange={e => setOtpInput(e.target.value)} required maxLength={6}
                          className="w-full pl-11 pr-4 py-3.5 rounded-xl outline-none lg:text-lg font-black tracking-[0.5em] text-center transition-all"
                          style={{ background: isDark ? "rgba(46,213,115,0.05)" : "rgba(46,213,115,0.05)", border: "1px solid rgba(46,213,115,0.3)", color: "#2ed573" }} />
                      </div>
                      <p className="text-[10px] text-center font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-muted)" }}>
                        Verification Sent to <span style={{ color: "#00d4ff" }}>{emailInput}</span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {errorMsg && (
                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] font-black uppercase tracking-widest text-[#ff006e] text-center bg-[#ff006e]/10 py-2.5 rounded-xl border border-[#ff006e]/20">
                    {errorMsg}
                  </motion.p>
                )}

                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={isLoading}
                  className="w-full py-4 mt-3 rounded-xl text-white font-black tracking-widest uppercase text-xs shadow-xl disabled:opacity-50 transition-all border border-white/10"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                  {isLoading ? "Synchronizing..." : (otpStep ? "Verify Payload" : "Initialize Auth")}
                </motion.button>
                
                {otpStep && (
                  <button type="button" onClick={() => setOtpStep(false)} className="text-[10px] font-bold text-[#6c5ce7] mt-3 hover:underline text-center uppercase tracking-widest block w-full">
                    Return to Login
                  </button>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* ═════════════ DASHBOARD ═════════════ */}
        {isAuthenticated && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex min-h-screen">

            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r p-5 sticky top-0 h-screen"
              style={{ background: isDark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)", borderColor: "var(--border-subtle)" }}>

              {/* Logo */}
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-black tracking-tight" style={{ color: "var(--text-primary)" }}>Nexora</h1>
                  <p className="text-[10px] font-bold text-[#6c5ce7]">ADMIN CONSOLE</p>
                </div>
              </div>

              {/* Nav with groups */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <nav className="flex flex-col gap-1.5 pb-20">
                  {Object.entries(
                    TABS.reduce((acc, tab) => {
                      const group = tab.group || "Modules";
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(tab);
                      return acc;
                    }, {} as Record<string, typeof TABS>)
                  ).map(([groupName, groupTabs]) => (
                    <div key={groupName} className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest px-4 mb-2" style={{ color: "var(--text-muted)" }}>
                        {groupName}
                      </p>
                      <div className="flex flex-col gap-1">
                        {groupTabs.map(tab => {
                          const active = activeTab === tab.id;
                          return (
                            <motion.button key={tab.id} whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
                              onClick={() => setActiveTab(tab.id)}
                              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-left"
                              style={{
                                background: active ? `${tab.color}12` : "transparent",
                                color: active ? tab.color : "var(--text-secondary)"
                              }}>
                              <tab.icon className="w-4 h-4" />
                              {tab.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>

              {/* Logout */}
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold mt-auto transition-colors"
                style={{ color: "#ff006e" }}>
                <LogOut className="w-4.5 h-4.5" /> Lock Terminal
              </button>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 flex flex-col min-w-0">
              {/* Top bar (mobile nav + header) */}
              <header className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b"
                style={{ background: isDark ? "rgba(10,10,18,0.9)" : "rgba(255,255,255,0.9)", borderColor: "var(--border-subtle)", backdropFilter: "blur(20px)" }}>

                {/* Mobile tab selector */}
                <div className="lg:hidden flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <select value={activeTab} onChange={e => setActiveTab(e.target.value as TabId)}
                    className="bg-transparent font-bold text-sm outline-none" style={{ color: "var(--text-primary)" }}>
                    {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>

                <div className="hidden lg:block">
                  <h2 className="text-lg font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                    {TABS.find(t => t.id === activeTab)?.label}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full hidden sm:block"
                    style={{ background: "rgba(46,213,115,0.1)", color: "#2ed573" }}>
                    <Activity className="w-3 h-3 inline mr-1" /> {stats.onlineUsers} ONLINE
                  </span>
                  <button onClick={handleLogout} className="lg:hidden p-2 rounded-xl" style={{ color: "#ff006e" }}>
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </header>

              {/* Content */}
              <div className="flex-1 p-6 lg:p-8 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                    {activeTab === "overview" && <OverviewTab stats={stats} onRefresh={fetchStats} />}
                    {activeTab === "users" && <UsersTab />}
                    {activeTab === "connections" && <ConnectionsTab />}
                    {activeTab === "templates" && <EmailTemplatesTab />}
                    {activeTab === "broadcast" && <BroadcastTab />}
                    {activeTab === "blog" && <BlogTab />}
                    {activeTab === "gallery" && <GalleryTab />}
                    {activeTab === "analytics" && <AnalyticsTab />}
                    {activeTab === "audit_logs" && <AuditLogsTab />}
                    {activeTab === "security" && <SecurityTab />}
                    {activeTab === "safety" && <SafetyTab />}

                    {/* Highly Functional SEO / configuration forms! */}
                    {["config", "seo_manager", "keywords", "google_bing", "indexing"].includes(activeTab) && (
                      <DynamicConfigTab activeTab={activeTab} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
